/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  plugins: [require('daisyui')],
  daisyui: {
    themes: false,  // Disable theme system
    styled: true,   // Keep component styles
    base: false,    // Disable base styles
  },
}
