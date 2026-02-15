<script lang="ts">
  // Marquee Button - Cinema marquee-style button with animated lights
  // Variants: primary (red), accent (gold), outline
  // Features: animated border lights, shimmer on hover

  export let variant: 'primary' | 'accent' | 'outline' = 'primary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let disabled: boolean = false;
  export let loading: boolean = false;
  export let className: string = '';
  export let type: 'button' | 'submit' = 'button';
</script>

<button
  {type}
  {disabled}
  class="marquee-button marquee-{variant} marquee-{size} {className}"
  class:loading
  on:click
>
  {#if loading}
    <span class="loading-spinner"></span>
  {/if}
  <span class="button-content" class:loading>
    <slot />
  </span>
</button>

<style>
  .marquee-button {
    position: relative;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 0.5rem;
    cursor: pointer;
    overflow: hidden;
    transition:
      transform var(--timing-quick),
      box-shadow var(--timing-quick);
    font-family: 'Bebas Neue', sans-serif;
    border: none;
  }

  /* Size variants */
  .marquee-sm {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    min-width: 80px;
  }

  .marquee-md {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    min-width: 120px;
  }

  .marquee-lg {
    padding: 1rem 2rem;
    font-size: 1.25rem;
    min-width: 160px;
  }

  /* Primary variant - Cinema red */
  .marquee-primary {
    background: linear-gradient(135deg, var(--accent-red) 0%, var(--accent-deep-red) 100%);
    color: white;
    box-shadow:
      0 4px 14px rgba(220, 38, 38, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .marquee-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 50%,
      transparent 100%
    );
    transform: translateX(-100%);
    transition: transform 0.6s;
  }

  .marquee-primary:hover::before {
    transform: translateX(100%);
  }

  .marquee-primary:hover {
    box-shadow:
      0 6px 20px rgba(220, 38, 38, 0.6),
      0 0 30px rgba(220, 38, 38, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .marquee-primary:active {
    transform: translateY(0);
  }

  /* Accent variant - Gold marquee */
  .marquee-accent {
    background: linear-gradient(135deg, var(--accent-brass) 0%, var(--accent-gold) 100%);
    color: black;
    box-shadow:
      0 4px 14px rgba(212, 175, 55, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .marquee-accent::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--gradient-marquee);
    background-size: 200% 100%;
    opacity: 0;
    transition: opacity 0.3s;
  }

  .marquee-accent:hover::before {
    opacity: 0.3;
    animation: goldShimmer 2s linear infinite;
  }

  .marquee-accent:hover {
    box-shadow:
      0 6px 20px rgba(212, 175, 55, 0.6),
      0 0 30px rgba(212, 175, 55, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
  }

  .marquee-accent:active {
    transform: translateY(0);
  }

  /* Outline variant */
  .marquee-outline {
    background: transparent;
    color: var(--accent-gold);
    border: 2px solid var(--accent-gold);
    box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
  }

  .marquee-outline:hover {
    background: var(--accent-gold);
    color: black;
    box-shadow:
      0 0 20px rgba(212, 175, 55, 0.4),
      0 0 40px rgba(212, 175, 55, 0.2);
    transform: translateY(-2px);
  }

  .marquee-outline:active {
    transform: translateY(0);
  }

  /* Disabled state */
  .marquee-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .marquee-button:disabled:hover {
    box-shadow: none;
  }

  .marquee-button:disabled::before {
    display: none;
  }

  /* Loading state */
  .marquee-button.loading {
    cursor: wait;
  }

  .button-content {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    transition: opacity var(--timing-quick);
  }

  .button-content.loading {
    opacity: 0;
  }

  .loading-spinner {
    position: absolute;
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Focus state */
  .marquee-button:focus-visible {
    outline: 2px solid var(--accent-gold);
    outline-offset: 3px;
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .marquee-button::before,
    .marquee-accent:hover::before {
      animation: none;
    }

    .marquee-button:hover {
      transform: none;
    }
  }
</style>
