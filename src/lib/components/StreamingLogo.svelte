<script lang="ts">
  import Icon from '@iconify/svelte';
  import type { StreamingService } from '$lib/types';

  export let services: StreamingService[] | undefined = undefined;

  const FREE_PRIORITY = ['Netflix', 'Disney Plus', 'Amazon Prime Video'];

  function pickBestService(list: StreamingService[]): { service: StreamingService; isRental: boolean } | null {
    const free = list.filter(s => !s.type || s.type === 'flatrate');
    const rental = list.filter(s => s.type === 'rent');

    // Priority 1: preferred free services
    for (const name of FREE_PRIORITY) {
      const match = free.find(s => s.provider_name === name);
      if (match) return { service: match, isRental: false };
    }
    // Fallback: any free service
    if (free.length > 0) return { service: free[0], isRental: false };

    // Priority 2: Amazon rental
    const amazonRental = rental.find(s => s.provider_name.toLowerCase().includes('amazon'));
    if (amazonRental) return { service: amazonRental, isRental: true };

    // Priority 3: any other rental
    if (rental.length > 0) return { service: rental[0], isRental: true };

    return null;
  }

  $: chosen = services && services.length > 0 ? pickBestService(services) : null;
</script>

{#if services === undefined}
  <!-- Loading skeleton -->
  <div class="w-6 h-6 rounded skeleton-box"></div>
{:else if chosen}
  <div
    class="relative flex-shrink-0"
    title={chosen.isRental ? `Available to rent on ${chosen.service.provider_name}` : `Available on ${chosen.service.provider_name}`}
  >
    <img
      src="https://image.tmdb.org/t/p/w45{chosen.service.logo_path}"
      alt={chosen.service.provider_name}
      class="w-6 h-6 rounded object-cover"
    />
    {#if chosen.isRental}
      <span class="rent-badge">£</span>
    {/if}
  </div>
{:else}
  <Icon
    icon="mdi:alert-circle-outline"
    class="w-5 h-5 flex-shrink-0"
    style="color: var(--accent-gold); opacity: 0.5;"
    title="Not available on UK streaming or rental"
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

  .rent-badge {
    position: absolute;
    bottom: -3px;
    right: -3px;
    font-size: 7px;
    line-height: 1;
    background: #b45309;
    color: white;
    border-radius: 2px;
    padding: 1px 2px;
    font-weight: 700;
  }
</style>
