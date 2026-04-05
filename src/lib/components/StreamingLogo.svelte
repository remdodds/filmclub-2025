<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { StreamingService } from '$lib/types';

  export let services: StreamingService[] | undefined = undefined;

  const PRIORITY = ['Netflix', 'Disney Plus', 'Amazon Prime Video'];

  function pickService(list: StreamingService[]): StreamingService | null {
    for (const name of PRIORITY) {
      const match = list.find(s => s.provider_name === name);
      if (match) return match;
    }
    return list[0] ?? null;
  }

  $: chosen = services && services.length > 0 ? pickService(services) : null;
</script>

{#if services === undefined}
  <!-- Loading skeleton -->
  <div class="w-6 h-6 rounded skeleton-box"></div>
{:else if chosen}
  <img
    src="https://image.tmdb.org/t/p/w45{chosen.logo_path}"
    alt={chosen.provider_name}
    title={chosen.provider_name}
    class="w-6 h-6 rounded object-cover flex-shrink-0"
  />
{:else}
  <Icon
    icon="mdi:alert-circle-outline"
    class="w-5 h-5 flex-shrink-0"
    style="color: var(--accent-gold); opacity: 0.5;"
    title="Not available on UK streaming"
  />
{/if}

<style>
  .skeleton-box {
    background: rgba(212, 175, 55, 0.1);
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }
</style>
