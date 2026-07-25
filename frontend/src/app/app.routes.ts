import { Routes } from '@angular/router';
import { Welcome } from './pages/welcome/welcome';
import { Bookings } from './pages/bookings/bookings';
import { Calendar } from './pages/calendar/calendar';
import { Settings } from './pages/settings/settings';
import { Occupancy } from './pages/occupancy/occupancy';

export const routes: Routes = [
  { path: '', component: Welcome },
  { path: 'reservas', component: Bookings },
  { path: 'reservadas', component: Occupancy },
  { path: 'calendario', component: Calendar },
  { path: 'precios', component: Settings },
  // Cualquier direccion desconocida vuelve al inicio
  { path: '**', redirectTo: '' }
];
