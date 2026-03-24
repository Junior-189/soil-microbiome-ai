/**
 * Soil Microbiome Sensor — ESP32 Sketch
 * =======================================
 *
 * WIRING DIAGRAM:
 * ────────────────────────────────────────────────────────────────
 *  SENSOR               ESP32 GPIO        NOTES
 * ────────────────────────────────────────────────────────────────
 *  Capacitive Moisture  GPIO 36 (VP/A0)   Analog read
 *  DS18B20 Temp         GPIO 4            4.7kΩ pullup to 3.3V
 *  pH Sensor Module     GPIO 34 (A6)      Analog read, voltage divider needed
 *  NPK Sensor (RS485)   GPIO 16 (RX2) / GPIO 17 (TX2) + GPIO 2 (DE/RE)
 *  DHT22 Humidity       GPIO 5            Digital
 *  Status LED (Blue)    GPIO 2 (built-in) WiFi status
 * ────────────────────────────────────────────────────────────────
 *
 *  POWER:
 *    3.3V for all sensors (ESP32 GPIO is 3.3V)
 *    pH sensor may need voltage divider: 5V output -> use 2kΩ/3.3kΩ divider
 *
 * REQUIRED LIBRARIES:
 *   - WiFi (built-in ESP32)
 *   - HTTPClient (built-in ESP32)
 *   - ArduinoJson (by Benoit Blanchon)
 *   - OneWire (by Jim Studt et al.)
 *   - DallasTemperature (by Miles Burton)
 *   - DHT sensor library (by Adafruit)
 *
 * Board: "ESP32 Dev Module" — install ESP32 board package via Arduino Board Manager.
 * Deep sleep: powers down between readings to save battery.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>

// ── Configuration ─────────────────────────────────────────────────
#define WIFI_SSID         "your_wifi_ssid"
#define WIFI_PASSWORD     "your_wifi_password"
#define SERVER_URL        "http://192.168.1.100:5000"
#define DEVICE_SERIAL     "ESP-001"
#define SLEEP_SECONDS     30

// ── Pin Definitions ───────────────────────────────────────────────
#define MOISTURE_PIN      36    // ADC1_CH0 (VP)
#define PH_PIN            34    // ADC1_CH6
#define TEMP_PIN          4
#define DHT_PIN           5
#define RS485_DE_RE_PIN   2
#define STATUS_LED_PIN    2     // Built-in blue LED on most ESP32 dev boards

// ── Calibration ───────────────────────────────────────────────────
#define MOISTURE_DRY_VALUE  3200   // 12-bit ADC for ESP32
#define MOISTURE_WET_VALUE  1200
#define PH_VOLTAGE_AT_4     2.00f  // Volts (adjusted for 3.3V ADC reference)
#define PH_VOLTAGE_AT_7     1.65f

// ── Objects ───────────────────────────────────────────────────────
OneWire oneWire(TEMP_PIN);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHT_PIN, DHT22);

// RS485 NPK command (Renke sensor, same as Arduino)
const byte NPK_CMD[]  = {0x01, 0x03, 0x00, 0x00, 0x00, 0x03, 0x05, 0xCB};
const int  NPK_CMD_LEN = 8;

// ── connectWiFi ───────────────────────────────────────────────────
void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    Serial.print("Connecting to WiFi");
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        // Blink built-in LED while connecting
        digitalWrite(STATUS_LED_PIN, HIGH);
        delay(250);
        digitalWrite(STATUS_LED_PIN, LOW);
        delay(250);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println();
        Serial.print("Connected! IP: ");
        Serial.println(WiFi.localIP());
        // Green LED flash (3 quick flashes = success)
        for (int i = 0; i < 3; i++) {
            digitalWrite(STATUS_LED_PIN, HIGH); delay(100);
            digitalWrite(STATUS_LED_PIN, LOW);  delay(100);
        }
    } else {
        Serial.println("\nFailed to connect to WiFi after 3 attempts");
        // Long red LED flash = failure
        digitalWrite(STATUS_LED_PIN, HIGH);
        delay(1000);
        digitalWrite(STATUS_LED_PIN, LOW);
    }
}

// ── sendReading ───────────────────────────────────────────────────
bool sendReading(String jsonPayload) {
    if (WiFi.status() != WL_CONNECTED) return false;

    String url = String(SERVER_URL) + "/api/devices/" + DEVICE_SERIAL + "/ingest";
    HTTPClient http;

    int maxRetries = 3;
    for (int attempt = 0; attempt < maxRetries; attempt++) {
        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.setTimeout(10000);

        int code = http.POST(jsonPayload);

        if (code >= 200 && code < 300) {
            Serial.printf("[%d] Reading sent successfully (HTTP %d)\n", attempt + 1, code);
            http.end();
            // Success flash
            for (int i = 0; i < 2; i++) {
                digitalWrite(STATUS_LED_PIN, HIGH); delay(150);
                digitalWrite(STATUS_LED_PIN, LOW);  delay(150);
            }
            return true;
        } else {
            Serial.printf("[%d] Failed to send reading: HTTP %d\n", attempt + 1, code);
            http.end();
            if (attempt < maxRetries - 1) delay(2000);
        }
    }

    // Failure indicator
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(500);
    digitalWrite(STATUS_LED_PIN, LOW);
    return false;
}

// ── readMoisture ─────────────────────────────────────────────────
float readMoisture() {
    int raw = analogRead(MOISTURE_PIN);
    float moisture = map(raw, MOISTURE_DRY_VALUE, MOISTURE_WET_VALUE, 0, 100);
    return constrain(moisture, 0.0f, 100.0f);
}

// ── readTemperature ───────────────────────────────────────────────
float readTemperature() {
    ds18b20.requestTemperatures();
    float tempC = ds18b20.getTempCByIndex(0);
    if (tempC == DEVICE_DISCONNECTED_C) return -99.0f;
    return tempC;
}

// ── readPH ────────────────────────────────────────────────────────
float readPH() {
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PH_PIN);
        delay(10);
    }
    float avgAdc = sum / 10.0f;
    float voltage = avgAdc * (3.3f / 4095.0f);  // 12-bit ADC, 3.3V reference

    float ph = 4.0f + (voltage - PH_VOLTAGE_AT_4) * (3.0f / (PH_VOLTAGE_AT_7 - PH_VOLTAGE_AT_4));
    return constrain(ph, 0.0f, 14.0f);
}

// ── readNPK ───────────────────────────────────────────────────────
struct NPKReading { int nitrogen; int phosphorus; int potassium; bool valid; };

NPKReading readNPK() {
    NPKReading result = {0, 0, 0, false};

    digitalWrite(RS485_DE_RE_PIN, HIGH);
    delay(1);
    Serial2.write(NPK_CMD, NPK_CMD_LEN);
    Serial2.flush();
    digitalWrite(RS485_DE_RE_PIN, LOW);

    unsigned long start = millis();
    while (Serial2.available() < 9 && millis() - start < 500) delay(10);

    if (Serial2.available() >= 9) {
        byte buf[9];
        for (int i = 0; i < 9; i++) buf[i] = Serial2.read();
        result.nitrogen   = (buf[3] << 8) | buf[4];
        result.phosphorus = (buf[5] << 8) | buf[6];
        result.potassium  = (buf[7] << 8) | buf[8];
        result.valid = true;
    }
    while (Serial2.available()) Serial2.read();
    return result;
}

// ── readDHT ───────────────────────────────────────────────────────
struct DHTReading { float temperature; float humidity; bool valid; };

DHTReading readDHT() {
    DHTReading result = {0, 0, false};
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    if (!isnan(h) && !isnan(t)) {
        result.temperature = t;
        result.humidity = h;
        result.valid = true;
    }
    return result;
}

// ── buildJSON ─────────────────────────────────────────────────────
String buildJSON(float moisture, float soilTemp, float ph,
                 int N, int P, int K, float ambTemp, float humidity) {
    StaticJsonDocument<512> doc;
    doc["deviceSerial"]       = DEVICE_SERIAL;
    doc["soilMoisture"]       = round(moisture * 10) / 10.0f;
    doc["soilTemperature"]    = round(soilTemp * 10) / 10.0f;
    doc["soilPh"]             = round(ph * 100) / 100.0f;
    doc["nitrogenPpm"]        = N;
    doc["phosphorusPpm"]      = P;
    doc["potassiumPpm"]       = K;
    doc["ambientTemperature"] = round(ambTemp * 10) / 10.0f;
    doc["humidity"]           = round(humidity * 10) / 10.0f;
    doc["electricalConductivity"] = 1.2f;  // Placeholder (add EC sensor if available)
    doc["organicMatter"]      = 3.5f;      // Placeholder (lab test)
    String json;
    serializeJson(doc, json);
    return json;
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
    Serial.begin(115200);
    Serial2.begin(9600, SERIAL_8N1, 16, 17);  // RX=GPIO16, TX=GPIO17
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    pinMode(STATUS_LED_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW);

    ds18b20.begin();
    dht.begin();
    delay(2000);

    Serial.println("ESP32 Soil Sensor — " DEVICE_SERIAL);
    connectWiFi();
}

// ── Main Loop ─────────────────────────────────────────────────────
void loop() {
    float moisture = readMoisture();
    float soilTemp = readTemperature();
    float ph       = readPH();
    NPKReading npk = readNPK();
    DHTReading dht_data = readDHT();

    int N = npk.valid ? npk.nitrogen   : 0;
    int P = npk.valid ? npk.phosphorus : 0;
    int K = npk.valid ? npk.potassium  : 0;
    float ambTemp  = dht_data.valid ? dht_data.temperature : 25.0f;
    float humidity = dht_data.valid ? dht_data.humidity    : 60.0f;

    String json = buildJSON(moisture, soilTemp, ph, N, P, K, ambTemp, humidity);
    Serial.println(json);

    if (WiFi.status() == WL_CONNECTED) {
        bool sent = sendReading(json);
        if (!sent) Serial.println("Reading logged locally (WiFi send failed)");
    } else {
        Serial.println("WiFi disconnected — reading logged locally only");
        connectWiFi();
    }

    // Deep sleep to save power
    Serial.printf("Sleeping for %d seconds...\n", SLEEP_SECONDS);
    esp_deep_sleep((uint64_t)SLEEP_SECONDS * 1000000ULL);
}
