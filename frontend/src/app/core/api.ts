import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API_URL = 'http://localhost:3000/api';

export interface Cabin {
  _id: string;
  number: number;
  code: string;
  name: string;
  capacity: number;
  basePrice: number;
  extraGuestPrice: number;
  active: boolean;
  available?: boolean;
}

export interface Company {
  _id: string;
  name: string;
  rateType: 'general' | 'corporate';
  discountPercent: number;
  phone?: string;
}

export interface Guest {
  _id: string;
  idType?: 'national' | 'foreign';
  idNumber: string;
  fullName: string;
  phone?: string;
  companyId?: Company | null;
}

/**
 * Lo que se envia al crear un huesped.
 * Se separa de Guest porque al leer la empresa llega como objeto y al
 * escribir se manda solo su identificador.
 */
export interface GuestInput {
  idType?: 'national' | 'foreign';
  idNumber: string;
  fullName: string;
  phone?: string;
  companyId?: string | null;
}

export interface FrequentGuest extends Guest {
  visits: number;
  lastCheckIn: string;
}

export interface PropertyAvailability {
  total: number;
  available: number;
  free: boolean;
  capacity: number;
}

export interface BookingListItem {
  _id: string;
  bookingType: 'cabin' | 'full';
  cabinId: { _id: string; code: string; name: string } | null;
  guestId: { _id: string; idNumber: string; fullName: string } | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rateType: string;
  nightlyRate: number;
  discountPercent: number;
  total: number;
  status: string;
  notes?: string;
}

export interface CabinOccupancy extends Cabin {
  booking: {
    _id: string;
    bookingType: 'cabin' | 'full';
    guestId: { idNumber: string; fullName: string; phone?: string } | null;
    checkIn: string;
    checkOut: string;
    nights: number;
    guests: number;
    rateType: string;
    discountPercent: number;
    total: number;
    status: string;
  } | null;
}

export interface CalendarBooking {
  _id: string;
  bookingType: 'cabin' | 'full';
  guestName: string;
  idNumber: string;
  idType: 'national' | 'foreign';
  phone: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rateType: string;
  discountPercent: number;
  netTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
}

export interface CalendarCabin {
  _id: string;
  number: number;
  name: string;
  capacity: number;
  days: (string | null)[];
}

export interface CalendarData {
  from: string;
  to: string;
  dates: string[];
  bookings: Record<string, CalendarBooking>;
  cabins: CalendarCabin[];
}

export interface Payment {
  _id: string;
  amount: number;
  method: string;
  paidAt: string;
  receivedBy?: string;
  notes?: string;
}

export interface BookingDetail {
  booking: { _id: string; total: number; nights: number; guests: number };
  payments: Payment[];
  paid: number;
  balance: number;
}

export interface FullPropertyRate {
  mode: 'per_guest' | 'flat';
  ratePerGuest: number;
  flatRate: number;
}

export interface CabinStatus {
  _id: string;
  number: number;
  name: string;
  capacity: number;
  state: 'occupied' | 'cleaning' | 'available';
  override: 'ready' | 'dirty' | null;
  guestName: string | null;
  leavingGuest: string | null;
  arrivesToday: boolean;
}

export interface CleaningWindow {
  checkoutTime: string;
  readyTime: string;
}

export interface StatusBoard {
  date: string;
  time: string;
  window: CleaningWindow;
  cabins: CabinStatus[];
}

export interface TaxSettings {
  rate: number;
  applyToGeneral: boolean;
  applyToCorporate: boolean;
  applyToFull: boolean;
}

export interface ReportRow {
  period: string;
  income: number;
  payments: number;
  nights: number;
  revenue: number;
}

export interface IncomeReport {
  from: string;
  to: string;
  groupBy: 'day' | 'week' | 'month';
  rows: ReportRow[];
  totals: { income: number; payments: number; nights: number; revenue: number };
  best: ReportRow | null;
  worst: ReportRow | null;
}

export interface Quote {
  bookingType: string;
  nights: number;
  guests: number;
  rateType: string;
  rate: number;
  nightlyRate: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netTotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  /** Todas las cabinas, en orden, sin importar disponibilidad. */
  cabins(): Observable<Cabin[]> {
    return this.http.get<Cabin[]>(`${API_URL}/cabins`);
  }

  /** Las 15 cabinas en orden, cada una con su estado de ocupacion. */
  cabinsWithAvailability(checkIn: string, checkOut: string): Observable<Cabin[]> {
    return this.http.get<Cabin[]>(`${API_URL}/cabins/availability`, {
      params: { checkIn, checkOut }
    });
  }

  /** Estado de la propiedad completa, para el alquiler a puerta cerrada. */
  propertyAvailability(checkIn: string, checkOut: string): Observable<PropertyAvailability> {
    return this.http.get<PropertyAvailability>(`${API_URL}/cabins/property`, {
      params: { checkIn, checkOut }
    });
  }

  /** Reservas guardadas, de la mas proxima a la mas lejana. */
  bookings(): Observable<BookingListItem[]> {
    return this.http.get<BookingListItem[]>(`${API_URL}/bookings`);
  }

  /** Las 15 cabinas con quien las ocupa en la fecha indicada. */
  occupancy(date: string): Observable<CabinOccupancy[]> {
    return this.http.get<CabinOccupancy[]>(`${API_URL}/cabins/occupancy`, { params: { date } });
  }

  /** Rejilla de ocupacion: cabinas por dias. */
  calendar(from: string, days: number): Observable<CalendarData> {
    return this.http.get<CalendarData>(`${API_URL}/cabins/calendar`, {
      params: { from, days: String(days) }
    });
  }

  updateBooking(id: string, payload: unknown): Observable<unknown> {
    return this.http.put(`${API_URL}/bookings/${id}`, payload);
  }

  /** Cancela la reserva y libera sus noches. */
  cancelBooking(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/bookings/${id}`);
  }

  /** Reserva con sus abonos y el saldo pendiente. */
  bookingDetail(id: string): Observable<BookingDetail> {
    return this.http.get<BookingDetail>(`${API_URL}/bookings/${id}`);
  }

  addPayment(payload: unknown): Observable<{ payment: Payment; paid: number; balance: number }> {
    return this.http.post<{ payment: Payment; paid: number; balance: number }>(
      `${API_URL}/payments`,
      payload
    );
  }

  deletePayment(id: string): Observable<unknown> {
    return this.http.delete(`${API_URL}/payments/${id}`);
  }

  /** Huespedes que mas se repiten, para el acceso rapido. */
  frequentGuests(): Observable<FrequentGuest[]> {
    return this.http.get<FrequentGuest[]>(`${API_URL}/guests/frequent`);
  }

  companies(): Observable<Company[]> {
    return this.http.get<Company[]>(`${API_URL}/companies`);
  }

  updateCabin(id: string, payload: unknown): Observable<Cabin> {
    return this.http.put<Cabin>(`${API_URL}/cabins/${id}`, payload);
  }

  corporateRate(): Observable<{ rate: number }> {
    return this.http.get<{ rate: number }>(`${API_URL}/settings/corporate-rate`);
  }

  saveCorporateRate(rate: number): Observable<{ rate: number }> {
    return this.http.put<{ rate: number }>(`${API_URL}/settings/corporate-rate`, { rate });
  }

  fullPropertyRate(): Observable<FullPropertyRate> {
    return this.http.get<FullPropertyRate>(`${API_URL}/settings/full-property-rate`);
  }

  saveFullPropertyRate(payload: FullPropertyRate): Observable<FullPropertyRate> {
    return this.http.put<FullPropertyRate>(`${API_URL}/settings/full-property-rate`, payload);
  }

  /** Estado de limpieza de cada cabina en un momento dado. */
  cabinStatuses(date: string, time: string): Observable<StatusBoard> {
    return this.http.get<StatusBoard>(`${API_URL}/cabins/status`, { params: { date, time } });
  }

  /** Ajuste manual: 'ready', 'dirty' o vacio para volver al horario. */
  setCleaning(cabinId: string, payload: unknown): Observable<StatusBoard> {
    return this.http.put<StatusBoard>(`${API_URL}/cabins/${cabinId}/cleaning`, payload);
  }

  cleaningWindow(): Observable<CleaningWindow> {
    return this.http.get<CleaningWindow>(`${API_URL}/settings/cleaning`);
  }

  saveCleaningWindow(payload: CleaningWindow): Observable<CleaningWindow> {
    return this.http.put<CleaningWindow>(`${API_URL}/settings/cleaning`, payload);
  }

  updateGuest(id: string, payload: unknown): Observable<Guest> {
    return this.http.put<Guest>(`${API_URL}/guests/${id}`, payload);
  }

  tax(): Observable<TaxSettings> {
    return this.http.get<TaxSettings>(`${API_URL}/settings/tax`);
  }

  saveTax(payload: TaxSettings): Observable<TaxSettings> {
    return this.http.put<TaxSettings>(`${API_URL}/settings/tax`, payload);
  }

  /** Registra llegada o salida del huesped. */
  setBookingStatus(id: string, payload: unknown): Observable<unknown> {
    return this.http.patch(`${API_URL}/bookings/${id}/status`, payload);
  }

  incomeReport(from: string, to: string, groupBy: string): Observable<IncomeReport> {
    return this.http.get<IncomeReport>(`${API_URL}/reports/income`, {
      params: { from, to, groupBy }
    });
  }

  searchGuests(search: string): Observable<Guest[]> {
    return this.http.get<Guest[]>(`${API_URL}/guests`, { params: { search } });
  }

  createGuest(guest: GuestInput): Observable<Guest> {
    return this.http.post<Guest>(`${API_URL}/guests`, guest);
  }

  quote(payload: unknown): Observable<Quote> {
    return this.http.post<Quote>(`${API_URL}/bookings/quote`, payload);
  }

  createBooking(payload: unknown): Observable<{ _id: string }> {
    return this.http.post<{ _id: string }>(`${API_URL}/bookings`, payload);
  }
}
