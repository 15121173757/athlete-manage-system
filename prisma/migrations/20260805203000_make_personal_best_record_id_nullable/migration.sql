-- AlterTable: recordId 改为可空（支持手动录入的 PB 不关联训练记录）
-- SQLite 不支持 ALTER COLUMN DROP NOT NULL，采用 Prisma 标准的表重建方式
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_personal_bests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "athleteId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "achievedDate" DATETIME NOT NULL,
    "recordId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personal_bests_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "personal_bests_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_personal_bests" ("id", "athleteId", "exerciseId", "value", "unit", "achievedDate", "recordId", "createdAt")
SELECT "id", "athleteId", "exerciseId", "value", "unit", "achievedDate", "recordId", "createdAt" FROM "personal_bests";

DROP TABLE "personal_bests";
ALTER TABLE "new_personal_bests" RENAME TO "personal_bests";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "personal_bests_athleteId_exerciseId_key" ON "personal_bests"("athleteId", "exerciseId");
