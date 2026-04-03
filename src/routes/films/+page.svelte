<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { Film, FilmSuggestion } from '$lib/types';
  import { fly, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';
  import { toast } from 'svelte-sonner';

  let films: Film[] = [];
  let newTitle = '';
  let loading = false;
  let deletingId: string | null = null;
  let mounted = false;

  // Typeahead state
  let suggestions: FilmSuggestion[] = [];
  let suggestionsLoading = false;
  let showDropdown = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const suggestionsCache = new Map<string, FilmSuggestion[]>();

  function handleTitleInput() {
    if (debounceTimer) clearTimeout(debounceTimer);

    const query = newTitle.trim();

    if (query.length < 2) {
      suggestions = [];
      showDropdown = false;
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (suggestionsCache.has(query)) {
        suggestions = suggestionsCache.get(query)!;
        showDropdown = suggestions.length > 0;
        return;
      }

      suggestionsLoading = true;
      try {
        const result = await api.searchFilms(query);
        suggestionsCache.set(query, result.suggestions);
        suggestions = result.suggestions;
        showDropdown = suggestions.length > 0;
      } catch {
        suggestions = [];
        showDropdown = false;
      } finally {
        suggestionsLoading = false;
      }
    }, 350);
  }

  function selectSuggestion(suggestion: FilmSuggestion) {
    newTitle = suggestion.title;
    suggestions = [];
    showDropdown = false;
  }

  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      suggestions = [];
      showDropdown = false;
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.typeahead-container')) {
      suggestions = [];
      showDropdown = false;
    }
  }

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
      suggestions = [];
      showDropdown = false;
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

<svelte:window on:click={handleClickOutside} />

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
        <CinemaCard variant="velvet" className="mb-8 add-film-card">
          <form class="p-6" on:submit={handleAddFilm}>
            <label for="film-title" class="text-subtitle text-sm uppercase tracking-wider text-gold mb-3 block">
              Add Film
            </label>
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div class="typeahead-container relative flex gap-3" on:click|stopPropagation>
              <div class="relative flex-1">
                <input
                  id="film-title"
                  type="text"
                  placeholder="Enter film title..."
                  class="input input-bordered w-full"
                  style="background: rgba(26, 26, 26, 0.8); border-color: rgba(212, 175, 55, 0.3); min-height: 48px;"
                  bind:value={newTitle}
                  bind:this={inputEl}
                  on:input={handleTitleInput}
                  on:keydown={handleTitleKeydown}
                  disabled={loading}
                  required
                  autocomplete="off"
                />
                {#if suggestionsLoading}
                  <div class="absolute right-3 top-1/2 -translate-y-1/2">
                    <span class="loading loading-spinner loading-sm" style="color: var(--accent-gold);"></span>
                  </div>
                {/if}
                {#if showDropdown && suggestions.length > 0}
                  <ul
                    class="absolute z-50 w-full mt-1 rounded-lg shadow-xl overflow-hidden"
                    style="background: rgba(20, 20, 20, 0.98); border: 1px solid rgba(212, 175, 55, 0.3);"
                  >
                    {#each suggestions as suggestion (suggestion.tmdbId)}
                      <!-- svelte-ignore a11y-click-events-have-key-events -->
                      <li
                        class="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
                        on:click={() => selectSuggestion(suggestion)}
                      >
                        {#if suggestion.posterPath}
                          <img
                            src="https://image.tmdb.org/t/p/w92{suggestion.posterPath}"
                            alt="{suggestion.title} poster"
                            class="flex-shrink-0 rounded object-cover"
                            style="width: 40px; height: 60px;"
                          />
                        {:else}
                          <div
                            class="flex-shrink-0 rounded flex items-center justify-center"
                            style="width: 40px; height: 60px; background: rgba(212, 175, 55, 0.1);"
                          >
                            <Icon icon="mdi:filmstrip" class="w-5 h-5" style="color: var(--accent-gold); opacity: 0.5;" />
                          </div>
                        {/if}
                        <span class="text-sm">
                          {suggestion.title}
                          {#if suggestion.releaseYear}
                            <span class="opacity-50 ml-1">({suggestion.releaseYear})</span>
                          {/if}
                        </span>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
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
                      <h3 class="text-lg font-bold leading-tight break-words">
                        {film.title}{#if film.metadata?.releaseYear}&nbsp;<span class="text-sm font-normal opacity-60">({film.metadata.releaseYear})</span>{/if}
                      </h3>
                      {#if film.metadata?.overview}
                        <p class="text-xs opacity-60 mt-1 leading-snug">{film.metadata.overview.slice(0, 100)}{film.metadata.overview.length > 100 ? '…' : ''}</p>
                      {/if}
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

      {#if films.some(f => f.metadata)}
        <p class="text-xs opacity-40 text-center mt-6">Film data provided by TMDB</p>
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

  /* Allow the typeahead dropdown to overflow the card bounds.
     Safe here: this card contains only form elements, nothing bleeds at the border-radius. */
  :global(.cinema-card.add-film-card) {
    overflow: visible;
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
