import { config } from './config/env.js';
import { InfluxRepository } from './database/influxClient.js';
import { createMqttClient } from './mqtt/mqttClient.js';
import { AlertService, calculateAlerts } from './services/alertService.js';
import { EmailService } from './services/emailService.js';
import { parseSensorMessage, PayloadValidationError } from './validation/sensorPayload.js';
import { logger } from './utils/logger.js';

const influx = new InfluxRepository({ influx: config.influx, logger });
const alerts = new AlertService({ getLastState: (deviceId) => influx.getLastState(deviceId) });
const email = new EmailService({ smtp: config.smtp, logger });

async function processMessage(topic, payload) {
  try {
    const received = parseSensorMessage(payload);
    const topicDeviceId = topic.split('/').at(-2);
    if (topicDeviceId !== received.deviceId) {
      throw new PayloadValidationError(['deviceId does not match the MQTT topic namespace']);
    }
    const calculated = calculateAlerts(received.temperature, received.humidity);
    const inconsistent = received.temperatureAlert !== calculated.temperatureAlert ||
      received.humidityAlert !== calculated.humidityAlert || received.alert !== calculated.alert;
    if (inconsistent) {
      logger.warn('VALIDATION', 'Device alert flags were inconsistent and have been replaced', {
        device: received.deviceId,
        topic
      });
    }

    const measurement = { ...received, ...calculated, timestamp: new Date() };
    logger.info('SENSOR', 'Measurement received', {
      device: measurement.deviceId,
      temperature: measurement.temperature,
      humidity: measurement.humidity,
      status: measurement.alert ? 'ALERT' : 'NORMAL'
    });

    await influx.writeEnvironment(measurement);
    const transition = await alerts.evaluate(measurement);
    if (!transition.event) return;

    await influx.writeAlertEvent(measurement, transition);
    logger.info('ALERT', 'State transition', {
      device: measurement.deviceId,
      event: transition.event,
      reason: transition.reason
    });

    try {
      if (transition.event === 'ALERT_STARTED') await email.sendAlert(measurement, transition.reason);
      if (transition.event === 'ALERT_RESOLVED') await email.sendRecovery(measurement);
    } catch (error) {
      logger.error('EMAIL', 'Notification failed; measurement processing continues', { error: error.message });
    }
  } catch (error) {
    if (error instanceof PayloadValidationError) {
      logger.warn('VALIDATION', 'Message discarded', { topic, issues: error.issues });
      return;
    }
    logger.error('BACKEND', 'Message processing failed', { topic, error: error.message });
  }
}

const mqttClient = createMqttClient({ mqtt: config.mqtt, logger, onMessage: processMessage });

async function shutdown(signal) {
  logger.info('SYSTEM', 'Graceful shutdown requested', { signal });
  mqttClient.end(true);
  try {
    await influx.close();
  } catch (error) {
    logger.error('INFLUX', 'Failed to flush pending writes during shutdown', { error: error.message });
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => logger.error('SYSTEM', 'Uncaught exception', { error: error.message }));
process.on('unhandledRejection', (error) => logger.error('SYSTEM', 'Unhandled rejection', { error: error?.message || String(error) }));

logger.info('SYSTEM', 'IoT monitoring backend started');
