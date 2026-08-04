import mqtt from 'mqtt';
import { config } from '../config/env.js';
import { calculateAlerts } from '../services/alertService.js';

const DEVICE_ID = (process.env.SIMULATE_DEVICE_ID || 'esp32-01').trim();
const SCENARIOS = Object.freeze({
  normal: { temperature: 30, humidity: 60 },
  temperature: { temperature: 38, humidity: 60 },
  humidity: { temperature: 30, humidity: 75 },
  both: { temperature: 40, humidity: 80 }
});

function topicForDevice(pattern, deviceId) {
  if (pattern.includes('#') || pattern.split('+').length !== 2) {
    throw new Error('MQTT_TOPIC must contain exactly one + wildcard and no # wildcard');
  }
  return pattern.replace('+', deviceId);
}

function connect() {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(config.mqtt.url, {
      clientId: `sensor-simulator-${Date.now().toString(36)}`,
      username: config.mqtt.username,
      password: config.mqtt.password,
      clean: true,
      reconnectPeriod: 0,
      connectTimeout: 10000,
      keepalive: 30,
      rejectUnauthorized: true
    });
    client.once('connect', () => resolve(client));
    client.once('error', reject);
  });
}

function publish(client, topic, scenario) {
  const values = SCENARIOS[scenario];
  const alerts = calculateAlerts(values.temperature, values.humidity);
  const payload = JSON.stringify({ deviceId: DEVICE_ID, ...values, ...alerts });

  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (error) => {
      if (error) reject(error);
      else {
        console.log(`[SIMULATOR] ${scenario}: ${payload}`);
        resolve();
      }
    });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main() {
  const requested = process.argv[2] || 'demo';
  const scenarios = requested === 'demo' ? ['normal', 'temperature'] : [requested];
  if (scenarios.some((scenario) => !Object.hasOwn(SCENARIOS, scenario))) {
    throw new Error(`unknown scenario "${requested}"; use demo, normal, temperature, humidity or both`);
  }
  if (!DEVICE_ID || DEVICE_ID.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(DEVICE_ID)) {
    throw new Error('SIMULATE_DEVICE_ID contains unsupported characters or is too long');
  }

  const topic = topicForDevice(config.mqtt.topic, DEVICE_ID);
  const client = await connect();
  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      await publish(client, topic, scenarios[index]);
      if (index < scenarios.length - 1) await wait(2000);
    }
  } finally {
    client.end(true);
  }
}

main().catch((error) => {
  console.error(`[SIMULATOR] ${error.message}`);
  process.exitCode = 1;
});
