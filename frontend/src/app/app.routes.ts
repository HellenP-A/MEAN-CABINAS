import { Routes } from '@angular/router';

import { authGuard, adminGuard } from './core/guards';
import { Bookings } from './pages/bookings/bookings';
import { Calendar } from './pages/calendar/calendar';
import { Login } from './pages/login/login';
import { Payments } from './pages/payments/payments';
import { Occupancy } from './pages/occupancy/occupancy';
import { Reports } from './pages/reports/reports';
import { Settings } from './pages/settings/settings';
import { Welcome } from './pages/welcome/welcome';

export const routes: Routes = [
  { path: 'ingresar', component: Login },

  { path: '', component: Welcome, canActivate: [authGuard] },
  { path: 'reservas', component: Bookings, canActivate: [authGuard] },
  { path: 'reservadas', component: Occupancy, canActivate: [authGuard] },
  { path: 'calendario', component: Calendar, canActivate: [authGuard] },
  { path: 'pagos', component: Payments, canActivate: [authGuard] },

  // Precios queda reservado al administrador
  { path: 'precios', component: Settings, canActivate: [adminGuard] },
  { path: 'reportes', component: Reports, canActivate: [adminGuard] },

  { path: '**', redirectTo: '' }
];
