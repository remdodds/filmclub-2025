<script lang="ts">
  // Enhanced Star Rating Component with cinematic sparkle effects
  // 0-3 stars rating system with golden shimmer on selection

  export let rating: number = 0;
  export let maxStars: number = 3;
  export let label: string = '';
  export let onRate: (newRating: number) => void = () => {};

  let hoveredStar: number | null = null;
  let sparkles: { id: number; x: number; y: number }[] = [];
  let sparkleId = 0;

  function handleStarClick(star: number) {
    const newRating = star + 1 === rating ? 0 : star + 1;
    rating = newRating;
    onRate(newRating);
    createSparkles(star);
  }

  function handleKeyPress(event: KeyboardEvent, star: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStarClick(star);
    }
  }

  function createSparkles(starIndex: number) {
    // Create sparkle particles around the clicked star
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      const sparkle = {
        id: sparkleId++,
        x,
        y
      };

      sparkles = [...sparkles, sparkle];

      // Remove sparkle after animation
      setTimeout(() => {
        sparkles = sparkles.filter(s => s.id !== sparkle.id);
      }, 800);
    }
  }

  function getStarLabel(star: number): string {
    const labels = [
      "wouldn't mind",
      'interested',
      'yes please!'
    ];
    return labels[star] || '';
  }
</script>

<div class="star-rating-container">
  <div class="stars-wrapper">
    {#each Array(maxStars) as _, i}
      <div class="star-container">
        <button
          class="star-button"
          class:filled={i < rating}
          class:hovered={hoveredStar !== null && i <= hoveredStar}
          on:click={() => handleStarClick(i)}
          on:mouseenter={() => hoveredStar = i}
          on:mouseleave={() => hoveredStar = null}
          on:keypress={(e) => handleKeyPress(e, i)}
          aria-label="{getStarLabel(i)} - {i + 1} star{i === 0 ? '' : 's'}"
          role="radio"
          aria-checked={i < rating}
        >
          <svg
            class="star-icon"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              class="star-path"
              class:filled={i < rating}
            />
          </svg>

          {#each sparkles as sparkle (sparkle.id)}
            <div
              class="sparkle"
              style="--x: {sparkle.x}px; --y: {sparkle.y}px;"
            >
              ✨
            </div>
          {/each}
        </button>

        {#if hoveredStar === i}
          <div class="star-tooltip">{getStarLabel(i)}</div>
        {/if}
      </div>
    {/each}
  </div>

  {#if label}
    <div class="rating-label">{label}</div>
  {/if}
</div>

<style>
  .star-rating-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .stars-wrapper {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .star-container {
    position: relative;
  }

  .star-button {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    transition: transform var(--timing-quick);
    position: relative;
  }

  .star-button:hover {
    transform: scale(1.15);
  }

  .star-button:active {
    transform: scale(1.05);
  }

  .star-icon {
    width: 2.5rem;
    height: 2.5rem;
    display: block;
  }

  .star-path {
    fill: rgba(212, 175, 55, 0.2);
    stroke: var(--accent-gold);
    stroke-width: 1;
    transition:
      fill var(--timing-normal),
      filter var(--timing-normal);
  }

  .star-path.filled {
    fill: url(#goldGradient);
    filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.8));
  }

  .star-button.hovered .star-path {
    fill: rgba(212, 175, 55, 0.5);
  }

  .star-button.filled .star-path {
    animation: starShimmer 2s ease-in-out infinite;
  }

  @keyframes starShimmer {
    0%, 100% {
      filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.8));
    }
    50% {
      filter: drop-shadow(0 0 16px rgba(212, 175, 55, 1));
    }
  }

  .sparkle {
    position: absolute;
    top: 50%;
    left: 50%;
    font-size: 0.75rem;
    pointer-events: none;
    animation: sparkleAnimation 0.8s ease-out forwards;
    transform-origin: center;
  }

  @keyframes sparkleAnimation {
    0% {
      opacity: 1;
      transform: translate(-50%, -50%) translate(0, 0) scale(0) rotate(0deg);
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -50%) translate(var(--x), var(--y)) scale(1.5) rotate(180deg);
    }
  }

  .star-tooltip {
    position: absolute;
    bottom: -2.5rem;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-velvet);
    color: var(--accent-gold);
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
    pointer-events: none;
    border: 1px solid var(--accent-gold);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 10;
    animation: fadeInDown var(--timing-quick);
  }

  .star-tooltip::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-bottom-color: var(--accent-gold);
  }

  .rating-label {
    font-size: 0.875rem;
    color: var(--accent-gold);
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .star-button:focus-visible {
    outline: 2px solid var(--accent-gold);
    outline-offset: 4px;
    border-radius: 0.25rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .star-button:hover,
    .star-button:active {
      transform: none;
    }

    .star-button.filled .star-path {
      animation: none;
    }

    .sparkle {
      display: none;
    }
  }
</style>

<svg width="0" height="0" style="position: absolute;">
  <defs>
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color: var(--accent-brass); stop-opacity: 1" />
      <stop offset="50%" style="stop-color: var(--accent-gold); stop-opacity: 1" />
      <stop offset="100%" style="stop-color: var(--spotlight-warm); stop-opacity: 1" />
    </linearGradient>
  </defs>
</svg>
