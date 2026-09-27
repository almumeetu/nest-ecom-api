/**
 * Trust Point Mart — Multi-Category Seeder
 *
 * Usage (standalone):  tsx prisma/seed-products.ts
 * Usage (composed):    import { seedProducts } from './seed-products'
 *                      await seedProducts(prisma)
 *
 * Seeding strategy:
 *   1. Delete all dependent rows first (FK order), then products, categories, brands.
 *   2. Upsert verified brands (Trust Point Agro, Apex, Bata, Aarong, Zara, Levi's, Nike, Casio, Anker).
 *   3. Upsert units (PCS, KG, PR, BTL, JAR, BOX).
 *   4. Create core categories (Fresh Groceries & Agro, Men's Fashion, Women's Fashion, Footwear, Tech & Smart Gadgets, Bags & Accessories).
 *   5. Create products across all departments with authentic content, verified image URLs matching content, and BDT pricing.
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
    .map((w) => w[0]?.toUpperCase() || 'P')
    .join('')
    .slice(0, 4);
  return `${brandInitial}-${initials}-${String(index + 1).padStart(3, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data definitions
// ─────────────────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: 'Trust Point Agro', slug: 'trust-point-agro' },
  { name: 'Apex',             slug: 'apex'             },
  { name: 'Bata',             slug: 'bata'             },
  { name: 'Aarong',           slug: 'aarong'           },
  { name: 'Zara',             slug: 'zara'             },
  { name: "Levi's",           slug: 'levis'            },
  { name: 'Nike',             slug: 'nike'             },
  { name: 'Casio',            slug: 'casio'            },
  { name: 'Anker',            slug: 'anker'            },
] as const;

const CATEGORIES = [
  { name: 'Fresh Groceries & Agro', slug: 'groceries'      },
  { name: "Men's Fashion",          slug: 'mens-fashion'   },
  { name: "Women's Fashion",        slug: 'womens-fashion' },
  { name: 'Footwear & Shoes',       slug: 'footwear'       },
  { name: 'Tech & Smart Gadgets',   slug: 'tech-gadgets'   },
  { name: 'Bags & Accessories',     slug: 'accessories'    },
] as const;

const UNITS = [
  { name: 'Pieces',    abbreviation: 'PCS', factor: 1 },
  { name: 'Kilograms', abbreviation: 'KG',  factor: 1 },
  { name: 'Pair',      abbreviation: 'PR',  factor: 1 },
  { name: 'Bottle',    abbreviation: 'BTL', factor: 1 },
  { name: 'Jar',       abbreviation: 'JAR', factor: 1 },
  { name: 'Box',       abbreviation: 'BOX', factor: 1 },
] as const;

const DEFAULT_STOCK = 100;

interface SeedProductDef {
  name: string;
  category: string;
  brand: string;
  price: number;
  cost?: number;
  unit: string;
  imageUrl: string;
  description: string;
}

const PRODUCTS: SeedProductDef[] = [
  // ── 1. Fresh Groceries & Agro Harvest ──────────────────────────────────────
  {
    name: 'Rajshahi Himsagar Mango (10kg Export Pack)',
    category: 'groceries',
    brand: 'trust-point-agro',
    price: 2450,
    cost: 2100,
    unit: 'KG',
    imageUrl: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80',
    description: 'Naturally tree-ripened, chemical-free GI-certified Himsagar mangoes sourced directly from orchards in Naogaon and Rajshahi Division. Packed with care in ventilated crates for nationwide delivery.',
  },
  {
    name: 'Kalijira Premium Aromatic Polao Rice (5kg Bag)',
    category: 'groceries',
    brand: 'trust-point-agro',
    price: 780,
    cost: 650,
    unit: 'KG',
    imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&auto=format&fit=crop&q=80',
    description: 'Naturally aged fine grain Kalijira aromatic rice. Renowned for its rich scent and fluffy non-sticky texture, ideal for authentic Bangladeshi polao, biryani, and festive dishes.',
  },
  {
    name: '100% Pure Cold-Pressed Mustard Oil (1L Bottle)',
    category: 'groceries',
    brand: 'trust-point-agro',
    price: 380,
    cost: 320,
    unit: 'BTL',
    imageUrl: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800&auto=format&fit=crop&q=80',
    description: 'Traditional wood-pressed (Ghani) pure mustard oil. Unadulterated, pungent aroma and high natural nutrient retention for authentic Bengali cooking.',
  },
  {
    name: 'Sundarban Natural Wild Raw Honey (500g Glass Jar)',
    category: 'groceries',
    brand: 'trust-point-agro',
    price: 850,
    cost: 700,
    unit: 'JAR',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
    description: 'Raw, unpasteurized wildflower honey collected by traditional Mouals in the Sundarbans mangrove forest. 100% natural enzymes and rich antioxidant profile.',
  },
  {
    name: 'Farm-Fresh Pure Cow Ghee (500g Tin)',
    category: 'groceries',
    brand: 'trust-point-agro',
    price: 750,
    cost: 620,
    unit: 'JAR',
    imageUrl: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800&auto=format&fit=crop&q=80',
    description: 'Traditional bilona churned pure cow ghee made from grass-fed dairy butter. Rich golden granules with captivating traditional aroma.',
  },

  // ── 2. Men's Fashion & Apparel ─────────────────────────────────────────────
  {
    name: 'Executive Crisp Cotton Formal Shirt',
    category: 'mens-fashion',
    brand: 'zara',
    price: 1850,
    cost: 1400,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
    description: '100% long-staple combed cotton formal shirt with reinforced collar fusing and easy-iron finish. Tailored for corporate executives and formal business wear.',
  },
  {
    name: 'Premium Embroidered Cotton Panjabi',
    category: 'mens-fashion',
    brand: 'aarong',
    price: 2800,
    cost: 2200,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=800&auto=format&fit=crop&q=80',
    description: 'Handcrafted fine cotton panjabi featuring intricate placket thread embroidery, tailored regular fit, and side pockets. Ideal for Eid, Jumuah, and celebratory occasions.',
  },
  {
    name: 'Classic Denim Trucker Jacket',
    category: 'mens-fashion',
    brand: 'levis',
    price: 3500,
    cost: 2800,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&auto=format&fit=crop&q=80',
    description: 'Iconic rugged denim jacket crafted from heavyweight authentic cotton twill. Metal shank buttons, dual chest flap pockets, and timeless styling.',
  },
  {
    name: 'Slim Fit Stretch Chino Pants',
    category: 'mens-fashion',
    brand: 'zara',
    price: 1650,
    cost: 1300,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80',
    description: 'Tailored slim-fit chinos crafted with stretch cotton twill for all-day comfort and effortless transition from office to weekend casuals.',
  },
  {
    name: 'Breathable Pique Cotton Polo Shirt',
    category: 'mens-fashion',
    brand: 'zara',
    price: 1100,
    cost: 850,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800&auto=format&fit=crop&q=80',
    description: 'Classic two-button placket polo shirt crafted from breathable cotton pique fabric with ribbed collar and cuffs.',
  },
  {
    name: 'Slim Fit Stretch Denim Jeans',
    category: 'mens-fashion',
    brand: 'levis',
    price: 2400,
    cost: 1900,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=80',
    description: 'Premium indigo-washed denim with comfort-stretch fibers, classic 5-pocket architecture, and sturdy copper rivets.',
  },

  // ── 3. Women's Fashion & Lifestyle ─────────────────────────────────────────
  {
    name: 'Traditional Handloom Silk Saree',
    category: 'womens-fashion',
    brand: 'aarong',
    price: 4500,
    cost: 3600,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
    description: 'Exquisite Bangladeshi handloom silk saree adorned with delicate woven zari border and floral pallu artwork. Includes unstitched blouse piece.',
  },
  {
    name: 'Designer Embroidered Kurti & Salwar Set',
    category: 'womens-fashion',
    brand: 'aarong',
    price: 3200,
    cost: 2500,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
    description: 'Contemporary two-piece ethnic set featuring fine cotton embroidery on neck and hem, complemented by matching relaxed-fit salwar.',
  },
  {
    name: 'Floral Print Summer Wrap Dress',
    category: 'womens-fashion',
    brand: 'zara',
    price: 2500,
    cost: 1900,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
    description: 'Lightweight breathable rayon wrap dress with feminine floral motif, adjustable waist tie, and flowing ruffled hem.',
  },
  {
    name: "Women's High-Waist Trousers",
    category: 'womens-fashion',
    brand: 'zara',
    price: 1900,
    cost: 1450,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop&q=80',
    description: 'High-waisted tailored trousers with pleated front, belt loops, and clean tapered cut designed for stylish professional wear.',
  },
  {
    name: 'Elegant Pashmina Woolen Shawl',
    category: 'womens-fashion',
    brand: 'aarong',
    price: 2200,
    cost: 1700,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80',
    description: 'Feather-soft fine wool shawl with subtle woven paisley motifs and fringed trim. Elegant warmth for festive winter gatherings.',
  },

  // ── 4. Footwear & Shoes ────────────────────────────────────────────────────
  {
    name: 'Handcrafted Genuine Leather Loafers',
    category: 'footwear',
    brand: 'apex',
    price: 3650,
    cost: 2900,
    unit: 'PR',
    imageUrl: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=800&auto=format&fit=crop&q=80',
    description: 'Full-grain vegetable-tanned Bangladeshi cowhide leather loafers. Hand-burnished finish, cushioned memory foam insole, and non-slip rubber outsole.',
  },
  {
    name: 'Air Running Sport Sneakers',
    category: 'footwear',
    brand: 'nike',
    price: 5800,
    cost: 4600,
    unit: 'PR',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
    description: 'High-performance road running shoes engineered with responsive air cushioning, breathable fly-mesh upper, and flex grooves for superior traction.',
  },
  {
    name: 'Leather Chelsea Dress Boots',
    category: 'footwear',
    brand: 'bata',
    price: 4200,
    cost: 3300,
    unit: 'PR',
    imageUrl: 'https://images.unsplash.com/photo-1638247025967-b4e38f787b76?w=800&auto=format&fit=crop&q=80',
    description: 'Classic leather Chelsea boots with elastic side gusset, pull tab, and durable welted construction. Versatile styling for formal and smart casuals.',
  },
  {
    name: 'Casual Breathable Canvas Walking Shoes',
    category: 'footwear',
    brand: 'bata',
    price: 1850,
    cost: 1400,
    unit: 'PR',
    imageUrl: 'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?w=800&auto=format&fit=crop&q=80',
    description: 'Lightweight low-profile canvas sneakers with vulcanized rubber sole and soft padded collar for effortless everyday steps.',
  },

  // ── 5. Tech & Smart Gadgets ────────────────────────────────────────────────
  {
    name: 'Ultra AMOLED Smart Watch (Fitness Edition)',
    category: 'tech-gadgets',
    brand: 'casio',
    price: 3200,
    cost: 2500,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    description: '1.43-inch HD AMOLED display with Bluetooth calling, heart rate & SpO2 tracking, 100+ sports modes, and up to 10 days of battery life.',
  },
  {
    name: 'True Wireless ANC Bluetooth Earbuds',
    category: 'tech-gadgets',
    brand: 'anker',
    price: 2600,
    cost: 2000,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
    description: 'Active Noise Cancelling earbuds with custom 10mm graphene drivers, ENC quadruple microphones for crystal clear voice calls, and 32 hours total playtime.',
  },
  {
    name: '65W GaN Multi-Port Fast Charger',
    category: 'tech-gadgets',
    brand: 'anker',
    price: 1850,
    cost: 1450,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=80',
    description: 'Gallium Nitride (GaN) fast charger with dual Type-C and USB-A ports. Powers laptops, tablets, and smartphones with temperature safety protection.',
  },

  // ── 6. Bags & Daily Accessories ───────────────────────────────────────────
  {
    name: 'Full-Grain Leather Bi-Fold Wallet',
    category: 'accessories',
    brand: 'apex',
    price: 1250,
    cost: 950,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=800&auto=format&fit=crop&q=80',
    description: 'Handcrafted genuine cow leather wallet with RFID blocking protection, 8 card slots, dual currency compartments, and slim pocket profile.',
  },
  {
    name: 'Genuine Leather Formal Pin-Buckle Belt',
    category: 'accessories',
    brand: 'apex',
    price: 950,
    cost: 720,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1624222247344-550fb60583dc?w=800&auto=format&fit=crop&q=80',
    description: 'Single-piece full-grain leather belt featuring a sleek gunmetal pin-buckle and beveled edge detailing. Built for decades of daily wear.',
  },
  {
    name: 'Polarized UV400 Aviator Sunglasses',
    category: 'accessories',
    brand: 'casio',
    price: 1450,
    cost: 1100,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
    description: 'Classic aviator sunglasses with polarized TAC lenses providing 100% UVA/UVB protection, lightweight stainless-steel frame, and soft silicone nose pads.',
  },
  {
    name: 'Water-Resistant Canvas Laptop Backpack',
    category: 'accessories',
    brand: 'casio',
    price: 2250,
    cost: 1750,
    unit: 'PCS',
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    description: 'High-density water-resistant canvas backpack with padded 15.6-inch laptop compartment, ergonomic breathable shoulder straps, and anti-theft back pocket.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main exported seeder
// ─────────────────────────────────────────────────────────────────────────────

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log('🛍️  [ProductSeeder] Starting Trust Point Mart product seed...');

  // ── Step 1: Clear existing data (FK dependency order) ─────────────────────
  console.log('\n🗑️  [ProductSeeder] Clearing existing catalog data...');

  await prisma.inventoryLog.deleteMany({});
  await prisma.productVariantAttribute.deleteMany({});
  await prisma.productVariantMedia.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.wholesaleOrderRequestItem.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.productMedia.deleteMany({});
  await prisma.discountProduct.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.brand.deleteMany({});

  console.log('✅ [ProductSeeder] Old catalog cleared.\n');

  // ── Step 2: Create Brands ──────────────────────────────────────────────────
  console.log('🏷️  [ProductSeeder] Creating brands...');

  const brandMap: Record<string, string> = {};

  for (const b of BRANDS) {
    const brand = await prisma.brand.upsert({
      where:  { slug: b.slug },
      update: { name: b.name },
      create: { name: b.name, slug: b.slug, logoUrl: null },
    });
    brandMap[b.slug] = brand.id;
    console.log(`   ✓ Brand: "${brand.name}"`);
  }

  console.log();

  // ── Step 3: Upsert Units ──────────────────────────────────────────────────
  console.log('📏 [ProductSeeder] Upserting units...');

  const unitMap: Record<string, string> = {};

  for (const u of UNITS) {
    const unit = await prisma.unit.upsert({
      where:  { abbreviation: u.abbreviation },
      update: { name: u.name, factor: u.factor },
      create: {
        name:         u.name,
        abbreviation: u.abbreviation,
        factor:       u.factor,
        isActive:     true,
      },
    });
    unitMap[u.abbreviation] = unit.id;
    console.log(`   ✓ Unit: "${unit.name}" (${unit.abbreviation})`);
  }

  console.log();

  // ── Step 4: Create Categories ─────────────────────────────────────────────
  console.log('📁 [ProductSeeder] Creating categories...');

  const categoryMap: Record<string, string> = {};

  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug, imageUrl: null },
    });
    categoryMap[cat.slug] = created.id;
    console.log(`   ✓ Category: "${created.name}" (${created.slug})`);
  }

  console.log();

  // ── Step 5: Create Products + default Variants ───────────────────────────
  console.log(`📦 [ProductSeeder] Creating ${PRODUCTS.length} Trust Point products...\n`);

  for (let i = 0; i < PRODUCTS.length; i++) {
    const p          = PRODUCTS[i];
    const slug       = toSlug(p.name);
    const brandInitial = p.brand.slice(0, 3).toUpperCase();
    const sku        = skuFromName(brandInitial, p.name, i);
    const brandId    = brandMap[p.brand];
    const categoryId = categoryMap[p.category];
    const unitId     = unitMap[p.unit] || unitMap['PCS'];
    const brandName  = BRANDS.find((b) => b.slug === p.brand)?.name ?? p.brand;

    if (!brandId || !categoryId) {
      console.warn(`   ⚠️ Skipping "${p.name}" — missing brand or category`);
      continue;
    }

    await prisma.product.create({
      data: {
        name:            p.name,
        slug,
        description:     p.description,
        status:          'active',
        metaTitle:       `${p.name} | Trust Point Mart`,
        metaDescription: `Shop authentic ${p.name} at Trust Point Mart. Verified quality, fast delivery, and fair pricing.`,
        metaKeywords:    `trust point, marketplace, ${slug}, ${p.category}`,

        brandId,
        categoryId,
        unitId,

        media: {
          create: [
            {
              isFeatured: true,
              sortOrder:  0,
              media: {
                create: {
                  url:      p.imageUrl,
                  type:     'image',
                  provider: 's3',
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
              cost:                p.cost ?? null,
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

  // ── Step 6: Configure Trust Point Mart Settings ───────────────────────────
  console.log('\n⚙️  [ProductSeeder] Ensuring Trust Point Mart settings...');
  const existingSetting = await prisma.setting.findFirst();
  const settingData = {
    shopName: 'Trust Point Mart',
    slogan: "Bangladesh's Trusted Multi-Category Hypermarket",
    branchName: 'Central Logistics & Procurement Hub',
    branchAddress: 'Mohadevpur, Naogaon, Rajshahi Division, Bangladesh',
    contactNumber: [{ title: 'Hotline', value: '01707819676' }],
    email: [{ title: 'Support', value: 'support@trustpointmart.com' }],
    currency: 'BDT',
    language: 'bn',
    copyrightYear: new Date().getFullYear().toString(),
  };

  if (existingSetting) {
    await prisma.setting.update({
      where: { id: existingSetting.id },
      data: settingData,
    });
    console.log('   ✓ Updated shop settings to Trust Point Mart');
  } else {
    await prisma.setting.create({
      data: settingData,
    });
    console.log('   ✓ Created initial shop settings for Trust Point Mart');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 [ProductSeeder] Trust Point Mart catalog seeding complete!');
  console.log('   📊 Summary:');
  console.log(`      Brands     : ${BRANDS.length}`);
  console.log(`      Categories : ${CATEGORIES.length}`);
  console.log(`      Products   : ${PRODUCTS.length}`);
  console.log(`      Shop Name  : Trust Point Mart\n`);
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
