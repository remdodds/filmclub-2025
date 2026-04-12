<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import { firebaseAuth } from '$lib/firebase';
  import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import CinemaCard from '$lib/components/CinemaCard.svelte';
  import MarqueeButton from '$lib/components/MarqueeButton.svelte';

  let password = '';
  let error = '';
  let loading = false;
  let mounted = false;
  let pendingIdToken: string | null = null;
  let clubName = 'Film Club';

  onMount(async () => {
    auth.init();
    mounted = true;
    api.getConfig().then(r => { if (r.config?.clubName) clubName = r.config.clubName; }).catch(() => {});
  });

  async function handleGoogleLogin() {
    error = '';
    loading = true;
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);
      pendingIdToken = await result.user.getIdToken();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Google login failed';
    } finally {
      loading = false;
    }
  }

  async function handlePasswordSubmit(e: Event) {
    e.preventDefault();
    if (!pendingIdToken) return;
    error = '';
    loading = true;
    try {
      const data = await api.loginWithGoogle(pendingIdToken, password);
      auth.login(data.sessionToken, data.visitorId, data.isAdmin ?? false);
      goto('/home');
    } catch (err) {
      error = err instanceof Error ? err.message : 'Login failed';
    } finally {
      loading = false;
    }
  }

  function handleBack() {
    pendingIdToken = null;
    password = '';
    error = '';
  }
</script>

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
            {clubName}
          </h1>
          <div class="text-subtitle opacity-80">
            {#if pendingIdToken}
              Enter the club password to continue
            {:else}
              Sign in with Google to continue
            {/if}
          </div>
        </div>

        <div in:fly={{ y: 30, duration: 800, delay: 500, easing: cubicOut }}>
          <CinemaCard variant="velvet" className="w-full max-w-md">
            {#if pendingIdToken}
              <form class="p-8" on:submit={handlePasswordSubmit}>
                <div class="form-control mb-4">
                  <label class="label mb-2" for="password">
                    <span class="text-subtitle text-sm uppercase tracking-wider text-gold">Club Password</span>
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

                <button
                  type="button"
                  class="btn btn-ghost w-full mt-3 text-sm opacity-60"
                  on:click={handleBack}
                  disabled={loading}
                >
                  ← Back
                </button>
              </form>
            {:else}
              <div class="p-8">
                {#if error}
                  <div class="alert alert-error mb-4" in:fly={{ y: -10, duration: 300 }}>
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

                <button
                  type="button"
                  class="btn btn-outline w-full flex items-center justify-center gap-2"
                  style="border-color: rgba(212, 175, 55, 0.3); color: inherit;"
                  on:click={handleGoogleLogin}
                  disabled={loading}
                >
                  {#if loading}
                    <span class="loading loading-spinner loading-sm"></span>
                  {:else}
                    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  {/if}
                  {loading ? 'Connecting...' : 'Continue with Google'}
                </button>
              </div>
            {/if}
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
