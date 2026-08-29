import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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

import { Api, Cabin, FrequentGuest, PropertyAvailability, Quote } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

/** Una linea de la reserva: que cabina y cuanta gente va en ella. */
interface Row {
  // Identidad propia de la linea: sin esto la lista se sigue por posicion
  // y al cambiar una fila la vista reutiliza la anterior sin recalcular
  key: number;
  cabinId: string;
  guests: number;
}

let rowKey = 0;
const newRow = (): Row => ({ key: ++rowKey, cabinId: '', guests: 1 });

/** Reserva recien guardada, para poder cobrarla sin salir de la pantalla. */
interface Saved {
  _id: string;
  total: number;
  netTotal: number;
  taxRate: number;
  taxAmount: number;
  guestName: string;
}

function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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

  readonly discounts = [0, 5, 10, 15, 20];
  readonly methods = [
    { key: 'cash', label: 'Efectivo' },
    { key: 'sinpe', label: 'SINPE' },
    { key: 'transfer', label: 'Transferencia' },
    { key: 'card', label: 'Tarjeta' },
    { key: 'other', label: 'Otro' }
  ];

  // Las 15 cabinas: las ocupadas vienen marcadas y se muestran bloqueadas
  allCabins = signal<Cabin[]>([]);
  rows = signal<Row[]>([newRow()]);

  property = signal<PropertyAvailability | null>(null);
  frequent = signal<FrequentGuest[]>([]);
  quote = signal<Quote | null>(null);

  nights = signal(1);
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  // Con senales el boton de cobro se redibuja al instante
  payTax = signal(true);
  chargeAmount = signal(0);
  // El resumen sigue al interruptor de IVA: un solo toque cambia todos los montos
  // El resumen acompana la eleccion de IVA del cobro
  showNet = computed(() => !this.payTax());
  // Paso de cobro: aparece con la reserva ya guardada
  saved = signal<Saved | null>(null);
  charging = signal(false);

  private knownGuestId = signal<string | null>(null);
  private lastQuery = '';
  private lastIdType: 'national' | 'foreign' = 'national';

  form = this.fb.nonNullable.group({
    bookingType: ['cabin'],
    checkIn: [this.today as Date | null, Validators.required],
    checkOut: [addDays(this.today, 1) as Date | null, Validators.required],
    idType: ['national' as 'national' | 'foreign'],
    idNumber: ['', Validators.required],
    fullName: ['', Validators.required],
    phone: ['', Validators.pattern(/^\d{4}-\d{4}$/)],
    // Correo del cliente: a el llega la factura electronica automatica
    email: ['', Validators.email],
    // Solo se usa en puerta cerrada; por cabina el total sale de la suma
    guests: [1],
    rateType: ['general'],
    discountPercent: [0],
    paymentAmount: [''],
    paymentMethod: ['cash']
  });

  paymentForm = this.fb.nonNullable.group({
    amount: [''],
    method: ['cash']
  });

  // El template necesita reaccionar al correo digitado (los FormControl
  // leidos directo en el template no son reactivos)
  emailValue = toSignal(this.form.controls.email.valueChanges, { initialValue: '' });

  get isFullProperty(): boolean {
    return this.form.controls.bookingType.value === 'full';
  }

  /** Lineas con cabina ya elegida. */
  private filled = computed(() => this.rows().filter((row) => row.cabinId));

  totalGuests = computed(() => this.filled().reduce((sum, row) => sum + row.guests, 0));

  cabinCount = computed(() => this.filled().length);

  canSave = computed(() => {
    if (!this.quote()) return false;
    if (this.isFullProperty) return Boolean(this.property()?.free);
    return this.filled().length > 0;
  });

  cabinById(id: string): Cabin | undefined {
    return this.allCabins().find((cabin) => cabin._id === id);
  }

  /** Opciones de personas segun la capacidad de la cabina elegida. */
  guestOptionsFor(cabinId: string): number[] {
    const capacity = this.cabinById(cabinId)?.capacity ?? 1;
    return Array.from({ length: capacity }, (_, index) => index + 1);
  }

  /** Cabinas ya tomadas en la reserva: ninguna puede repetirse. */
  private takenIds = computed(
    () => new Set(this.rows().filter((row) => row.cabinId).map((row) => row.cabinId))
  );

  /** Ya elegida en otra linea de esta misma reserva. */
  isTaken(cabin: Cabin, index: number): boolean {
    return this.rows().some(
      (row, position) => position !== index && row.cabinId === cabin._id
    );
  }

  /** Se bloquea si esta ocupada en esas fechas o ya se eligio en otra linea. */
  isBlocked(cabin: Cabin, index: number): boolean {
    if (cabin.available === false) return true;
    const current = this.rows()[index]?.cabinId;
    return cabin._id !== current && this.takenIds().has(cabin._id);
  }

  constructor() {
    this.api.frequentGuests().subscribe((list) => this.frequent.set(list.slice(0, 8)));

    this.form.valueChanges.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => {
      this.syncIdType();
      this.syncAvailability();
      this.refreshQuote();
    });

    this.form.controls.checkIn.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((checkIn) => this.syncCheckOut(checkIn));

    this.form.controls.checkOut.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.syncNights());

    this.syncNights();
    this.syncAvailability();
  }

  /**
   * Al mover la entrada, la salida pasa siempre al dia siguiente.
   * Es la estadia mas comun; si son mas noches, se corrige la salida a mano.
   */
  private syncCheckOut(checkIn: Date | null): void {
    if (!checkIn) return;

    const next = addDays(checkIn, 1);
    const current = this.form.controls.checkOut.value;

    if (!current || startOfDay(current).getTime() !== next.getTime()) {
      this.form.controls.checkOut.setValue(next);
    }
  }

  /** Noches del rango: la salida no se cobra, por eso es la diferencia simple. */
  private syncNights(): void {
    const { checkIn, checkOut } = this.form.getRawValue();

    if (!checkIn || !checkOut) {
      this.nights.set(0);
      return;
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = startOfDay(checkOut).getTime() - startOfDay(checkIn).getTime();
    this.nights.set(Math.max(Math.round(diff / msPerDay), 0));
  }

  allowFromToday = (date: Date | null): boolean =>
    !date || startOfDay(date).getTime() >= this.today.getTime();

  allowAfterCheckIn = (date: Date | null): boolean => {
    if (!date) return true;
    const checkIn = this.form.controls.checkIn.value ?? this.today;
    return startOfDay(date).getTime() >= addDays(checkIn, 1).getTime();
  };

  private syncAvailability(): void {
    const { checkIn, checkOut, bookingType } = this.form.getRawValue();
    if (!checkIn || !checkOut) return;

    const query = `${bookingType}|${toIsoDate(checkIn)}|${toIsoDate(checkOut)}`;
    if (query === this.lastQuery) return;
    this.lastQuery = query;
    this.loading.set(true);

    // Cambiar de fechas invalida lo elegido: puede que ya no esten libres
    this.rows.set([newRow()]);
    this.quote.set(null);

    if (bookingType === 'full') {
      this.allCabins.set([]);
      this.api.propertyAvailability(toIsoDate(checkIn), toIsoDate(checkOut)).subscribe({
        next: (result) => {
          this.loading.set(false);
          this.property.set(result);
        },
        error: () => this.loading.set(false)
      });
      return;
    }

    this.property.set(null);

    this.api.cabinsWithAvailability(toIsoDate(checkIn), toIsoDate(checkOut)).subscribe({
      next: (list: Cabin[]) => {
        this.loading.set(false);
        this.allCabins.set(list);
      },
      error: () => {
        this.loading.set(false);
        this.allCabins.set([]);
      }
    });
  }

  addRow(): void {
    this.rows.update((list) => [...list, newRow()]);
  }

  removeRow(index: number): void {
    this.rows.update((list) => list.filter((_, position) => position !== index));
    if (this.rows().length === 0) this.rows.set([newRow()]);
    this.refreshQuote();
  }

  setRowCabin(index: number, cabinId: string): void {
    // Segunda barrera, por si la opcion llegara a quedar activa
    const repeated = this.rows().some(
      (row, position) => position !== index && row.cabinId === cabinId
    );
    if (cabinId && repeated) return;

    const capacity = this.cabinById(cabinId)?.capacity ?? 1;

    this.rows.update((list) =>
      list.map((row, position) =>
        position === index ? { ...row, cabinId, guests: Math.min(row.guests, capacity) } : row
      )
    );
    this.refreshQuote();
  }

  setRowGuests(index: number, guests: number): void {
    this.rows.update((list) =>
      list.map((row, position) => (position === index ? { ...row, guests } : row))
    );
    this.refreshQuote();
  }

  private refreshQuote(): void {
    const value = this.form.getRawValue();

    if (!value.checkIn || !value.checkOut) {
      this.quote.set(null);
      return;
    }

    const guests = this.isFullProperty ? value.guests : this.totalGuests();
    const ready = this.isFullProperty ? this.property()?.free && guests > 0 : this.filled().length > 0;

    if (!ready) {
      this.quote.set(null);
      return;
    }

    this.api
      .quote({
        bookingType: value.bookingType,
        cabins: this.filled(),
        checkIn: toIsoDate(value.checkIn),
        checkOut: toIsoDate(value.checkOut),
        guests,
        rateType: value.rateType,
        discountPercent: value.discountPercent
      })
      .subscribe({
        next: (result) => {
          this.quote.set(result);
          this.errorMessage.set('');
          this.syncPaymentAmount();
        },
        error: (error) => {
          this.quote.set(null);
          this.errorMessage.set(error.error?.message ?? 'No fue posible calcular el monto');
        }
      });
  }

  /** Deja el monto sugerido igual al total, con o sin IVA segun se elija. */
  private syncPaymentAmount(): void {
    const price = this.quote();
    if (!price) return;

    const value = this.payTax() ? price.total : price.netTotal;
    this.form.controls.paymentAmount.setValue(value.toLocaleString('en-US'), { emitEvent: false });
    this.chargeAmount.set(value);
  }

  /** Monto que se va a cobrar, ya limpio de separadores. */
  paymentAmount(): number {
    return this.chargeAmount();
  }

  /** Lo que corresponde cobrar segun el interruptor de IVA. */
  chargeTarget(): number {
    const price = this.quote();
    if (!price) return 0;
    return this.payTax() ? price.total : price.netTotal;
  }

  formatPaymentAmount(): void {
    const control = this.form.controls.paymentAmount;
    const digits = String(control.value).replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';

    if (formatted !== control.value) control.setValue(formatted, { emitEvent: false });
    this.chargeAmount.set(Number(digits) || 0);
  }

  useTax(withTax: boolean): void {
    this.payTax.set(withTax);
    this.syncPaymentAmount();
  }

  formatId(): void {
    if (this.form.controls.idType.value !== 'national') return;

    const control = this.form.controls.idNumber;
    const digits = control.value.replace(/\D/g, '').slice(0, 9);

    let formatted = digits;
    if (digits.length > 5) {
      formatted = `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5)}`;
    } else if (digits.length > 1) {
      formatted = `${digits.slice(0, 1)}-${digits.slice(1)}`;
    }

    if (formatted !== control.value) control.setValue(formatted, { emitEvent: false });
  }

  formatPhone(): void {
    const control = this.form.controls.phone;
    const digits = control.value.replace(/\D/g, '').slice(0, 8);
    const formatted = digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;

    if (formatted !== control.value) control.setValue(formatted, { emitEvent: false });
  }

  private syncIdType(): void {
    const type = this.form.controls.idType.value;
    if (type === this.lastIdType) return;
    this.lastIdType = type;

    const control = this.form.controls.idNumber;

    if (type === 'national') {
      this.formatId();
      control.setValidators([Validators.required, Validators.pattern(/^\d-\d{4}-\d{4}$/)]);
    } else {
      const clean = control.value.replace(/-/g, '');
      if (clean !== control.value) control.setValue(clean, { emitEvent: false });
      control.setValidators([Validators.required]);
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  findGuest(): void {
    const idNumber = this.form.controls.idNumber.value.trim();
    if (!idNumber) return;

    this.api.searchGuests(idNumber).subscribe((list) => {
      const match = list.find((guest) => guest.idNumber === idNumber);

      if (match) {
        this.form.patchValue({
          fullName: match.fullName,
          phone: match.phone ?? '',
          email: match.email ?? '',
          idType: match.idType ?? 'national',
          idNumber: match.idNumber
        });
        this.knownGuestId.set(match._id);
      } else {
        this.knownGuestId.set(null);
      }
    });
  }

  pickGuest(guest: FrequentGuest): void {
    const company = guest.companyId ?? null;

    this.form.patchValue({
      idType: guest.idType ?? 'national',
      idNumber: guest.idNumber,
      fullName: guest.fullName,
      phone: guest.phone ?? '',
      email: guest.email ?? '',
      rateType: company?.rateType ?? this.form.controls.rateType.value,
      discountPercent: company?.discountPercent ?? this.form.controls.discountPercent.value
    });

    this.knownGuestId.set(guest._id);
  }

  hideGuest(guest: FrequentGuest, event: Event): void {
    event.stopPropagation();
    this.frequent.update((list) => list.filter((item) => item._id !== guest._id));
    this.api.updateGuest(guest._id, { hiddenFromFrequent: true }).subscribe();
  }

  save(collect: boolean): void {
    if (this.form.invalid || !this.canSave()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const guests = this.isFullProperty ? value.guests : this.totalGuests();
    const amount = collect ? this.paymentAmount() : 0;
    this.saving.set(true);

    const email = value.email.trim();
    const knownId = this.knownGuestId();

    // Si el huesped ya existe y se digito un correo, se guarda de una vez:
    // es el correo al que llega la factura electronica
    const guestId$ = knownId
      ? email
        ? this.api.updateGuest(knownId, { email }).pipe(map(() => knownId))
        : of(knownId)
      : this.api
          .createGuest({
            idType: value.idType,
            idNumber: value.idNumber,
            fullName: value.fullName,
            phone: value.phone,
            email
          })
          .pipe(map((guest) => guest._id));

    guestId$
      .pipe(
        switchMap((guestId) =>
          this.api.createBooking({
            bookingType: value.bookingType,
            cabins: this.filled(),
            guestId,
            checkIn: toIsoDate(value.checkIn!),
            checkOut: toIsoDate(value.checkOut!),
            guests,
            rateType: value.rateType,
            discountPercent: value.discountPercent,
            applyTax: this.payTax()
          })
        ),
        // El cobro va en la misma accion: no hay una segunda pantalla
        switchMap((booking) =>
          amount > 0
            ? this.api.addPayment({
                bookingId: booking._id,
                amount,
                method: value.paymentMethod
              })
            : of(null)
        )
      )
      .subscribe({
        next: (result) => {
          this.saving.set(false);

          const message = !result
            ? 'Reserva guardada, queda pendiente de pago'
            : result.balance <= 0
              ? 'Reserva guardada y pagada por completo'
              : `Reserva guardada · saldo ₡${result.balance.toLocaleString('en-US')}`;

          this.snackBar.open(message, 'Cerrar', { duration: 5000 });
          this.reset();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(error.error?.message ?? 'No fue posible guardar la reserva');
        }
      });
  }

  formatAmount(): void {
    const control = this.paymentForm.controls.amount;
    const digits = String(control.value).replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';

    if (formatted !== control.value) control.setValue(formatted, { emitEvent: false });
  }

  chargeFull(): void {
    const saved = this.saved();
    if (!saved) return;
    this.paymentForm.patchValue({ amount: saved.total.toLocaleString('en-US') });
    this.charge();
  }

  charge(): void {
    const saved = this.saved();
    const value = this.paymentForm.getRawValue();
    const amount = Number(String(value.amount).replace(/\D/g, ''));

    if (!saved || !amount) return;

    this.charging.set(true);

    this.api.addPayment({ bookingId: saved._id, amount, method: value.method }).subscribe({
      next: (result) => {
        this.charging.set(false);
        const message =
          result.balance <= 0
            ? 'Reserva guardada y pagada por completo'
            : `Reserva guardada · saldo ₡${result.balance.toLocaleString('en-US')}`;
        this.snackBar.open(message, 'Cerrar', { duration: 5000 });
        this.reset();
      },
      error: (error) => {
        this.charging.set(false);
        this.errorMessage.set(error.error?.message ?? 'No fue posible registrar el pago');
      }
    });
  }

  skipPayment(): void {
    this.snackBar.open('Reserva guardada sin pago', 'Cerrar', { duration: 4000 });
    this.reset();
  }

  private reset(): void {
    this.form.reset({
      bookingType: 'cabin',
      checkIn: this.today,
      checkOut: addDays(this.today, 1),
      idType: 'national',
      guests: 1,
      rateType: 'general',
      discountPercent: 0,
      paymentAmount: '',
      paymentMethod: 'cash'
    });

    this.payTax.set(true);
    this.chargeAmount.set(0);
    this.paymentForm.reset({ amount: '', method: 'cash' });
    this.rows.set([newRow()]);
    this.quote.set(null);
    this.knownGuestId.set(null);
    this.lastQuery = '';
    this.syncNights();
    this.syncAvailability();
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
