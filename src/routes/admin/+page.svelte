<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';

  interface Candidate {
    id: string;
    title: string;
    addedBy?: string;
  }

  interface Vote {
    filmId: string;
    score: number;
  }

  interface Ballot {
    visitorId: string;
    votes: Vote[];
    submittedAt: string | Date;
  }

  interface VotingRoundInfo {
    id: string;
    openedAt: string | Date;
    closesAt: string | Date;
  }

  interface AdminVotesData {
    isOpen: boolean;
    votingRound: VotingRoundInfo | null;
    candidates: Candidate[];
    ballots: Ballot[];
    totalBallots: number;
  }

  let data: AdminVotesData | null = null;
  let loading = true;
  let error = '';
  let selectingWinner = false;
  let winnerResult = '';
  let winnerError = '';

  onMount(async () => {
    await loadVotes();
  });

  async function loadVotes() {
    loading = true;
    error = '';
    try {
      data = await api.getAdminVotes();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load votes';
    } finally {
      loading = false;
    }
  }

  async function handleSelectWinner() {
    selectingWinner = true;
    winnerResult = '';
    winnerError = '';
    try {
      const result = await api.selectWinner();
      winnerResult = result.message || 'Winner selected successfully';
      // Reload votes data to reflect the now-closed round
      await loadVotes();
    } catch (err) {
      winnerError = err instanceof Error ? err.message : 'Failed to select winner';
    } finally {
      selectingWinner = false;
    }
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getStars(score: number): string {
    return '★'.repeat(score) + '☆'.repeat(3 - score);
  }

  function getScoreForFilm(ballot: Ballot, filmId: string): number | null {
    const vote = ballot.votes.find((v) => v.filmId === filmId);
    return vote !== undefined ? vote.score : null;
  }

  function getScoreClass(score: number | null): string {
    if (score === null) return 'text-base-content/30';
    if (score === 3) return 'text-success';
    if (score === 2) return 'text-warning';
    if (score === 1) return 'text-error';
    return 'text-base-content/40';
  }
</script>

<div class="min-h-screen pb-20" style="background-color: #0A0A0A;">
  <div class="container mx-auto p-4 max-w-5xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Admin Panel
        </h1>
        <p class="text-base-content/50 mt-1 text-sm">Current voting round overview</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm" on:click={loadVotes} disabled={loading}>
          {loading ? '...' : 'Refresh'}
        </button>
        <button class="btn btn-ghost btn-sm" on:click={() => goto('/home')}>
          ← Back
        </button>
      </div>
    </div>

    {#if loading}
      <div class="flex justify-center items-center h-64">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    {:else if error}
      <div class="alert alert-error">
        <span>{error}</span>
      </div>
    {:else if data}

      <!-- Voting Round Status -->
      <div class="card shadow-xl border mb-6 {data.isOpen ? 'border-success/30' : 'border-base-300/30'}" style="background-color: #1A1A1A;">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="card-title text-xl">Voting Round Status</h2>
              {#if data.isOpen && data.votingRound}
                <div class="text-sm text-base-content/70 mt-1 space-y-0.5">
                  <div>Opened: {formatDate(data.votingRound.openedAt)}</div>
                  <div>Closes: {formatDate(data.votingRound.closesAt)}</div>
                </div>
              {/if}
            </div>
            <div class="badge {data.isOpen ? 'badge-success' : 'badge-ghost'} badge-lg">
              {data.isOpen ? 'Open' : 'Closed / No active round'}
            </div>
          </div>

          {#if data.isOpen}
            <div class="divider my-2"></div>

            <!-- Stats row -->
            <div class="flex gap-6 text-center">
              <div>
                <div class="text-3xl font-bold text-primary">{data.totalBallots}</div>
                <div class="text-xs text-base-content/50 uppercase tracking-wide">
                  {data.totalBallots === 1 ? 'Vote cast' : 'Votes cast'}
                </div>
              </div>
              <div>
                <div class="text-3xl font-bold text-accent">{data.candidates.length}</div>
                <div class="text-xs text-base-content/50 uppercase tracking-wide">
                  {data.candidates.length === 1 ? 'Film' : 'Films'}
                </div>
              </div>
            </div>

            <div class="divider my-2"></div>

            <!-- Select Winner Button -->
            <div>
              {#if winnerResult}
                <div class="alert alert-success mb-3">
                  <span>{winnerResult}</span>
                </div>
              {/if}
              {#if winnerError}
                <div class="alert alert-error mb-3">
                  <span>{winnerError}</span>
                </div>
              {/if}
              <div class="flex items-center gap-4">
                <button
                  class="btn btn-primary"
                  on:click={handleSelectWinner}
                  disabled={selectingWinner}
                >
                  {#if selectingWinner}
                    <span class="loading loading-spinner loading-sm"></span>
                    Running algorithm...
                  {:else}
                    Run Winner Selection
                  {/if}
                </button>
                <p class="text-xs text-base-content/50">
                  Runs the Condorcet algorithm and closes the voting round
                </p>
              </div>
            </div>
          {/if}
        </div>
      </div>

      {#if !data.isOpen}
        <!-- No active round - still allow triggering in case needed -->
        <div class="card shadow-xl border border-warning/20 mb-6" style="background-color: #1A1A1A;">
          <div class="card-body">
            <h2 class="card-title text-warning text-sm">No open voting round</h2>
            <p class="text-base-content/50 text-sm">
              There is no active voting round right now. Votes are only collected when a round is open.
            </p>
          </div>
        </div>
      {:else if data.candidates.length === 0}
        <div class="card shadow-xl border border-base-300/20 mb-6" style="background-color: #1A1A1A;">
          <div class="card-body text-center text-base-content/50">
            No films have been nominated yet.
          </div>
        </div>
      {:else if data.ballots.length === 0}
        <div class="card shadow-xl border border-base-300/20 mb-6" style="background-color: #1A1A1A;">
          <div class="card-body text-center text-base-content/50">
            No votes have been cast yet this round.
          </div>
        </div>
      {:else}

        <!-- Votes Table -->
        <div class="card shadow-xl border border-primary/20" style="background-color: #1A1A1A;">
          <div class="card-body">
            <h2 class="card-title text-xl mb-4">Votes Cast This Round</h2>
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide">Voter</th>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide">Submitted</th>
                    {#each data.candidates as film}
                      <th class="text-base-content/50 text-xs uppercase tracking-wide text-center max-w-24">
                        <div class="truncate" title={film.title}>{film.title}</div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each data.ballots as ballot}
                    <tr class="hover:bg-base-200/10">
                      <td>
                        <code class="text-xs text-base-content/60 font-mono">
                          {ballot.visitorId.slice(0, 8)}…
                        </code>
                      </td>
                      <td class="text-xs text-base-content/50">
                        {formatDate(ballot.submittedAt)}
                      </td>
                      {#each data.candidates as film}
                        {@const score = getScoreForFilm(ballot, film.id)}
                        <td class="text-center">
                          {#if score !== null}
                            <span class="text-sm {getScoreClass(score)}" title="Score: {score}/3">
                              {getStars(score)}
                            </span>
                          {:else}
                            <span class="text-base-content/20 text-xs">—</span>
                          {/if}
                        </td>
                      {/each}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>

            <!-- Score legend -->
            <div class="flex gap-4 mt-4 text-xs text-base-content/40">
              <span><span class="text-success">★★★</span> = 3 (Love it)</span>
              <span><span class="text-warning">★★☆</span> = 2 (Like it)</span>
              <span><span class="text-error">★☆☆</span> = 1 (Meh)</span>
              <span><span class="text-base-content/30">☆☆☆</span> = 0 (No thanks)</span>
              <span><span>—</span> = Not rated</span>
            </div>
          </div>
        </div>

      {/if}

    {/if}
  </div>
</div>

<style>
  :global(.bg-clip-text) {
    -webkit-background-clip: text;
    background-clip: text;
  }
</style>
