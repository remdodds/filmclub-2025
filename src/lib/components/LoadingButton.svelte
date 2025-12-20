<script lang="ts">
  interface Props {
    loading?: boolean;
    disabled?: boolean;
    class?: string;
    type?: 'button' | 'submit' | 'reset';
    onclick?: (e: MouseEvent) => void;
  }

  let {
    loading = false,
    disabled = false,
    class: className = '',
    type = 'button',
    onclick,
    children
  }: Props = $props();

  const isDisabled = $derived(loading || disabled);
</script>

<button
  {type}
  disabled={isDisabled}
  class="btn {className} inline-flex items-center justify-center"
  {onclick}
>
  <svg class="h-4 w-4 mr-2 flex-shrink-0 {loading ? 'animate-spin opacity-100' : 'opacity-0'}" viewBox="0 0 24 24">
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
      fill="none"
    />
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
  {@render children()}
</button>
