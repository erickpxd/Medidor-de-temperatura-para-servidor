import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AlertService,
  calculateAlerts,
  determineReason
} from '../src/services/alertService.js';

function measurement(deviceId, temperature, humidity) {
  return { deviceId, temperature, humidity, ...calculateAlerts(temperature, humidity) };
}

test('uses strict critical limits and calculates device flags defensively', () => {
  assert.deepEqual(calculateAlerts(37, 70), {
    temperatureAlert: false,
    humidityAlert: false,
    alert: false
  });
  assert.deepEqual(calculateAlerts(37.1, 70.1), {
    temperatureAlert: true,
    humidityAlert: true,
    alert: true
  });
});

test('determines every supported alert reason', () => {
  assert.equal(determineReason(calculateAlerts(38, 60)), 'TEMPERATURE');
  assert.equal(determineReason(calculateAlerts(30, 75)), 'HUMIDITY');
  assert.equal(determineReason(calculateAlerts(40, 80)), 'TEMPERATURE_AND_HUMIDITY');
  assert.equal(determineReason(calculateAlerts(30, 60)), 'NONE');
});

test('emits NORMAL -> ALERT and ALERT -> NORMAL transitions', async () => {
  const service = new AlertService();
  const started = await service.evaluate(measurement('esp32-01', 38, 60));
  const resolved = await service.evaluate(measurement('esp32-01', 30, 60));

  assert.equal(started.event, 'ALERT_STARTED');
  assert.equal(started.reason, 'TEMPERATURE');
  assert.equal(resolved.event, 'ALERT_RESOLVED');
  assert.equal(resolved.currentState, 'NORMAL');
});

test('does not emit duplicate events or notifications during a sustained alert', async () => {
  const service = new AlertService();
  let notificationCount = 0;
  for (let index = 0; index < 5; index += 1) {
    const transition = await service.evaluate(measurement('esp32-01', 40, 60));
    if (transition.event === 'ALERT_STARTED') notificationCount += 1;
  }
  assert.equal(notificationCount, 1);
});

test('emits a new alert after recovery', async () => {
  const service = new AlertService();
  const sequence = [
    measurement('esp32-01', 30, 60),
    measurement('esp32-01', 40, 60),
    measurement('esp32-01', 30, 60),
    measurement('esp32-01', 40, 60)
  ];
  const events = [];
  for (const item of sequence) {
    const transition = await service.evaluate(item);
    if (transition.event) events.push(transition.event);
  }
  assert.deepEqual(events, ['ALERT_STARTED', 'ALERT_RESOLVED', 'ALERT_STARTED']);
});

test('restores ALERT state and reason from InfluxDB and avoids restart spam', async () => {
  const service = new AlertService({
    getLastState: async () => ({ status: 'ALERT', temperatureAlert: false, humidityAlert: true })
  });
  const continuing = await service.evaluate(measurement('esp32-01', 40, 80));
  const resolved = await service.evaluate(measurement('esp32-01', 30, 60));
  assert.equal(continuing.event, null);
  assert.equal(resolved.event, 'ALERT_RESOLVED');
  assert.equal(resolved.reason, 'TEMPERATURE_AND_HUMIDITY');
});
