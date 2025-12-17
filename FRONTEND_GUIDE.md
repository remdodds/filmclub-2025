# Frontend Development Guide

**Last Updated**: 2025-12-17
**Backend Status**: ✅ Fully deployed and working
**API URL**: https://us-central1-filmclubapi.cloudfunctions.net/api

---

## Overview

The backend is complete and deployed. This guide covers building the SvelteKit frontend to interact with the Film Club API.

---

## Current Backend Status

### ✅ What's Working
- **Authentication**: Login with shared password
- **Films**: Add, list, delete films with duplicate detection
- **Config**: Club configuration stored and accessible
- **Sample Data**: Two films already in the system ("The Godfather", "Pulp Fiction")

### 🔄 What's NOT Implemented (Future)
- **Voting**: API endpoints exist but not yet used
- **Results**: Condorcet algorithm ready but no voting rounds created yet
- **History**: Endpoint ready but no watched films yet

---

## Frontend Pages to Build

### Priority 1: Core User Flow

#### 1. Login Page (`src/routes/+page.svelte`)
**Purpose**: Authenticate users with the shared club password

**Features**:
- Simple password input form
- "Login" button
- Store session token in localStorage or a Svelte store
- Redirect to films page on success

**API Call**:
```typescript
POST /auth/login
Body: { password: string }
Response: { sessionToken: string, visitorId: string }
```

**Example**:
```svelte
<script lang="ts">
  let password = '';

  async function login() {
    const res = await fetch('https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (data.sessionToken) {
      localStorage.setItem('sessionToken', data.sessionToken);
      localStorage.setItem('visitorId', data.visitorId);
      // Redirect to films page
    }
  }
</script>

<form on:submit|preventDefault={login}>
  <input type="password" bind:value={password} placeholder="Enter club password" />
  <button type="submit">Login</button>
</form>
```

---

#### 2. Films Page (`src/routes/films/+page.svelte`)
**Purpose**: List nominated films and add new ones

**Features**:
- Display list of nominated films
- Input field to add new film
- Delete button for each film
- Show error if duplicate film

**API Calls**:
```typescript
// List films
GET /films
Headers: { Authorization: 'Bearer <token>' }
Response: { films: Film[] }

// Add film
POST /films
Headers: { Authorization: 'Bearer <token>', Content-Type: 'application/json' }
Body: { title: string }
Response: { film: Film }

// Delete film
DELETE /films/:id
Headers: { Authorization: 'Bearer <token>' }
Response: { success: true }
```

**Example**:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let films = [];
  let newTitle = '';
  let token = '';

  onMount(async () => {
    token = localStorage.getItem('sessionToken');
    await loadFilms();
  });

  async function loadFilms() {
    const res = await fetch('https://us-central1-filmclubapi.cloudfunctions.net/api/films', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    films = data.films;
  }

  async function addFilm() {
    const res = await fetch('https://us-central1-filmclubapi.cloudfunctions.net/api/films', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: newTitle })
    });

    if (res.ok) {
      newTitle = '';
      await loadFilms();
    }
  }

  async function deleteFilm(id) {
    await fetch(`https://us-central1-filmclubapi.cloudfunctions.net/api/films/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    await loadFilms();
  }
</script>

<h1>Nominated Films</h1>

<form on:submit|preventDefault={addFilm}>
  <input bind:value={newTitle} placeholder="Film title" />
  <button type="submit">Add Film</button>
</form>

<ul>
  {#each films as film}
    <li>
      {film.title}
      <button on:click={() => deleteFilm(film.id)}>Delete</button>
    </li>
  {/each}
</ul>
```

---

#### 3. App Layout (`src/routes/+layout.svelte`)
**Purpose**: Navigation and auth guard

**Features**:
- Check if user is logged in
- Redirect to login if not authenticated
- Navigation menu (Films, Voting, History)
- Logout button

**API Call**:
```typescript
GET /auth/check
Headers: { Authorization: 'Bearer <token>' }
Response: { valid: true, visitorId: string }
```

**Example**:
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  let isLoggedIn = false;

  onMount(async () => {
    const token = localStorage.getItem('sessionToken');
    if (!token) {
      goto('/');
      return;
    }

    const res = await fetch('https://us-central1-filmclubapi.cloudfunctions.net/api/auth/check', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      isLoggedIn = true;
    } else {
      goto('/');
    }
  });

  async function logout() {
    const token = localStorage.getItem('sessionToken');
    await fetch('https://us-central1-filmclubapi.cloudfunctions.net/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    localStorage.clear();
    goto('/');
  }
</script>

{#if isLoggedIn}
  <nav>
    <a href="/films">Films</a>
    <a href="/vote">Vote</a>
    <a href="/history">History</a>
    <button on:click={logout}>Logout</button>
  </nav>
{/if}

<slot />
```

---

### Priority 2: Voting (Future)

#### 4. Voting Page (`src/routes/vote/+page.svelte`)
**Purpose**: Vote on films during active voting round

**Features**:
- Show if voting is open/closed
- List films with 0-3 scale input for each
- Submit votes button
- Show your current votes if already submitted

**API Calls**:
```typescript
GET /votes/current
Response: { votingRound: {...} | null }

POST /votes
Body: { votes: { [filmId]: score } }
```

**Note**: Voting functionality exists in the API but scheduled functions need to create voting rounds. You can manually create a voting round via Firestore console for testing.

---

#### 5. History Page (`src/routes/history/+page.svelte`)
**Purpose**: View watched films and past voting results

**Features**:
- Chronological list of watched films
- Show winning film with voting details
- Display average scores

**API Call**:
```typescript
GET /films/history
Response: { films: Film[] }

GET /votes/results/latest
Response: { results: {...} }
```

---

## Recommended File Structure

```
src/
├── lib/
│   ├── api.ts              # API client wrapper (centralize fetch calls)
│   ├── stores.ts           # Auth store (session token, visitor ID)
│   └── types.ts            # TypeScript types for Film, Vote, etc.
│
├── routes/
│   ├── +page.svelte        # Login page
│   ├── +layout.svelte      # App layout with nav
│   ├── films/
│   │   └── +page.svelte    # Films list/add/delete
│   ├── vote/
│   │   └── +page.svelte    # Voting interface
│   └── history/
│       └── +page.svelte    # Watch history
│
└── app.css                 # Tailwind + DaisyUI styles
```

---

## Helper: API Client (`src/lib/api.ts`)

Create a centralized API client to avoid repeating fetch calls:

```typescript
const API_BASE = 'https://us-central1-filmclubapi.cloudfunctions.net/api';

function getToken(): string {
  return localStorage.getItem('sessionToken') || '';
}

export const api = {
  // Auth
  async login(password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return res.json();
  },

  async logout() {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  async checkSession() {
    const res = await fetch(`${API_BASE}/auth/check`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  // Films
  async getFilms() {
    const res = await fetch(`${API_BASE}/films`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
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
    return res.json();
  },

  async deleteFilm(id: string) {
    const res = await fetch(`${API_BASE}/films/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  async getHistory() {
    const res = await fetch(`${API_BASE}/films/history`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  // Votes
  async getCurrentVoting() {
    const res = await fetch(`${API_BASE}/votes/current`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
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
    return res.json();
  },

  async getLatestResults() {
    const res = await fetch(`${API_BASE}/votes/results/latest`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    return res.json();
  },

  // Config
  async getConfig() {
    const res = await fetch(`${API_BASE}/config`);
    return res.json();
  }
};
```

**Usage**:
```typescript
import { api } from '$lib/api';

// In your components
const data = await api.getFilms();
await api.addFilm('Inception');
```

---

## Helper: Auth Store (`src/lib/stores.ts`)

Manage authentication state across components:

```typescript
import { writable } from 'svelte/store';

interface AuthState {
  sessionToken: string | null;
  visitorId: string | null;
  isLoggedIn: boolean;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    sessionToken: null,
    visitorId: null,
    isLoggedIn: false
  });

  return {
    subscribe,
    login(sessionToken: string, visitorId: string) {
      localStorage.setItem('sessionToken', sessionToken);
      localStorage.setItem('visitorId', visitorId);
      set({ sessionToken, visitorId, isLoggedIn: true });
    },
    logout() {
      localStorage.removeItem('sessionToken');
      localStorage.removeItem('visitorId');
      set({ sessionToken: null, visitorId: null, isLoggedIn: false });
    },
    init() {
      const sessionToken = localStorage.getItem('sessionToken');
      const visitorId = localStorage.getItem('visitorId');
      if (sessionToken && visitorId) {
        set({ sessionToken, visitorId, isLoggedIn: true });
      }
    }
  };
}

export const auth = createAuthStore();
```

**Usage**:
```svelte
<script>
  import { auth } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(() => {
    auth.init();
  });

  $: isLoggedIn = $auth.isLoggedIn;
</script>
```

---

## TypeScript Types (`src/lib/types.ts`)

Define types for API responses:

```typescript
export interface Film {
  id: string;
  title: string;
  addedBy: string;
  addedAt: string | Date;
  status: 'nominated' | 'watched';
  watchedAt?: string | Date;
}

export interface Config {
  clubName: string;
  timezone: string;
  votingSchedule: {
    openDay: number;
    openTime: string;
    closeDay: number;
    closeTime: string;
  };
}

export interface VotingRound {
  id: string;
  openedAt: string;
  closesAt: string;
  status: 'open' | 'closed';
  films: { id: string; title: string }[];
  yourVotes?: Record<string, number>;
}

export interface VotingResults {
  votingRoundId: string;
  closedAt: string;
  winner: {
    id: string;
    title: string;
    rank: number;
    totalScore: number;
    averageScore: number;
  };
  rankings: Array<{
    id: string;
    title: string;
    rank: number;
    totalScore: number;
    averageScore: number;
  }>;
}
```

---

## Styling with DaisyUI

DaisyUI is already installed. Use these components:

### Login Form
```svelte
<div class="hero min-h-screen bg-base-200">
  <div class="hero-content flex-col">
    <div class="card w-full max-w-sm shadow-2xl bg-base-100">
      <form class="card-body">
        <div class="form-control">
          <label class="label">
            <span class="label-text">Password</span>
          </label>
          <input type="password" class="input input-bordered" required />
        </div>
        <div class="form-control mt-6">
          <button class="btn btn-primary">Login</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

### Films List
```svelte
<div class="container mx-auto p-4">
  <h1 class="text-3xl font-bold mb-4">Nominated Films</h1>

  <div class="form-control mb-4">
    <div class="input-group">
      <input type="text" placeholder="Film title" class="input input-bordered w-full" />
      <button class="btn btn-primary">Add</button>
    </div>
  </div>

  <div class="space-y-2">
    {#each films as film}
      <div class="card bg-base-100 shadow-md">
        <div class="card-body flex-row justify-between items-center p-4">
          <h2 class="card-title">{film.title}</h2>
          <button class="btn btn-sm btn-error">Delete</button>
        </div>
      </div>
    {/each}
  </div>
</div>
```

### Bottom Navigation
```svelte
<div class="btm-nav">
  <button class:active={$page.url.pathname === '/films'}>
    <svg>...</svg>
    <span class="btm-nav-label">Films</span>
  </button>
  <button class:active={$page.url.pathname === '/vote'}>
    <svg>...</svg>
    <span class="btm-nav-label">Vote</span>
  </button>
  <button class:active={$page.url.pathname === '/history'}>
    <svg>...</svg>
    <span class="btm-nav-label">History</span>
  </button>
</div>
```

---

## Development Workflow

1. **Start dev server**:
   ```bash
   npm run dev
   ```

2. **Test with real API**:
   - API is already live at `https://us-central1-filmclubapi.cloudfunctions.net/api`
   - Password: `filmclub2025`
   - Two films already exist: "The Godfather", "Pulp Fiction"

3. **Check API responses**:
   ```bash
   # Get config
   curl https://us-central1-filmclubapi.cloudfunctions.net/api/config

   # Login
   curl -X POST https://us-central1-filmclubapi.cloudfunctions.net/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"password": "filmclub2025"}'

   # List films (use token from login)
   curl https://us-central1-filmclubapi.cloudfunctions.net/api/films \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

---

## Testing Checklist

### Phase 1: Login & Navigation
- [ ] Login page displays correctly
- [ ] Can login with correct password
- [ ] Session token stored in localStorage
- [ ] Redirects to films page after login
- [ ] Layout shows navigation
- [ ] Can logout and return to login

### Phase 2: Films Management
- [ ] Can view list of films
- [ ] Can add new film
- [ ] Duplicate detection shows error
- [ ] Can delete film
- [ ] Film list updates after add/delete

### Phase 3: Polish (Future)
- [ ] Mobile responsive
- [ ] Loading states
- [ ] Error messages
- [ ] Empty states (no films)
- [ ] Success notifications

---

## Deployment (Future)

When frontend is ready:

```bash
# Build
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

The frontend will be available at:
`https://filmclubapi.web.app`

---

## Troubleshooting

### CORS Errors
The API already has CORS enabled for all origins. If you see CORS errors:
- Make sure you're using the full URL with `https://`
- Check browser console for actual error

### Authentication Issues
- Session tokens expire after 7 days
- Check localStorage has `sessionToken` key
- Verify token is being sent in `Authorization` header

### API Not Responding
- Check API is running: `curl https://us-central1-filmclubapi.cloudfunctions.net/api/health`
- View logs: `firebase functions:log --only api`

---

## Next Steps for Tomorrow

1. **Create `src/lib/api.ts`** - Copy the API client code above
2. **Create `src/lib/stores.ts`** - Copy the auth store code above
3. **Create `src/lib/types.ts`** - Copy the TypeScript types above
4. **Build login page** (`src/routes/+page.svelte`)
5. **Build films page** (`src/routes/films/+page.svelte`)
6. **Build layout** (`src/routes/+layout.svelte`)
7. **Test the flow** - Login → Add film → Delete film → Logout

---

## Quick Reference

**API Base URL**: `https://us-central1-filmclubapi.cloudfunctions.net/api`
**Club Password**: `filmclub2025`
**Sample Films**: "The Godfather", "Pulp Fiction"

**Documentation**:
- Full API docs: `API_DOCUMENTATION.md`
- Backend progress: `PROJECT_PROGRESS.md`
- Project overview: `README.md`

**GitHub**: https://github.com/remdodds/filmclub-2025
**Firebase Console**: https://console.firebase.google.com/project/filmclubapi

---

Good luck with the frontend! The backend is solid and ready to use. 🎬
