export const TEMPERATURE_LIMIT = 37;
export const HUMIDITY_LIMIT = 70;

export function calculateAlerts(temperature, humidity) {
  const temperatureAlert = temperature > TEMPERATURE_LIMIT;
  const humidityAlert = humidity > HUMIDITY_LIMIT;
  return {
    temperatureAlert,
    humidityAlert,
    alert: temperatureAlert || humidityAlert
  };
}

export function determineReason({ temperatureAlert, humidityAlert }) {
  if (temperatureAlert && humidityAlert) return 'TEMPERATURE_AND_HUMIDITY';
  if (temperatureAlert) return 'TEMPERATURE';
  if (humidityAlert) return 'HUMIDITY';
  return 'NONE';
}

export class AlertService {
  constructor({ getLastState = async () => null } = {}) {
    this.getLastState = getLastState;
    this.states = new Map();
    this.initializations = new Map();
  }

  async initializeDevice(deviceId) {
    if (this.states.has(deviceId)) return;
    if (!this.initializations.has(deviceId)) {
      this.initializations.set(deviceId, (async () => {
        let storedState = null;
        try {
          storedState = await this.getLastState(deviceId);
        } catch {
          // Availability is favored: a failed history lookup starts from NORMAL.
        }
        const status = typeof storedState === 'string' ? storedState : storedState?.status;
        const reason = status === 'ALERT' && typeof storedState === 'object'
          ? determineReason(storedState)
          : null;
        this.states.set(deviceId, { status: status === 'ALERT' ? 'ALERT' : 'NORMAL', reason });
      })());
    }
    await this.initializations.get(deviceId);
  }

  async evaluate(measurement) {
    await this.initializeDevice(measurement.deviceId);
    const previous = this.states.get(measurement.deviceId);
    const currentState = measurement.alert ? 'ALERT' : 'NORMAL';
    const currentReason = measurement.alert ? determineReason(measurement) : null;

    let event = null;
    if (previous.status === 'NORMAL' && currentState === 'ALERT') event = 'ALERT_STARTED';
    if (previous.status === 'ALERT' && currentState === 'NORMAL') event = 'ALERT_RESOLVED';
    const eventReason = event === 'ALERT_STARTED' ? currentReason : event === 'ALERT_RESOLVED' ? previous.reason : null;
    this.states.set(measurement.deviceId, { status: currentState, reason: currentReason });

    return {
      previousState: previous.status,
      currentState,
      event,
      reason: eventReason
    };
  }
}
