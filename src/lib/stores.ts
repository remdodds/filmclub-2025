import { writable } from 'svelte/store';

interface AuthState {
  authenticated: boolean;
  clubName?: string;
  votingOpen?: boolean;
}

export const authStore = writable<AuthState>({ authenticated: false });
