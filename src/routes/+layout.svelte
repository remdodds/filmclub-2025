<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores';
  import { Toaster } from 'svelte-sonner';
  import '../app.css';

  $: currentPath = $page.url.pathname;
  $: showNav = $auth.isLoggedIn && currentPath !== '/';
</script>

<svelte:head>
  <title>Film Club</title>
</svelte:head>

<!-- Toast Notifications with Cinematic Styling -->
<Toaster
  position="top-center"
  theme="dark"
  richColors={true}
  toastOptions={{
    style: 'background: linear-gradient(135deg, #4A1725 0%, #6B0F1A 100%); border: 1px solid rgba(212, 175, 55, 0.3); color: white; font-family: system-ui;',
    duration: 4000
  }}
/>

<slot />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
