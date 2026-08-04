#include <WiFi.h>
#include <PubSubClient.h>
#include <DHTesp.h>

constexpr int DHT_PIN = 15;
constexpr int BUZZER_PIN = 14;

constexpr float TEMPERATURE_LIMIT = 37.0;
constexpr float HUMIDITY_LIMIT = 70.0;

constexpr char WIFI_SSID[] = "Wokwi-GUEST";
constexpr char WIFI_PASSWORD[] = "";

// Public, unencrypted broker for Wokwi demonstrations only. For production,
// replace this configuration with a private MQTTS endpoint and WiFiClientSecure.
constexpr char MQTT_HOST[] = "broker.hivemq.com";
constexpr uint16_t MQTT_PORT = 1883;
constexpr char MQTT_USERNAME[] = "";
constexpr char MQTT_PASSWORD[] = "";

constexpr char DEVICE_ID[] = "esp32-01";
constexpr char VITALS_TOPIC[] = "jala/erick-lima/capstone-iot/esp32-01/vitals";
constexpr char STATUS_TOPIC[] = "jala/erick-lima/capstone-iot/esp32-01/status";

constexpr unsigned long SENSOR_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
constexpr unsigned long MQTT_RETRY_INTERVAL_MS = 5000;

WiFiClient networkClient;
PubSubClient mqttClient(networkClient);
DHTesp dht;

unsigned long lastSensorReading = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
bool buzzerActive = false;

void setBuzzer(bool active) {
  if (active == buzzerActive) return;

  buzzerActive = active;
  if (active) {
    tone(BUZZER_PIN, 1000);
    Serial.println("[BUZZER] ON");
  } else {
    noTone(BUZZER_PIN);
    digitalWrite(BUZZER_PIN, LOW);
    Serial.println("[BUZZER] OFF");
  }
}

void connectWifiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) return;

  const unsigned long now = millis();
  if (now - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;
  lastWifiAttempt = now;

  Serial.printf("[WIFI] Connecting to %s\n", WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectMqttIfNeeded() {
  if (WiFi.status() != WL_CONNECTED || mqttClient.connected()) return;

  const unsigned long now = millis();
  if (now - lastMqttAttempt < MQTT_RETRY_INTERVAL_MS) return;
  lastMqttAttempt = now;

  String clientId = String(DEVICE_ID) + "-" + String(static_cast<uint32_t>(ESP.getEfuseMac()), HEX);
  Serial.printf("[MQTT] Connecting to %s:%u\n", MQTT_HOST, MQTT_PORT);

  const bool connected = mqttClient.connect(
    clientId.c_str(),
    MQTT_USERNAME,
    MQTT_PASSWORD,
    STATUS_TOPIC,
    1,
    true,
    "offline"
  );

  if (connected) {
    mqttClient.publish(STATUS_TOPIC, "online", true);
    Serial.println("[MQTT] Connected");
  } else {
    Serial.printf("[MQTT] Connection failed, state=%d\n", mqttClient.state());
  }
}

void readAndPublishSensor() {
  const TempAndHumidity data = dht.getTempAndHumidity();
  if (isnan(data.temperature) || isnan(data.humidity) ||
      !isfinite(data.temperature) || !isfinite(data.humidity) ||
      data.humidity < 0.0 || data.humidity > 100.0) {
    Serial.println("[SENSOR] Invalid DHT22 reading discarded");
    return;
  }

  const bool temperatureAlert = data.temperature > TEMPERATURE_LIMIT;
  const bool humidityAlert = data.humidity > HUMIDITY_LIMIT;
  const bool alert = temperatureAlert || humidityAlert;

  // This edge decision deliberately runs before and independently of MQTT.
  setBuzzer(alert);

  char payload[256];
  snprintf(
    payload,
    sizeof(payload),
    "{\"deviceId\":\"%s\",\"temperature\":%.2f,\"humidity\":%.2f,"
    "\"temperatureAlert\":%s,\"humidityAlert\":%s,\"alert\":%s}",
    DEVICE_ID,
    data.temperature,
    data.humidity,
    temperatureAlert ? "true" : "false",
    humidityAlert ? "true" : "false",
    alert ? "true" : "false"
  );

  Serial.printf(
    "[SENSOR] temperature=%.2fC humidity=%.2f%% status=%s\n",
    data.temperature,
    data.humidity,
    alert ? "ALERT" : "NORMAL"
  );

  if (!mqttClient.connected()) {
    Serial.println("[MQTT] Offline; local alert remains active and measurement was not published");
    return;
  }

  if (mqttClient.publish(VITALS_TOPIC, payload)) {
    Serial.printf("[MQTT] Published %s\n", payload);
  } else {
    Serial.println("[MQTT] Publish failed");
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  dht.setup(DHT_PIN, DHTesp::DHT22);

  WiFi.mode(WIFI_STA);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setSocketTimeout(2);

  // Allow immediate connection attempts and an immediate first reading.
  lastWifiAttempt = millis() - WIFI_RETRY_INTERVAL_MS;
  lastMqttAttempt = millis() - MQTT_RETRY_INTERVAL_MS;
  lastSensorReading = millis() - SENSOR_INTERVAL_MS;
  Serial.println("[SYSTEM] ESP32 IoT monitor started");
}

void loop() {
  connectWifiIfNeeded();
  connectMqttIfNeeded();

  if (mqttClient.connected()) mqttClient.loop();

  const unsigned long now = millis();
  if (now - lastSensorReading >= SENSOR_INTERVAL_MS) {
    lastSensorReading = now;
    readAndPublishSensor();
  }

  delay(10);
}
