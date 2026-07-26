import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Api, IncomeReport, ReportRow } from '../../core/api';
import { ThemeToggle } from '../../core/theme-toggle';

type Period = 'day' | 'week' | 'month' | 'year';

function toIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-reports',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    ThemeToggle
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './reports.html',
  styleUrl: './reports.scss'
})
export class Reports {
  private api = inject(Api);
  private fb = inject(FormBuilder);

  report = signal<IncomeReport | null>(null);
  loading = signal(true);
  errorMessage = signal('');
  metric = signal<'revenue' | 'income'>('revenue');

  // El control elige el periodo; el agrupamiento que se pide al servidor
  // sale de ese periodo, un nivel mas fino para que el grafico tenga barras
  form = this.fb.nonNullable.group({
    from: [null as Date | null],
    to: [null as Date | null],
    groupBy: ['day' as Period]
  });

  maxValue = computed(() => {
    const rows = this.report()?.rows ?? [];
    const key = this.metric();
    return rows.reduce((max, row) => Math.max(max, row[key]), 0) || 1;
  });

  generatedAt = new Intl.DateTimeFormat('es-CR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  constructor() {
    this.applyRange('day');
    this.load();

    this.form.controls.groupBy.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((period) => {
        this.applyRange(period);
        this.load();
      });
  }

  /** Cada periodo trae su propio rango, siempre el que se esta cursando. */
  private applyRange(period: Period): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let from: Date;
    let to: Date;

    if (period === 'day') {
      from = new Date(year, month, day);
      to = new Date(year, month, day);
    } else if (period === 'week') {
      // La semana corre de lunes a domingo
      const weekday = (now.getDay() + 6) % 7;
      from = new Date(year, month, day - weekday);
      to = new Date(year, month, day - weekday + 6);
    } else if (period === 'month') {
      from = new Date(year, month, 1);
      to = new Date(year, month + 1, 0);
    } else {
      from = new Date(year, 0, 1);
      to = new Date(year, 11, 31);
    }

    this.form.patchValue({ from, to }, { emitEvent: false });
  }

  /** Dentro del año se agrupa por mes; en los demas casos, por dia. */
  private unitFor(period: Period): string {
    return period === 'year' ? 'month' : 'day';
  }

  load(): void {
    const { from, to, groupBy } = this.form.getRawValue();
    if (!from || !to) return;

    this.loading.set(true);
    this.errorMessage.set('');

    this.api.incomeReport(toIsoDate(from), toIsoDate(to), this.unitFor(groupBy)).subscribe({
      next: (result) => {
        this.report.set(result);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        this.errorMessage.set(error.error?.message ?? 'No fue posible generar el reporte');
      }
    });
  }

  rangeNote(): string {
    const notes: Record<Period, string> = {
      day: 'Hoy',
      week: 'Semana en curso, día por día',
      month: 'Mes en curso, día por día',
      year: 'Año en curso, mes por mes'
    };
    return notes[this.form.controls.groupBy.value];
  }

  barWidth(row: ReportRow): string {
    return `${Math.round((row[this.metric()] / this.maxValue()) * 100)}%`;
  }

  value(row: ReportRow): number {
    return row[this.metric()];
  }

  label(period: string): string {
    const date = new Date(`${period}T00:00:00Z`);
    const unit = this.report()?.groupBy ?? 'day';

    if (unit === 'month') {
      const text = new Intl.DateTimeFormat('es-CR', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }

    const text = new Intl.DateTimeFormat('es-CR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC'
    }).format(date);

    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  perNight(row: ReportRow): number {
    return row.nights > 0 ? Math.round(row.revenue / row.nights) : 0;
  }

  print(): void {
    window.print();
  }

  money(value: number): string {
    return `₡${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
  }
}
