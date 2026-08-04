import { InfluxDB, Point } from '@influxdata/influxdb-client';
import { config } from '../config/env.js';
import { calculateAlerts, determineReason } from '../services/alertService.js';

function positiveInteger(name, fallback, maximum) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function sample(index, total, intervalMinutes, timestamp) {
  const date = new Date(timestamp);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const dailyPhase = ((hour - 6) / 24) * Math.PI * 2;
  const noise = Math.sin(index * 1.73) * 0.45 + Math.cos(index * 0.37) * 0.25;

  let temperature = 28 + Math.sin(dailyPhase) * 4.2 + noise;
  let humidity = 58 - Math.sin(dailyPhase) * 8 + Math.cos(index * 0.51) * 1.4;

  // Three short, deterministic alert windows exercise every dashboard state.
  if (hour >= 11 && hour < 12) temperature += 10;
  if (hour >= 17 && hour < 18) humidity += 18;
  if (hour >= 20 && hour < 20.5) {
    temperature += 14;
    humidity += 20;
  }

  const hoursBeforeEnd = (total - 1 - index) * intervalMinutes / 60;
  if (hoursBeforeEnd > 4.5 && hoursBeforeEnd <= 5) temperature += 12;
  if (hoursBeforeEnd > 3 && hoursBeforeEnd <= 3.5) humidity += 20;
  if (hoursBeforeEnd > 1.5 && hoursBeforeEnd <= 2) {
    temperature += 14;
    humidity += 20;
  }

  // Leave the newest samples normal so the live Wokwi alert is a fresh transition.
  if (index >= total - 2) {
    temperature = 29 + index % 2 * 0.2;
    humidity = 60 + index % 2 * 0.3;
  }

  return { temperature: round(temperature), humidity: round(humidity) };
}

async function main() {
  const hours = positiveInteger('SEED_HOURS', 72, 24 * 30);
  const intervalMinutes = positiveInteger('SEED_INTERVAL_MINUTES', 5, 60);
  const deviceId = (process.env.SEED_DEVICE_ID || 'esp32-01').trim();
  if (!deviceId || deviceId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(deviceId)) {
    throw new Error('SEED_DEVICE_ID contains unsupported characters or is too long');
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  const end = Math.floor(Date.now() / intervalMs) * intervalMs - intervalMs;
  const total = Math.floor(hours * 60 / intervalMinutes) + 1;
  const start = end - (total - 1) * intervalMs;
  const client = new InfluxDB({ url: config.influx.url, token: config.influx.token });
  const writeApi = client.getWriteApi(config.influx.org, config.influx.bucket, 'ms', {
    batchSize: 500,
    flushInterval: 1000,
    maxRetries: 5
  });

  let previousAlert = false;
  let previousReason = null;
  let eventCount = 0;

  for (let index = 0; index < total; index += 1) {
    const timestamp = new Date(start + index * intervalMs);
    const values = sample(index, total, intervalMinutes, timestamp);
    const alerts = calculateAlerts(values.temperature, values.humidity);
    const reason = alerts.alert ? determineReason(alerts) : null;

    writeApi.writePoint(new Point('environment')
      .tag('deviceId', deviceId)
      .tag('status', alerts.alert ? 'ALERT' : 'NORMAL')
      .floatField('temperature', values.temperature)
      .floatField('humidity', values.humidity)
      .booleanField('temperatureAlert', alerts.temperatureAlert)
      .booleanField('humidityAlert', alerts.humidityAlert)
      .booleanField('alert', alerts.alert)
      .timestamp(timestamp));

    const event = !previousAlert && alerts.alert
      ? 'ALERT_STARTED'
      : previousAlert && !alerts.alert ? 'ALERT_RESOLVED' : null;
    if (event) {
      writeApi.writePoint(new Point('alert_events')
        .tag('deviceId', deviceId)
        .tag('event', event)
        .tag('reason', event === 'ALERT_STARTED' ? reason : previousReason)
        .floatField('temperature', values.temperature)
        .floatField('humidity', values.humidity)
        .timestamp(timestamp));
      eventCount += 1;
    }

    previousAlert = alerts.alert;
    previousReason = reason;
  }

  await writeApi.close();
  console.log(JSON.stringify({
    deviceId,
    measurements: total,
    alertEvents: eventCount,
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString()
  }, null, 2));
}

main().catch((error) => {
  console.error(`[SEED] ${error.message}`);
  process.exitCode = 1;
});
