import { Component, inject } from '@angular/core';
import { Theme } from './theme';

@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="toggle"
      (click)="theme.toggle()"
      [attr.aria-label]="theme.dark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
      @if (theme.dark()) {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      }
    </button>
  `,
  styles: `
    .toggle {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid var(--surface-line);
      border-radius: 999px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .toggle:hover {
      background: var(--surface);
    }

    .toggle:focus-visible {
      outline: 3px solid var(--sun);
      outline-offset: 2px;
    }

    svg {
      width: 20px;
      height: 20px;
    }
  `
})
export class ThemeToggle {
  theme = inject(Theme);
}
