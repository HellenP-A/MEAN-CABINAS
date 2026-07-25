import { effect, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'cabinas-theme';

/**
 * Modo claro u oscuro. Recuerda la eleccion entre visitas y,
 * la primera vez, respeta la preferencia del sistema operativo.
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  readonly dark = signal(this.initialValue());

  constructor() {
    effect(() => {
      const isDark = this.dark();
      document.documentElement.classList.toggle('dark', isDark);
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.dark.update((value) => !value);
  }

  private initialValue(): boolean {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
}
