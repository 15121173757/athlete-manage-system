-- 负荷记录新增训练类型字段（力量/速度/耐力/柔韧/技巧/恢复）
ALTER TABLE "load_records" ADD COLUMN "trainingType" TEXT;
