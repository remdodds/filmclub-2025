<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { auth } from '$lib/stores';

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

  interface HistoryRecord {
    roundId: string;
    openedAt: string | Date;
    closedAt: string | Date;
    winner: { filmId: string; title: string; nominatedBy: string } | null;
    totalBallots: number;
    candidateCount: number;
  }

  // Voting round state
  let data: AdminVotesData | null = null;
  let loading = true;
  let error = '';
  let openingRound = false;
  let openRoundResult = '';
  let openRoundError = '';
  let selectingWinner = false;
  let winnerResult = '';
  let winnerError = '';

  // Clear nominated films state
  let clearingFilms = false;
  let clearFilmsResult = '';
  let clearFilmsError = '';
  let confirmClearFilms = false;

  // Voting history state
  let history: HistoryRecord[] = [];
  let historyLoading = true;
  let historyError = '';

  // History edit state
  let editingRoundId: string | null = null;
  let editTitle = '';
  let savingEdit = false;
  let editError = '';

  // History delete state
  let confirmDeleteRoundId: string | null = null;
  let deletingRoundId: string | null = null;
  let deleteError = '';

  // Change password state
  let currentPassword = '';
  let newPassword = '';
  let confirmNewPassword = '';
  let changingPassword = false;
  let changePasswordResult = '';
  let changePasswordError = '';

  onMount(async () => {
    auth.init();
    const state = get(auth);
    if (!state.isLoggedIn) {
      goto('/');
      return;
    }
    try {
      const check = await api.checkSession();
      if (!check.isAdmin) {
        goto('/home');
        return;
      }
    } catch {
      goto('/home');
      return;
    }
    await Promise.all([loadVotes(), loadHistory()]);
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

  async function loadHistory() {
    historyLoading = true;
    historyError = '';
    try {
      const result = await api.getVotingHistory();
      history = result.history;
    } catch (err) {
      historyError = err instanceof Error ? err.message : 'Failed to load history';
    } finally {
      historyLoading = false;
    }
  }

  async function handleOpenRound() {
    openingRound = true;
    openRoundResult = '';
    openRoundError = '';
    try {
      const result = await api.openRound();
      openRoundResult = result.message || 'Voting round opened';
      await loadVotes();
    } catch (err) {
      openRoundError = err instanceof Error ? err.message : 'Failed to open voting round';
    } finally {
      openingRound = false;
    }
  }

  async function handleSelectWinner() {
    selectingWinner = true;
    winnerResult = '';
    winnerError = '';
    try {
      const result = await api.selectWinner();
      winnerResult = result.message || 'Winner selected successfully';
      await loadVotes();
    } catch (err) {
      winnerError = err instanceof Error ? err.message : 'Failed to select winner';
    } finally {
      selectingWinner = false;
    }
  }

  async function handleClearFilms() {
    if (!confirmClearFilms) {
      confirmClearFilms = true;
      return;
    }
    clearingFilms = true;
    clearFilmsResult = '';
    clearFilmsError = '';
    try {
      const result = await api.clearNominatedFilms();
      clearFilmsResult = result.message;
      confirmClearFilms = false;
      await loadVotes();
    } catch (err) {
      clearFilmsError = err instanceof Error ? err.message : 'Failed to clear films';
      confirmClearFilms = false;
    } finally {
      clearingFilms = false;
    }
  }

  function startEdit(record: HistoryRecord) {
    editingRoundId = record.roundId;
    editTitle = record.winner?.title || '';
    editError = '';
  }

  function cancelEdit() {
    editingRoundId = null;
    editTitle = '';
    editError = '';
  }

  async function saveEdit() {
    if (!editingRoundId || !editTitle.trim()) return;
    savingEdit = true;
    editError = '';
    try {
      await api.updateHistoryRecord(editingRoundId, editTitle.trim());
      const idx = history.findIndex((h) => h.roundId === editingRoundId);
      if (idx >= 0 && history[idx].winner) {
        history[idx] = {
          ...history[idx],
          winner: { ...history[idx].winner!, title: editTitle.trim() },
        };
      }
      editingRoundId = null;
    } catch (err) {
      editError = err instanceof Error ? err.message : 'Failed to save';
    } finally {
      savingEdit = false;
    }
  }

  function requestDelete(roundId: string) {
    confirmDeleteRoundId = roundId;
    deleteError = '';
  }

  function cancelDelete() {
    confirmDeleteRoundId = null;
  }

  async function confirmDelete() {
    if (!confirmDeleteRoundId) return;
    const roundId = confirmDeleteRoundId;
    deletingRoundId = roundId;
    deleteError = '';
    try {
      await api.deleteHistoryRecord(roundId);
      history = history.filter((h) => h.roundId !== roundId);
      confirmDeleteRoundId = null;
    } catch (err) {
      deleteError = err instanceof Error ? err.message : 'Failed to delete';
    } finally {
      deletingRoundId = null;
    }
  }

  async function handleChangePassword() {
    changePasswordError = '';
    changePasswordResult = '';
    if (newPassword !== confirmNewPassword) {
      changePasswordError = 'New passwords do not match.';
      return;
    }
    changingPassword = true;
    try {
      await api.changePassword(currentPassword, newPassword);
      changePasswordResult = 'Password changed successfully.';
      currentPassword = '';
      newPassword = '';
      confirmNewPassword = '';
    } catch (err) {
      changePasswordError = err instanceof Error ? err.message : 'Failed to change password';
    } finally {
      changingPassword = false;
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

  function formatDateShort(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
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
        <button class="btn btn-ghost btn-sm" on:click={() => Promise.all([loadVotes(), loadHistory()])} disabled={loading}>
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
        <!-- No active round — offer to open one -->
        <div class="card shadow-xl border border-primary/20 mb-6" style="background-color: #1A1A1A;">
          <div class="card-body">
            <h2 class="card-title text-xl">Start a New Voting Round</h2>
            <p class="text-base-content/50 text-sm mb-4">
              No round is currently open. Opening a round lets members cast their votes against all nominated films.
            </p>
            {#if openRoundResult}
              <div class="alert alert-success mb-3">
                <span>{openRoundResult}</span>
              </div>
            {/if}
            {#if openRoundError}
              <div class="alert alert-error mb-3">
                <span>{openRoundError}</span>
              </div>
            {/if}
            <div class="flex items-center gap-4">
              <button
                class="btn btn-success"
                on:click={handleOpenRound}
                disabled={openingRound}
              >
                {#if openingRound}
                  <span class="loading loading-spinner loading-sm"></span>
                  Opening round...
                {:else}
                  Open Voting Round
                {/if}
              </button>
              <p class="text-xs text-base-content/50">
                Uses the scheduled close time from club config
              </p>
            </div>
          </div>
        </div>

        <!-- Nominated Films -->
        {#if data.candidates.length > 0}
          <div class="card shadow-xl border border-base-300/20 mb-6" style="background-color: #1A1A1A;">
            <div class="card-body">
              <h2 class="card-title text-xl">Nominated Films</h2>
              <p class="text-base-content/50 text-sm mb-3">
                {data.candidates.length} film{data.candidates.length === 1 ? '' : 's'} waiting to be voted on
              </p>

              <ul class="mb-4 space-y-1">
                {#each data.candidates as film}
                  <li class="text-sm text-base-content/80 flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary inline-block flex-shrink-0"></span>
                    {film.title}
                  </li>
                {/each}
              </ul>

              {#if clearFilmsResult}
                <div class="alert alert-success mb-3">
                  <span>{clearFilmsResult}</span>
                </div>
              {/if}
              {#if clearFilmsError}
                <div class="alert alert-error mb-3">
                  <span>{clearFilmsError}</span>
                </div>
              {/if}

              {#if confirmClearFilms}
                <div class="flex items-center gap-3 flex-wrap">
                  <span class="text-sm text-warning">
                    Clear all {data.candidates.length} nominated film{data.candidates.length === 1 ? '' : 's'}? This cannot be undone.
                  </span>
                  <button
                    class="btn btn-error btn-sm"
                    on:click={handleClearFilms}
                    disabled={clearingFilms}
                  >
                    {#if clearingFilms}
                      <span class="loading loading-spinner loading-xs"></span>
                      Clearing...
                    {:else}
                      Yes, clear all
                    {/if}
                  </button>
                  <button
                    class="btn btn-ghost btn-sm"
                    on:click={() => (confirmClearFilms = false)}
                    disabled={clearingFilms}
                  >
                    Cancel
                  </button>
                </div>
              {:else}
                <button class="btn btn-warning btn-sm w-fit" on:click={handleClearFilms}>
                  Clear All Nominated Films
                </button>
              {/if}
            </div>
          </div>
        {/if}

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
              <table class="table">
                <thead>
                  <tr class="align-bottom">
                    <th class="text-base-content/50 text-xs uppercase tracking-wide whitespace-nowrap">Voter</th>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide whitespace-nowrap">Submitted</th>
                    {#each data.candidates as film}
                      <th class="text-center px-3">
                        <div class="film-header-cell" title={film.title}>{film.title}</div>
                      </th>
                    {/each}
                  </tr>
                </thead>
                <tbody>
                  {#each data.ballots as ballot}
                    <tr class="hover:bg-base-200/10">
                      <td class="py-3">
                        <code class="text-xs text-base-content/60 font-mono whitespace-nowrap">
                          {ballot.visitorId.slice(0, 8)}…
                        </code>
                      </td>
                      <td class="text-xs text-base-content/50 whitespace-nowrap py-3">
                        {formatDate(ballot.submittedAt)}
                      </td>
                      {#each data.candidates as film}
                        {@const score = getScoreForFilm(ballot, film.id)}
                        <td class="text-center px-3 py-3">
                          {#if score !== null}
                            <span class="text-base {getScoreClass(score)}" title="Score: {score}/3">
                              {getStars(score)}
                            </span>
                          {:else}
                            <span class="text-base-content/20 text-sm">—</span>
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

      <!-- Change Club Password -->
      <div class="card shadow-xl border border-base-300/20 mt-6" style="background-color: #1A1A1A;">
        <div class="card-body">
          <h2 class="card-title text-xl mb-1">Change Club Password</h2>
          <p class="text-base-content/50 text-sm mb-4">Update the password members use to log in.</p>

          {#if changePasswordResult}
            <div class="alert alert-success mb-3">
              <span>{changePasswordResult}</span>
            </div>
          {/if}
          {#if changePasswordError}
            <div class="alert alert-error mb-3">
              <span>{changePasswordError}</span>
            </div>
          {/if}

          <form on:submit|preventDefault={handleChangePassword} class="flex flex-col gap-3 max-w-sm">
            <div>
              <label class="label pb-1" for="currentPassword">
                <span class="label-text text-base-content/70 text-xs uppercase tracking-wide">Current password</span>
              </label>
              <input
                id="currentPassword"
                type="password"
                class="input input-bordered input-sm w-full"
                bind:value={currentPassword}
                disabled={changingPassword}
                required
              />
            </div>
            <div>
              <label class="label pb-1" for="newPassword">
                <span class="label-text text-base-content/70 text-xs uppercase tracking-wide">New password</span>
              </label>
              <input
                id="newPassword"
                type="password"
                class="input input-bordered input-sm w-full"
                bind:value={newPassword}
                disabled={changingPassword}
                required
                minlength="8"
              />
            </div>
            <div>
              <label class="label pb-1" for="confirmNewPassword">
                <span class="label-text text-base-content/70 text-xs uppercase tracking-wide">Confirm new password</span>
              </label>
              <input
                id="confirmNewPassword"
                type="password"
                class="input input-bordered input-sm w-full"
                bind:value={confirmNewPassword}
                disabled={changingPassword}
                required
                minlength="8"
              />
            </div>
            <div class="mt-1">
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                disabled={changingPassword || !currentPassword || !newPassword || !confirmNewPassword}
              >
                {#if changingPassword}
                  <span class="loading loading-spinner loading-xs"></span>
                  Changing...
                {:else}
                  Change Password
                {/if}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Voting History Management -->
      <div class="card shadow-xl border border-base-300/20 mt-6" style="background-color: #1A1A1A;">
        <div class="card-body">
          <h2 class="card-title text-xl mb-1">Past Voting Rounds</h2>
          <p class="text-base-content/50 text-sm mb-4">Edit the winner title or delete a round from the record.</p>

          {#if deleteError}
            <div class="alert alert-error mb-3">
              <span>{deleteError}</span>
            </div>
          {/if}

          {#if historyLoading}
            <div class="flex justify-center py-8">
              <span class="loading loading-spinner loading-md text-primary"></span>
            </div>
          {:else if historyError}
            <div class="alert alert-error">
              <span>{historyError}</span>
            </div>
          {:else if history.length === 0}
            <p class="text-base-content/40 text-sm text-center py-6">No past voting rounds yet.</p>
          {:else}
            <div class="overflow-x-auto">
              <table class="table">
                <thead>
                  <tr>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide">Date</th>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide">Winner</th>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide text-center">Ballots</th>
                    <th class="text-base-content/50 text-xs uppercase tracking-wide text-center">Films</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {#each history as record}
                    <tr class="hover:bg-base-200/10 align-middle">
                      <td class="text-sm text-base-content/60 whitespace-nowrap">
                        {formatDateShort(record.closedAt)}
                      </td>
                      <td class="text-sm">
                        {#if editingRoundId === record.roundId}
                          <div class="flex items-center gap-2 flex-wrap">
                            <input
                              class="input input-bordered input-sm w-48"
                              bind:value={editTitle}
                              on:keydown={(e) => e.key === 'Enter' && saveEdit()}
                              disabled={savingEdit}
                              placeholder="Winner title"
                            />
                            <button
                              class="btn btn-success btn-xs"
                              on:click={saveEdit}
                              disabled={savingEdit || !editTitle.trim()}
                            >
                              {#if savingEdit}
                                <span class="loading loading-spinner loading-xs"></span>
                              {:else}
                                Save
                              {/if}
                            </button>
                            <button class="btn btn-ghost btn-xs" on:click={cancelEdit} disabled={savingEdit}>
                              Cancel
                            </button>
                            {#if editError}
                              <span class="text-error text-xs">{editError}</span>
                            {/if}
                          </div>
                        {:else if record.winner}
                          <span class="font-medium">{record.winner.title}</span>
                        {:else}
                          <span class="text-base-content/30 italic">No winner</span>
                        {/if}
                      </td>
                      <td class="text-center text-sm text-base-content/60">{record.totalBallots}</td>
                      <td class="text-center text-sm text-base-content/60">{record.candidateCount}</td>
                      <td>
                        <div class="flex items-center gap-1 justify-end">
                          {#if confirmDeleteRoundId === record.roundId}
                            <span class="text-xs text-warning mr-1">Delete this round?</span>
                            <button
                              class="btn btn-error btn-xs"
                              on:click={confirmDelete}
                              disabled={deletingRoundId === record.roundId}
                            >
                              {#if deletingRoundId === record.roundId}
                                <span class="loading loading-spinner loading-xs"></span>
                              {:else}
                                Yes
                              {/if}
                            </button>
                            <button class="btn btn-ghost btn-xs" on:click={cancelDelete}>No</button>
                          {:else}
                            {#if record.winner && editingRoundId !== record.roundId}
                              <button
                                class="btn btn-ghost btn-xs text-base-content/50"
                                on:click={() => startEdit(record)}
                                title="Edit winner title"
                              >
                                Edit
                              </button>
                            {/if}
                            <button
                              class="btn btn-ghost btn-xs text-error/60"
                              on:click={() => requestDelete(record.roundId)}
                              title="Delete round"
                            >
                              Delete
                            </button>
                          {/if}
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>

    {/if}
  </div>
</div>

<style>
  :global(.bg-clip-text) {
    -webkit-background-clip: text;
    background-clip: text;
  }

  .film-header-cell {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
    font-size: 0.75rem;
    font-weight: 500;
    color: oklch(var(--bc) / 0.6);
    max-height: 8rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
