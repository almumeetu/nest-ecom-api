-- UOM Refactor: rename code->abbreviation safely, add factor + parent hierarchy

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='units' AND column_name='code'
    ) THEN
        ALTER TABLE "units" RENAME COLUMN "code" TO "abbreviation";
    END IF;

    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='units' AND column_name='description'
    ) THEN
        ALTER TABLE "units" DROP COLUMN "description";
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='units' AND column_name='abbreviation'
    ) THEN
        ALTER TABLE "units" ADD COLUMN "abbreviation" TEXT;
        UPDATE "units" SET "abbreviation" = "id" WHERE "abbreviation" IS NULL;
        ALTER TABLE "units" ALTER COLUMN "abbreviation" SET NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS "units_abbreviation_key" ON "units"("abbreviation");
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='units' AND column_name='factor'
    ) THEN
        ALTER TABLE "units" ADD COLUMN "factor" DOUBLE PRECISION NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='units' AND column_name='parent_id'
    ) THEN
        ALTER TABLE "units" ADD COLUMN "parent_id" TEXT;
    ELSE
        ALTER TABLE "units" ALTER COLUMN "parent_id" TYPE TEXT USING "parent_id"::TEXT;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name='units_parent_id_fkey'
    ) THEN
        ALTER TABLE "units"
          ADD CONSTRAINT "units_parent_id_fkey"
          FOREIGN KEY ("parent_id") REFERENCES "units"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
