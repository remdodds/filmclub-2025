<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from '@iconify/svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import type { VotingHistoryRecord } from '$lib/types';

  let isLoggedIn = false;
  let logoutLoading = false;
  let mounted = false;
  let lastWinner: VotingHistoryRecord | null = null;

  onMount(async () => {
    auth.init();
    auth.subscribe(state => {
      isLoggedIn = state.isLoggedIn;
      if (!isLoggedIn) {
        goto('/');
      }
    });

    try {
      const data = await api.getVotingHistory(1);
      const latest = data.history?.[0];
      if (latest?.winner) {
        lastWinner = latest;
      }
    } catch {
      // Non-critical - home page still works without this
    }

    mounted = true;
  });

  function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function navigateTo(path: string) {
    goto(path);
  }

  async function handleLogout() {
    logoutLoading = true;
    try {
      await api.logout();
      auth.logout();
    } finally {
      logoutLoading = false;
    }
  }
</script>

<div class="cinema-home min-h-screen">
  <div class="max-w-4xl mx-auto px-4 py-12">
    {#if mounted}
      <!-- Header -->
      <div class="text-center mb-12" in:fly={{ y: -30, duration: 800, easing: cubicOut }}>
        <div class="text-small mb-3 tracking-widest uppercase opacity-70">
          Now Showing
        </div>
        <h1 class="text-headline gold-shimmer mb-4">
          Film Club
        </h1>
        <div class="text-subtitle opacity-80">
          What would you like to do?
        </div>
      </div>

      <!-- Last Winner Banner -->
      {#if lastWinner}
        <div
          class="last-winner-banner mb-10"
          in:fly={{ y: 20, duration: 600, delay: 100, easing: cubicOut }}
        >
          <div class="winner-label">
            <Icon icon="mdi:trophy" class="w-4 h-4" style="color: var(--accent-gold);" />
            Next Up
          </div>
          <div class="winner-title">{lastWinner.winner!.title}</div>
          <div class="winner-meta">
            {formatDate(lastWinner.closedAt)}
            <span class="mx-2 opacity-40">•</span>
            {lastWinner.totalBallots} {lastWinner.totalBallots === 1 ? 'vote' : 'votes'}
            {#if lastWinner.condorcetWinner}
              <span class="mx-2 opacity-40">•</span>
              <span style="color: var(--accent-gold);">Condorcet winner</span>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Navigation Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <!-- Nominated Films Card -->
        <div
          class="stagger-item"
          style="animation-delay: 100ms;"
          in:fly={{ y: 30, duration: 600, delay: 200, easing: cubicOut }}
        >
          <CinemaCard
            variant="poster"
            clickable={true}
            on:click={() => navigateTo('/films')}
          >
            <div class="p-8 text-center">
              <Icon
                icon="mdi:filmstrip"
                class="w-16 h-16 mx-auto mb-4"
                style="color: var(--accent-gold);"
              />
              <h2 class="text-title mb-2">Nominated Films</h2>
              <p class="text-small opacity-70">View and add films to the roster</p>
            </div>
          </CinemaCard>
        </div>

        <!-- Vote Card -->
        <div
          class="stagger-item"
          style="animation-delay: 200ms;"
          in:fly={{ y: 30, duration: 600, delay: 300, easing: cubicOut }}
        >
          <CinemaCard
            variant="poster"
            clickable={true}
            on:click={() => navigateTo('/vote')}
          >
            <div class="p-8 text-center">
              <Icon
                icon="mdi:star-box-multiple"
                class="w-16 h-16 mx-auto mb-4"
                style="color: var(--accent-gold);"
              />
              <h2 class="text-title mb-2">Cast Your Vote</h2>
              <p class="text-small opacity-70">Rate nominated films</p>
            </div>
          </CinemaCard>
        </div>

        <!-- Voting History Card -->
        <div
          class="stagger-item"
          style="animation-delay: 300ms;"
          in:fly={{ y: 30, duration: 600, delay: 400, easing: cubicOut }}
        >
          <CinemaCard
            variant="poster"
            clickable={true}
            on:click={() => navigateTo('/history')}
          >
            <div class="p-8 text-center">
              <Icon
                icon="mdi:trophy-variant"
                class="w-16 h-16 mx-auto mb-4"
                style="color: var(--accent-gold);"
              />
              <h2 class="text-title mb-2">Past Premieres</h2>
              <p class="text-small opacity-70">View voting history and winners</p>
            </div>
          </CinemaCard>
        </div>

        <!-- Admin Card -->
        <div
          class="stagger-item"
          style="animation-delay: 400ms;"
          in:fly={{ y: 30, duration: 600, delay: 500, easing: cubicOut }}
        >
          <CinemaCard
            variant="poster"
            clickable={true}
            on:click={() => navigateTo('/admin')}
          >
            <div class="p-8 text-center">
              <Icon
                icon="mdi:cog"
                class="w-16 h-16 mx-auto mb-4"
                style="color: var(--accent-gold);"
              />
              <h2 class="text-title mb-2">Admin</h2>
              <p class="text-small opacity-70">View votes &amp; select winner</p>
            </div>
          </CinemaCard>
        </div>

        <!-- Exit/Logout Card -->
        <div
          class="stagger-item"
          style="animation-delay: 500ms;"
          in:fly={{ y: 30, duration: 600, delay: 600, easing: cubicOut }}
        >
          <CinemaCard
            variant="standard"
            clickable={true}
            on:click={handleLogout}
            className="exit-card"
          >
            <div class="p-8 text-center">
              <div class="exit-sign mb-4">
                <Icon
                  icon="mdi:exit-run"
                  class="w-12 h-12 mx-auto"
                />
              </div>
              <h2 class="text-title mb-2" style="color: var(--accent-red);">
                {logoutLoading ? 'Exiting...' : 'Exit'}
              </h2>
              <p class="text-small opacity-70">Sign out of Film Club</p>
            </div>
          </CinemaCard>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .cinema-home {
    background: radial-gradient(ellipse at top, rgba(26, 26, 26, 0.6) 0%, var(--bg-theater) 50%);
    position: relative;
  }

  .exit-card {
    border: 1px solid rgba(220, 38, 38, 0.3);
  }

  .exit-sign {
    position: relative;
    color: var(--accent-red);
    filter: drop-shadow(0 0 12px rgba(220, 38, 38, 0.6));
  }

  .exit-card:hover .exit-sign {
    animation: exitPulse 1.5s ease-in-out infinite;
  }

  @keyframes exitPulse {
    0%, 100% {
      filter: drop-shadow(0 0 12px rgba(220, 38, 38, 0.6));
    }
    50% {
      filter: drop-shadow(0 0 20px rgba(220, 38, 38, 0.9));
    }
  }

  /* Last Winner Banner */
  .last-winner-banner {
    text-align: center;
    padding: 1.5rem 2rem;
    border-radius: 0.75rem;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 100%);
    border: 1px solid rgba(212, 175, 55, 0.35);
    box-shadow: 0 0 30px rgba(212, 175, 55, 0.08);
  }

  .winner-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.7rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    opacity: 0.65;
    margin-bottom: 0.5rem;
  }

  .winner-title {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--accent-gold);
    text-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
    margin-bottom: 0.4rem;
    letter-spacing: 0.02em;
  }

  .winner-meta {
    font-size: 0.8rem;
    opacity: 0.6;
  }

  /* Grid responsive adjustments */
  @media (max-width: 768px) {
    :global(.cinema-home .grid) {
      grid-template-columns: 1fr;
    }
  }

  /* Stagger animation */
  .stagger-item {
    animation: fadeInUp var(--timing-slow) both;
  }
</style>
