import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, catchError, throwError } from 'rxjs';

export interface UserSession {
  id: string;
  email: string;
  role: string;
  name: string;
}

interface LoginApiResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:5000/api';
  private readonly TOKEN_KEY = 'sanad_admin_token';
  private readonly SESSION_KEY = 'sanad_admin_session';

  // Writable signal for authentication state
  readonly currentUser = signal<UserSession | null>(null);

  // Computed signal for checking if authenticated
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  constructor(private router: Router, private http: HttpClient) {
    this.loadSession();
  }

  // Load session from localStorage on startup
  private loadSession(): void {
    try {
      const saved = localStorage.getItem(this.SESSION_KEY);
      if (saved) {
        this.currentUser.set(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Error loading session:', e);
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // Real API login — calls POST /api/auth/login
  login(email: string, password: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<LoginApiResponse>(`${this.API_URL}/auth/login`, { email, password }).pipe(
      tap((res) => {
        // Persist JWT and user session
        localStorage.setItem(this.TOKEN_KEY, res.token);
        const sessionData: UserSession = {
          id: res.user.id,
          email: res.user.email,
          role: res.user.role,
          name: res.user.name
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
        this.currentUser.set(sessionData);
      }),
      map(() => ({ success: true })),
      catchError((err) => {
        const message = err?.error?.message || 'Login failed. Please try again.';
        return throwError(() => ({ success: false, message }));
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
