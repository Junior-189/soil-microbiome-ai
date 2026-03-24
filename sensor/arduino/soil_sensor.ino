/**
 * Soil Microbiome Sensor — Arduino Sketch
 * =========================================
 *
 * WIRING DIAGRAM:
 * ────────────────────────────────────────────────────────────────
 *  SENSOR               ARDUINO PIN       NOTES
 * ────────────────────────────────────────────────────────────────
 *  Capacitive Moisture  A0                Analog read 0-1023
 *  DS18B20 Temp         Pin 4             4.7kΩ pullup to 5V required
 *  pH Sensor Module     A1                Analog read, voltage-mapped
 *  NPK Sensor (RS485)   Serial1 (Tx=18,Rx=19) + Pin 2 (DE/RE)
 *  DHT22 Humidity       Pin 3             Digital, pull-up required
 * ────────────────────────────────────────────────────────────────
 *
 *  POWER:
 *    Moisture sensor VCC -> 3.3V or 5V
 *    DS18B20 VCC -> 5V, GND -> GND
 *    pH module VCC -> 5V, GND -> GND, PO -> A1
 *    RS485 module VCC -> 5V, DI -> Serial1 TX, RO -> Serial1 RX
 *    DHT22 VCC -> 5V, DATA -> Pin 3 (with 10kΩ pullup to 5V)
 *
 * REQUIRED LIBRARIES (install via Library Manager):
 *   - OneWire (by Jim Studt et al.)
 *   - DallasTemperature (by Miles Burton)
 *   - DHT sensor library (by Adafruit)
 *   - ArduinoJson (by Benoit Blanchon)
 *
 * Serial output at 9600 baud — JSON every 30 seconds.
 */

#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ── Pin Definitions ──────────────────────────────────────────────
#define MOISTURE_PIN        A0
#define PH_PIN              A1
#define TEMP_PIN            4
#define DHT_PIN             3
#define RS485_DE_RE_PIN     2

// ── Calibration Constants ─────────────────────────────────────────
// Moisture: dry and wet raw ADC values (calibrate with your sensor)
#define MOISTURE_DRY_VALUE  850    // ADC value in completely dry soil
#define MOISTURE_WET_VALUE  380    // ADC value in fully saturated soil

// pH calibration: measure actual ADC values at pH 4.0 and pH 7.0 buffer
#define PH_VOLTAGE_AT_4     3.04f  // Volts at pH 4.0 (e.g. 623/1023 * 5.0)
#define PH_VOLTAGE_AT_7     2.51f  // Volts at pH 7.0

// ── Device ID ─────────────────────────────────────────────────────
#define DEVICE_SERIAL "ARD-001"

// ── Object Initialization ─────────────────────────────────────────
OneWire oneWire(TEMP_PIN);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHT_PIN, DHT22);

// RS485 Modbus RTU command for NPK sensor (standard Renke RS485 NPK sensor)
// Command: Read holding registers 0x0000 (N), 0x0001 (P), 0x0002 (K)
const byte NPK_CMD[] = {0x01, 0x03, 0x00, 0x00, 0x00, 0x03, 0x05, 0xCB};
const int  NPK_CMD_LEN = 8;

// ── readMoisture ──────────────────────────────────────────────────
float readMoisture() {
    int raw = analogRead(MOISTURE_PIN);
    // Map: higher ADC = drier soil -> lower moisture %
    float moisture = map(raw, MOISTURE_DRY_VALUE, MOISTURE_WET_VALUE, 0, 100);
    return constrain(moisture, 0.0f, 100.0f);
}

// ── readTemperature ───────────────────────────────────────────────
float readTemperature() {
    ds18b20.requestTemperatures();
    float tempC = ds18b20.getTempCByIndex(0);
    if (tempC == DEVICE_DISCONNECTED_C) {
        Serial.println(F("Warning: DS18B20 not detected"));
        return -99.0f;
    }
    return tempC;
}

// ── readPH ────────────────────────────────────────────────────────
float readPH() {
    // Average 10 samples for stability
    long sum = 0;
    for (int i = 0; i < 10; i++) {
        sum += analogRead(PH_PIN);
        delay(10);
    }
    float avgAdc = sum / 10.0f;
    float voltage = avgAdc * (5.0f / 1023.0f);

    // Linear interpolation between pH 4 and pH 7 calibration points
    // pH = 4 + (voltage - V_at_4) * (7 - 4) / (V_at_7 - V_at_4)
    float ph = 4.0f + (voltage - PH_VOLTAGE_AT_4) * (3.0f / (PH_VOLTAGE_AT_7 - PH_VOLTAGE_AT_4));
    return constrain(ph, 0.0f, 14.0f);
}

// ── readNPK ───────────────────────────────────────────────────────
struct NPKReading { int nitrogen; int phosphorus; int potassium; bool valid; };

NPKReading readNPK() {
    NPKReading result = {0, 0, 0, false};

    // Enable RS485 transmit mode
    digitalWrite(RS485_DE_RE_PIN, HIGH);
    delay(1);

    // Send Modbus RTU command
    Serial1.write(NPK_CMD, NPK_CMD_LEN);
    Serial1.flush();

    // Switch to receive mode
    digitalWrite(RS485_DE_RE_PIN, LOW);

    // Wait for response (9 bytes expected: addr + func + len + 6 data + CRC)
    unsigned long start = millis();
    while (Serial1.available() < 9 && millis() - start < 500) {
        delay(10);
    }

    if (Serial1.available() >= 9) {
        byte buf[9];
        for (int i = 0; i < 9; i++) {
            buf[i] = Serial1.read();
        }
        // Parse response: bytes 3-4 = N, 5-6 = P, 7-8 = K (in mg/kg = ppm)
        result.nitrogen   = (buf[3] << 8) | buf[4];
        result.phosphorus = (buf[5] << 8) | buf[6];
        result.potassium  = (buf[7] << 8) | buf[8];
        result.valid = true;
    } else {
        Serial.println(F("Warning: NPK sensor response timeout"));
    }
    // Flush remaining bytes
    while (Serial1.available()) Serial1.read();

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
    } else {
        Serial.println(F("Warning: DHT22 read failed"));
    }
    return result;
}

// ── buildJSON ─────────────────────────────────────────────────────
String buildJSON(float moisture, float soilTemp, float ph,
                 int N, int P, int K, float ambTemp, float humidity) {
    StaticJsonDocument<512> doc;
    doc["deviceSerial"]      = DEVICE_SERIAL;
    doc["soilMoisture"]      = round(moisture * 10) / 10.0f;
    doc["soilTemperature"]   = round(soilTemp * 10) / 10.0f;
    doc["soilPh"]            = round(ph * 100) / 100.0f;
    doc["nitrogenPpm"]       = N;
    doc["phosphorusPpm"]     = P;
    doc["potassiumPpm"]      = K;
    doc["ambientTemperature"]= round(ambTemp * 10) / 10.0f;
    doc["humidity"]          = round(humidity * 10) / 10.0f;
    doc["timestamp"]         = millis() / 1000;  // seconds since boot

    String json;
    serializeJson(doc, json);
    return json;
}

// ── Setup ─────────────────────────────────────────────────────────
void setup() {
    Serial.begin(9600);
    Serial1.begin(9600);  // RS485 NPK sensor
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW);

    ds18b20.begin();
    dht.begin();

    delay(2000);  // Allow sensors to stabilize
    Serial.println(F("Soil Microbiome Sensor Ready — " DEVICE_SERIAL));
    Serial.println(F("Sending JSON readings every 30 seconds..."));
}

// ── Main Loop ─────────────────────────────────────────────────────
void loop() {
    float moisture = readMoisture();
    float soilTemp = readTemperature();
    float ph       = readPH();
    NPKReading npk = readNPK();
    DHTReading dht_data = readDHT();

    // Use fallbacks if sensors failed
    int N = npk.valid ? npk.nitrogen   : 0;
    int P = npk.valid ? npk.phosphorus : 0;
    int K = npk.valid ? npk.potassium  : 0;
    float ambTemp = dht_data.valid ? dht_data.temperature : 25.0f;
    float humidity = dht_data.valid ? dht_data.humidity  : 60.0f;

    String json = buildJSON(moisture, soilTemp, ph, N, P, K, ambTemp, humidity);
    Serial.println(json);

    delay(30000);  // 30 seconds between readings
}
