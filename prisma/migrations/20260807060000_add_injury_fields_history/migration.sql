-- 伤病管理增强：新增受伤部位/原因/诊断/治疗/附件字段，增加修改历史表与索引

-- AlterTable
ALTER TABLE "injuries" ADD COLUMN "bodyPart" TEXT;
ALTER TABLE "injuries" ADD COLUMN "cause" TEXT;
ALTER TABLE "injuries" ADD COLUMN "diagnosis" TEXT;
ALTER TABLE "injuries" ADD COLUMN "treatment" TEXT;
ALTER TABLE "injuries" ADD COLUMN "attachmentPath" TEXT;
ALTER TABLE "injuries" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "injuries" ADD COLUMN "attachmentType" TEXT;
ALTER TABLE "injuries" ADD COLUMN "attachmentSize" INTEGER;

-- CreateTable
CREATE TABLE "injury_histories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "injuryId" INTEGER NOT NULL,
    "changedBy" INTEGER NOT NULL,
    "changes" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "injury_histories_injuryId_fkey" FOREIGN KEY ("injuryId") REFERENCES "injuries" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "injury_histories_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "injuries_athleteId_status_idx" ON "injuries"("athleteId", "status");

-- CreateIndex
CREATE INDEX "injuries_status_startDate_idx" ON "injuries"("status", "startDate");

-- CreateIndex
CREATE INDEX "injury_histories_injuryId_createdAt_idx" ON "injury_histories"("injuryId", "createdAt");
