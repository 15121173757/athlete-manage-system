-- CreateTable
CREATE TABLE "jump_analysis_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "testType" TEXT NOT NULL,
    "testDate" DATETIME NOT NULL,
    "videoName" TEXT,
    "videoFps" INTEGER,
    "flightTimeMs" REAL,
    "jumpHeightCm" REAL,
    "takeoffVelocity" REAL,
    "contactTimeMs" REAL,
    "rsi" REAL,
    "jumpCount" INTEGER,
    "avgHeightCm" REAL,
    "bestHeightCm" REAL,
    "avgRsi" REAL,
    "rsiCv" REAL,
    "details" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "recordedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "jump_analysis_records_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "jump_analysis_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "jump_analysis_records_athleteId_testDate_idx" ON "jump_analysis_records"("athleteId", "testDate");
