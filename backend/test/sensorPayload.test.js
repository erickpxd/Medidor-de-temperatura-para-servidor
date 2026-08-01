import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSensorMessage, PayloadValidationError, validateSensorPayload } from '../src/validation/sensorPayload.js';

const validPayload = {
  deviceId: 'esp32-01',
  temperature: 36.5,
  humidity: 65.2,
  temperatureAlert: false,
  humidityAlert: false,
  alert: false
};

test('accepts and normalizes a valid payload', () => {
  assert.deepEqual(validateSensorPayload({ ...validPayload, deviceId: ' esp32-01 ' }), validPayload);
});

test('rejects malformed JSON without crashing the process', () => {
  assert.throws(() => parseSensorMessage(Buffer.from('{broken')), PayloadValidationError);
  assert.throws(() => parseSensorMessage(Buffer.alloc(4097, 'x')), PayloadValidationError);
});

test('rejects absent fields, non-finite numbers and invalid humidity', () => {
  assert.throws(
    () => validateSensorPayload({ ...validPayload, temperature: Number.NaN, humidity: 101, alert: 'false' }),
    (error) => error.issues.some((issue) => issue.includes('temperature')) &&
      error.issues.some((issue) => issue.includes('humidity')) &&
      error.issues.some((issue) => issue.includes('alert'))
  );
  assert.throws(() => validateSensorPayload({ deviceId: 'esp32-01' }), PayloadValidationError);
});

test('rejects an unsafe device identifier', () => {
  assert.throws(() => validateSensorPayload({ ...validPayload, deviceId: 'device with spaces' }), PayloadValidationError);
});
