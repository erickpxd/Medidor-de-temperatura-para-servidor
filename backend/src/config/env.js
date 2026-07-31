import 'dotenv/config';

function integer(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function boolean(name, fallback) {
  const raw = (process.env[name] ?? String(fallback)).toLowerCase();
  if (!['true', 'false'].includes(raw)) {
    throw new Error(`${name} must be true or false`);
  }
  return raw === 'true';
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!value || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export const config = Object.freeze({
  mqtt: {
    url: required('MQTT_URL', 'mqtt://localhost:1883'),
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    topic: required('MQTT_TOPIC', 'iot/monitoring/+/vitals'),
    clientId: required('MQTT_CLIENT_ID', 'iot-monitoring-backend')
  },
  influx: {
    url: required('INFLUX_URL', 'http://localhost:8086'),
    token: required('INFLUX_TOKEN', 'change-me-development-token'),
    org: required('INFLUX_ORG', 'iot'),
    bucket: required('INFLUX_BUCKET', 'iot_monitoring')
  },
  smtp: {
    host: process.env.SMTP_HOST?.trim(),
    port: integer('SMTP_PORT', 587),
    secure: boolean('SMTP_SECURE', false),
    user: process.env.SMTP_USER?.trim(),
    password: process.env.SMTP_PASSWORD,
    to: process.env.ALERT_EMAIL_TO?.trim(),
    sendRecovery: boolean('SEND_RECOVERY_EMAIL', true)
  },
  logLevel: process.env.LOG_LEVEL || 'info'
});
