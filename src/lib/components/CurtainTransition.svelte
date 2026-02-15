<script lang="ts">
  // Curtain Transition - Cinema curtain effect for page transitions
  // Two velvet curtains that open/close during navigation

  import { onMount } from 'svelte';

  export let isOpen: boolean = true;
  export let duration: number = 800;

  let leftCurtain: HTMLDivElement;
  let rightCurtain: HTMLDivElement;
</script>

<div class="curtain-container" aria-hidden="true">
  <div
    bind:this={leftCurtain}
    class="curtain curtain-left"
    class:open={isOpen}
    style="--duration: {duration}ms;"
  >
    <div class="curtain-texture"></div>
  </div>
  <div
    bind:this={rightCurtain}
    class="curtain curtain-right"
    class:open={isOpen}
    style="--duration: {duration}ms;"
  >
    <div class="curtain-texture"></div>
  </div>
</div>

<style>
  .curtain-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9998;
  }

  .curtain {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    background: var(--gradient-velvet);
    transition: transform calc(var(--duration) * 1ms) cubic-bezier(0.65, 0, 0.35, 1);
    will-change: transform;
  }

  .curtain-left {
    left: 0;
    transform: translateX(0);
  }

  .curtain-left.open {
    transform: translateX(-100%);
  }

  .curtain-right {
    right: 0;
    transform: translateX(0);
  }

  .curtain-right.open {
    transform: translateX(100%);
  }

  .curtain-texture {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.03) 0px,
      transparent 2px,
      transparent 4px,
      rgba(255, 255, 255, 0.03) 6px
    );
    pointer-events: none;
  }

  .curtain::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.5) 0%,
      transparent 100%
    );
  }

  .curtain::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      180deg,
      rgba(139, 0, 0, 0.1) 0%,
      rgba(107, 15, 26, 0.1) 50%,
      rgba(74, 23, 37, 0.1) 100%
    );
    mix-blend-mode: overlay;
  }

  @media (prefers-reduced-motion: reduce) {
    .curtain {
      transition-duration: 1ms;
    }
  }
</style>
