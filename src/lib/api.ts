const API_BASE = 'https://us-central1-filmclubapi.cloudfunctions.net/api';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('sessionToken') || '';
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  async login(password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return handleResponse(res);
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  async checkSession() {
    const res = await fetch(`${API_BASE}/auth/check`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  // Films
  async getFilms() {
    const res = await fetch(`${API_BASE}/films`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  async addFilm(title: string) {
    const res = await fetch(`${API_BASE}/films`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    });
    return handleResponse(res);
  },

  async deleteFilm(id: string) {
    const res = await fetch(`${API_BASE}/films/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  async getHistory() {
    const res = await fetch(`${API_BASE}/films/history`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  // Votes
  async getCurrentVoting() {
    const res = await fetch(`${API_BASE}/votes/current`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  async submitVotes(votes: Record<string, number>) {
    const res = await fetch(`${API_BASE}/votes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ votes })
    });
    return handleResponse(res);
  },

  async getLatestResults() {
    const res = await fetch(`${API_BASE}/votes/results/latest`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return handleResponse(res);
  },

  // Config
  async getConfig() {
    const res = await fetch(`${API_BASE}/config`);
    return handleResponse(res);
  }
};
