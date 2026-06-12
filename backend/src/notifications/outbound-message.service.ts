import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Outbound email/SMS service for guest-facing notifications.
 *
 * Email delivers for real through SMTP (nodemailer) once SMTP_* env vars
 * are set; without them every send is a structured log line, so dev and
 * un-configured installs stay silent-but-observable. SMS remains a stub —
 * Tajikistan deployments will use a local SMS gateway, which is a one-method
 * change here once an account exists.
 *
 * SMTP env contract:
 *   SMTP_HOST   e.g. smtp.gmail.com (required to enable)
 *   SMTP_PORT   default 587 (465 → implicit TLS)
 *   SMTP_USER / SMTP_PASS   auth (optional for open relays)
 *   SMTP_FROM   default "Artuch Travel <SMTP_USER>"
 */
@Injectable()
export class OutboundMessageService {
  private logger = new Logger('OutboundMessage');

  private smtpEnabled = !!process.env.SMTP_HOST;
  private twilioEnabled = !!process.env.TWILIO_ACCOUNT_SID;
  private transporter: Transporter | null = null;

  /** Lazily build (and reuse) the SMTP transport — boot must not depend on
   *  the mail server being reachable. */
  private getTransporter(): Transporter {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT) || 587;
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      });
    }
    return this.transporter;
  }

  private fromAddress(): string {
    return (
      process.env.SMTP_FROM ||
      `Artuch Travel <${process.env.SMTP_USER || 'noreply@artuch.org'}>`
    );
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    if (!to) return;
    if (!this.smtpEnabled) {
      this.logger.log(`[EMAIL stub] to=${to} subject="${subject}"`);
      return;
    }
    try {
      await this.getTransporter().sendMail({
        from: this.fromAddress(),
        to,
        subject,
        text: body,
      });
      this.logger.log(`[EMAIL sent] to=${to} subject="${subject}"`);
    } catch (e: any) {
      // Notifications are best-effort: a mail outage must never fail the
      // business operation (check-in, folio close) that triggered it.
      this.logger.error(`[EMAIL failed] to=${to}: ${e?.message ?? e}`);
    }
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
    try {
      await this.getTransporter().sendMail({
        from: this.fromAddress(),
        to,
        subject,
        html: safeHtml,
      });
      this.logger.log(
        `[EMAIL html sent] to=${to} subject="${subject}" size=${safeHtml.length}`,
      );
    } catch (e: any) {
      this.logger.error(`[EMAIL html failed] to=${to}: ${e?.message ?? e}`);
    }
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
