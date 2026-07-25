import { Routes } from '@angular/router';
import { Welcome } from './pages/welcome/welcome';
import { Bookings } from './pages/bookings/bookings';
import { Occupancy } from './pages/occupancy/occupancy';

export const routes: Routes = [
  { path: '', component: Welcome },
  { path: 'reservas', component: Bookings },
  { path: 'reservadas', component: Occupancy },
  // Cualquier direccion desconocida vuelve al inicio
  { path: '**', redirectTo: '' }
];
