<script lang="ts">
  // Film grain overlay component for authentic cinema feel
  // Adds subtle animated texture across the viewport
</script>

<div class="film-grain-overlay"></div>

<style>
  .film-grain-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
    opacity: var(--film-grain-opacity, 0.03);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    animation: filmGrain 8s steps(10) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .film-grain-overlay {
      animation: none;
    }
  }
</style>
