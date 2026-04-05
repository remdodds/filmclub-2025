<!--
  Voting History Page

  Displays a chronological list of completed voting rounds.
  Each round shows the winner (if any), the date, vote count, and number of films.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { VotingHistoryRecord } from '$lib/types';

  let history: VotingHistoryRecord[] = [];
  let loading = true;
  let error = '';

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

  /**
   * Loads voting history from the API
   * Fetches all completed voting rounds ordered by most recent first
   */
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

  /**
   * Formats a date for display in British format (e.g., "24 Dec 2025")
   * @param date - Date object or ISO string to format
   * @returns Formatted date string
   */
  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
              <div class="flex justify-between items-center">
                <div>
                  <h2 class="card-title text-2xl">
                    {#if round.winner}
                      <span class="text-primary">{round.winner.title}</span>
                      {#if round.condorcetWinner}
                        <span class="badge badge-success badge-sm">Condorcet Winner</span>
                      {/if}
                    {:else}
                      <span class="text-base-content/50">No votes</span>
                    {/if}
                  </h2>
                  <div class="text-sm text-base-content/70 mt-1">
                    <span>{formatDate(round.closedAt)}</span>
                    {#if round.totalBallots > 0}
                      <span class="mx-2">•</span>
                      <span>{round.totalBallots} {round.totalBallots === 1 ? 'vote' : 'votes'}</span>
                      <span class="mx-2">•</span>
                      <span>{round.candidateCount} {round.candidateCount === 1 ? 'film' : 'films'}</span>
                    {/if}
                  </div>
                </div>
              </div>
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
</style>
