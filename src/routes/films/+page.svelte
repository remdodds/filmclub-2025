<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Film } from '$lib/types';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';
  import StreamingLogo from '$lib/components/StreamingLogo.svelte';
  import { toast } from 'svelte-sonner';
  import type { StreamingService } from '$lib/types';

  let films: Film[] = [];
  let loading = true;
  let deletingId: string | null = null;
  let mounted = false;
  // undefined = loading, StreamingService[] = result (may be empty)
  let streamingMap: Record<string, StreamingService[] | undefined> = {};

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
    loading = true;
    try {
      const data = await api.getFilms();
      films = data.films;
      loadStreamingAvailability(films.map(f => f.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load films');
    } finally {
      loading = false;
    }
  }

  function loadStreamingAvailability(filmIds: string[]) {
    streamingMap = {};
    for (const id of filmIds) {
      api.getStreamingAvailability(id)
        .then(data => { streamingMap = { ...streamingMap, [id]: data.services }; })
        .catch(() => { streamingMap = { ...streamingMap, [id]: [] }; });
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
</script>

<div class="films-page min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-5xl">
    {#if mounted}
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8" in:fly={{ y: -20, duration: 600, easing: cubicOut }}>
        <button
          on:click={() => goto('/home')}
          class="btn btn-circle btn-outline hover:btn-accent transition-all"
          aria-label="Back to home"
        >
          <Icon icon="mdi:arrow-left" class="w-6 h-6" />
        </button>
        <div class="flex-1">
          <h1 class="text-headline gold-shimmer">
            Nominated Films
          </h1>
          <p class="text-small opacity-70 mt-1">
            {#if loading}
              Loading...
            {:else}
              {films.length} film{films.length === 1 ? '' : 's'} nominated
            {/if}
          </p>
        </div>
        <MarqueeButton
          variant="accent"
          size="md"
          on:click={() => goto('/films/nominate')}
        >
          <Icon icon="mdi:plus" class="w-5 h-5" />
          Nominate a Film
        </MarqueeButton>
      </div>

      <!-- Films Grid -->
      {#if loading}
        <div class="text-center py-16">
          <span class="loading loading-spinner loading-lg" style="color: var(--accent-gold);"></span>
        </div>
      {:else if films.length === 0}
        <div
          class="text-center py-16"
          in:fly={{ y: 20, duration: 600, delay: 100, easing: cubicOut }}
        >
          <Icon
            icon="mdi:movie-open-outline"
            class="w-24 h-24 mx-auto mb-6 opacity-20"
          />
          <h2 class="text-title opacity-50 mb-2">No Films Yet</h2>
          <p class="opacity-40 mb-6">Be the first to nominate a film!</p>
          <MarqueeButton
            variant="accent"
            size="md"
            on:click={() => goto('/films/nominate')}
          >
            <Icon icon="mdi:ticket-confirmation" class="w-5 h-5" />
            Nominate a Film
          </MarqueeButton>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each films as film, i (film.id)}
            <div
              in:scale={{ duration: 400, delay: i * 50, start: 0.9, easing: cubicOut }}
              out:scale={{ duration: 300, start: 1, easing: cubicOut }}
            >
              <CinemaCard variant="poster" className="film-card">
                <div class="p-6 relative">
                  <div class="flex items-start gap-3">
                    {#if film.metadata?.posterPath}
                      <img
                        src="https://image.tmdb.org/t/p/w92{film.metadata.posterPath}"
                        alt="{film.title} poster"
                        class="w-12 rounded flex-shrink-0 object-cover"
                        style="height: 72px;"
                      />
                    {:else}
                      <Icon
                        icon="mdi:filmstrip-box"
                        class="w-8 h-8 flex-shrink-0 mt-1"
                        style="color: var(--accent-gold);"
                      />
                    {/if}
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <h3 class="text-lg font-bold leading-tight break-words flex-1">
                          {film.title}{#if film.metadata?.releaseYear}&nbsp;<span class="text-sm font-normal opacity-60">({film.metadata.releaseYear})</span>{/if}
                        </h3>
                        <StreamingLogo services={streamingMap[film.id]} />
                      </div>
                      {#if film.metadata?.overview}
                        <p class="text-xs opacity-60 mt-1 leading-snug">{film.metadata.overview.slice(0, 100)}{film.metadata.overview.length > 100 ? '…' : ''}</p>
                      {/if}
                    </div>
                  </div>

                  <button
                    on:click={() => handleDelete(film.id, film.title)}
                    disabled={deletingId === film.id}
                    class="btn btn-sm btn-circle btn-outline btn-error absolute top-3 right-3 opacity-0 delete-btn"
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

        {#if films.some(f => f.metadata)}
          <p class="text-xs opacity-40 text-center mt-6">Film data provided by TMDB</p>
        {/if}
      {/if}
    {/if}
  </div>
</div>

<style>
  .films-page {
    background: radial-gradient(ellipse at top, rgba(26, 26, 26, 0.6) 0%, var(--bg-theater) 50%);
    position: relative;
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

  /* Mobile: always show delete button */
  @media (max-width: 768px) {
    .film-card .delete-btn {
      opacity: 1;
    }
  }
</style>
