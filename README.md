# AI-Assisted Soil Microbiome Analysis System
### For Crop Yield Prediction

A full-stack precision agriculture platform with **two independent AI models** that operate in parallel and display results side by side.

---

## System Overview

| Model | Type | Input | Output |
|-------|------|-------|--------|
| **Model 1** | Tabular Regression (RF + GB + XGBoost Ensemble) | Real-time soil sensor data (24 features) | Predicted yield (tons/ha) + SHAP explainability |
| **Model 2** | CNN Classification (EfficientNetB0) | Soil/Tomato/Corn images | Health class + confidence + yield impact note |

**These are two completely independent models. They do NOT merge. The dashboard shows both results side by side.**

---

## Research Objectives

1. **Objective 1** — Identify key soil parameters and microbiome indicators influencing crop yield
2. **Objective 2** — Integrate Arduino + ESP32 sensor device for real-time data collection
3. **Objective 3** — Develop two AI models: tabular (soil sensors) + CNN (crop/soil images)
4. **Objective 4** — Predict crop yield from sensor data; classify crop/soil health from images
5. **Objective 5** — Evaluate both models independently in terms of prediction accuracy

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS + Recharts |
| Backend | Node.js + Express + Prisma ORM |
| Database | PostgreSQL 16 |
| ML Engine | Python FastAPI + scikit-learn + TensorFlow/Keras + SHAP |
| Sensors | Arduino C++ + ESP32 sketch + Python simulator |
| Auth | JWT (7-day expiry) |
| Real-time | Socket.io |

---

## Quick Start

### Option A — Docker (Recommended)

```bash
git clone <repo-url>
cd soil-microbiome-ai

# (Optional) Place your datasets before building — see Dataset Setup below

docker-compose up --build
```

In a new terminal:
```bash
# Run database migrations and seed demo data
docker-compose exec server npx prisma migrate dev --name init
docker-compose exec server npx prisma generate
docker-compose exec server npm run seed
```

Open **http://localhost:3000**

**Demo login:** `demo@farm.ai` / `demo1234`

---

### Option B — Local Development

#### Prerequisites
- Node.js 20+
- Python 3.11+
- PostgreSQL 16

#### 1. Database
```bash
createdb soil_microbiome
```

#### 2. Backend
```bash
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run seed
npm run dev
```

#### 3. ML Engine
```bash
cd ml-engine
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 4. Frontend
```bash
cd client
cp .env.example .env
npm install
npm run dev
```

---

## Dataset Setup

### Model 1 — Tabular (Sensor Data)

Place your CSV at:
```
ml-engine/data/sensor_data.csv
```

Required column (or any alias below):
- `yieldTonsPerHa` (or: `yield`, `Yield`)

Supported column aliases:
| Alias | Maps to |
|-------|---------|
| `ph`, `pH` | `soilPh` |
| `moisture`, `moisture_%` | `soilMoisture` |
| `temp`, `temperature` | `soilTemperature` |
| `N`, `nitrogen` | `nitrogenPpm` |
| `P`, `phosphorus` | `phosphorusPpm` |
| `K`, `potassium` | `potassiumPpm` |
| `EC` | `electricalConductivity` |
| `yield`, `Yield` | `yieldTonsPerHa` |
| `crop`, `crop_type` | `cropTypeEncoded` |

> **Note:** If you have fewer than 300 rows, the system automatically generates synthetic supplemental data using agronomic rules.

### Model 2 — CNN (Image Classification)

Organize images in class subfolders:

```
ml-engine/data/
├── soil/
│   ├── Soil___healthy/        ← JPG/PNG images here
│   ├── Soil___dry/
│   ├── Soil___degraded/
│   └── Soil___waterlogged/
├── tomato/
│   ├── Tomato___healthy/
│   ├── Tomato___Early_blight/
│   ├── Tomato___Late_blight/
│   └── ...                    ← Any class folder name works
└── corn/
    ├── Corn___healthy/
    ├── Corn___Common_rust/
    └── ...
```

**Compatible with PlantVillage dataset** (available on Kaggle).
The class folder names become class labels automatically.

> The model will skip any dataset folder that has no images and log a clear warning.

---

## Training the Models

### Via REST API
```bash
# Train tabular model
curl -X POST http://localhost:8000/tabular/train

# Train all CNN models
curl -X POST http://localhost:8000/image/train

# Train everything
curl -X POST http://localhost:8000/train/all
```

### Via Dashboard Admin
Go to **Analytics** tab → model status is shown with training buttons.

### Via Admin API (authenticated)
```bash
curl -X POST http://localhost:5000/api/admin/train/all \
  -H "Authorization: Bearer <your_jwt_token>"
```

---

## Hardware Setup

### Arduino Wiring
```
Sensor               Arduino Pin    Notes
─────────────────────────────────────────────────────
Capacitive Moisture  A0             Maps 0-1023 → 0-100%
DS18B20 Temp         Pin 4          4.7kΩ pullup to 5V
pH Sensor Module     A1             Voltage calibrated
NPK Sensor (RS485)   Serial1+Pin 2  Modbus RTU protocol
DHT22 Humidity       Pin 3          Digital
```

### ESP32 Wiring
Same as Arduino + WiFi. Set constants in `esp32_sensor.ino`:
```cpp
#define WIFI_SSID       "your_wifi"
#define WIFI_PASSWORD   "your_password"
#define SERVER_URL      "http://192.168.1.100:5000"
#define DEVICE_SERIAL   "ESP-001"
#define SLEEP_SECONDS   30
```

### Sensor Simulator (No Hardware Required)
```bash
cd sensor/simulation

# Basic usage
python simulator.py

# With options
python simulator.py --device-serial ESP-001 \
                    --server http://localhost:5000 \
                    --interval 10 \
                    --farm-id <your-farm-uuid> \
                    --count 100
```

Register the device serial in the dashboard first (Sensor → Devices).

---

## API Reference

### Authentication
```
POST /api/auth/register    Create account
POST /api/auth/login       Login → JWT token
```

### Farms
```
GET    /api/farms          List user's farms
POST   /api/farms          Create farm
GET    /api/farms/:id      Get farm with predictions + analyses
PUT    /api/farms/:id      Update farm
DELETE /api/farms/:id      Delete farm (cascades)
```

### Soil Readings
```
GET    /api/soil-readings?farmId=    Paginated list
POST   /api/soil-readings            Add manual reading
GET    /api/soil-readings/trends/:farmId  Weekly averages (90 days)
DELETE /api/soil-readings/:id        Delete reading
```

### AI — Yield Prediction (Model 1)
```
POST   /api/predict        Run ensemble prediction on latest reading
GET    /api/predictions?farmId=   Paginated history
PATCH  /api/predictions/:id/actual  Enter actual yield for accuracy tracking
```

### AI — Image Analysis (Model 2)
```
POST   /api/image/analyze  Upload image → CNN classification
GET    /api/image/analyses?farmId=  Paginated history
GET    /api/image/analyses/:id/image  Serve stored image
```

### IoT Device Ingest (No Auth)
```
POST   /api/devices/:deviceSerial/ingest   ESP32/Arduino posts readings
GET    /api/devices/:id/simulate           Get simulated reading for form fill
```

### ML Engine (FastAPI — Port 8000)
```
POST   /tabular/predict    Yield prediction
POST   /tabular/train      Train tabular models
GET    /tabular/metrics    Model performance metrics
POST   /image/predict      CNN classification
POST   /image/train        Train CNN models
GET    /image/metrics      CNN accuracy metrics
GET    /models/status      Check which models are trained
GET    /health             Health check
```

---

## Model Performance (Post-Training)

### Tabular Regression (on your dataset)
| Metric | Expected Range |
|--------|---------------|
| RMSE   | 0.3 – 0.6 t/ha |
| MAE    | 0.2 – 0.45 t/ha |
| R²     | 0.85 – 0.95 |

### CNN Classification (PlantVillage dataset)
| Dataset | Expected Accuracy |
|---------|------------------|
| Tomato  | 92–96% |
| Corn    | 90–94% |
| Soil    | 85–93% |

---

## Project Structure

```
soil-microbiome-ai/
├── client/                     React + Vite frontend
│   ├── src/
│   │   ├── api/                API layer (axios)
│   │   ├── components/         Reusable UI components
│   │   ├── contexts/           Auth + Farm context
│   │   ├── hooks/              useSocket hook
│   │   └── pages/              All dashboard pages
│   └── Dockerfile
├── server/                     Node.js + Express API
│   ├── lib/                    Prisma singleton
│   ├── middleware/             Auth + upload middleware
│   ├── routes/                 All API routes
│   ├── services/               ML service + recommendation engine
│   ├── scripts/seed.js         Demo data seeder
│   └── prisma/schema.prisma    Complete DB schema
├── ml-engine/                  Python FastAPI ML service
│   ├── main.py                 FastAPI app + endpoints
│   ├── model/
│   │   ├── features.py         Feature definitions + metadata
│   │   ├── preprocessor.py     Data preprocessing
│   │   ├── tabular_trainer.py  RF + GB + XGB + Ensemble training
│   │   ├── cnn_trainer.py      EfficientNetB0 training (2-phase)
│   │   ├── explainability.py   SHAP values + top features
│   │   └── recommendation_engine.py  Rule-based recommendations
│   └── data/                   Place your datasets here
├── sensor/
│   ├── arduino/soil_sensor.ino Arduino sketch (wiring + code)
│   ├── esp32/esp32_sensor.ino  ESP32 sketch (WiFi + deep sleep)
│   └── simulation/simulator.py Python ESP32 simulator
├── docker-compose.yml
└── README.md
```

---

## Support

- Issues: https://github.com/anthropics/claude-code/issues
- Demo: `demo@farm.ai` / `demo1234`
- ML Engine docs: http://localhost:8000/docs (Swagger UI auto-generated)
