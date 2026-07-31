import mqtt from 'mqtt';

export function createMqttClient({ mqtt: settings, logger, onMessage }) {
  const client = mqtt.connect(settings.url, {
    clientId: settings.clientId,
    username: settings.username,
    password: settings.password,
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    keepalive: 30,
    rejectUnauthorized: true
  });

  client.on('connect', () => {
    logger.info('MQTT', 'Connected');
    client.subscribe(settings.topic, { qos: 1 }, (error) => {
      if (error) logger.error('MQTT', 'Subscription failed', { error: error.message });
      else logger.info('MQTT', 'Subscribed', { topic: settings.topic });
    });
  });
  client.on('reconnect', () => logger.warn('MQTT', 'Reconnecting'));
  client.on('offline', () => logger.warn('MQTT', 'Offline'));
  client.on('error', (error) => logger.error('MQTT', 'Client error', { error: error.message }));
  client.on('message', (topic, payload) => onMessage(topic, payload));

  return client;
}
