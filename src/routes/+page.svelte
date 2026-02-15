<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import FilmGrain from '$lib/components/FilmGrain.svelte';
  import SpotlightEffect from '$lib/components/SpotlightEffect.svelte';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';

  let password = '';
  let error = '';
  let loading = false;
  let mounted = false;

  onMount(() => {
    auth.init();
    mounted = true;
  });

  async function handleLogin(e: Event) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      const data = await api.login(password);
      auth.login(data.sessionToken, data.visitorId);
      goto('/home');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      loading = false;
    }
  }
</script>

<FilmGrain />
<SpotlightEffect intensity="medium" />

<div class="cinema-entrance">
  <div class="hero min-h-screen relative">
    <div class="film-strip-top"></div>

    <div class="hero-content flex-col relative z-10">
      {#if mounted}
        <div class="text-center mb-8" in:fly={{ y: -30, duration: 800, delay: 300, easing: cubicOut }}>
          <div class="text-small mb-2 text-gold-shimmer tracking-widest uppercase">
            Now Showing
          </div>
          <h1 class="text-display gold-shimmer mb-4" style="text-shadow: 0 0 40px rgba(212, 175, 55, 0.3);">
            Film Club
          </h1>
          <div class="text-subtitle opacity-80">
            Enter your club password to continue
          </div>
        </div>

        <div in:fly={{ y: 30, duration: 800, delay: 500, easing: cubicOut }}>
          <CinemaCard variant="velvet" spotlight={true} className="w-full max-w-md">
            <form class="p-8" on:submit={handleLogin}>
              <div class="form-control mb-4">
                <label class="label mb-2" for="password">
                  <span class="text-subtitle text-sm uppercase tracking-wider text-gold">Password</span>
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter club password"
                  class="input input-bordered w-full"
                  style="background: rgba(26, 26, 26, 0.8); border-color: rgba(212, 175, 55, 0.3); min-height: 48px;"
                  bind:value={password}
                  required
                  disabled={loading}
                />
              </div>

              {#if error}
                <div class="alert alert-error mt-4 mb-4" in:fly={{ y: -10, duration: 300 }}>
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

              <div class="form-control mt-6">
                <MarqueeButton
                  variant="accent"
                  size="lg"
                  type="submit"
                  {loading}
                  className="w-full"
                >
                  {loading ? 'Opening Doors...' : 'Enter Cinema'}
                </MarqueeButton>
              </div>
            </form>
          </CinemaCard>
        </div>
      {/if}
    </div>

    <div class="film-strip-bottom"></div>
  </div>
</div>

<style>
  .cinema-entrance {
    position: relative;
    min-height: 100vh;
    background: radial-gradient(ellipse at center, rgba(26, 26, 26, 0.8) 0%, var(--bg-theater) 70%);
  }

  .film-strip-top,
  .film-strip-bottom {
    position: absolute;
    left: 0;
    right: 0;
    height: 30px;
    background: repeating-linear-gradient(
      90deg,
      var(--bg-theater) 0px,
      var(--bg-theater) 12px,
      rgba(212, 175, 55, 0.3) 12px,
      rgba(212, 175, 55, 0.3) 18px
    );
    z-index: 5;
  }

  .film-strip-top {
    top: 0;
    border-bottom: 2px solid rgba(212, 175, 55, 0.2);
  }

  .film-strip-bottom {
    bottom: 0;
    border-top: 2px solid rgba(212, 175, 55, 0.2);
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
</style>
