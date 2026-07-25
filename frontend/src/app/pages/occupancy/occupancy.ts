import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';

import { Api, CabinOccupancy } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

@Component({
  selector: 'app-occupancy',
  imports: [RouterLink, MatButtonModule, ThemeToggle],
  templateUrl: './occupancy.html',
  styleUrl: './occupancy.scss'
})
export class Occupancy {
  private api = inject(Api);

  // Fecha local en formato AAAA-MM-DD. El backend guarda medianoche UTC,
  // asi que se compara como texto y no se corre un dia.
  readonly todayIso = new Date().toLocaleDateString('sv-SE');

  readonly todayLabel = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  cabins = signal<CabinOccupancy[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  busy = computed(() => this.cabins().filter((cabin) => cabin.booking).length);

  constructor() {
    this.api.occupancy(this.todayIso).subscribe({
      next: (list) => {
        this.cabins.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el estado de las cabinas');
        this.loading.set(false);
      }
    });
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-CR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    }).format(new Date(iso));
  }

  /** Marca a quien se va hoy: es la cabina que hay que cobrar y preparar. */
  leavesToday(iso: string): boolean {
    return iso.slice(0, 10) === this.todayIso;
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
