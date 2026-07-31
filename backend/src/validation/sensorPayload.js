const REQUIRED_FIELDS = [
  'deviceId',
  'temperature',
  'humidity',
  'temperatureAlert',
  'humidityAlert',
  'alert'
];

export class PayloadValidationError extends Error {
  constructor(issues) {
    super(`Invalid sensor payload: ${issues.join('; ')}`);
    this.name = 'PayloadValidationError';
    this.issues = issues;
  }
}

export function validateSensorPayload(value) {
  const issues = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PayloadValidationError(['payload must be a JSON object']);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!Object.hasOwn(value, field)) issues.push(`${field} is required`);
  }

  const normalizedDeviceId = typeof value.deviceId === 'string' ? value.deviceId.trim() : '';
  if (!normalizedDeviceId) {
    issues.push('deviceId must be a non-empty string');
  } else if (normalizedDeviceId.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(normalizedDeviceId)) {
    issues.push('deviceId contains unsupported characters or is too long');
  }

  if (typeof value.temperature !== 'number' || !Number.isFinite(value.temperature)) {
    issues.push('temperature must be a finite number');
  }

  if (typeof value.humidity !== 'number' || !Number.isFinite(value.humidity)) {
    issues.push('humidity must be a finite number');
  } else if (value.humidity < 0 || value.humidity > 100) {
    issues.push('humidity must be between 0 and 100');
  }

  for (const field of ['temperatureAlert', 'humidityAlert', 'alert']) {
    if (typeof value[field] !== 'boolean') issues.push(`${field} must be a boolean`);
  }

  if (issues.length > 0) throw new PayloadValidationError(issues);

  return {
    deviceId: normalizedDeviceId,
    temperature: value.temperature,
    humidity: value.humidity,
    temperatureAlert: value.temperatureAlert,
    humidityAlert: value.humidityAlert,
    alert: value.alert
  };
}

export function parseSensorMessage(buffer) {
  if (buffer.length > 4096) {
    throw new PayloadValidationError(['payload exceeds the 4096-byte limit']);
  }
  let parsed;
  try {
    parsed = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new PayloadValidationError(['payload is not valid JSON']);
  }
  return validateSensorPayload(parsed);
}
