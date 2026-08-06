-- CreateTable
CREATE TABLE "load_records" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "recordDate" DATETIME NOT NULL,
    "rpe" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "recordedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "load_records_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "load_records_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "load_records_athleteId_recordDate_idx" ON "load_records"("athleteId", "recordDate");
