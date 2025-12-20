<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { api } from '$lib/api';
  import { onMount } from 'svelte';

  let password = '';
  let error = '';
  let loading = false;

  onMount(() => {
    auth.init();
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

<div class="hero min-h-screen" style="background-color: #0A0A0A;">
  <div class="hero-content flex-col">
    <div class="text-center mb-6">
      <h1 class="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
        🎬 Film Club
      </h1>
      <p class="text-xl text-base-content/70">Enter your club password to continue</p>
    </div>
    <div class="card w-full max-w-sm shadow-2xl border border-primary/20" style="background-color: #2A2A2A;">
      <form class="card-body" on:submit={handleLogin}>
        <div class="form-control">
          <label class="label" for="password">
            <span class="label-text">Password</span>
          </label>
          <input
            id="password"
            type="password"
            placeholder="Enter club password"
            class="input input-bordered"
            bind:value={password}
            required
            disabled={loading}
          />
        </div>
        {#if error}
          <div class="alert alert-error mt-2">
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
          <button class="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  </div>
</div>
