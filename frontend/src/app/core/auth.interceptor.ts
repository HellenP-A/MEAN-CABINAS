import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Agrega el token a cada peticion y, si el servidor responde que la sesion
 * vencio, devuelve al usuario a la pantalla de ingreso.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('cabinas-token');

  const request = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((error) => {
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        localStorage.removeItem('cabinas-token');
        localStorage.removeItem('cabinas-user');
        router.navigate(['/ingresar']);
      }
      return throwError(() => error);
    })
  );
};
