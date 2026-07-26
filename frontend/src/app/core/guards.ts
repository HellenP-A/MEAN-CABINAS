import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/** Exige sesion iniciada. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isLoggedIn()) return true;

  router.navigate(['/ingresar']);
  return false;
};

/** Ademas de la sesion, exige rol de administrador. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.isAdmin()) return true;

  router.navigate(auth.isLoggedIn() ? ['/'] : ['/ingresar']);
  return false;
};
