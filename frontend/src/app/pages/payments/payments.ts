import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { Api, PaymentBoardItem } from '../../core/api';
import { BookingPayments } from '../../core/booking-payments';
import { ThemeToggle } from '../../core/theme-toggle';

type Filter = 'due' | 'unpaid' | 'partial' | 'paid' | 'all';

@Component({
  selector: 'app-payments',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, BookingPayments, ThemeToggle],
  templateUrl: './payments.html',
  styleUrl: './payments.scss'
})
export class Payments {
  private api = inject(Api);

  readonly todayLabel = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  items = signal<PaymentBoardItem[]>([]);
  loading = signal(true);
  filter = signal<Filter>('due');
  // Reserva con el panel de abonos abierto
  openId = signal<string | null>(null);

  visible = computed(() => {
    const filter = this.filter();
    return this.items().filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'due') return item.paymentStatus !== 'paid';
      return item.paymentStatus === filter;
    });
  });

  /** Lo que falta por cobrar en lo que se esta viendo. */
  dueTotal = computed(() =>
    this.visible().reduce((sum, item) => sum + Math.max(item.balance, 0), 0)
  );

  counts = computed(() => {
    const list = this.items();
    return {
      unpaid: list.filter((item) => item.paymentStatus === 'unpaid').length,
      partial: list.filter((item) => item.paymentStatus === 'partial').length,
      paid: list.filter((item) => item.paymentStatus === 'paid').length
    };
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.api.paymentsBoard().subscribe({
      next: (list) => {
        this.items.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  setFilter(value: Filter): void {
    this.filter.set(value);
    this.openId.set(null);
  }

  toggle(id: string): void {
    this.openId.set(this.openId() === id ? null : id);
  }

  statusLabel(status: string): string {
    if (status === 'paid') return 'Pagada';
    if (status === 'partial') return 'Abono parcial';
    return 'Sin pagar';
  }

  invoiceLabel(status: string): string {
    switch (status) {
      case 'accepted':
        return 'Factura enviada';
      case 'queued':
      case 'processing':
        return 'Facturando…';
      case 'rejected':
        return 'Factura rechazada';
      case 'error':
        return 'Error de factura';
      case 'manual_required':
        return 'Facturar en portal GTI';
      default:
        return status;
    }
  }

  /** Ultimos 4 digitos del consecutivo, suficiente para ubicarla en GTI. */
  shortConsecutivo(value: string): string {
    return value.slice(-4);
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-CR', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    }).format(new Date(iso));
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
