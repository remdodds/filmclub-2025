<script lang="ts">
  // Cinema Card - Movie poster-inspired card component
  // Variants: standard, poster, velvet
  // Features: spotlight effect, dramatic shadows, hover animations

  export let variant: 'standard' | 'poster' | 'velvet' = 'standard';
  export let spotlight: boolean = false;
  export let clickable: boolean = false;
  export let className: string = '';
</script>

{#if clickable}
  <button
    class="cinema-card cinema-card-{variant} {className}"
    class:spotlight
    class:clickable
    on:click
  >
    <slot />
  </button>
{:else}
  <div
    class="cinema-card cinema-card-{variant} {className}"
    class:spotlight
  >
    <slot />
  </div>
{/if}

<style>
  .cinema-card {
    background-color: var(--bg-card);
    border-radius: 0.75rem;
    overflow: hidden;
    position: relative;
    transition:
      transform var(--timing-normal),
      box-shadow var(--timing-normal);
    display: block;
    width: 100%;
    text-align: inherit;
    font: inherit;
    padding: 0;
  }

  button.cinema-card {
    background-color: var(--bg-card);
    border: none;
    text-align: left;
  }

  /* Standard variant - clean card with subtle effects */
  .cinema-card-standard {
    background-color: var(--bg-card);
    border: 1px solid rgba(212, 175, 55, 0.2);
    box-shadow: var(--shadow-medium);
  }

  /* Poster variant - movie poster styling with gold border */
  .cinema-card-poster {
    background: linear-gradient(135deg, #2A2A2A 0%, #1A1A1A 100%);
    border: 2px solid var(--accent-gold);
    box-shadow:
      var(--shadow-dramatic),
      0 0 20px rgba(212, 175, 55, 0.2);
  }

  .cinema-card-poster::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      transparent 0%,
      rgba(212, 175, 55, 0.05) 50%,
      transparent 100%
    );
    pointer-events: none;
  }

  /* Velvet variant - rich burgundy velvet texture */
  .cinema-card-velvet {
    background: var(--gradient-velvet);
    border: 1px solid rgba(212, 175, 55, 0.3);
    box-shadow: var(--shadow-dramatic);
  }

  .cinema-card-velvet::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      rgba(255, 255, 255, 0.03) 0px,
      transparent 1px,
      transparent 2px,
      rgba(255, 255, 255, 0.03) 3px
    );
    pointer-events: none;
  }

  /* Spotlight effect */
  .cinema-card.spotlight::after {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(
      circle at center,
      rgba(255, 248, 220, 0.15) 0%,
      transparent 60%
    );
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--timing-slow);
  }

  /* Hover effects */
  .cinema-card:hover {
    transform: translateY(-4px);
  }

  .cinema-card-standard:hover {
    box-shadow:
      var(--shadow-dramatic),
      var(--shadow-gold-glow);
  }

  .cinema-card-poster:hover {
    box-shadow:
      var(--shadow-dramatic),
      0 0 30px rgba(212, 175, 55, 0.4),
      0 0 50px rgba(212, 175, 55, 0.2);
    border-color: var(--accent-gold);
  }

  .cinema-card-velvet:hover {
    box-shadow:
      var(--shadow-dramatic),
      0 0 25px rgba(107, 15, 26, 0.6);
  }

  .cinema-card.spotlight:hover::after {
    opacity: 1;
  }

  /* Clickable state */
  .cinema-card.clickable {
    cursor: pointer;
  }

  .cinema-card.clickable:active {
    transform: translateY(-2px);
  }

  /* Focus state for accessibility */
  .cinema-card:focus-visible {
    outline: 2px solid var(--accent-gold);
    outline-offset: 4px;
  }

  /* Reduce motion support */
  @media (prefers-reduced-motion: reduce) {
    .cinema-card {
      transition: none;
    }

    .cinema-card:hover {
      transform: none;
    }
  }
</style>
