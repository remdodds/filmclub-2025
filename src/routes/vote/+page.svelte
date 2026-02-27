<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { VotingRound } from '$lib/types';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import confetti from 'canvas-confetti';
  import FilmGrain from '$lib/components/FilmGrain.svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';
  import StarRating from '$lib/components/StarRating.svelte';
  import { toast } from 'svelte-sonner';

  let votingRound: VotingRound | null = null;
  let votes: Record<string, number> = {};
  let loading = false;
  let mounted = false;

  onMount(async () => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    await loadVotingRound();
    mounted = true;

    return unsubscribe;
  });

  async function loadVotingRound() {
    try {
      const data = await api.getCurrentVoting();

      // Map API response to frontend format
      if (data.votingRound) {
        votingRound = {
          ...data.votingRound,
          films: data.votingRound.candidates || data.votingRound.films || []
        };
      } else {
        votingRound = null;
      }

      if (data.userBallot?.votes) {
        // Convert ballot votes array to Record format
        votes = {};
        data.userBallot.votes.forEach((vote: any) => {
          votes[vote.filmId] = vote.score;
        });
      } else if (votingRound?.films) {
        // Initialize all films with 0 votes
        votes = {};
        votingRound.films.forEach(film => {
          votes[film.id] = 0;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load voting round');
    }
  }

  async function handleSubmit() {
    if (!votingRound) return;

    loading = true;

    try {
      await api.submitVotes(votes);
      toast.success('Votes submitted successfully!');

      // Confetti celebration!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#DC2626', '#FFE4B5']
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit votes');
    } finally {
      loading = false;
    }
  }

  function setVote(filmId: string, score: number) {
    votes[filmId] = score;
  }

  function navigateBack() {
    goto('/home');
  }
</script>

<FilmGrain />

<div class="vote-page min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    {#if mounted}
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8" in:fly={{ y: -20, duration: 600, easing: cubicOut }}>
        <button
          on:click={navigateBack}
          class="btn btn-circle btn-outline hover:btn-accent transition-all"
          aria-label="Back to home"
        >
          <Icon icon="mdi:arrow-left" class="w-6 h-6" />
        </button>
        <div class="flex-1">
          <h1 class="text-headline gold-shimmer">
            Cast Your Votes
          </h1>
          <p class="text-small opacity-70 mt-1">
            Rate each film from 0-3 stars
          </p>
        </div>
      </div>

      {#if !votingRound}
        <!-- No active voting round -->
        <div
          class="text-center py-16"
          in:fly={{ y: 20, duration: 600, delay: 200, easing: cubicOut }}
        >
          <Icon
            icon="mdi:clock-outline"
            class="w-24 h-24 mx-auto mb-6 opacity-20"
          />
          <h2 class="text-title opacity-50 mb-2">No Active Voting Round</h2>
          <p class="opacity-40">Check back later when voting opens!</p>
        </div>
      {:else if votingRound.status === 'closed'}
        <!-- Voting closed -->
        <div in:fly={{ y: 20, duration: 600, delay: 200, easing: cubicOut }}>
          <CinemaCard variant="velvet">
            <div class="p-8 text-center">
              <Icon
                icon="mdi:lock-outline"
                class="w-16 h-16 mx-auto mb-4"
                style="color: var(--accent-gold);"
              />
              <h2 class="text-title mb-2">Voting Has Closed</h2>
              <p class="opacity-70">This voting round is now complete. Check the history for results!</p>
            </div>
          </CinemaCard>
        </div>
      {:else}
        <!-- Voting interface -->
        <div>
          <!-- Info Banner -->
          <div in:fly={{ y: 20, duration: 600, delay: 100, easing: cubicOut }}>
            <CinemaCard variant="velvet" className="mb-8">
              <div class="p-6 text-center">
                <Icon
                  icon="mdi:information-outline"
                  class="w-8 h-8 mx-auto mb-3"
                  style="color: var(--accent-gold);"
                />
                <p class="text-sm font-semibold" style="color: var(--accent-gold);">
                  Rate each film with 0-3 stars
                </p>
                <p class="text-xs opacity-70 mt-2">
                  Your ratings help determine which film wins!
                </p>
              </div>
            </CinemaCard>
          </div>

          <!-- Film cards -->
          <div class="space-y-6 mb-8">
            {#each votingRound.films as film, i (film.id)}
              <div
                in:scale={{ duration: 400, delay: 200 + (i * 100), start: 0.95, easing: cubicOut }}
              >
                <CinemaCard variant="poster">
                  <div class="p-8">
                    <div class="flex items-center gap-4 mb-6">
                      <Icon
                        icon="mdi:movie-open"
                        class="w-10 h-10 flex-shrink-0"
                        style="color: var(--accent-gold);"
                      />
                      <h2 class="text-title flex-1">{film.title}</h2>
                    </div>

                    <div class="flex justify-center">
                      <StarRating
                        rating={votes[film.id]}
                        maxStars={3}
                        onRate={(newRating) => setVote(film.id, newRating)}
                      />
                    </div>
                  </div>
                </CinemaCard>
              </div>
            {/each}
          </div>

          <!-- Submit Button -->
          <div in:fly={{ y: 20, duration: 600, delay: 400, easing: cubicOut }}>
            <MarqueeButton
              variant="accent"
              size="lg"
              {loading}
              disabled={loading}
              className="w-full"
              on:click={handleSubmit}
            >
              <Icon icon="mdi:ballot" class="w-6 h-6" />
              {loading ? 'Submitting Ballot...' : 'Submit Ballot'}
            </MarqueeButton>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .vote-page {
    background: radial-gradient(ellipse at top, rgba(26, 26, 26, 0.6) 0%, var(--bg-theater) 50%);
    position: relative;
  }
</style>
