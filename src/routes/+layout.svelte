<script lang="ts">
  import { page } from '$app/stores';
  import { auth } from '$lib/stores';
  import '../app.css';

  $: currentPath = $page.url.pathname;
  $: showNav = $auth.isLoggedIn && currentPath !== '/';
</script>

<svelte:head>
  <title>Film Club</title>
</svelte:head>

<slot />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
</style>
