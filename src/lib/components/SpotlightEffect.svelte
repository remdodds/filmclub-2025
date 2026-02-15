<script lang="ts">
  // Spotlight Effect - Dramatic cinematic spotlight
  // Can be static or follow mouse movement

  export let followMouse: boolean = false;
  export let intensity: 'low' | 'medium' | 'high' = 'medium';

  let spotlightX = 50;
  let spotlightY = 50;

  const intensityMap = {
    low: 0.1,
    medium: 0.15,
    high: 0.25
  };

  const opacityValue = intensityMap[intensity];

  function handleMouseMove(event: MouseEvent) {
    if (!followMouse) return;

    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;

    spotlightX = x;
    spotlightY = y;
  }
</script>

<svelte:window on:mousemove={handleMouseMove} />

<div
  class="spotlight-effect"
  style="
    --spotlight-x: {spotlightX}%;
    --spotlight-y: {spotlightY}%;
    --spotlight-opacity: {opacityValue};
  "
  aria-hidden="true"
></div>

<style>
  .spotlight-effect {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    background: radial-gradient(
      circle at var(--spotlight-x) var(--spotlight-y),
      rgba(255, 248, 220, var(--spotlight-opacity)) 0%,
      transparent 40%,
      transparent 100%
    );
    mix-blend-mode: soft-light;
    transition: background 0.15s ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .spotlight-effect {
      transition: none;
    }
  }

  /* Hide on mobile for performance */
  @media (max-width: 768px) {
    .spotlight-effect {
      display: none;
    }
  }
</style>
