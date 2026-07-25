import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Api, Cabin, CleaningWindow, FullPropertyRate } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

/** Texto con separadores a numero limpio. */
function toNumber(value: string | number): number {
  return Number(String(value).replace(/\D/g, '')) || 0;
}

/** Numero a texto con separador de miles. */
function toText(value: number): string {
  return value ? Number(value).toLocaleString('en-US') : '';
}

@Component({
  selector: 'app-settings',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    ThemeToggle
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings {
  private api = inject(Api);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  loading = signal(true);
  saving = signal(false);
  errorMessage = signal('');

  form = this.fb.group({
    corporateRate: [''],
    fullMode: ['per_guest' as 'per_guest' | 'flat'],
    fullPerGuest: [''],
    fullFlat: [''],
    checkoutTime: ['10:00'],
    readyTime: ['14:00'],
    cabins: this.fb.array<FormGroup>([])
  });

  get cabinRows(): FormGroup[] {
    return (this.form.controls.cabins as FormArray<FormGroup>).controls;
  }

  constructor() {
    this.load();
  }

  private load(): void {
    forkJoin({
      cabins: this.api.cabins(),
      corporate: this.api.corporateRate(),
      full: this.api.fullPropertyRate(),
      cleaning: this.api.cleaningWindow()
    }).subscribe({
      next: ({ cabins, corporate, full, cleaning }) => {
        this.form.patchValue({
          corporateRate: toText(corporate.rate),
          fullMode: full.mode,
          fullPerGuest: toText(full.ratePerGuest),
          fullFlat: toText(full.flatRate),
          checkoutTime: cleaning.checkoutTime,
          readyTime: cleaning.readyTime
        });

        const array = this.form.controls.cabins as FormArray<FormGroup>;
        array.clear();

        cabins.forEach((cabin) => array.push(this.buildRow(cabin)));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No fue posible cargar la configuración');
        this.loading.set(false);
      }
    });
  }

  private buildRow(cabin: Cabin): FormGroup {
    return this.fb.group({
      _id: [cabin._id],
      number: [cabin.number],
      name: [cabin.name],
      capacity: [cabin.capacity],
      basePrice: [toText(cabin.basePrice)],
      extraGuestPrice: [toText(cabin.extraGuestPrice)],
      active: [cabin.active]
    });
  }

  /** Da formato de miles mientras se escribe, en cualquier campo de monto. */
  formatMoney(group: FormGroup | null, controlName: string): void {
    // Se resuelve por separado: unir los dos formularios confunde al compilador
    const control = group ? group.get(controlName) : this.form.get(controlName);
    if (!control) return;

    const digits = String(control.value).replace(/\D/g, '');
    const formatted = digits ? Number(digits).toLocaleString('en-US') : '';

    if (formatted !== control.value) {
      control.setValue(formatted, { emitEvent: false });
    }
  }

  /** Precio de ejemplo, para ver el efecto del cambio sin hacer cuentas. */
  preview(group: FormGroup): string {
    const base = toNumber(group.get('basePrice')?.value ?? 0);
    const extra = toNumber(group.get('extraGuestPrice')?.value ?? 0);
    const capacity = Number(group.get('capacity')?.value ?? 1);
    const total = base + extra * Math.max(capacity - 1, 0);

    return `1 persona ₡${toText(base) || 0} · ${capacity} personas ₡${toText(total) || 0}`;
  }

  save(): void {
    this.saving.set(true);
    this.errorMessage.set('');

    const value = this.form.getRawValue();

    // Solo se envian las cabinas que cambiaron: menos escrituras y menos riesgo
    const cabinCalls = this.cabinRows
      .filter((group) => group.dirty)
      .map((group) => {
        const row = group.getRawValue() as Record<string, string | number | boolean>;
        return this.api.updateCabin(String(row['_id']), {
          capacity: Number(row['capacity']),
          basePrice: toNumber(row['basePrice'] as string),
          extraGuestPrice: toNumber(row['extraGuestPrice'] as string),
          active: Boolean(row['active'])
        });
      });

    forkJoin([
      this.api.saveCorporateRate(toNumber(value.corporateRate ?? '')),
      this.api.saveFullPropertyRate({
        mode: value.fullMode ?? 'per_guest',
        ratePerGuest: toNumber(value.fullPerGuest ?? ''),
        flatRate: toNumber(value.fullFlat ?? '')
      } as FullPropertyRate),
      this.api.saveCleaningWindow({
        checkoutTime: value.checkoutTime ?? '10:00',
        readyTime: value.readyTime ?? '14:00'
      } as CleaningWindow),
      ...(cabinCalls.length > 0 ? cabinCalls : [of(null)])
    ]).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackBar.open('Precios guardados', 'Cerrar', { duration: 4000 });
        this.form.markAsPristine();
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(error.error?.message ?? 'No fue posible guardar los cambios');
      }
    });
  }
}
