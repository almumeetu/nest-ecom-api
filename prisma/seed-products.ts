/**
 * London Tea Exchange — Category & Product Seeder
 *
 * Usage (standalone):  tsx prisma/seed-products.ts
 * Usage (composed):    import { seedProducts } from './seed-products'
 *                      await seedProducts(prisma)
 *
 * Seeding strategy:
 *   1. Delete all dependent rows first (FK order), then products, then categories.
 *   2. Upsert the "London Tea Exchange" brand  (Product.brandId is non-nullable).
 *   3. Upsert a "Box" unit                     (optional but cleaner for admin UI).
 *   4. Create the 4 top-level navigation categories.
 *   5. Create the 9 "Assorted Collections" products, each with one default
 *      ProductVariant priced at 2 900 BDT (Decimal(10,2)).
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

/**
 * Generates a compact SKU from the product name.
 * e.g. "Assorted Classic Collection" → "LTE-CC-001"
 */
function skuFromName(name: string, index: number): string {
  const initials = name
    .replace(/assorted/i, '') // strip repeated prefix
    .trim()
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .join('');
  return `LTE-${initials}-${String(index + 1).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data definitions
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Assorted Collections', slug: 'assorted-collections' },
  { name: 'Tea Book Collections', slug: 'tea-book-collections' },
  { name: 'Loose Leaf Tea',        slug: 'loose-leaf-tea'        },
  { name: 'Elegant Gifts',         slug: 'elegant-gifts'         },
] as const;

/**
 * The 9 products visible in the "Assorted Collections" grid on the UI screenshot.
 * All share the same baseline price of 2 900 BDT.
 */
const ASSORTED_PRODUCTS = [
  { name: 'Assorted Classic Collection',     imageFile: 'classic-collection.jpg'     },
  { name: 'Assorted Royal Collection',       imageFile: 'royal-collection.jpg'       },
  { name: 'Assorted Black Tea Collection',   imageFile: 'black-tea-collection.jpg'   },
  { name: 'Assorted Oolong Collection',      imageFile: 'oolong-collection.jpg'      },
  { name: 'Assorted Super Fruit Collection', imageFile: 'super-fruit-collection.jpg' },
  { name: 'Assorted Festive Collection',     imageFile: 'festive-collection.jpg'     },
  { name: 'Assorted Wellness Collection',    imageFile: 'wellness-collection.jpg'    },
  { name: 'Assorted Wild Meadows Collection',imageFile: 'wild-meadows-collection.jpg'},
  { name: 'Assorted Wild Orchard Collection',imageFile: 'wild-orchard-collection.jpg'},
] as const;

const BASE_PRICE   = 2900; // BDT
const DEFAULT_STOCK = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Main exported seeder  (called by both standalone mode and seed.ts)
// ─────────────────────────────────────────────────────────────────────────────

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log('🍵 [ProductSeeder] Starting London Tea Exchange product seed...');

  // ── Step 1: Clear existing data (FK dependency order) ─────────────────────
  console.log('\n🗑️  [ProductSeeder] Clearing existing product data...');

  // Leaf-level relations first
  await prisma.inventoryLog.deleteMany({});
  console.log('   ✓ inventory_logs');

  await prisma.productVariantAttribute.deleteMany({});
  console.log('   ✓ product_variant_attributes');

  await prisma.productVariantMedia.deleteMany({});
  console.log('   ✓ product_variant_media');

  await prisma.cartItem.deleteMany({});
  console.log('   ✓ cart_items');

  await prisma.wholesaleOrderRequestItem.deleteMany({});
  console.log('   ✓ wholesale_order_request_items');

  await prisma.orderItem.deleteMany({});
  console.log('   ✓ order_items');

  // Mid-level
  await prisma.productVariant.deleteMany({});
  console.log('   ✓ product_variants');

  await prisma.productMedia.deleteMany({});
  console.log('   ✓ product_media');

  await prisma.discountProduct.deleteMany({});
  console.log('   ✓ discount_products');

  await prisma.wishlist.deleteMany({});
  console.log('   ✓ wishlists');

  await prisma.review.deleteMany({});
  console.log('   ✓ reviews');

  // Root tables
  await prisma.product.deleteMany({});
  console.log('   ✓ products');

  await prisma.category.deleteMany({});
  console.log('   ✓ categories');

  console.log('✅ [ProductSeeder] Existing data cleared.\n');

  // ── Step 2: Upsert Brand ──────────────────────────────────────────────────
  // Product.brandId is required (non-nullable), so we always need a brand row.
  console.log('🏷️  [ProductSeeder] Upserting brand...');

  const brand = await prisma.brand.upsert({
    where:  { slug: 'london-tea-exchange' },
    update: { name: 'London Tea Exchange' },
    create: { name: 'London Tea Exchange', slug: 'london-tea-exchange', logoUrl: null },
  });

  console.log(`   ✓ Brand: "${brand.name}" (id: ${brand.id})\n`);

  // ── Step 3: Upsert Unit ───────────────────────────────────────────────────
  // unitId is nullable on Product, but assigning a unit makes admin UI cleaner.
  console.log('📏 [ProductSeeder] Upserting unit...');

  const unit = await prisma.unit.upsert({
    where:  { abbreviation: 'BOX' },
    update: { name: 'Box' },
    create: {
      name:         'Box',
      abbreviation: 'BOX',
      factor:       1,
      isActive:     true,
    },
  });

  console.log(`   ✓ Unit: "${unit.name}" (abbreviation: ${unit.abbreviation})\n`);

  // ── Step 4: Create Categories ─────────────────────────────────────────────
  console.log('📁 [ProductSeeder] Creating categories...');

  const createdCategories = await Promise.all(
    CATEGORIES.map((cat) =>
      prisma.category.create({
        data: { name: cat.name, slug: cat.slug, imageUrl: null },
      }),
    ),
  );

  createdCategories.forEach((cat) =>
    console.log(`   ✓ "${cat.name}" (slug: ${cat.slug})`),
  );

  const assortedCategory = createdCategories.find(
    (c) => c.slug === 'assorted-collections',
  );

  if (!assortedCategory) {
    // Should never happen given the static CATEGORIES array above.
    throw new Error(
      '[ProductSeeder] FATAL: "assorted-collections" category row not found after insert.',
    );
  }

  console.log(`\n   ↳ Assorted Collections id: ${assortedCategory.id}\n`);

  // ── Step 5: Create Products + default Variants ───────────────────────────
  console.log(
    `📦 [ProductSeeder] Creating ${ASSORTED_PRODUCTS.length} products (price: ${BASE_PRICE} BDT)...\n`,
  );

  for (let i = 0; i < ASSORTED_PRODUCTS.length; i++) {
    const { name, imageFile } = ASSORTED_PRODUCTS[i];
    const slug = toSlug(name);
    const sku  = skuFromName(name, i);

    await prisma.product.create({
      data: {
        name,
        slug,
        description:     `${name} — a premium curated experience box from London Tea Exchange, thoughtfully assembled for tea enthusiasts.`,
        status:          'active',
        metaTitle:       name,
        metaDescription: `Shop the ${name} from London Tea Exchange. A premium gift box for tea lovers.`,
        metaKeywords:    `london tea exchange, ${slug}, assorted tea, tea gift box`,

        brandId:    brand.id,
        categoryId: assortedCategory.id,
        unitId:     unit.id,

        // Featured image via the central Media + ProductMedia system.
        media: {
          create: [
            {
              isFeatured: true,
              sortOrder: 0,
              media: {
                create: {
                  url: `/products/${imageFile}`,
                  type: 'image',
                  provider: 'local',
                },
              },
            },
          ],
        },

        // Each product ships with exactly one default variant that carries price/stock
        variants: {
          create: [
            {
              sku,
              price:               BASE_PRICE,
              cost:                null,
              stockQuantity:       DEFAULT_STOCK,
              stockAlertThreshold: 10,
              isDefault:           true,
            },
          ],
        },
      },
    });

    console.log(`   ✓ [${i + 1}/${ASSORTED_PRODUCTS.length}] "${name}"  (sku: ${sku})`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 [ProductSeeder] Seeding complete!');
  console.log('   📊 Summary:');
  console.log(`      Categories : ${createdCategories.length}`);
  console.log(`      Products   : ${ASSORTED_PRODUCTS.length}`);
  console.log(`      Variants   : ${ASSORTED_PRODUCTS.length} (1 default per product)`);
  console.log(`      Base price : ${BASE_PRICE} BDT`);
  console.log(`      Stock/item : ${DEFAULT_STOCK} units\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone execution guard
// tsx prisma/seed-products.ts
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma  = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

  try {
    await seedProducts(prisma);
  } catch (error) {
    console.error('❌ [ProductSeeder] Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
