-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- Seed initial ordering from existing creation order so the tree stays stable.
-- Newest-first (matching the previous default) within each parent scope.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "parentId"
      ORDER BY "created_at" DESC
    ) - 1 AS rn
  FROM "categories"
)
UPDATE "categories" c
SET "sort_order" = ranked.rn
FROM ranked
WHERE c."id" = ranked."id";
