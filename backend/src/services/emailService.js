import nodemailer from 'nodemailer';
import { HUMIDITY_LIMIT, TEMPERATURE_LIMIT } from './alertService.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

export class EmailService {
  constructor({ smtp, logger }) {
    this.smtp = smtp;
    this.logger = logger;
    this.enabled = Boolean(smtp.host && smtp.to);
    this.transporter = this.enabled ? nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
      requireTLS: !smtp.secure,
      tls: { minVersion: 'TLSv1.2' },
      disableFileAccess: true,
      disableUrlAccess: true
    }) : null;

    if (!this.enabled) {
      this.logger.warn('EMAIL', 'SMTP disabled: configure SMTP_HOST and ALERT_EMAIL_TO to send notifications');
    }
  }

  async sendAlert(measurement, reason) {
    if (!this.enabled) return false;
    const when = measurement.timestamp.toISOString();
    const text = [
      'Alerta crítico detectado.', '',
      `Dispositivo: ${measurement.deviceId}`, '',
      `Temperatura: ${measurement.temperature} °C`,
      `Limite de temperatura: ${TEMPERATURE_LIMIT} °C`, '',
      `Umidade: ${measurement.humidity}%`,
      `Limite de umidade: ${HUMIDITY_LIMIT}%`, '',
      `Motivo: ${reason}`, '',
      `Data/Hora: ${when}`
    ].join('\n');
    const html = `<h2>Alerta crítico detectado</h2>
      <p><strong>Dispositivo:</strong> ${escapeHtml(measurement.deviceId)}</p>
      <p><strong>Temperatura:</strong> ${measurement.temperature} °C (limite: ${TEMPERATURE_LIMIT} °C)</p>
      <p><strong>Umidade:</strong> ${measurement.humidity}% (limite: ${HUMIDITY_LIMIT}%)</p>
      <p><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
      <p><strong>Data/Hora:</strong> ${when}</p>`;

    await this.transporter.sendMail({
      from: this.smtp.user || 'iot-monitor@localhost',
      to: this.smtp.to,
      subject: '[IoT ALERT] Limite crítico detectado',
      text,
      html
    });
    this.logger.info('EMAIL', 'Alert email sent', { device: measurement.deviceId });
    return true;
  }

  async sendRecovery(measurement) {
    if (!this.enabled || !this.smtp.sendRecovery) return false;
    const when = measurement.timestamp.toISOString();
    const text = [
      'Os valores retornaram aos limites normais.', '',
      `Dispositivo: ${measurement.deviceId}`, '',
      `Temperatura: ${measurement.temperature} °C`,
      `Umidade: ${measurement.humidity}%`, '',
      `Data/Hora: ${when}`
    ].join('\n');
    const html = `<h2>Valores normalizados</h2>
      <p><strong>Dispositivo:</strong> ${escapeHtml(measurement.deviceId)}</p>
      <p><strong>Temperatura:</strong> ${measurement.temperature} °C</p>
      <p><strong>Umidade:</strong> ${measurement.humidity}%</p>
      <p><strong>Data/Hora:</strong> ${when}</p>`;

    await this.transporter.sendMail({
      from: this.smtp.user || 'iot-monitor@localhost',
      to: this.smtp.to,
      subject: '[IoT RECOVERY] Valores normalizados',
      text,
      html
    });
    this.logger.info('EMAIL', 'Recovery email sent', { device: measurement.deviceId });
    return true;
  }
}
