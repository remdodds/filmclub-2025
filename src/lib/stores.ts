import { writable } from 'svelte/store';
import type { AuthState } from './types';

function createAuthStore() {
  const { subscribe, set } = writable<AuthState>({
    sessionToken: null,
    visitorId: null,
    isLoggedIn: false,
    isAdmin: false
  });

  return {
    subscribe,
    login(sessionToken: string, visitorId: string, isAdmin: boolean) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sessionToken', sessionToken);
        localStorage.setItem('visitorId', visitorId);
        localStorage.setItem('isAdmin', String(isAdmin));
      }
      set({ sessionToken, visitorId, isLoggedIn: true, isAdmin });
    },
    logout() {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('visitorId');
        localStorage.removeItem('isAdmin');
      }
      set({ sessionToken: null, visitorId: null, isLoggedIn: false, isAdmin: false });
    },
    init() {
      if (typeof window !== 'undefined') {
        const sessionToken = localStorage.getItem('sessionToken');
        const visitorId = localStorage.getItem('visitorId');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';
        if (sessionToken && visitorId) {
          set({ sessionToken, visitorId, isLoggedIn: true, isAdmin });
        }
      }
    }
  };
}

export const auth = createAuthStore();
