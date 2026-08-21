-- CreateTable
CREATE TABLE "fitness_test_results" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planId" INTEGER NOT NULL,
    "athleteId" INTEGER NOT NULL,
    "testId" INTEGER NOT NULL,
    "rawValue" TEXT,
    "value" REAL,
    "gradeValue" TEXT,
    "textValue" TEXT,
    "recordedById" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fitness_test_results_planId_fkey" FOREIGN KEY ("planId") REFERENCES "fitness_test_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fitness_test_results_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fitness_test_results_testId_fkey" FOREIGN KEY ("testId") REFERENCES "fitness_tests" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fitness_test_results_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_fitness_tests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'HIGHER_BETTER',
    "warningThreshold" REAL,
    "description" TEXT,
    "purpose" TEXT,
    "applicableGroup" TEXT,
    "equipment" TEXT,
    "demoVideoUrl" TEXT,
    "diagramUrl" TEXT,
    "standards" TEXT,
    "referenceRange" TEXT,
    "precautions" TEXT,
    "resultType" TEXT NOT NULL DEFAULT 'NUMERIC',
    "gradeOptions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_fitness_tests" ("applicableGroup", "category", "createdAt", "demoVideoUrl", "description", "diagramUrl", "direction", "equipment", "id", "name", "precautions", "purpose", "referenceRange", "standards", "unit", "updatedAt", "warningThreshold") SELECT "applicableGroup", "category", "createdAt", "demoVideoUrl", "description", "diagramUrl", "direction", "equipment", "id", "name", "precautions", "purpose", "referenceRange", "standards", "unit", "updatedAt", "warningThreshold" FROM "fitness_tests";
DROP TABLE "fitness_tests";
ALTER TABLE "new_fitness_tests" RENAME TO "fitness_tests";
CREATE UNIQUE INDEX "fitness_tests_name_key" ON "fitness_tests"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "fitness_test_results_planId_testId_idx" ON "fitness_test_results"("planId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "fitness_test_results_planId_athleteId_testId_key" ON "fitness_test_results"("planId", "athleteId", "testId");
