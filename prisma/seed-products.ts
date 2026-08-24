/**
 * Ecom — Fashion Category, Brand & Product Seeder
 *
 * Usage (standalone):  tsx prisma/seed-products.ts
 * Usage (composed):    import { seedProducts } from './seed-products'
 *                      await seedProducts(prisma)
 *
 * Seeding strategy:
 *   1. Delete all dependent rows first (FK order), then products, categories, brands.
 *   2. Upsert multiple fashion brands.
 *   3. Upsert unit (PCS).
 *   4. Create fashion categories (Men, Women, Kids, Accessories, Footwear).
 *   5. Create products across categories with variants and BDT pricing.
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

function skuFromName(brandInitial: string, name: string, index: number): string {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0].toUpperCase())
    .join('');
  return `${brandInitial}-${initials}-${String(index + 1).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data definitions
// ─────────────────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Zara',    slug: 'zara'   },
  { name: 'H&M',     slug: 'hm'     },
  { name: "Levi's",  slug: 'levis'  },
  { name: 'Nike',    slug: 'nike'   },
  { name: 'Adidas',  slug: 'adidas' },
  { name: 'Mango',   slug: 'mango'  },
] as const;

const CATEGORIES = [
  { name: "Men's Fashion",   slug: 'mens-fashion'   },
  { name: "Women's Fashion", slug: 'womens-fashion' },
  { name: "Kids' Fashion",   slug: 'kids-fashion'   },
  { name: 'Accessories',     slug: 'accessories'    },
  { name: 'Footwear',        slug: 'footwear'       },
] as const;

const DEFAULT_STOCK = 100;

const PRODUCTS = [
  // ── Men's Fashion ──────────────────────────────────────────────────────────
  { name: 'Classic Slim Fit Shirt',         category: 'mens-fashion',   brand: 'zara',   price: 1200, imageFile: 'slim-fit-shirt.jpg'        },
  { name: 'Casual Chino Pants',             category: 'mens-fashion',   brand: 'hm',     price: 1500, imageFile: 'chino-pants.jpg'           },
  { name: 'Denim Jacket',                   category: 'mens-fashion',   brand: 'levis',  price: 3500, imageFile: 'denim-jacket.jpg'          },
  { name: 'Graphic Tee Collection',         category: 'mens-fashion',   brand: 'hm',     price:  800, imageFile: 'graphic-tee.jpg'           },
  { name: 'Formal Blazer',                  category: 'mens-fashion',   brand: 'zara',   price: 4500, imageFile: 'formal-blazer.jpg'         },
  { name: 'Slim Fit Jeans',                 category: 'mens-fashion',   brand: 'levis',  price: 2200, imageFile: 'slim-fit-jeans.jpg'        },

  // ── Women's Fashion ────────────────────────────────────────────────────────
  { name: 'Floral Wrap Dress',              category: 'womens-fashion', brand: 'mango',  price: 2500, imageFile: 'floral-wrap-dress.jpg'     },
  { name: 'High-Waist Trousers',            category: 'womens-fashion', brand: 'zara',   price: 1800, imageFile: 'high-waist-trousers.jpg'   },
  { name: 'Oversized Blazer',               category: 'womens-fashion', brand: 'mango',  price: 3800, imageFile: 'womens-blazer.jpg'         },
  { name: 'Crop Top Set',                   category: 'womens-fashion', brand: 'hm',     price: 1200, imageFile: 'crop-top-set.jpg'          },
  { name: 'Midi Skirt',                     category: 'womens-fashion', brand: 'zara',   price: 1600, imageFile: 'midi-skirt.jpg'            },
  { name: 'Knit Cardigan',                  category: 'womens-fashion', brand: 'mango',  price: 2200, imageFile: 'knit-cardigan.jpg'         },

  // ── Kids' Fashion ──────────────────────────────────────────────────────────
  { name: 'Kids Cotton T-Shirt Pack',       category: 'kids-fashion',   brand: 'hm',     price:  900, imageFile: 'kids-tshirt-pack.jpg'      },
  { name: 'Kids Denim Shorts',              category: 'kids-fashion',   brand: 'levis',  price: 1100, imageFile: 'kids-denim-shorts.jpg'     },
  { name: 'Kids Hooded Sweatshirt',         category: 'kids-fashion',   brand: 'adidas', price: 1400, imageFile: 'kids-hoodie.jpg'           },

  // ── Accessories ────────────────────────────────────────────────────────────
  { name: 'Leather Belt',                   category: 'accessories',    brand: 'zara',   price:  900, imageFile: 'leather-belt.jpg'          },
  { name: 'Canvas Tote Bag',                category: 'accessories',    brand: 'hm',     price: 1100, imageFile: 'canvas-tote-bag.jpg'       },
  { name: 'Classic Wrist Watch',            category: 'accessories',    brand: 'mango',  price: 5500, imageFile: 'wrist-watch.jpg'           },
  { name: 'Polarized Sunglasses',           category: 'accessories',    brand: 'zara',   price: 1800, imageFile: 'sunglasses.jpg'            },
  { name: 'Knitted Scarf',                  category: 'accessories',    brand: 'hm',     price:  700, imageFile: 'knitted-scarf.jpg'         },

  // ── Footwear ───────────────────────────────────────────────────────────────
  { name: 'Air Running Sneakers',           category: 'footwear',       brand: 'nike',   price: 7500, imageFile: 'air-running-sneakers.jpg'  },
  { name: 'Classic Stan Smith',             category: 'footwear',       brand: 'adidas', price: 6800, imageFile: 'stan-smith.jpg'            },
  { name: 'Leather Chelsea Boots',          category: 'footwear',       brand: 'zara',   price: 5200, imageFile: 'chelsea-boots.jpg'         },
  { name: 'Casual Canvas Shoes',            category: 'footwear',       brand: 'adidas', price: 3200, imageFile: 'canvas-shoes.jpg'          },
  { name: 'Sport Training Shoes',           category: 'footwear',       brand: 'nike',   price: 8200, imageFile: 'training-shoes.jpg'        },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main exported seeder
// ─────────────────────────────────────────────────────────────────────────────

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log('🛍️  [ProductSeeder] Starting Ecom Fashion product seed...');

  // ── Step 1: Clear existing data (FK dependency order) ─────────────────────
  console.log('\n🗑️  [ProductSeeder] Clearing existing product data...');

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
  await prisma.product.deleteMany({});
  console.log('   ✓ products');
  await prisma.category.deleteMany({});
  console.log('   ✓ categories');
  await prisma.brand.deleteMany({});
  console.log('   ✓ brands');

  console.log('✅ [ProductSeeder] Existing data cleared.\n');

  // ── Step 2: Create Brands ──────────────────────────────────────────────────
  console.log('🏷️  [ProductSeeder] Creating fashion brands...');

  const brandMap: Record<string, string> = {}; // slug → id

  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({
      where:  { slug: b.slug },
      update: { name: b.name },
      create: { name: b.name, slug: b.slug, logoUrl: null },
    });
    brandMap[b.slug] = brand.id;
    console.log(`   ✓ "${brand.name}"`);
  }

  console.log();

  // ── Step 3: Upsert Unit ───────────────────────────────────────────────────
  console.log('📏 [ProductSeeder] Upserting unit...');

  const unit = await prisma.unit.upsert({
    where:  { abbreviation: 'PCS' },
    update: { name: 'Pieces' },
    create: {
      name:         'Pieces',
      abbreviation: 'PCS',
      factor:       1,
      isActive:     true,
    },
  });

  console.log(`   ✓ "${unit.name}" (${unit.abbreviation})\n`);

  // ── Step 4: Create Categories ─────────────────────────────────────────────
  console.log('📁 [ProductSeeder] Creating fashion categories...');

  const categoryMap: Record<string, string> = {}; // slug → id

  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug, imageUrl: null },
    });
    categoryMap[cat.slug] = created.id;
    console.log(`   ✓ "${created.name}"`);
  }

  console.log();

  // ── Step 5: Create Products + default Variants ───────────────────────────
  console.log(`📦 [ProductSeeder] Creating ${PRODUCTS.length} fashion products...\n`);

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p         = PRODUCTS[i];
    const slug      = toSlug(p.name);
    const brandInitial = p.brand.slice(0, 3).toUpperCase();
    const sku       = skuFromName(brandInitial, p.name, i);
    const brandId   = brandMap[p.brand];
    const categoryId = categoryMap[p.category];
    const brandName  = BRANDS.find((b) => b.slug === p.brand)?.name ?? p.brand;

    if (!brandId || !categoryId) {
      console.warn(`   ⚠️  Skipping "${p.name}" — missing brand or category`);
      continue;
    }

    await prisma.product.create({
      data: {
        name:            p.name,
        slug,
        description:     `${p.name} — a premium fashion piece from ${brandName}, crafted for style and comfort.`,
        status:          'active',
        metaTitle:       p.name,
        metaDescription: `Shop ${p.name} at Ecom. Premium fashion at the best price.`,
        metaKeywords:    `ecom, fashion, ${slug}, ${p.category}`,

        brandId,
        categoryId,
        unitId: unit.id,

        media: {
          create: [
            {
              isFeatured: true,
              sortOrder:  0,
              media: {
                create: {
                  url:      `/products/${p.imageFile}`,
                  type:     'image',
                  provider: 'local',
                },
              },
            },
          ],
        },

        variants: {
          create: [
            {
              sku,
              price:               p.price,
              cost:                null,
              stockQuantity:       DEFAULT_STOCK,
              stockAlertThreshold: 10,
              isDefault:           true,
            },
          ],
        },
      },
    });

    console.log(`   ✓ [${i + 1}/${PRODUCTS.length}] "${p.name}"  (sku: ${sku}, price: ${p.price} BDT)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 [ProductSeeder] Fashion seeding complete!');
  console.log('   📊 Summary:');
  console.log(`      Brands     : ${BRANDS.length}`);
  console.log(`      Categories : ${CATEGORIES.length}`);
  console.log(`      Products   : ${PRODUCTS.length}`);
  console.log(`      Variants   : ${PRODUCTS.length} (1 default per product)\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone execution guard
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


