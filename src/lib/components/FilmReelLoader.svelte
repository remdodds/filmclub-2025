<script lang="ts">
  // Film reel loader - rotating cinema-style loading indicator
  // Props: size (default: 40), color (default: gold), message (optional)

  export let size: number = 40;
  export let color: 'gold' | 'red' | 'white' = 'gold';
  export let message: string = '';

  const colorMap = {
    gold: 'var(--accent-gold)',
    red: 'var(--accent-red)',
    white: '#ffffff'
  };

  const fillColor = colorMap[color];
</script>

<div class="film-reel-container" style="--size: {size}px;">
  <svg
    class="film-reel"
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Loading"
    role="status"
  >
    <!-- Outer ring -->
    <circle
      cx="50"
      cy="50"
      r="45"
      fill="none"
      stroke={fillColor}
      stroke-width="2"
      opacity="0.3"
    />

    <!-- Inner ring -->
    <circle
      cx="50"
      cy="50"
      r="35"
      fill="none"
      stroke={fillColor}
      stroke-width="2"
      opacity="0.3"
    />

    <!-- Film holes (6 holes arranged in circle) -->
    {#each Array(6) as _, i}
      {@const angle = (i * 60) * Math.PI / 180}
      {@const x = 50 + 40 * Math.cos(angle)}
      {@const y = 50 + 40 * Math.sin(angle)}
      <circle
        cx={x}
        cy={y}
        r="6"
        fill={fillColor}
        opacity="0.8"
      />
    {/each}

    <!-- Center circle -->
    <circle
      cx="50"
      cy="50"
      r="15"
      fill="none"
      stroke={fillColor}
      stroke-width="3"
      opacity="0.6"
    />
  </svg>

  {#if message}
    <div class="loader-message">{message}</div>
  {/if}
</div>

<style>
  .film-reel-container {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .film-reel {
    animation: filmReel 2s linear infinite;
    filter: drop-shadow(0 0 8px currentColor);
  }

  .loader-message {
    font-size: 0.875rem;
    color: var(--accent-gold);
    text-align: center;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .film-reel {
      animation: filmReel 8s linear infinite;
    }
  }
</style>
