import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, map, of, switchMap } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Api, Cabin, PropertyAvailability, Quote } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

/** Convierte la fecha del calendario a AAAA-MM-DD sin desfase de zona horaria. */
function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Fecha sin hora, para que las comparaciones no dependan del momento del dia. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const result = startOfDay(date);
  result.setDate(result.getDate() + days);
  return result;
}

@Component({
  selector: 'app-bookings',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ThemeToggle
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './bookings.html',
  styleUrl: './bookings.scss'
})
export class Bookings {
  private api = inject(Api);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  readonly today = startOfDay(new Date());
  readonly todayLabel = new Intl.DateTimeFormat('es-CR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  cabins = signal<Cabin[]>([]);
  selectedCabin = signal<Cabin | null>(null);
  property = signal<PropertyAvailability | null>(null);
  guestOptions = signal<number[]>([]);
  quote = signal<Quote | null>(null);
  errorMessage = signal('');
  saving = signal(false);
  loading = signal(false);

  // Cuantas quedan libres, para avisar cuando no hay ninguna
  freeCount = computed(() => this.cabins().filter((cabin) => cabin.available).length);

  // Huesped ya registrado: evita crearlo de nuevo en cada visita
  private knownGuestId = signal<string | null>(null);
  // Ultima consulta hecha, para no repetirla en cada tecla
  private lastQuery = '';

  readonly discounts = [0, 5, 10, 15, 20];

  form = this.fb.nonNullable.group({
    bookingType: ['cabin'],
    // Arranca con hoy y manana: el caso mas comun es registrar a quien acaba de llegar
    checkIn: [this.today as Date | null, Validators.required],
    checkOut: [addDays(this.today, 1) as Date | null, Validators.required],
    cabinId: [''],
    guests: [1, [Validators.required, Validators.min(1)]],
    idNumber: ['', Validators.required],
    fullName: ['', Validators.required],
    phone: ['', Validators.pattern(/^\d{4}-\d{4}$/)],
    rateType: ['general'],
    discountPercent: [0]
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => {
        this.syncAvailability();
        this.syncSelectedCabin();
        this.refreshQuote();
      });

    // Con fechas por defecto, la disponibilidad se consulta de una vez
    this.syncAvailability();
  }

  get isFullProperty(): boolean {
    return this.form.controls.bookingType.value === 'full';
  }

  get hasDates(): boolean {
    const { checkIn, checkOut } = this.form.getRawValue();
    return Boolean(checkIn && checkOut);
  }

  /** La salida nunca puede ser el mismo dia de la entrada ni antes. */
  get minCheckOut(): Date {
    const checkIn = this.form.controls.checkIn.value;
    return addDays(checkIn ?? this.today, 1);
  }

  /**
   * Habilita hoy en adelante y bloquea de ayer hacia atras.
   * Se usa un filtro y no un minimo porque la comparacion por fecha exacta
   * dejaba hoy fuera del rango.
   */
  allowFromToday = (date: Date | null): boolean => {
    if (!date) return true;
    return startOfDay(date).getTime() >= this.today.getTime();
  };

  /** La salida debe caer despues de la entrada. */
  allowAfterCheckIn = (date: Date | null): boolean => {
    if (!date) return true;
    return startOfDay(date).getTime() >= this.minCheckOut.getTime();
  };

  /** Consulta disponibilidad segun el tipo de reserva elegido. */
  private syncAvailability(): void {
    const { checkIn, checkOut, bookingType } = this.form.getRawValue();

    if (!checkIn || !checkOut) {
      this.cabins.set([]);
      this.property.set(null);
      this.lastQuery = '';
      return;
    }

    const query = `${bookingType}|${toIsoDate(checkIn)}|${toIsoDate(checkOut)}`;
    if (query === this.lastQuery) return;
    this.lastQuery = query;
    this.loading.set(true);

    if (bookingType === 'full') {
      this.cabins.set([]);
      this.selectedCabin.set(null);

      this.api.propertyAvailability(toIsoDate(checkIn), toIsoDate(checkOut)).subscribe({
        next: (result) => {
          this.loading.set(false);
          this.property.set(result);
        },
        error: () => {
          this.loading.set(false);
          this.property.set(null);
        }
      });
      return;
    }

    this.property.set(null);

    this.api.cabinsWithAvailability(toIsoDate(checkIn), toIsoDate(checkOut)).subscribe({
      next: (list) => {
        this.loading.set(false);
        this.cabins.set(list);

        // Si la cabina elegida dejo de estar libre al cambiar las fechas, se limpia
        const current = this.form.controls.cabinId.value;
        if (current && !list.some((cabin) => cabin._id === current && cabin.available)) {
          this.form.controls.cabinId.setValue('', { emitEvent: false });
          this.quote.set(null);
        }
        this.syncSelectedCabin();
      },
      error: () => {
        this.loading.set(false);
        this.cabins.set([]);
      }
    });
  }

  /** Publica la cabina elegida y ajusta las opciones de personas a su capacidad. */
  private syncSelectedCabin(): void {
    if (this.isFullProperty) {
      this.selectedCabin.set(null);
      this.guestOptions.set([]);
      return;
    }

    const cabin = this.cabins().find((item) => item._id === this.form.controls.cabinId.value);
    this.selectedCabin.set(cabin ?? null);

    if (!cabin) {
      this.guestOptions.set([]);
      return;
    }

    this.guestOptions.set(Array.from({ length: cabin.capacity }, (_, index) => index + 1));

    if (this.form.controls.guests.value > cabin.capacity) {
      this.form.controls.guests.setValue(cabin.capacity, { emitEvent: false });
    }
  }

  private refreshQuote(): void {
    const value = this.form.getRawValue();
    const ready =
      value.checkIn &&
      value.checkOut &&
      value.guests &&
      (this.isFullProperty ? this.property()?.free : value.cabinId);

    if (!ready) {
      this.quote.set(null);
      return;
    }

    this.api
      .quote({
        bookingType: value.bookingType,
        cabinId: value.cabinId || undefined,
        checkIn: toIsoDate(value.checkIn!),
        checkOut: toIsoDate(value.checkOut!),
        guests: value.guests,
        rateType: value.rateType,
        discountPercent: value.discountPercent
      })
      .subscribe({
        next: (result) => {
          this.quote.set(result);
          this.errorMessage.set('');
        },
        error: (error) => {
          this.quote.set(null);
          this.errorMessage.set(error.error?.message ?? 'No fue posible calcular el monto');
        }
      });
  }

  /**
   * Da forma al telefono mientras se escribe: 8765-0987.
   * Descarta lo que no sea numero y corta en ocho digitos,
   * asi no hay que acordarse de poner el guion.
   */
  formatPhone(): void {
    const control = this.form.controls.phone;
    const digits = control.value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;

    if (formatted !== control.value) {
      control.setValue(formatted, { emitEvent: false });
    }
  }

  /** Al salir del campo de cedula, completa los datos si ya visito antes. */
  findGuest(): void {
    const idNumber = this.form.controls.idNumber.value.trim();
    if (!idNumber) return;

    this.api.searchGuests(idNumber).subscribe((list) => {
      const match = list.find((guest) => guest.idNumber === idNumber);

      if (match) {
        this.form.patchValue({ fullName: match.fullName, phone: match.phone ?? '' });
        this.knownGuestId.set(match._id);
      } else {
        this.knownGuestId.set(null);
      }
    });
  }

  save(): void {
    const value = this.form.getRawValue();

    if (this.form.invalid || !this.quote() || (!this.isFullProperty && !value.cabinId)) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);

    // Si el huesped es nuevo se crea primero, luego se guarda la reserva
    const guestId$ = this.knownGuestId()
      ? of(this.knownGuestId()!)
      : this.api
          .createGuest({
            idNumber: value.idNumber,
            fullName: value.fullName,
            phone: value.phone
          })
          .pipe(map((guest) => guest._id));

    guestId$
      .pipe(
        switchMap((guestId) =>
          this.api.createBooking({
            bookingType: value.bookingType,
            cabinId: value.cabinId || undefined,
            guestId,
            checkIn: toIsoDate(value.checkIn!),
            checkOut: toIsoDate(value.checkOut!),
            guests: value.guests,
            rateType: value.rateType,
            discountPercent: value.discountPercent
          })
        )
      )
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.snackBar.open('Reserva guardada', 'Cerrar', { duration: 4000 });

          // Vuelve a las fechas de hoy, listo para el siguiente registro
          this.form.reset({
            bookingType: 'cabin',
            checkIn: this.today,
            checkOut: addDays(this.today, 1),
            cabinId: '',
            guests: 1,
            rateType: 'general',
            discountPercent: 0
          });

          this.knownGuestId.set(null);
          this.quote.set(null);
          this.selectedCabin.set(null);
          this.guestOptions.set([]);
          this.lastQuery = '';
          this.syncAvailability();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(error.error?.message ?? 'No fue posible guardar la reserva');
        }
      });
  }

  /** Formato de colones sin decimales. */
  money(value: number): string {
    return `₡${new Intl.NumberFormat('es-CR', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
