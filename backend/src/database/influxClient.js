import { InfluxDB, Point } from '@influxdata/influxdb-client';

function escapeFluxString(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export class InfluxRepository {
  constructor({ influx, logger }) {
    this.influx = influx;
    this.logger = logger;
    this.client = new InfluxDB({ url: influx.url, token: influx.token });
    this.writeApi = this.client.getWriteApi(influx.org, influx.bucket, 'ms', {
      batchSize: 1,
      flushInterval: 1000,
      maxRetries: 5,
      writeFailed: (error, lines, attempts) => {
        this.logger.error('INFLUX', 'Write failed', { error: error.message, attempts, points: lines.length });
      }
    });
    this.queryApi = this.client.getQueryApi(influx.org);
  }

  async writeEnvironment(measurement) {
    const point = new Point('environment')
      .tag('deviceId', measurement.deviceId)
      .tag('status', measurement.alert ? 'ALERT' : 'NORMAL')
      .floatField('temperature', measurement.temperature)
      .floatField('humidity', measurement.humidity)
      .booleanField('temperatureAlert', measurement.temperatureAlert)
      .booleanField('humidityAlert', measurement.humidityAlert)
      .booleanField('alert', measurement.alert)
      .timestamp(measurement.timestamp);
    this.writeApi.writePoint(point);
    this.logger.info('INFLUX', 'Environment measurement queued', { device: measurement.deviceId });
  }

  async writeAlertEvent(measurement, transition) {
    const point = new Point('alert_events')
      .tag('deviceId', measurement.deviceId)
      .tag('event', transition.event)
      .tag('reason', transition.reason)
      .floatField('temperature', measurement.temperature)
      .floatField('humidity', measurement.humidity)
      .timestamp(measurement.timestamp);
    this.writeApi.writePoint(point);
    this.logger.info('INFLUX', 'Alert event queued', { device: measurement.deviceId, event: transition.event });
  }

  async getLastState(deviceId) {
    const query = `from(bucket: "${escapeFluxString(this.influx.bucket)}")
      |> range(start: 0)
      |> filter(fn: (r) => r._measurement == "environment")
      |> filter(fn: (r) => r.deviceId == "${escapeFluxString(deviceId)}")
      |> filter(fn: (r) => contains(value: r._field, set: ["alert", "temperatureAlert", "humidityAlert"]))
      |> last()
      |> group(columns: ["deviceId", "status"])
      |> pivot(rowKey: ["deviceId", "status"], columnKey: ["_field"], valueColumn: "_value")`;
    let state = null;
    for await (const { values, tableMeta } of this.queryApi.iterateRows(query)) {
      const row = tableMeta.toObject(values);
      state = {
        status: row.status || (row.alert ? 'ALERT' : 'NORMAL'),
        temperatureAlert: Boolean(row.temperatureAlert),
        humidityAlert: Boolean(row.humidityAlert)
      };
    }
    return state;
  }

  async close() {
    await this.writeApi.close();
  }
}
