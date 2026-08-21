-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_training_plan_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "planId" INTEGER NOT NULL,
    "athleteId" INTEGER,
    "exerciseId" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "load" REAL,
    "restSeconds" INTEGER,
    "duration" INTEGER,
    "tempo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "training_plan_items_planId_fkey" FOREIGN KEY ("planId") REFERENCES "training_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "training_plan_items_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "training_plan_items_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "athletes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_training_plan_items" ("duration", "exerciseId", "id", "load", "notes", "planId", "reps", "restSeconds", "sets", "sortOrder") SELECT "duration", "exerciseId", "id", "load", "notes", "planId", "reps", "restSeconds", "sets", "sortOrder" FROM "training_plan_items";
DROP TABLE "training_plan_items";
ALTER TABLE "new_training_plan_items" RENAME TO "training_plan_items";
CREATE INDEX "training_plan_items_planId_sortOrder_idx" ON "training_plan_items"("planId", "sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
