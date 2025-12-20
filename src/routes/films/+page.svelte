<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Film } from '$lib/types';

  let films: Film[] = [];
  let newTitle = '';
  let loading = false;
  let error = '';
  let success = '';

  onMount(async () => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    await loadFilms();

    return unsubscribe;
  });

  async function loadFilms() {
    try {
      const data = await api.getFilms();
      films = data.films;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load films';
    }
  }

  async function handleAddFilm(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    error = '';
    success = '';
    loading = true;

    try {
      await api.addFilm(newTitle.trim());
      success = 'Film added successfully!';
      newTitle = '';
      await loadFilms();
      setTimeout(() => { success = ''; }, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to add film';
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this film?')) return;

    error = '';
    try {
      await api.deleteFilm(id);
      await loadFilms();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete film';
    }
  }
</script>

<div class="min-h-screen pb-20" style="background-color: #0A0A0A;">
  <div class="container mx-auto p-4 max-w-2xl">
    <h1 class="text-4xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
      🎬 Nominated Films
    </h1>

    <form class="mb-6" on:submit={handleAddFilm}>
      <div class="join w-full shadow-lg">
        <input
          type="text"
          placeholder="Enter film title..."
          class="input input-bordered join-item flex-1 border-primary/30 focus:border-primary"
          style="background-color: #2A2A2A;"
          bind:value={newTitle}
          disabled={loading}
          required
        />
        <button class="btn btn-primary join-item shadow-lg shadow-primary/50" type="submit" disabled={loading}>
          {loading ? 'Adding...' : 'Add Film'}
        </button>
      </div>
    </form>

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

    {#if films.length === 0}
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
            d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
          />
        </svg>
        <p class="text-xl opacity-50">No films nominated yet</p>
        <p class="opacity-40 mt-2">Add your first film above!</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each films as film}
          <div class="card shadow-lg border border-primary/20 hover:border-primary/50 transition-all" style="background-color: #2A2A2A;">
            <div class="card-body p-4 flex-row justify-between items-center">
              <h2 class="card-title text-lg">{film.title}</h2>
              <button
                class="btn btn-sm btn-error btn-outline hover:shadow-lg hover:shadow-error/50 transition-all"
                on:click={() => handleDelete(film.id)}
              >
                Delete
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
