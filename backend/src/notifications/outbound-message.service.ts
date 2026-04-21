import { Injectable, Logger } from '@nestjs/common';

/**
 * Outbound email/SMS service for guest-facing notifications.
 *
 * Currently emits structured log lines so the call sites and templates exist
 * in production code; flipping to real delivery is a matter of installing
 * nodemailer and Twilio and replacing the body of the two `deliver*`
 * methods. SMTP/Twilio configuration is read from env so adding the SDK
 * later requires no other code changes.
 */
@Injectable()
export class OutboundMessageService {
  private logger = new Logger('OutboundMessage');

  private smtpEnabled = !!process.env.SMTP_HOST;
  private twilioEnabled = !!process.env.TWILIO_ACCOUNT_SID;

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (!to) return;
    if (!this.smtpEnabled) {
      this.logger.log(`[EMAIL stub] to=${to} subject="${subject}"`);
      return;
    }
    // TODO: integrate nodemailer
    this.logger.log(`[EMAIL] to=${to} subject="${subject}"`);
  }

  /**
   * Send an HTML email. Pre-rendered HTML is passed in verbatim — the
   * receipt screen on the client owns the template, we're only a delivery
   * pipe. That avoids duplicating the receipt layout across the RN/web
   * client and the backend (Node) runtimes.
   *
   * Treats `<script>` and `<iframe>` tags as injection attempts — strips
   * them rather than refusing the request, so a well-meaning caller isn't
   * blocked by an unexpected tag in a hotel note.
   */
  async sendHtmlEmail(to: string, subject: string, html: string): Promise<void> {
    if (!to) return;
    const safeHtml = sanitizeHtmlForEmail(html);
    if (!this.smtpEnabled) {
      this.logger.log(
        `[EMAIL stub html] to=${to} subject="${subject}" size=${safeHtml.length}`,
      );
      return;
    }
    // TODO: integrate nodemailer with html: safeHtml
    this.logger.log(
      `[EMAIL html] to=${to} subject="${subject}" size=${safeHtml.length}`,
    );
  }

  async sendSms(to: string, body: string): Promise<void> {
    if (!to) return;
    if (!this.twilioEnabled) {
      this.logger.log(`[SMS stub] to=${to} body="${body.slice(0, 60)}..."`);
      return;
    }
    // TODO: integrate Twilio
    this.logger.log(`[SMS] to=${to} body="${body.slice(0, 60)}..."`);
  }

  // ── Templates ───────────────────────────────────────────────────────────

  async notifyReservationCreated(opts: {
    email?: string;
    phone?: string;
    guestName: string;
    roomNumber: number;
    checkInDate: string;
    checkOutDate: string;
  }) {
    const subject = `Бронирование подтверждено — номер ${opts.roomNumber}`;
    const body =
      `${opts.guestName}, ваша бронь подтверждена.\n` +
      `Номер: ${opts.roomNumber}\n` +
      `Заезд: ${formatDate(opts.checkInDate)}\n` +
      `Выезд: ${formatDate(opts.checkOutDate)}\n` +
      `Ждём вас в Artuch Travel!`;
    await Promise.all([
      opts.email ? this.sendEmail(opts.email, subject, body) : undefined,
      opts.phone ? this.sendSms(opts.phone, body) : undefined,
    ]);
  }

  async notifyCheckInReminder(opts: {
    email?: string;
    phone?: string;
    guestName: string;
    roomNumber: number;
    checkInDate: string;
  }) {
    const subject = `Напоминание о заезде — ${formatDate(opts.checkInDate)}`;
    const body =
      `${opts.guestName}, ждём вас завтра в номере ${opts.roomNumber}.\n` +
      `Заезд: ${formatDate(opts.checkInDate)}.`;
    await Promise.all([
      opts.email ? this.sendEmail(opts.email, subject, body) : undefined,
      opts.phone ? this.sendSms(opts.phone, body) : undefined,
    ]);
  }

  async notifyFolioClosed(opts: {
    email?: string;
    phone?: string;
    guestName?: string;
    folioId: string;
    totalAmount: number;
    paidAmount: number;
  }) {
    const subject = `Чек по фолио — ${opts.totalAmount.toFixed(2)} TJS`;
    const body =
      `${opts.guestName || 'Уважаемый гость'}, ваше фолио закрыто.\n` +
      `Сумма: ${opts.totalAmount.toFixed(2)} TJS\n` +
      `Оплачено: ${opts.paidAmount.toFixed(2)} TJS\n` +
      `Спасибо, что выбрали Artuch Travel!`;
    await Promise.all([
      opts.email ? this.sendEmail(opts.email, subject, body) : undefined,
      opts.phone ? this.sendSms(opts.phone, body) : undefined,
    ]);
  }
}

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('ru-RU');
  } catch {
    return d;
  }
}

/**
 * Minimal HTML sanitiser for email bodies received from clients. Removes
 * script/iframe/object/embed tags and their contents, plus on-* event
 * handler attributes. Not a general-purpose XSS guard — this is a belt-
 * and-suspenders layer for trusted clients posting their own receipt
 * templates; the real control is the CASL guard that gates the endpoint.
 */
function sanitizeHtmlForEmail(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '');
}
