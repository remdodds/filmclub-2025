<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { VotingHistoryRecord } from '$lib/types';

  let history: VotingHistoryRecord[] = [];
  let loading = true;
  let error = '';
  let expandedRound: string | null = null;

  onMount(async () => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    await loadHistory();

    return unsubscribe;
  });

  async function loadHistory() {
    loading = true;
    error = '';
    try {
      const data = await api.getVotingHistory();
      history = data.history;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load voting history';
    } finally {
      loading = false;
    }
  }

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function toggleExpand(roundId: string) {
    expandedRound = expandedRound === roundId ? null : roundId;
  }

  function getScoreColor(score: number, maxScore: number): string {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-warning';
    return 'text-error';
  }

  function getMedalEmoji(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }
</script>

<div class="min-h-screen pb-20" style="background-color: #0A0A0A;">
  <div class="container mx-auto p-4 max-w-4xl">
    <h1 class="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      📊 Voting History
    </h1>

    {#if loading}
      <div class="flex justify-center items-center h-64">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    {:else if error}
      <div class="alert alert-error">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{error}</span>
      </div>
    {:else if history.length === 0}
      <div class="card shadow-xl border border-primary/20" style="background-color: #1A1A1A;">
        <div class="card-body text-center">
          <p class="text-lg text-base-content/70">No voting history yet. Complete your first voting round to see results here!</p>
        </div>
      </div>
    {:else}
      <div class="space-y-4">
        {#each history as round}
          <div class="card shadow-xl border border-primary/20 hover:border-primary/40 transition-all" style="background-color: #1A1A1A;">
            <div class="card-body">
              <!-- Round Header -->
              <div class="flex justify-between items-start mb-4">
                <div>
                  <h2 class="card-title text-2xl">
                    {#if round.winner}
                      <span class="text-primary">{round.winner.title}</span>
                      {#if round.condorcetWinner}
                        <span class="badge badge-success badge-sm">Condorcet Winner</span>
                      {/if}
                    {:else}
                      <span class="text-base-content/50">No Winner</span>
                    {/if}
                  </h2>
                  <div class="text-sm text-base-content/70 mt-1">
                    <span>{formatDate(round.closedAt)}</span>
                    <span class="mx-2">•</span>
                    <span>{round.totalBallots} {round.totalBallots === 1 ? 'vote' : 'votes'}</span>
                    <span class="mx-2">•</span>
                    <span>{round.candidateCount} {round.candidateCount === 1 ? 'film' : 'films'}</span>
                  </div>
                </div>
                <button
                  class="btn btn-sm btn-ghost"
                  on:click={() => toggleExpand(round.roundId)}
                >
                  {expandedRound === round.roundId ? '▲ Hide Details' : '▼ Show Details'}
                </button>
              </div>

              <!-- Top 3 Summary -->
              {#if round.rankings.length > 0}
                <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4">
                  {#each round.rankings.slice(0, 3) as ranking}
                    <div
                      class="p-3 rounded-lg border {ranking.rank === 1 ? 'border-primary winner-card' : 'border-base-300'}"
                      style={ranking.rank !== 1 ? 'background-color: #2A2A2A;' : ''}
                    >
                      <div class="flex items-center gap-2">
                        <span class="text-2xl">{getMedalEmoji(ranking.rank)}</span>
                        <div class="flex-1 min-w-0">
                          <div class="font-semibold truncate">{ranking.title}</div>
                          <div class="text-xs text-base-content/70">
                            Avg: {ranking.averageScore.toFixed(2)} • Total: {ranking.totalScore}
                          </div>
                        </div>
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}

              <!-- Expanded Details -->
              {#if expandedRound === round.roundId}
                <div class="divider"></div>

                <!-- Full Rankings Table -->
                <div class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Film</th>
                        <th>Avg Score</th>
                        <th>Total Score</th>
                        <th>Head-to-Head</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each round.rankings as ranking}
                        <tr class:font-bold={ranking.rank === 1}>
                          <td>
                            <span class="flex items-center gap-2">
                              {getMedalEmoji(ranking.rank)}
                              <span class:text-primary={ranking.rank === 1}>#{ranking.rank}</span>
                            </span>
                          </td>
                          <td>
                            <div>
                              <div class:text-primary={ranking.rank === 1}>{ranking.title}</div>
                              {#if ranking.nominatedBy}
                                <div class="text-xs text-base-content/50">by {ranking.nominatedBy}</div>
                              {/if}
                            </div>
                          </td>
                          <td>
                            <span class={getScoreColor(ranking.averageScore, 3)}>
                              {ranking.averageScore.toFixed(2)}
                            </span>
                          </td>
                          <td>{ranking.totalScore}</td>
                          <td>
                            <span class="text-success">{ranking.pairwiseWins}W</span>
                            <span class="mx-1">-</span>
                            <span class="text-error">{ranking.pairwiseLosses}L</span>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>

                <!-- Algorithm Info -->
                <div class="mt-4 p-3 rounded-lg" style="background-color: #2A2A2A;">
                  <div class="text-xs text-base-content/70">
                    <span class="font-semibold">Algorithm:</span> {round.algorithm}
                    {#if round.condorcetWinner}
                      <span class="ml-2">• Clear winner beats all other films in head-to-head comparisons</span>
                    {/if}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(.bg-clip-text) {
    -webkit-background-clip: text;
    background-clip: text;
  }

  .winner-card {
    background-color: rgba(139, 92, 246, 0.05);
  }
</style>
