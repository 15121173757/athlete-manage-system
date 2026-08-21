-- RedefineTables
-- 测试标准重构：移除旧的 scoringStandard（评分标准）列，新增 standards（常模数组 JSON）列
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_fitness_tests" ("applicableGroup", "category", "createdAt", "demoVideoUrl", "description", "diagramUrl", "direction", "equipment", "id", "name", "precautions", "purpose", "referenceRange", "unit", "updatedAt", "warningThreshold") SELECT "applicableGroup", "category", "createdAt", "demoVideoUrl", "description", "diagramUrl", "direction", "equipment", "id", "name", "precautions", "purpose", "referenceRange", "unit", "updatedAt", "warningThreshold" FROM "fitness_tests";
DROP TABLE "fitness_tests";
ALTER TABLE "new_fitness_tests" RENAME TO "fitness_tests";
CREATE UNIQUE INDEX "fitness_tests_name_key" ON "fitness_tests"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
