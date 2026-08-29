import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Api, Payment } from './api';

const METHODS: Record<string, string> = {
  cash: 'Efectivo',
  sinpe: 'SINPE',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro'
};

/**
 * Abonos de una reserva y su saldo.
 * Vive aparte del calendario para poder reutilizarlo en otras pantallas.
 */
@Component({
  selector: 'app-booking-payments',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <section class="pay">
      <h3 class="pay__title">Pagos</h3>

      @if (loading()) {
        <p class="pay__note">Cargando…</p>
      } @else {
        <div class="pay__summary">
          <div>
            <span class="pay__label">Total</span>
            <span class="pay__value">{{ money(total()) }}</span>
          </div>
          <div>
            <span class="pay__label">Abonado</span>
            <span class="pay__value pay__value--paid">{{ money(paid()) }}</span>
          </div>
          <div>
            <span class="pay__label">Saldo</span>
            <span class="pay__value" [class.pay__value--due]="balance() > 0">
              {{ money(balance()) }}
            </span>
          </div>
        </div>

        @if (balance() <= 0) {
          <p class="pay__done">Reserva cancelada por completo.</p>
        }

        @if (payments().length > 0) {
          <ul class="pay__list">
            @for (payment of payments(); track payment._id) {
              <li class="pay__item">
                <span class="pay__amount">{{ money(payment.amount) }}</span>
                <span class="pay__method">{{ label(payment.method) }}</span>
                <span class="pay__date">{{ date(payment.paidAt) }}</span>
                <button matButton class="pay__remove" (click)="remove(payment._id)">Quitar</button>
              </li>
            }
          </ul>
        }

        <form class="pay__form" [formGroup]="form">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Monto del abono</mat-label>
            <span matTextPrefix>₡&nbsp;</span>
            <input
              matInput
              inputmode="numeric"
              autocomplete="off"
              placeholder="20,000"
              formControlName="amount"
              (input)="formatAmount()" />
          </mat-form-field>

          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Forma de pago</mat-label>
            <mat-select formControlName="method">
              @for (item of methodOptions; track item.key) {
                <mat-option [value]="item.key">{{ item.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button
            matButton="filled"
            class="pay__add"
            [disabled]="saving() || amountValue() === 0"
            (click)="add()">
            @if (amountValue() >= balance() && balance() > 0) {
              Cobrar todo · {{ money(amountValue()) }}
            } @else if (amountValue() > 0) {
              Registrar abono · {{ money(amountValue()) }}
            } @else {
              Registrar abono
            }
          </button>
        </form>

        @if (amountValue() > 0 && amountValue() < balance()) {
          <p class="pay__partial">
            Es un abono parcial: quedará un saldo de {{ money(balance() - amountValue()) }}
          </p>
        }

        @if (errorMessage()) {
          <p class="pay__error">{{ errorMessage() }}</p>
        }
      }
    </section>
  `,
  styles: `
    .pay {
      margin-top: 22px;
      padding-top: 20px;
      border-top: 1px solid var(--surface-line);
    }

    .pay__title {
      margin: 0 0 14px;
      font-size: 0.8125rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.6;
    }

    .pay__summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 14px;
      margin-bottom: 16px;
    }

    .pay__label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.55;
    }

    .pay__value {
      display: block;
      margin-top: 2px;
      font-size: 1.375rem;
      font-weight: 700;
    }

    .pay__value--paid {
      color: #2e7d32;
    }

    /* El saldo pendiente se marca: es el dato que se consulta al cobrar */
    .pay__value--due {
      color: #b3261e;
    }

    .pay__done {
      margin: 0 0 14px;
      color: #2e7d32;
      font-weight: 600;
    }

    .pay__list {
      margin: 0 0 16px;
      padding: 0;
      list-style: none;
      display: grid;
      gap: 6px;
    }

    .pay__item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 10px;
      background: rgba(127, 179, 168, 0.14);
    }

    .pay__amount {
      font-weight: 700;
    }

    .pay__method,
    .pay__date {
      font-size: 0.875rem;
      opacity: 0.7;
    }

    .pay__remove {
      margin-left: auto;
      color: #b3261e;
    }

    .pay__form {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .pay__form mat-form-field {
      flex: 1;
      min-width: 150px;
    }

    .pay__add {
      height: 52px;
      padding: 0 24px;
    }

    .pay__error {
      margin: 12px 0 0;
      color: #b3261e;
      font-weight: 500;
    }

    .pay__partial {
      margin: 10px 0 0;
      color: #ef6c00;
      font-weight: 600;
    }
  `
})
export class BookingPayments {
  private api = inject(Api);
  private fb = inject(FormBuilder);

  bookingId = input.required<string>();

  // Avisa a la pantalla que lo contiene que el saldo cambio
  changed = output<void>();

  payments = signal<Payment[]>([]);
  total = signal(0);
  paid = signal(0);
  balance = signal(0);
  loading = signal(true);
  saving = signal(false);
  errorMessage = signal('');
  // Monto digitado, en senal: el boton y el aviso de abono parcial
  // se redibujan al instante (el FormControl en el template no es reactivo)
  amountValue = signal(0);

  readonly methodOptions = Object.entries(METHODS).map(([key, label]) => ({ key, label }));

  form = this.fb.nonNullable.group({
    // Texto y no numero: un campo numerico del navegador no admite comas
    amount: ['', Validators.required],
    method: ['cash']
  });

  constructor() {
    // Recarga sola cuando el calendario cambia de reserva seleccionada
    effect(() => {
      const id = this.bookingId();
      if (id) this.load(id);
    });
  }

  private load(id: string): void {
    this.loading.set(true);

    this.api.bookingDetail(id).subscribe({
      next: (detail) => {
        this.payments.set(detail.payments);
        this.total.set(detail.booking.total);
        this.paid.set(detail.paid);
        this.balance.set(detail.balance);
        // El monto sugerido es el saldo completo: cobrar todo es un solo
        // clic y para un abono parcial basta editar el numero
        this.form.controls.amount.setValue(
          detail.balance > 0 ? detail.balance.toLocaleString('en-US') : '',
          { emitEvent: false }
        );
        this.amountValue.set(detail.balance > 0 ? detail.balance : 0);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar los pagos');
        this.loading.set(false);
      }
    });
  }

  /**
   * Agrupa los miles mientras se escribe: 40000 se ve como 40,000.
   * Solo conserva digitos, asi que no se puede escribir un monto invalido.
   */
  formatAmount(): void {
    const control = this.form.controls.amount;
    const digits = String(control.value).replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';

    if (formatted !== control.value) {
      control.setValue(formatted, { emitEvent: false });
    }
    this.amountValue.set(Number(digits) || 0);
  }

  add(): void {
    const value = this.form.getRawValue();
    const amount = Number(String(value.amount).replace(/\D/g, ''));

    if (this.form.invalid || !amount) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    this.api
      .addPayment({ bookingId: this.bookingId(), amount, method: value.method })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.reset({ amount: '', method: 'cash' });
          this.amountValue.set(0);
          this.load(this.bookingId());
          this.changed.emit();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(error.error?.message ?? 'No fue posible registrar el abono');
        }
      });
  }

  remove(id: string): void {
    this.api.deletePayment(id).subscribe({
      next: () => {
        this.load(this.bookingId());
        this.changed.emit();
      },
      error: () => this.errorMessage.set('No fue posible quitar el abono')
    });
  }

  label(method: string): string {
    return METHODS[method] ?? method;
  }

  date(iso: string): string {
    return new Intl.DateTimeFormat('es-CR', { day: 'numeric', month: 'short' }).format(new Date(iso));
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
