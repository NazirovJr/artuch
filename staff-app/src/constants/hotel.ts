/**
 * Hotel-wide branding constants for receipts, emails, and any other
 * customer-facing surface that needs the property name/contacts.
 *
 * Single source of truth: edit here once and every receipt/footer/email
 * picks it up. In the future this can move to a backend-served config so
 * multi-property deployments work; for now a static file is enough and
 * avoids an extra request at startup.
 */
export interface HotelInfo {
  name: string;
  /** Short one-liner under the name (e.g. "Hotel & Cafe in the Fann Mountains"). */
  tagline?: string;
  /** Street / postal address. */
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  /** Optional tax ID / ИНН for fiscal receipts. */
  taxId?: string;
}

export const HOTEL_INFO: HotelInfo = {
  name: 'Artuch Travel',
  tagline: 'Отель и база в Фанских горах',
  address: 'Таджикистан, Согдийская область, Фанские горы',
  phone: '+992 44 000 00 00',
  email: 'info@artuch.travel',
  website: 'artuch.travel',
};
