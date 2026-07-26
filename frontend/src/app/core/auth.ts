import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

const TOKEN_KEY = 'cabinas-token';
const USER_KEY = 'cabinas-user';

export interface SessionUser {
  _id: string;
  username: string;
  fullName: string;
  role: 'admin' | 'reception';
}

/**
 * Sesion del usuario. El token viaja en cada peticion gracias al interceptor
 * y se guarda en el navegador para que recargar no obligue a entrar de nuevo.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  readonly user = signal<SessionUser | null>(this.readStored());

  readonly isLoggedIn = computed(() => this.user() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  private readStored(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;

    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }

  login(username: string, password: string): Observable<{ token: string; user: SessionUser }> {
    return this.http
      .post<{ token: string; user: SessionUser }>('http://localhost:3000/api/auth/login', {
        username,
        password
      })
      .pipe(
        tap((result) => {
          localStorage.setItem(TOKEN_KEY, result.token);
          localStorage.setItem(USER_KEY, JSON.stringify(result.user));
          this.user.set(result.user);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.user.set(null);
    this.router.navigate(['/ingresar']);
  }
}
