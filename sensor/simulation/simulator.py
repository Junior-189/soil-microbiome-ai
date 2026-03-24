"""
ESP32 Soil Sensor Simulator
============================
Simulates an ESP32 soil sensor posting realistic readings to the backend server.

Usage:
    python simulator.py --device-serial ESP-001
                        --server http://localhost:5000
                        --interval 10
                        --farm-id <uuid>
                        --count 0  (0 = infinite)
"""

import argparse
import math
import random
import sys
import time
from datetime import datetime, timezone

import requests


# ── Stateful moisture drift (persists between calls) ──────────────
_state = {
    "moisture": random.uniform(40, 65),
    "ph": random.uniform(6.0, 7.0),
    "n": random.uniform(25, 45),
    "p": random.uniform(18, 35),
    "k": random.uniform(120, 220),
}


def generate_reading(device_serial: str, farm_id: str = None) -> dict:
    """
    Generate a realistic soil sensor reading.
    - Temperature varies with time of day (cooler at night, warmer midday)
    - Moisture drifts slowly between calls
    - pH stable with small noise
    - NPK varies in realistic agricultural ranges
    - 5% chance of anomaly spike for realism
    """
    now = datetime.now(tz=timezone.utc)
    hour = now.hour + now.minute / 60.0

    # Temperature: sinusoidal over 24 hours (min ~18°C at 6am, max ~34°C at 2pm)
    soil_temp = 26 + 8 * math.sin((hour - 14) * math.pi / 12)
    ambient_temp = 28 + 10 * math.sin((hour - 14) * math.pi / 12)

    # Moisture: slow random drift ±2% per reading, bounded 20-90%
    drift = random.uniform(-2, 2)
    _state["moisture"] = max(20, min(90, _state["moisture"] + drift))

    # pH: very stable ±0.05
    _state["ph"] = max(4.5, min(8.5, _state["ph"] + random.uniform(-0.05, 0.05)))

    # NPK: drift within ranges
    _state["n"] = max(5, min(80, _state["n"] + random.uniform(-3, 3)))
    _state["p"] = max(5, min(60, _state["p"] + random.uniform(-2, 2)))
    _state["k"] = max(50, min(350, _state["k"] + random.uniform(-10, 10)))

    # Anomaly spike (5% chance) — simulates sensor glitch or soil event
    anomaly = random.random() < 0.05
    if anomaly:
        spike_type = random.choice(["moisture", "n", "ph"])
        if spike_type == "moisture":
            _state["moisture"] = random.choice([random.uniform(5, 15), random.uniform(85, 95)])
        elif spike_type == "n":
            _state["n"] = random.uniform(0, 5)
        else:
            _state["ph"] = random.choice([random.uniform(4.0, 4.8), random.uniform(7.8, 8.5)])

    reading = {
        "deviceSerial": device_serial,
        "soilMoisture": round(_state["moisture"], 1),
        "soilTemperature": round(soil_temp, 1),
        "soilPh": round(_state["ph"], 2),
        "electricalConductivity": round(random.uniform(0.3, 2.5), 2),
        "bulkDensity": round(random.uniform(1.0, 1.6), 2),
        "organicMatter": round(random.uniform(1.5, 5.5), 1),
        "nitrogenPpm": round(_state["n"], 1),
        "phosphorusPpm": round(_state["p"], 1),
        "potassiumPpm": round(_state["k"], 0),
        "calciumPpm": round(random.uniform(400, 1800), 0),
        "magnesiumPpm": round(random.uniform(40, 180), 0),
        "sulfurPpm": round(random.uniform(8, 45), 1),
        "microbialDiversityIndex": round(random.uniform(2.5, 6.8), 2),
        "nitrogenFixingBacteriaRatio": round(random.uniform(8, 35), 1),
        "mycorrhizalFungiPresence": random.random() > 0.4,
        "pathogenicFungiRatio": round(random.uniform(0.5, 12), 1),
        "bacterialCountCfu": round(random.uniform(5, 120), 1),
        "rainfallMm": round(random.uniform(0, 40), 1),
        "ambientTemperature": round(ambient_temp, 1),
        "humidity": round(random.uniform(40, 85), 1),
        "fertilizerKgPerHa": round(random.uniform(80, 400), 0),
        "previousYieldTons": round(random.uniform(2.5, 8.5), 2),
        "growingSeasonDays": random.randint(85, 160),
        "source": "SIMULATED",
        "isAnomaly": anomaly,
    }

    if farm_id:
        reading["farmId"] = farm_id

    return reading


def post_reading(server: str, device_serial: str, reading: dict) -> bool:
    """POST reading to server ingest endpoint."""
    url = f"{server}/api/devices/{device_serial}/ingest"
    timestamp = datetime.now(tz=timezone.utc).strftime("%H:%M:%S UTC")

    try:
        resp = requests.post(
            url,
            json=reading,
            timeout=10,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code in (200, 201):
            print(f"[{timestamp}] ✓ Reading sent — HTTP {resp.status_code}")
            return True
        else:
            print(f"[{timestamp}] ✗ Failed: HTTP {resp.status_code} — {resp.text[:200]}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"[{timestamp}] ✗ Connection refused. Is the server running at {server}?")
        return False
    except requests.exceptions.Timeout:
        print(f"[{timestamp}] ✗ Request timed out.")
        return False
    except Exception as e:
        print(f"[{timestamp}] ✗ Error: {e}")
        return False


def format_reading(reading: dict) -> str:
    """Format reading dict as a pretty console table."""
    lines = [
        f"  {'─'*44}",
        f"  Device:       {reading.get('deviceSerial', 'N/A')}",
        f"  Farm ID:      {reading.get('farmId', 'N/A')}",
        f"  {'─'*44}",
        f"  Moisture:     {reading['soilMoisture']:>6.1f} %        pH:         {reading['soilPh']:>5.2f}",
        f"  Soil Temp:    {reading['soilTemperature']:>6.1f} °C      Amb. Temp:  {reading['ambientTemperature']:>5.1f} °C",
        f"  Humidity:     {reading['humidity']:>6.1f} %        EC:         {reading['electricalConductivity']:>5.2f} dS/m",
        f"  Nitrogen:     {reading['nitrogenPpm']:>6.1f} ppm     Phosphorus: {reading['phosphorusPpm']:>5.1f} ppm",
        f"  Potassium:    {reading['potassiumPpm']:>6.0f} ppm     Org. Matter:{reading['organicMatter']:>5.1f} %",
        f"  Microb. Div:  {reading['microbialDiversityIndex']:>6.2f}          N-Fix Bact: {reading['nitrogenFixingBacteriaRatio']:>5.1f} %",
        f"  Patho. Fungi: {reading['pathogenicFungiRatio']:>6.1f} %        Mycorrhizae:{str(reading['mycorrhizalFungiPresence']):>6}",
        f"  {'─'*44}",
    ]
    if reading.get("isAnomaly"):
        lines.append("  ⚠  ANOMALY SPIKE INJECTED (5% chance event)")
        lines.append(f"  {'─'*44}")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Simulate an ESP32 soil sensor posting to the backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python simulator.py\n"
            "  python simulator.py --device-serial ESP-002 --interval 5 --count 50\n"
            "  python simulator.py --server http://localhost:5000 --farm-id <uuid>"
        ),
    )
    parser.add_argument("--device-serial", default="ESP-001", help="Device serial number")
    parser.add_argument("--server", default="http://localhost:5000", help="Backend server URL")
    parser.add_argument("--interval", type=int, default=10, help="Seconds between readings")
    parser.add_argument("--farm-id", default=None, help="Farm UUID (optional)")
    parser.add_argument("--count", type=int, default=0, help="Number of readings (0=infinite)")

    args = parser.parse_args()

    print(f"\nSoil Sensor Simulator")
    print(f"{'═'*46}")
    print(f"  Device:   {args.device_serial}")
    print(f"  Server:   {args.server}")
    print(f"  Interval: {args.interval}s")
    print(f"  Count:    {'∞' if args.count == 0 else args.count}")
    print(f"  Farm ID:  {args.farm_id or 'auto-detected from device'}")
    print(f"{'═'*46}\n")
    print("Press Ctrl+C to stop\n")

    sent_count = 0
    fail_count = 0
    total = 0

    try:
        while True:
            total += 1
            reading = generate_reading(args.device_serial, args.farm_id)

            timestamp = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            print(f"\n[Reading #{total}] {timestamp}")
            print(format_reading(reading))

            success = post_reading(args.server, args.device_serial, reading)
            if success:
                sent_count += 1
            else:
                fail_count += 1

            if args.count > 0 and total >= args.count:
                break

            time.sleep(args.interval)

    except KeyboardInterrupt:
        print("\n\nSimulator stopped by user.")
    finally:
        print(f"\n{'═'*46}")
        print(f"  Session Summary:")
        print(f"  Total readings:  {total}")
        print(f"  Successfully sent: {sent_count}")
        print(f"  Failed:           {fail_count}")
        print(f"{'═'*46}")
        sys.exit(0)


if __name__ == "__main__":
    main()
