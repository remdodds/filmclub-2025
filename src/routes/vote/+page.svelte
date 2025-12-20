<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { VotingRound } from '$lib/types';

  let votingRound: VotingRound | null = null;
  let votes: Record<string, number> = {};
  let loading = false;
  let error = '';
  let success = '';

  const voteLabels = [
    'I hate this idea',
    'Meh, I guess',
    'Sounds good!',
    'Yes! Let\'s watch this!'
  ];

  onMount(async () => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    await loadVotingRound();

    return unsubscribe;
  });

  async function loadVotingRound() {
    try {
      const data = await api.getCurrentVoting();
      votingRound = data.votingRound;

      if (votingRound?.yourVotes) {
        votes = { ...votingRound.yourVotes };
      } else if (votingRound?.films) {
        votes = {};
        votingRound.films.forEach(film => {
          votes[film.id] = 0;
        });
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load voting round';
    }
  }

  async function handleSubmit() {
    if (!votingRound) return;

    error = '';
    success = '';
    loading = true;

    try {
      await api.submitVotes(votes);
      success = 'Votes submitted successfully!';
      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to submit votes';
    } finally {
      loading = false;
    }
  }

  function setVote(filmId: string, score: number) {
    votes[filmId] = score;
  }
</script>

<div class="min-h-screen pb-20" style="background-color: #0A0A0A;">
  <div class="container mx-auto p-4 max-w-2xl">
    <h1 class="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      ⭐ Vote for Films
    </h1>

    {#if error}
      <div class="alert alert-error mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
      </div>
    {/if}

    {#if success}
      <div class="alert alert-success mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{success}</span>
      </div>
    {/if}

    {#if !votingRound}
      <div class="text-center py-12">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-24 w-24 mx-auto mb-4 opacity-30"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p class="text-xl opacity-50">No active voting round</p>
        <p class="opacity-40 mt-2">Check back later when voting opens!</p>
      </div>
    {:else if votingRound.status === 'closed'}
      <div class="alert alert-warning">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="stroke-current shrink-0 h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <span>Voting has closed</span>
      </div>
    {:else}
      <div class="mb-6">
        <div class="p-4 rounded-lg mb-4 border border-accent/30 shadow-lg" style="background-color: #2A2A2A;">
          <p class="text-sm font-semibold text-accent">Rate each film from 0-3 stars</p>
          <p class="text-xs opacity-70 mt-1">
            0 = Hate it • 1 = Meh • 2 = Good • 3 = Love it!
          </p>
        </div>

        <div class="space-y-4">
          {#each votingRound.films as film}
            <div class="card shadow-lg border border-primary/20 hover:border-primary/50 transition-all" style="background-color: #2A2A2A;">
              <div class="card-body p-4">
                <h2 class="card-title text-lg mb-3">{film.title}</h2>

                <div class="flex gap-2 justify-center">
                  {#each [0, 1, 2, 3] as score}
                    <button
                      class="btn btn-circle {votes[film.id] >= score ? 'btn-accent shadow-lg shadow-accent/50' : 'btn-outline'} transition-all hover:scale-110"
                      on:click={() => setVote(film.id, score)}
                      disabled={loading}
                      aria-label="Rate {score} stars"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-6 w-6"
                        fill="{votes[film.id] >= score ? 'currentColor' : 'none'}"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  {/each}
                </div>

                <p class="text-sm text-center mt-2 opacity-70">
                  {voteLabels[votes[film.id]]}
                </p>
              </div>
            </div>
          {/each}
        </div>

        <button
          class="btn btn-primary btn-lg w-full mt-6 shadow-xl shadow-primary/50 hover:shadow-2xl hover:shadow-primary/70 transition-all"
          on:click={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Votes'}
        </button>
      </div>
    {/if}
  </div>
</div>
