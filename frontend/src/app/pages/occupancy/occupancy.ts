import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { Api, CabinStatus, CleaningWindow } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

@Component({
  selector: 'app-occupancy',
  imports: [RouterLink, MatButtonModule, ThemeToggle],
  templateUrl: './occupancy.html',
  styleUrl: './occupancy.scss'
})
export class Occupancy {
  private api = inject(Api);

  readonly todayLabel = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  cabins = signal<CabinStatus[]>([]);
  window = signal<CleaningWindow>({ checkoutTime: '10:00', readyTime: '14:00' });
  time = signal('');
  loading = signal(true);
  errorMessage = signal('');

  occupied = computed(() => this.cabins().filter((c) => c.state === 'occupied').length);
  cleaning = computed(() => this.cabins().filter((c) => c.state === 'cleaning').length);
  available = computed(() => this.cabins().filter((c) => c.state === 'available').length);

  constructor() {
    this.load();

    // El estado depende de la hora, asi que se refresca solo cada minuto
    const timer = setInterval(() => this.load(), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  private now(): { date: string; time: string } {
    const now = new Date();
    return {
      date: now.toLocaleDateString('sv-SE'),
      time: now.toTimeString().slice(0, 5)
    };
  }

  load(): void {
    const { date, time } = this.now();
    this.time.set(time);

    this.api.cabinStatuses(date, time).subscribe({
      next: (board) => {
        this.cabins.set(board.cabins);
        this.window.set(board.window);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar el estado de las cabinas');
        this.loading.set(false);
      }
    });
  }

  /** Marca a mano una cabina como lista o como sucia; vacio vuelve al horario. */
  mark(cabin: CabinStatus, state: 'ready' | 'dirty' | ''): void {
    const { date, time } = this.now();

    this.api.setCleaning(cabin._id, { date, time, state }).subscribe({
      next: (board) => this.cabins.set(board.cabins),
      error: () => this.errorMessage.set('No fue posible cambiar el estado')
    });
  }

  label(state: string): string {
    if (state === 'occupied') return 'Ocupada';
    if (state === 'cleaning') return 'En limpieza';
    return 'Libre';
  }
}
