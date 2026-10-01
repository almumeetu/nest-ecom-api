/**
 * NovaMart — 50-Item Multi-Category Product Catalog Seeder
 *
 * Usage (standalone):  tsx prisma/seed-products.ts
 * Usage (composed):    import { seedProducts } from './seed-products'
 *                      await seedProducts(prisma)
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
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

function skuFromName(brand: string, name: string, index: number): string {
  const brandInitial = brand
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 3)
    .toUpperCase();
  const initials = name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() || 'P')
    .join('')
    .slice(0, 4);
  return `NM-${brandInitial}-${initials}-${String(index + 1).padStart(3, '0')}`;
}

const CATEGORIES = [
  {
    name: 'Skin Care & Beauty',
    slug: 'skin-care',
    imageUrl: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Digital Electronics',
    slug: 'digital-electronics',
    imageUrl: 'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Perfumes & Fragrances',
    slug: 'perfume',
    imageUrl: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Clothing & Fashion',
    slug: 'clothing',
    imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Baby & Kids Products',
    slug: 'baby-products',
    imageUrl: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Footwear & Shoes',
    slug: 'footwear',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Gourmet Foods & Agro',
    slug: 'groceries',
    imageUrl: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Health, Wellness & Fitness',
    slug: 'health-wellness',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&auto=format&fit=crop&q=80',
  },
  {
    name: 'Watches & Premium Accessories',
    slug: 'watches-accessories',
    imageUrl: 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
  },
] as const;

const CATEGORY_COLLECTION_MAP: Record<string, string> = {
  'Skin Care & Beauty': 'skin-care',
  'skin-care': 'skin-care',
  'Digital Electronics': 'digital-electronics',
  'digital-electronics': 'digital-electronics',
  'Perfumes & Fragrances': 'perfume',
  'perfume': 'perfume',
  'Clothing & Fashion': 'clothing',
  'clothing': 'clothing',
  'Baby & Kids Products': 'baby-products',
  'baby-products': 'baby-products',
  'Home & Living': 'home-living',
  'home-living': 'home-living',
  'Footwear & Shoes': 'footwear',
  'footwear': 'footwear',
  'Gourmet Foods & Agro': 'groceries',
  'groceries': 'groceries',
  'Health, Wellness & Fitness': 'health-wellness',
  'health-wellness': 'health-wellness',
  'Watches & Premium Accessories': 'watches-accessories',
  'watches-accessories': 'watches-accessories',
};

const UNITS = [
  { name: 'Pieces',    abbreviation: 'PCS', factor: 1 },
  { name: 'Kilograms', abbreviation: 'KG',  factor: 1 },
  { name: 'Pair',      abbreviation: 'PR',  factor: 1 },
  { name: 'Bottle',    abbreviation: 'BTL', factor: 1 },
  { name: 'Jar',       abbreviation: 'JAR', factor: 1 },
  { name: 'Box',       abbreviation: 'BOX', factor: 1 },
  { name: 'Set',       abbreviation: 'SET', factor: 1 },
] as const;

const DEFAULT_STOCK = 100;

interface JsonProduct {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  image: string;
  collection: string;
  priceNum: number;
  category: string;
  origin?: string;
  subtitle?: string;
  description: string;
  ingredients?: string[];
  galleryImages?: string[];
  brand: string;
}

function loadProducts(): JsonProduct[] {
  const localJson = path.join(__dirname, 'products.json');
  if (fs.existsSync(localJson)) {
    return JSON.parse(fs.readFileSync(localJson, 'utf8'));
  }
  const fallbackJson = path.join(__dirname, '../../ecom-dashboard/data/products.json');
  if (fs.existsSync(fallbackJson)) {
    return JSON.parse(fs.readFileSync(fallbackJson, 'utf8'));
  }
  throw new Error('products.json not found in prisma or ecom-dashboard directory');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported seeder
// ─────────────────────────────────────────────────────────────────────────────

export async function seedProducts(prisma: PrismaClient): Promise<void> {
  console.log('🛍️  [ProductSeeder] Starting NovaMart product seed...');

  const productsData = loadProducts();
  console.log(`📦 Loaded ${productsData.length} products from products.json`);

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

  const uniqueBrandNames = Array.from(new Set(productsData.map((p) => p.brand.trim()))).filter(Boolean);
  const brandMap: Record<string, string> = {};

  for (const brandName of uniqueBrandNames) {
    const slug = toSlug(brandName);
    const brand = await prisma.brand.upsert({
      where:  { slug },
      update: { name: brandName },
      create: { name: brandName, slug, logoUrl: null },
    });
    brandMap[brandName] = brand.id;
    brandMap[slug] = brand.id;
  }
  console.log(`   ✓ Successfully seeded ${uniqueBrandNames.length} brands`);

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
  }
  console.log(`   ✓ Successfully seeded ${UNITS.length} units`);

  // ── Step 4: Create Categories ─────────────────────────────────────────────
  console.log('📁 [ProductSeeder] Creating categories...');

  const categoryMap: Record<string, string> = {};

  for (const cat of CATEGORIES) {
    const created = await prisma.category.create({
      data: { name: cat.name, slug: cat.slug, imageUrl: cat.imageUrl },
    });
    categoryMap[cat.slug] = created.id;
    console.log(`   ✓ Category: "${created.name}" (${created.slug})`);
  }

  // ── Step 5: Create Products + default Variants ───────────────────────────
  console.log(`\n📦 [ProductSeeder] Creating ${productsData.length} NovaMart products...\n`);

  for (let i = 0; i < productsData.length; i++) {
    const p = productsData[i];
    const slug = toSlug(p.name);
    const categorySlug = CATEGORY_COLLECTION_MAP[p.collection] || 'skin-care';
    const categoryId = categoryMap[categorySlug];
    const brandId = brandMap[p.brand.trim()] || brandMap[toSlug(p.brand)];

    if (!brandId || !categoryId) {
      console.warn(`   ⚠️ Skipping "${p.name}" — missing brand or category (${p.brand} / ${p.collection})`);
      continue;
    }

    // Determine appropriate unit
    let unitKey = 'PCS';
    if (categorySlug === 'footwear') unitKey = 'PR';
    else if (categorySlug === 'groceries' && (p.name.includes('Honey') || p.name.includes('Oil') || p.name.includes('Ghee') || p.name.includes('Tea') || p.name.includes('Rice'))) {
      unitKey = p.name.includes('Rice') || p.name.includes('Salt') ? 'KG' : 'JAR';
    }
    else if (categorySlug === 'perfume' || (p.name.includes('Serum') || p.name.includes('Oil') || p.name.includes('Lotion'))) unitKey = 'BTL';
    const unitId = unitMap[unitKey] || unitMap['PCS'];

    const sku = skuFromName(p.brand, p.name, i);
    const cost = Math.round(p.priceNum * 0.75);

    // Prepare media items: featured image + additional gallery images
    const mediaCreates: Array<{ isFeatured: boolean; sortOrder: number; media: { create: { url: string; type: 'image'; provider: 's3' } } }> = [
      {
        isFeatured: true,
        sortOrder: 0,
        media: {
          create: {
            url: p.image,
            type: 'image',
            provider: 's3',
          },
        },
      },
    ];

    if (Array.isArray(p.galleryImages)) {
      p.galleryImages.forEach((imgUrl, gIdx) => {
        if (imgUrl && imgUrl !== p.image) {
          mediaCreates.push({
            isFeatured: false,
            sortOrder: gIdx + 1,
            media: {
              create: {
                url: imgUrl,
                type: 'image',
                provider: 's3',
              },
            },
          });
        }
      });
    }

    await prisma.product.create({
      data: {
        name:            p.name,
        slug,
        description:     p.description,
        status:          'active',
        metaTitle:       `${p.name} | NovaMart Bangladesh`,
        metaDescription: p.subtitle || p.description.slice(0, 160),
        metaKeywords:    `novamart, ${p.brand}, ${categorySlug}, online shop bangladesh, authentic import`,

        brandId,
        categoryId,
        unitId,

        media: {
          create: mediaCreates,
        },

        variants: {
          create: [
            {
              sku,
              price:               p.priceNum,
              cost,
              stockQuantity:       DEFAULT_STOCK,
              stockAlertThreshold: 10,
              isDefault:           true,
            },
          ],
        },
      },
    });

    console.log(`   ✓ [${i + 1}/${productsData.length}] "${p.name}" (${sku}, ৳${p.priceNum})`);
  }

  // ── Step 6: Configure NovaMart Settings with 01722301927 ─────────────────────
  console.log('\n⚙️  [ProductSeeder] Configuring NovaMart shop settings (Number: 01722301927)...');
  const existingSetting = await prisma.setting.findFirst();
  const settingData = {
    shopName: 'NovaMart',
    slogan: "Bangladesh's Premier Multi-Category Online Store",
    branchName: 'NovaMart Central Flagship & Fulfillment',
    branchAddress: 'Level 4, Nova Tower, Plot 18, Road 11, Banani, Dhaka-1213, Bangladesh',
    contactNumber: [
      { title: 'Hotline Support', value: '+880 1722-301927' },
      { title: 'Customer Care', value: '01722301927' },
    ],
    email: [
      { title: 'Customer Support', value: 'support@novamart.com.bd' },
      { title: 'Corporate Inquiries', value: 'sales@novamart.com.bd' },
    ],
    socialContact: {
      whatsapp: '8801722301927',
      facebook: 'https://facebook.com/novamart.bd',
      instagram: 'https://instagram.com/novamart.bd',
      youtube: 'https://youtube.com/@novamartbd',
    },
    currency: 'BDT',
    language: 'en',
    deliveryChargeInside: 60,
    deliveryChargeOutside: 120,
    deliveryChargeNearCity: 80,
    copyrightYear: new Date().getFullYear().toString(),
  };

  if (existingSetting) {
    await prisma.setting.update({
      where: { id: existingSetting.id },
      data: settingData,
    });
    console.log('   ✓ Updated shop settings to NovaMart (Hotline: 01722301927)');
  } else {
    await prisma.setting.create({
      data: settingData,
    });
    console.log('   ✓ Created initial shop settings for NovaMart (Hotline: 01722301927)');
  }

  // ── Step 7: Upsert NovaMart Hero Campaigns ─────────────────────────────────
  console.log('\n🎨 [ProductSeeder] Seeding NovaMart Hero Campaigns...');
  const heroSection = await prisma.section.findFirst({
    where: { title: 'Hero Campaign' },
  });

  if (heroSection) {
    const campaignsData = [
      {
        title: 'NovaMart-এ আপনাকে স্বাগতম',
        description: 'বিশ্বস্ত উৎসের ১০০% অথেনটিক পণ্য • সারা বাংলাদেশে দ্রুত ক্যাশ অন ডেলিভারি',
        hasDiscount: true,
        startAt: new Date(),
        status: 'active',
        images: [
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=80',
        ],
      },
      {
        title: 'স্মার্ট গ্যাজেটস & ডিজিটাল ইলেকট্রনিক্স',
        description: 'হেডফোন, স্মার্টওয়াচ, স্পিকার ও আধুনিক টেক এক্সেসরিজে সর্বোচ্চ ৪০% ছাড়',
        hasDiscount: true,
        startAt: new Date(),
        status: 'active',
        images: [
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1600&auto=format&fit=crop&q=80',
        ],
      },
      {
        title: 'স্কিন কেয়ার & লাক্সারি অরিজিনাল পারফিউম',
        description: 'কোরিয়ান সিরাম, ফেসওয়াশ ও অরিজিনাল অ্যারাবিয়ান আতর ও সুগন্ধিতে বিশেষ ছাড়',
        hasDiscount: true,
        startAt: new Date(),
        status: 'active',
        images: [
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1600&auto=format&fit=crop&q=80',
        ],
      },
      {
        title: 'প্রিমিয়াম বেবি কেয়ার ও কিডস ফ্যাশন',
        description: 'শিশুদের নিরাপদ স্কিন কেয়ার, ডায়াপার, পুষ্টিকর খাবার ও স্টাইলিশ পোশাক',
        hasDiscount: true,
        startAt: new Date(),
        status: 'active',
        images: [
          'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=1600&auto=format&fit=crop&q=80',
        ],
      },
    ];

    const oldCampaigns = await prisma.campaign.findMany({
      where: { sectionId: heroSection.id },
      select: { id: true },
    });
    for (const c of oldCampaigns) {
      await prisma.campaignImage.deleteMany({ where: { campaignId: c.id } });
    }
    await prisma.campaign.deleteMany({ where: { sectionId: heroSection.id } });

    for (const camp of campaignsData) {
      const createdCamp = await prisma.campaign.create({
        data: {
          title: camp.title,
          description: camp.description,
          hasDiscount: camp.hasDiscount,
          startAt: camp.startAt,
          status: camp.status,
          sectionId: heroSection.id,
        },
      });

      await prisma.campaignImage.create({
        data: {
          campaignId: createdCamp.id,
          images: camp.images,
        },
      });
      console.log(`   ✓ Created hero campaign: "${camp.title}"`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n🎉 [ProductSeeder] NovaMart multi-category catalog seeding complete!');
  console.log('   📊 Summary:');
  console.log(`      Brands     : ${uniqueBrandNames.length}`);
  console.log(`      Categories : ${CATEGORIES.length}`);
  console.log(`      Products   : ${productsData.length}`);
  console.log(`      Shop Name  : NovaMart`);
  console.log(`      Hotline    : 01722301927\n`);
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
