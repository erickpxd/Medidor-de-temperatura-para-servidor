#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHTesp.h>
#include <time.h>

constexpr int DHT_PIN = 15;
constexpr int BUZZER_PIN = 14;

constexpr float TEMPERATURE_LIMIT = 37.0;
constexpr float HUMIDITY_LIMIT = 70.0;

constexpr char WIFI_SSID[] = "Wokwi-GUEST";
constexpr char WIFI_PASSWORD[] = "";

// HiveMQ Cloud: substitua somente HOST, USERNAME e PASSWORD.
constexpr char MQTT_HOST[] = "YOUR_CLUSTER_URL.s1.eu.hivemq.cloud";
constexpr uint16_t MQTT_PORT = 8883;
constexpr char MQTT_USERNAME[] = "YOUR_ESP32_USERNAME";
constexpr char MQTT_PASSWORD[] = "YOUR_ESP32_PASSWORD";

// ISRG Root X1: valida a identidade TLS do HiveMQ Cloud.
static const char MQTT_ROOT_CA[] PROGMEM = R"CERT(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)CERT";

constexpr char DEVICE_ID[] = "esp32-01";
constexpr char VITALS_TOPIC[] = "jala/erick-lima/capstone-iot/esp32-01/vitals";
constexpr char STATUS_TOPIC[] = "jala/erick-lima/capstone-iot/esp32-01/status";

constexpr unsigned long SENSOR_INTERVAL_MS = 5000;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
constexpr unsigned long MQTT_RETRY_INTERVAL_MS = 5000;

WiFiClientSecure networkClient;
PubSubClient mqttClient(networkClient);
DHTesp dht;

unsigned long lastSensorReading = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastMqttAttempt = 0;
bool buzzerActive = false;
bool clockSyncStarted = false;

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

  if (time(nullptr) < 1700000000) {
    if (!clockSyncStarted) {
      clockSyncStarted = true;
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      Serial.println("[TLS] Synchronizing clock for certificate validation");
    }
    return;
  }

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
  networkClient.setCACert(MQTT_ROOT_CA);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setBufferSize(512);
  mqttClient.setSocketTimeout(10);
  mqttClient.setKeepAlive(30);

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
