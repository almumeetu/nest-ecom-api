-- Drop the legacy ProductImage table. It was superseded by the central
-- Media + ProductMedia system and is no longer referenced by any runtime code.
-- (The table is empty; product images now live in "media" / "product_media".)
ALTER TABLE "product_images" DROP CONSTRAINT IF EXISTS "product_images_productId_fkey";

DROP TABLE IF EXISTS "product_images";
