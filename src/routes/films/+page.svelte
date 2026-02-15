<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Film } from '$lib/types';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import FilmGrain from '$lib/components/FilmGrain.svelte';
  import SpotlightEffect from '$lib/components/SpotlightEffect.svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';
  import { toast } from 'svelte-sonner';

  let films: Film[] = [];
  let newTitle = '';
  let loading = false;
  let deletingId: string | null = null;
  let mounted = false;

  onMount(async () => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    await loadFilms();
    mounted = true;

    return unsubscribe;
  });

  async function loadFilms() {
    try {
      const data = await api.getFilms();
      films = data.films;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load films');
    }
  }

  async function handleAddFilm(e: Event) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    loading = true;

    try {
      await api.addFilm(newTitle.trim());
      toast.success('Film added to nominations!');
      newTitle = '';
      await loadFilms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add film');
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Remove "${title}" from nominations?`)) return;

    deletingId = id;
    try {
      await api.deleteFilm(id);
      toast.success('Film removed');
      await loadFilms();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete film');
    } finally {
      deletingId = null;
    }
  }

  function navigateBack() {
    goto('/home');
  }
</script>

<FilmGrain />
<SpotlightEffect intensity="low" />

<div class="films-page min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-5xl">
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
            Nominations
          </h1>
          <p class="text-small opacity-70 mt-1">
            {films.length} film{films.length === 1 ? '' : 's'} nominated
          </p>
        </div>
      </div>

      <!-- Add Film Section -->
      <div in:fly={{ y: 20, duration: 600, delay: 100, easing: cubicOut }}>
        <CinemaCard variant="velvet" className="mb-8">
          <form class="p-6" on:submit={handleAddFilm}>
            <label for="film-title" class="text-subtitle text-sm uppercase tracking-wider text-gold mb-3 block">
              Add Film
            </label>
            <div class="flex gap-3">
              <input
                id="film-title"
                type="text"
                placeholder="Enter film title..."
                class="input input-bordered flex-1"
                style="background: rgba(26, 26, 26, 0.8); border-color: rgba(212, 175, 55, 0.3); min-height: 48px;"
                bind:value={newTitle}
                disabled={loading}
                required
              />
              <MarqueeButton
                variant="accent"
                size="md"
                type="submit"
                {loading}
              >
                <Icon icon="mdi:ticket-confirmation" class="w-5 h-5" />
                Nominate
              </MarqueeButton>
            </div>
          </form>
        </CinemaCard>
      </div>

      <!-- Films Grid -->
      {#if films.length === 0}
        <div
          class="text-center py-16"
          in:fly={{ y: 20, duration: 600, delay: 200, easing: cubicOut }}
        >
          <Icon
            icon="mdi:movie-open-outline"
            class="w-24 h-24 mx-auto mb-6 opacity-20"
          />
          <h2 class="text-title opacity-50 mb-2">Coming Soon</h2>
          <p class="opacity-40">No films nominated yet. Add your first film above!</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each films as film, i (film.id)}
            <div
              in:scale={{ duration: 400, delay: i * 50, start: 0.9, easing: cubicOut }}
              out:scale={{ duration: 300, start: 1, easing: cubicOut }}
            >
              <CinemaCard variant="poster" spotlight={true} className="film-card">
                <div class="p-6 relative">
                  <div class="flex items-start gap-3">
                    <Icon
                      icon="mdi:filmstrip-box"
                      class="w-8 h-8 flex-shrink-0 mt-1"
                      style="color: var(--accent-gold);"
                    />
                    <div class="flex-1 min-w-0">
                      <h3 class="text-lg font-bold leading-tight break-words">
                        {film.title}
                      </h3>
                    </div>
                  </div>

                  <button
                    on:click={() => handleDelete(film.id, film.title)}
                    disabled={deletingId === film.id}
                    class="btn btn-sm btn-circle btn-outline btn-error absolute top-3 right-3 opacity-0 delete-btn"
                    class:loading={deletingId === film.id}
                    aria-label="Delete {film.title}"
                  >
                    {#if deletingId === film.id}
                      <span class="loading loading-spinner loading-sm"></span>
                    {:else}
                      <Icon icon="mdi:close" class="w-4 h-4" />
                    {/if}
                  </button>
                </div>
              </CinemaCard>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .films-page {
    background: radial-gradient(ellipse at top, rgba(26, 26, 26, 0.6) 0%, var(--bg-theater) 50%);
    position: relative;
  }

  .text-gold {
    color: var(--accent-gold);
  }

  .film-card {
    position: relative;
    min-height: 100px;
  }

  .film-card:hover .delete-btn {
    opacity: 1;
  }

  .delete-btn {
    transition: opacity var(--timing-normal);
  }

  :global(.input:focus) {
    outline: 2px solid var(--accent-gold) !important;
    outline-offset: 2px;
    border-color: var(--accent-gold) !important;
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.15) !important;
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .film-card .delete-btn {
      opacity: 1;
    }
  }
</style>
