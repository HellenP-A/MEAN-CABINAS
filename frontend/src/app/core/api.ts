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

export interface Guest {
  _id: string;
  idType?: 'national' | 'foreign';
  idNumber: string;
  fullName: string;
  phone?: string;
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
  total: number;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

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

  searchGuests(search: string): Observable<Guest[]> {
    return this.http.get<Guest[]>(`${API_URL}/guests`, { params: { search } });
  }

  createGuest(guest: Partial<Guest>): Observable<Guest> {
    return this.http.post<Guest>(`${API_URL}/guests`, guest);
  }

  quote(payload: unknown): Observable<Quote> {
    return this.http.post<Quote>(`${API_URL}/bookings/quote`, payload);
  }

  createBooking(payload: unknown): Observable<{ _id: string }> {
    return this.http.post<{ _id: string }>(`${API_URL}/bookings`, payload);
  }
}
