-- CreateEnum
CREATE TYPE "CropType" AS ENUM ('TOMATO', 'CORN', 'MIXED');

-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('SOIL', 'TOMATO', 'CORN');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('HEALTHY', 'AT_RISK', 'DISEASED', 'CRITICAL');

-- CreateEnum
CREATE TYPE "YieldCategory" AS ENUM ('POOR', 'AVERAGE', 'GOOD', 'EXCELLENT');

-- CreateEnum
CREATE TYPE "ReadingSource" AS ENUM ('SENSOR', 'MANUAL', 'SIMULATED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('ARDUINO', 'ESP32', 'RASPBERRY_PI', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ModelType" AS ENUM ('TABULAR', 'CNN');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('FERTILIZER', 'MICROBIAL_AMENDMENT', 'IRRIGATION', 'CROP_ROTATION', 'PEST_DISEASE', 'SOIL_HEALTH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "farmLocation" TEXT,
    "farmSizeHa" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "gpsLat" DOUBLE PRECISION,
    "gpsLng" DOUBLE PRECISION,
    "sizeHa" DOUBLE PRECISION,
    "cropType" "CropType" NOT NULL DEFAULT 'TOMATO',
    "region" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilReading" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "deviceId" TEXT,
    "source" "ReadingSource" NOT NULL DEFAULT 'SENSOR',
    "readingAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soilMoisture" DOUBLE PRECISION NOT NULL,
    "soilTemperature" DOUBLE PRECISION NOT NULL,
    "soilPh" DOUBLE PRECISION NOT NULL,
    "electricalConductivity" DOUBLE PRECISION NOT NULL,
    "bulkDensity" DOUBLE PRECISION,
    "organicMatter" DOUBLE PRECISION NOT NULL,
    "nitrogenPpm" DOUBLE PRECISION NOT NULL,
    "phosphorusPpm" DOUBLE PRECISION NOT NULL,
    "potassiumPpm" DOUBLE PRECISION NOT NULL,
    "calciumPpm" DOUBLE PRECISION,
    "magnesiumPpm" DOUBLE PRECISION,
    "sulfurPpm" DOUBLE PRECISION,
    "microbialDiversityIndex" DOUBLE PRECISION,
    "nitrogenFixingBacteriaRatio" DOUBLE PRECISION,
    "mycorrhizalFungiPresence" BOOLEAN NOT NULL DEFAULT false,
    "pathogenicFungiRatio" DOUBLE PRECISION,
    "bacterialCountCfu" DOUBLE PRECISION,
    "rainfallMm" DOUBLE PRECISION,
    "ambientTemperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "fertilizerKgPerHa" DOUBLE PRECISION,
    "previousYieldTons" DOUBLE PRECISION,
    "growingSeasonDays" INTEGER,

    CONSTRAINT "SoilReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageAnalysis" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "imageType" "ImageType" NOT NULL,
    "imagePath" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "predictedClass" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "allClassScores" JSONB NOT NULL,
    "healthStatus" "HealthStatus" NOT NULL,
    "yieldImpactNote" TEXT,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0.0',

    CONSTRAINT "ImageAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YieldPrediction" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "soilReadingId" TEXT,
    "predictedYieldTons" DOUBLE PRECISION NOT NULL,
    "confidenceLow" DOUBLE PRECISION NOT NULL,
    "confidenceHigh" DOUBLE PRECISION NOT NULL,
    "yieldCategory" "YieldCategory" NOT NULL,
    "regionalAverage" DOUBLE PRECISION,
    "actualYieldTons" DOUBLE PRECISION,
    "shapValues" JSONB NOT NULL,
    "topFeatures" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YieldPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoilRecommendation" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "category" "RecommendationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "actionItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoilRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageRecommendation" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "actionItems" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceSerial" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL DEFAULT 'ESP32',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "batteryLevel" DOUBLE PRECISION,
    "firmwareVersion" TEXT,
    "lastReadingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelMetrics" (
    "id" TEXT NOT NULL,
    "modelType" "ModelType" NOT NULL,
    "modelName" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "rmse" DOUBLE PRECISION,
    "mae" DOUBLE PRECISION,
    "r2Score" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "precision" DOUBLE PRECISION,
    "recall" DOUBLE PRECISION,
    "f1Score" DOUBLE PRECISION,
    "trainingSamples" INTEGER NOT NULL,
    "classes" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "YieldPrediction_soilReadingId_key" ON "YieldPrediction"("soilReadingId");

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_deviceSerial_key" ON "SensorDevice"("deviceSerial");

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilReading" ADD CONSTRAINT "SoilReading_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilReading" ADD CONSTRAINT "SoilReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "SensorDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageAnalysis" ADD CONSTRAINT "ImageAnalysis_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldPrediction" ADD CONSTRAINT "YieldPrediction_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YieldPrediction" ADD CONSTRAINT "YieldPrediction_soilReadingId_fkey" FOREIGN KEY ("soilReadingId") REFERENCES "SoilReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoilRecommendation" ADD CONSTRAINT "SoilRecommendation_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "YieldPrediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageRecommendation" ADD CONSTRAINT "ImageRecommendation_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "ImageAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
