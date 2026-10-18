<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import type { FilmSuggestion } from '$lib/types';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';
  import { toast } from 'svelte-sonner';
  import { isPearlHarbor } from '$lib/easterEggs';

  let mounted = false;
  let searchQuery = '';
  let suggestions: FilmSuggestion[] = [];
  let searchLoading = false;
  let nominatingId: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const suggestionsCache = new Map<string, FilmSuggestion[]>();
  let inputEl: HTMLInputElement;
  const PEARL_HARBOR_OVERLAY_MS = 5000;
  let showPearlHarborOverlay = false;
  let pearlHarborTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(() => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.isLoggedIn) {
        goto('/');
      }
    });

    mounted = true;
    // Focus the search input on mount
    setTimeout(() => inputEl?.focus(), 100);

    return unsubscribe;
  });

  onDestroy(clearPearlHarborTimer);

  function handleSearchInput() {
    if (debounceTimer) clearTimeout(debounceTimer);

    const query = searchQuery.trim();

    if (query.length < 2) {
      suggestions = [];
      return;
    }

    debounceTimer = setTimeout(async () => {
      if (suggestionsCache.has(query)) {
        suggestions = suggestionsCache.get(query)!;
        return;
      }

      searchLoading = true;
      try {
        const result = await api.searchFilms(query);
        suggestionsCache.set(query, result.suggestions);
        suggestions = result.suggestions;
      } catch {
        suggestions = [];
      } finally {
        searchLoading = false;
      }
    }, 350);
  }

  function clearPearlHarborTimer() {
    if (pearlHarborTimer) clearTimeout(pearlHarborTimer);
    pearlHarborTimer = null;
  }

  function showPearlHarborEasterEgg() {
    clearPearlHarborTimer();
    showPearlHarborOverlay = true;
    pearlHarborTimer = setTimeout(dismissPearlHarborOverlay, PEARL_HARBOR_OVERLAY_MS);
  }

  function dismissPearlHarborOverlay() {
    clearPearlHarborTimer();
    showPearlHarborOverlay = false;
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (showPearlHarborOverlay && event.key === 'Escape') {
      dismissPearlHarborOverlay();
    }
  }

  async function handleNominate(suggestion: FilmSuggestion) {
    // Easter egg requested by the club owner: Pearl Harbor is never nominated.
    if (isPearlHarbor(suggestion.title)) {
      showPearlHarborEasterEgg();
      return;
    }

    nominatingId = suggestion.tmdbId;
    try {
      await api.addFilm(suggestion.title);
      toast.success(`"${suggestion.title}" nominated!`);
      goto('/films');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to nominate film');
      nominatingId = null;
    }
  }
</script>

<svelte:window on:keydown={handleWindowKeydown} />

<div class="nominate-page min-h-screen">
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    {#if mounted}
      <!-- Header -->
      <div class="flex items-center gap-4 mb-8" in:fly={{ y: -20, duration: 600, easing: cubicOut }}>
        <button
          on:click={() => goto('/films')}
          class="btn btn-circle btn-outline hover:btn-accent transition-all"
          aria-label="Back to nominations"
        >
          <Icon icon="mdi:arrow-left" class="w-6 h-6" />
        </button>
        <div>
          <h1 class="text-headline gold-shimmer">
            Nominate a Film
          </h1>
          <p class="text-small opacity-70 mt-1">Search and select a film to nominate</p>
        </div>
      </div>

      <!-- Search Input -->
      <div in:fly={{ y: 20, duration: 600, delay: 100, easing: cubicOut }}>
        <CinemaCard variant="velvet" className="mb-6">
          <div class="p-6">
            <label for="search-input" class="text-subtitle text-sm uppercase tracking-wider text-gold mb-3 block">
              Search Films
            </label>
            <div class="relative">
              <Icon
                icon="mdi:magnify"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                style="color: var(--accent-gold); opacity: 0.6;"
              />
              <input
                id="search-input"
                type="text"
                placeholder="Type a film title..."
                class="input input-bordered w-full"
                style="background: rgba(26, 26, 26, 0.8); border-color: rgba(212, 175, 55, 0.3); min-height: 48px; padding-left: 2.5rem;"
                bind:value={searchQuery}
                bind:this={inputEl}
                on:input={handleSearchInput}
                autocomplete="off"
              />
              {#if searchLoading}
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                  <span class="loading loading-spinner loading-sm" style="color: var(--accent-gold);"></span>
                </div>
              {/if}
            </div>
          </div>
        </CinemaCard>
      </div>

      <!-- Results List -->
      {#if searchQuery.trim().length >= 2}
        <div in:fly={{ y: 10, duration: 300, easing: cubicOut }}>
          {#if searchLoading && suggestions.length === 0}
            <div class="text-center py-10 opacity-50">
              <span class="loading loading-spinner loading-md" style="color: var(--accent-gold);"></span>
            </div>
          {:else if suggestions.length === 0 && !searchLoading}
            <div class="text-center py-10 opacity-50">
              <Icon icon="mdi:movie-search-outline" class="w-12 h-12 mx-auto mb-3" />
              <p>No films found for "{searchQuery}"</p>
            </div>
          {:else}
            <div class="results-list flex flex-col gap-3">
              {#each suggestions as suggestion (suggestion.tmdbId)}
                <div in:fly={{ y: 10, duration: 200, easing: cubicOut }}>
                  <CinemaCard variant="poster" className="result-card">
                    <div class="p-4 flex items-center gap-4">
                      <!-- Poster -->
                      {#if suggestion.posterPath}
                        <img
                          src="https://image.tmdb.org/t/p/w92{suggestion.posterPath}"
                          alt="{suggestion.title} poster"
                          class="flex-shrink-0 rounded object-cover"
                          style="width: 48px; height: 72px;"
                        />
                      {:else}
                        <div
                          class="flex-shrink-0 rounded flex items-center justify-center"
                          style="width: 48px; height: 72px; background: rgba(212, 175, 55, 0.08);"
                        >
                          <Icon icon="mdi:filmstrip" class="w-6 h-6" style="color: var(--accent-gold); opacity: 0.4;" />
                        </div>
                      {/if}

                      <!-- Info -->
                      <div class="flex-1 min-w-0">
                        <p class="font-bold leading-tight">
                          {suggestion.title}
                        </p>
                        {#if suggestion.releaseYear}
                          <p class="text-sm opacity-50 mt-0.5">{suggestion.releaseYear}</p>
                        {/if}
                      </div>

                      <!-- Nominate button -->
                      <MarqueeButton
                        variant="accent"
                        size="sm"
                        loading={nominatingId === suggestion.tmdbId}
                        on:click={() => handleNominate(suggestion)}
                      >
                        <Icon icon="mdi:ticket-confirmation" class="w-4 h-4" />
                        Nominate
                      </MarqueeButton>
                    </div>
                  </CinemaCard>
                </div>
              {/each}
            </div>
            <p class="text-xs opacity-30 text-center mt-4">Film data provided by TMDB</p>
          {/if}
        </div>
      {:else if searchQuery.trim().length > 0}
        <div class="text-center py-10 opacity-40">
          <p class="text-sm">Keep typing to search...</p>
        </div>
      {:else}
        <div class="text-center py-16 opacity-30" in:fly={{ y: 10, duration: 400, delay: 200, easing: cubicOut }}>
          <Icon icon="mdi:movie-search-outline" class="w-16 h-16 mx-auto mb-4" />
          <p>Start typing to find a film</p>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#if showPearlHarborOverlay}
  <!-- Easter egg: tap anywhere, press Escape, or wait to dismiss -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="pearl-harbor-overlay fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 overflow-hidden cursor-pointer select-none"
    role="alertdialog"
    aria-modal="true"
    aria-label="Pearl Harbor easter egg"
    aria-describedby="pearl-harbor-message"
    tabindex="-1"
    data-testid="pearl-harbor-overlay"
    on:click={dismissPearlHarborOverlay}
  >
    <div class="pearl-harbor-flash" aria-hidden="true"></div>
    <span class="pearl-harbor-plane" aria-hidden="true">✈️</span>
    <span class="pearl-harbor-bomb" aria-hidden="true">💣</span>

    <p id="pearl-harbor-message" class="pearl-harbor-text text-center font-black leading-none px-4">
      GET FUCKED
    </p>

    <button class="btn btn-accent btn-lg relative" on:click={dismissPearlHarborOverlay}>
      Dismiss
    </button>
  </div>
{/if}

<style>
  .nominate-page {
    background: radial-gradient(ellipse at top, rgba(26, 26, 26, 0.6) 0%, var(--bg-theater) 50%);
    position: relative;
  }

  .text-gold {
    color: var(--accent-gold);
  }

  :global(.input:focus) {
    outline: 2px solid var(--accent-gold) !important;
    outline-offset: 2px;
    border-color: var(--accent-gold) !important;
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.15) !important;
  }
  /* ── Pearl Harbor easter egg ─────────────────────────────────────────── */
  .pearl-harbor-overlay {
    background: radial-gradient(circle at center, rgba(120, 10, 10, 0.92) 0%, rgba(0, 0, 0, 0.97) 70%);
    animation: overlayIn 200ms ease-out both;
  }

  .pearl-harbor-flash {
    position: absolute;
    inset: 0;
    background: #fff4c2;
    pointer-events: none;
    animation: flash 600ms ease-out both;
  }

  .pearl-harbor-text {
    position: relative;
    font-size: clamp(3rem, 16vw, 11rem);
    color: #ffd23f;
    text-shadow:
      0 0 12px rgba(255, 80, 0, 0.9),
      0 0 40px rgba(255, 0, 0, 0.7),
      6px 6px 0 #7a0000;
    animation:
      bounceIn 700ms cubic-bezier(0.68, -0.55, 0.27, 1.55) both,
      shake 450ms ease-in-out 700ms 3;
  }

  .pearl-harbor-plane {
    position: absolute;
    top: 12%;
    font-size: clamp(2.5rem, 8vw, 5rem);
    animation: flyBy 1600ms linear both;
  }

  .pearl-harbor-bomb {
    position: absolute;
    top: 0;
    font-size: clamp(2.5rem, 8vw, 5rem);
    animation: bombDrop 900ms ease-in 300ms both;
  }

  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes flash {
    0% { opacity: 0.9; }
    100% { opacity: 0; }
  }

  @keyframes bounceIn {
    0% { transform: scale(0.1) rotate(-12deg); opacity: 0; }
    60% { transform: scale(1.25) rotate(4deg); opacity: 1; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }

  @keyframes shake {
    0%, 100% { transform: translate(0, 0) rotate(0); }
    20% { transform: translate(-10px, 4px) rotate(-2deg); }
    40% { transform: translate(10px, -4px) rotate(2deg); }
    60% { transform: translate(-8px, -2px) rotate(-1deg); }
    80% { transform: translate(8px, 2px) rotate(1deg); }
  }

  @keyframes flyBy {
    from { left: -15%; }
    to { left: 110%; }
  }

  @keyframes bombDrop {
    0% { transform: translateY(-20vh) rotate(0); opacity: 1; }
    90% { transform: translateY(45vh) rotate(160deg); opacity: 1; }
    100% { transform: translateY(48vh) scale(2.5); opacity: 0; }
  }

  @media (prefers-reduced-motion: reduce) {
    .pearl-harbor-overlay,
    .pearl-harbor-flash,
    .pearl-harbor-text,
    .pearl-harbor-plane,
    .pearl-harbor-bomb {
      animation: none;
    }

    .pearl-harbor-flash,
    .pearl-harbor-plane,
    .pearl-harbor-bomb {
      display: none;
    }
  }
</style>
