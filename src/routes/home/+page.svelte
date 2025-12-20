<script lang="ts">
  import { goto } from '$app/navigation';
  import { auth } from '$lib/stores';
  import { onMount } from 'svelte';

  let isLoggedIn = false;

  onMount(async () => {
    auth.init();
    auth.subscribe(state => {
      isLoggedIn = state.isLoggedIn;
      if (!isLoggedIn) {
        goto('/');
      }
    });
  });

  function navigateTo(path: string) {
    goto(path);
  }
</script>

<div class="min-h-screen p-4" style="background-color: #0A0A0A;">
  <div class="max-w-md mx-auto pt-8">
    <div class="text-center mb-10">
      <h1 class="text-5xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
        🎬 Film Club
      </h1>
      <p class="text-xl text-base-content/70">What would you like to do?</p>
    </div>

    <div class="space-y-4">
      <button
        class="btn btn-primary btn-lg w-full justify-start gap-4 shadow-lg shadow-primary/50 hover:shadow-xl hover:shadow-primary/70 transition-all"
        on:click={() => navigateTo('/films')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
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
        <div class="text-left">
          <div class="font-bold">Nominated Films</div>
          <div class="text-sm opacity-70">View and add films</div>
        </div>
      </button>

      <button
        class="btn btn-accent btn-lg w-full justify-start gap-4 shadow-lg shadow-accent/50 hover:shadow-xl hover:shadow-accent/70 transition-all text-base-100"
        on:click={() => navigateTo('/vote')}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          />
        </svg>
        <div class="text-left">
          <div class="font-bold">Vote</div>
          <div class="text-sm opacity-70">Rate nominated films</div>
        </div>
      </button>

      <button
        class="btn btn-outline btn-lg w-full justify-start gap-4 hover:btn-error transition-all"
        on:click={() => auth.logout()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        <div class="text-left">
          <div class="font-bold">Logout</div>
          <div class="text-sm opacity-70">Sign out of Film Club</div>
        </div>
      </button>
    </div>
  </div>
</div>
