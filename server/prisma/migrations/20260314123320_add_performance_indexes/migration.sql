-- CreateIndex
CREATE INDEX "Farm_userId_idx" ON "Farm"("userId");

-- CreateIndex
CREATE INDEX "ImageAnalysis_farmId_idx" ON "ImageAnalysis"("farmId");

-- CreateIndex
CREATE INDEX "ImageAnalysis_analyzedAt_idx" ON "ImageAnalysis"("analyzedAt");

-- CreateIndex
CREATE INDEX "SensorDevice_userId_idx" ON "SensorDevice"("userId");

-- CreateIndex
CREATE INDEX "SensorDevice_farmId_idx" ON "SensorDevice"("farmId");

-- CreateIndex
CREATE INDEX "SoilReading_farmId_idx" ON "SoilReading"("farmId");

-- CreateIndex
CREATE INDEX "SoilReading_readingAt_idx" ON "SoilReading"("readingAt");

-- CreateIndex
CREATE INDEX "YieldPrediction_farmId_idx" ON "YieldPrediction"("farmId");

-- CreateIndex
CREATE INDEX "YieldPrediction_createdAt_idx" ON "YieldPrediction"("createdAt");
