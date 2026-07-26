import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { Auth } from '../../core/auth';
import { ThemeToggle } from '../../core/theme-toggle';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, ThemeToggle],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private auth = inject(Auth);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  working = signal(false);
  errorMessage = signal('');
  hidePassword = signal(true);

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, password } = this.form.getRawValue();
    this.working.set(true);
    this.errorMessage.set('');

    this.auth.login(username, password).subscribe({
      next: () => {
        this.working.set(false);
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.working.set(false);
        this.errorMessage.set(error.error?.message ?? 'No fue posible iniciar sesión');
      }
    });
  }
}
