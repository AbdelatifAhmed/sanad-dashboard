import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, throwError, switchMap } from 'rxjs';

export interface UserSession {
  id: string;
  email: string;
  role: string;
  name: string;
  avatar?: { url?: string; public_id?: string } | null;
}

// The backend login endpoint returns `accessToken`, not `token`
interface LoginApiResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar?: { url?: string; public_id?: string } | null;
  };
}

interface RefreshApiResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    avatar?: { url?: string; public_id?: string } | null;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http     = inject(HttpClient);
  private readonly router   = inject(Router);
  private readonly API_URL  = 'http://localhost:5000/api';
  private readonly TOKEN_KEY   = 'sanad_admin_token';
  private readonly SESSION_KEY = 'sanad_admin_session';

  // Auth state
  readonly currentUser    = signal<UserSession | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  constructor() {
    this.loadSession();
  }

  // ── Session Management ─────────────────────────────────────────────────────

  private loadSession(): void {
    try {
      const saved = localStorage.getItem(this.SESSION_KEY);
      if (saved) {
        this.currentUser.set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading session:', e);
      this.clearLocalStorage();
    }
  }

  private clearLocalStorage(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
  }

  private storeSession(accessToken: string, user: LoginApiResponse['user']): void {
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    const sessionData: UserSession = {
      id:     user.id,
      email:  user.email,
      role:   user.role,
      name:   user.name,
      avatar: user.avatar ?? null,
    };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    this.currentUser.set(sessionData);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  login(email: string, password: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<LoginApiResponse>(`${this.API_URL}/auth/login`, { email, password }, {
      withCredentials: true   // allow the httpOnly refreshToken cookie to be set
    }).pipe(
      tap((res) => {
        // Backend returns `accessToken` — fix was: res.token → res.accessToken
        this.storeSession(res.accessToken, res.user);
      }),
      map(() => ({ success: true })),
      catchError((err) => {
        const message = err?.error?.message || 'Login failed. Please try again.';
        return throwError(() => ({ success: false, message }));
      })
    );
  }

  // ── Token Refresh ──────────────────────────────────────────────────────────
  // Uses the httpOnly refreshToken cookie (7-day lifetime) to silently get a
  // new 15-minute access token. Called by StatsService when a 401 is received.

  refreshToken(): Observable<string> {
    return this.http.post<RefreshApiResponse>(
      `${this.API_URL}/auth/refresh-token`,
      {},
      { withCredentials: true }   // send the httpOnly cookie automatically
    ).pipe(
      tap((res) => {
        // Update the stored access token and session without re-logging in
        this.storeSession(res.accessToken, res.user);
      }),
      map((res) => res.accessToken),
      catchError((err) => {
        // Refresh token also expired or invalid — force logout
        console.error('Token refresh failed, redirecting to login:', err);
        this.logout();
        return throwError(() => err);
      })
    );
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  logout(): void {
    this.clearLocalStorage();
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
