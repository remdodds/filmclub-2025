import { writable } from 'svelte/store';
import type { AuthState } from './types';

function createAuthStore() {
  const { subscribe, set } = writable<AuthState>({
    sessionToken: null,
    visitorId: null,
    isLoggedIn: false
  });

  return {
    subscribe,
    login(sessionToken: string, visitorId: string) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('visitorId', visitorId);
      }
      set({ sessionToken, visitorId, isLoggedIn: true });
    },
    logout() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('visitorId');
      }
      set({ sessionToken: null, visitorId: null, isLoggedIn: false });
    },
    init() {
      if (typeof window !== 'undefined') {
        const sessionToken = localStorage.getItem('sessionToken');
        const visitorId = localStorage.getItem('visitorId');
        if (sessionToken && visitorId) {
          set({ sessionToken, visitorId, isLoggedIn: true });
        }
      }
    }
  };
}

export const auth = createAuthStore();
