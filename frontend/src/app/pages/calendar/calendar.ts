import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Api, CalendarBooking, CalendarData } from '../../core/api';
import { BookingPayments } from '../../core/booking-payments';
import { ThemeToggle } from '../../core/theme-toggle';

/** Tramo en medias casillas: cada dia son dos columnas. */
interface Segment {
  bookingId: string | null;
  colStart: number;
  colSpan: number;
  index: number;
}

interface Row {
  cabinId: string;
  number: number;
  name: string;
  capacity: number;
  segments: Segment[];
}

interface Selection {
  booking: CalendarBooking;
  cabinName: string;
  cabinNumber: number;
  cabinCapacity: number;
}

function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Fecha del calendario a AAAA-MM-DD, sin desfase de zona horaria. */
function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Texto ISO del backend a fecha local, para el calendario del formulario. */
function fromIso(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00`);
}

@Component({
  selector: 'app-calendar',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ThemeToggle,
    BookingPayments
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class Calendar {
  private api = inject(Api);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  readonly todayIso = new Date().toLocaleDateString('sv-SE');
  readonly dayCount = 14;
  readonly discounts = [0, 5, 10, 15, 20];

  from = signal(this.todayIso);
  data = signal<CalendarData | null>(null);
  loading = signal(true);
  selected = signal<Selection | null>(null);

  editing = signal(false);
  confirmingDelete = signal(false);
  working = signal(false);
  errorMessage = signal('');

  editForm = this.fb.nonNullable.group({
    checkIn: [null as Date | null],
    checkOut: [null as Date | null],
    guests: [1],
    rateType: ['general'],
    discountPercent: [0]
  });

  todayIndex = computed(() => this.data()?.dates.indexOf(this.todayIso) ?? -1);

  columns = computed(() => `repeat(${this.data()?.dates.length ?? 0}, minmax(48px, 1fr))`);

  trackColumns = computed(() => `repeat(${(this.data()?.dates.length ?? 0) * 2}, minmax(24px, 1fr))`);

  todayColumn = computed(() => {
    const index = this.todayIndex();
    return index < 0 ? '' : `${index * 2 + 1} / span 2`;
  });

  /** Opciones de personas segun la capacidad de la cabina seleccionada. */
  guestOptions = computed(() => {
    const max = this.selected()?.cabinCapacity ?? 1;
    return Array.from({ length: max }, (_, index) => index + 1);
  });

  rows = computed<Row[]>(() => {
    const data = this.data();
    if (!data) return [];

    const dates = data.dates;

    return data.cabins.map((cabin) => {
      const segments: Segment[] = [];
      let index = 0;

      while (index < cabin.days.length) {
        const value = cabin.days[index];

        // Los dias libres los pinta la capa de fondo; aqui solo van las reservas
        if (!value) {
          index += 1;
          continue;
        }

        let end = index;
        while (end + 1 < cabin.days.length && cabin.days[end + 1] === value) end += 1;

        const booking = data.bookings[value];
        const checkOutIndex = end + 1;

        const startsHere = booking?.checkIn.slice(0, 10) === dates[index];
        const endsHere = booking?.checkOut.slice(0, 10) === dates[checkOutIndex];

        const colStart = startsHere ? index * 2 + 2 : index * 2 + 1;
        const colEnd = endsHere ? checkOutIndex * 2 + 1 : end * 2 + 2;

        segments.push({ bookingId: value, colStart, colSpan: colEnd - colStart + 1, index });
        index = end + 1;
      }

      return {
        cabinId: cabin._id,
        number: cabin.number,
        name: cabin.name,
        capacity: cabin.capacity,
        segments
      };
    });
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.calendar(this.from(), this.dayCount).subscribe({
      next: (result) => {
        this.data.set(result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  move(days: number): void {
    this.from.set(shiftIso(this.from(), days));
    this.closeDetail();
    this.load();
  }

  goToday(): void {
    this.from.set(this.todayIso);
    this.closeDetail();
    this.load();
  }

  booking(id: string | null): CalendarBooking | null {
    if (!id) return null;
    return this.data()?.bookings[id] ?? null;
  }

  select(id: string | null, row?: Row): void {
    const booking = this.booking(id);
    this.editing.set(false);
    this.confirmingDelete.set(false);
    this.errorMessage.set('');

    if (!booking || !row) {
      this.selected.set(null);
      return;
    }

    this.selected.set({
      booking,
      cabinName: row.name,
      cabinNumber: row.number,
      cabinCapacity: row.capacity
    });
  }

  closeDetail(): void {
    this.selected.set(null);
    this.editing.set(false);
    this.confirmingDelete.set(false);
    this.errorMessage.set('');
  }

  isSelected(id: string | null): boolean {
    return Boolean(id) && this.selected()?.booking._id === id;
  }

  isSelectedRow(row: Row): boolean {
    const current = this.selected();
    if (!current) return false;
    return row.segments.some((segment) => segment.bookingId === current.booking._id);
  }

  /** Abre el formulario con los valores actuales de la reserva. */
  startEdit(): void {
    const current = this.selected();
    if (!current) return;

    this.editForm.setValue({
      checkIn: fromIso(current.booking.checkIn),
      checkOut: fromIso(current.booking.checkOut),
      guests: current.booking.guests,
      rateType: current.booking.rateType,
      discountPercent: current.booking.discountPercent
    });

    this.confirmingDelete.set(false);
    this.errorMessage.set('');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.errorMessage.set('');
  }

  saveEdit(): void {
    const current = this.selected();
    const value = this.editForm.getRawValue();
    if (!current || !value.checkIn || !value.checkOut) return;

    this.working.set(true);
    this.errorMessage.set('');

    this.api
      .updateBooking(current.booking._id, {
        checkIn: toIsoDate(value.checkIn),
        checkOut: toIsoDate(value.checkOut),
        guests: value.guests,
        rateType: value.rateType,
        discountPercent: value.discountPercent
      })
      .subscribe({
        next: () => {
          this.working.set(false);
          this.snackBar.open('Reserva actualizada', 'Cerrar', { duration: 4000 });
          this.closeDetail();
          this.load();
        },
        error: (error) => {
          this.working.set(false);
          this.errorMessage.set(error.error?.message ?? 'No fue posible guardar los cambios');
        }
      });
  }

  askDelete(): void {
    this.editing.set(false);
    this.errorMessage.set('');
    this.confirmingDelete.set(true);
  }

  confirmDelete(): void {
    const current = this.selected();
    if (!current) return;

    this.working.set(true);

    this.api.cancelBooking(current.booking._id).subscribe({
      next: () => {
        this.working.set(false);
        this.snackBar.open('Reserva eliminada', 'Cerrar', { duration: 4000 });
        this.closeDetail();
        this.load();
      },
      error: (error) => {
        this.working.set(false);
        this.confirmingDelete.set(false);
        this.errorMessage.set(error.error?.message ?? 'No fue posible eliminar la reserva');
      }
    });
  }

  isToday(index: number): boolean {
    return index === this.todayIndex();
  }

  span(booking: CalendarBooking): string {
    const day = (iso: string) => Number(iso.slice(8, 10));
    return `${day(booking.checkIn)} al ${day(booking.checkOut)}`;
  }

  weekday(iso: string): string {
    return new Intl.DateTimeFormat('es-CR', { weekday: 'narrow', timeZone: 'UTC' })
      .format(new Date(`${iso}T00:00:00Z`))
      .toUpperCase();
  }

  dayNumber(iso: string): string {
    return iso.slice(8, 10);
  }

  isWeekend(iso: string): boolean {
    const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
  }

  monthLabel(): string {
    const data = this.data();
    if (!data) return '';

    const format = (iso: string) =>
      new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${iso}T00:00:00Z`));

    return `${format(data.from)} — ${format(data.to)}`;
  }

  formatDate(iso: string): string {
    return new Intl.DateTimeFormat('es-CR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    }).format(new Date(iso));
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
