import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGuestOrderDto, CreateOrderDto, ListOrdersQueryDto, UpdateOrderStatusDto } from './dto/order.dto';

const orderInclude = {
  user: { select: { id: true, name: true, email: true, phone: true } },
  address: true,
  items: { include: { product: { include: { media: { include: { media: true } } } }, variant: true } },
  payments: true,
  shipments: true,
  statusLogs: { orderBy: { createdAt: 'desc' as const } },
};

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) { }

  async create(userId: string, dto: CreateOrderDto) {
    let cartItems: any[] = [];
    let cart: any = null;
    const now = new Date();

    if (dto.items && dto.items.length > 0) {
      const variantIds = dto.items.map(item => item.variantId);
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        include: { product: true }
      });

      const variantMap = new Map(variants.map(v => [v.id, v]));

      for (const itemInput of dto.items) {
        const variant = variantMap.get(itemInput.variantId);
        if (!variant) {
          throw new NotFoundException(`Variant with ID ${itemInput.variantId} not found`);
        }
        cartItems.push({
          variantId: variant.id,
          quantity: itemInput.quantity,
          variant: variant,
        });
      }
    } else {
      cart = await this.prisma.cart.findFirst({
        where: { userId },
        include: { items: { include: { variant: { include: { product: true } } } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!cart || cart.items.length === 0) throw new BadRequestException('Cart is empty');
      cartItems = cart.items;
    }

    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    const productIds = cartItems.map(item => item.variant.productId);
    const discountProducts = await this.prisma.discountProduct.findMany({
      where: {
        productId: { in: productIds },
        discount: {
          status: 'active',
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
      },
      include: { discount: true },
    });

    const discountMap = new Map<string, any[]>();
    for (const { productId, discount } of discountProducts) {
      const existing = discountMap.get(productId);
      if (existing) existing.push(discount);
      else discountMap.set(productId, [discount]);
    }

    const calculateDiscount = (price: number, type: 'percentage' | 'fixed', value: number) => {
      const discountAmount = type === 'percentage' ? price * (value / 100) : value;
      const actualDiscount = Math.min(discountAmount, price);
      return {
        discountAmount: Math.round(actualDiscount * 100) / 100,
        discountedPrice: Math.round((price - actualDiscount) * 100) / 100,
      };
    };

    const pickBestDiscount = (discounts: any[], lowestPrice: number) => {
      if (discounts.length === 1) return discounts[0];
      return discounts.reduce((best, current) => {
        const amount = (d: any) =>
          d.type === 'percentage' ? lowestPrice * (Number(d.value) / 100) : Number(d.value);
        return amount(current) > amount(best) ? current : best;
      });
    };

    const itemsWithDiscounts = cartItems.map(item => {
      const price = Number(item.variant.price);
      const discounts = discountMap.get(item.variant.productId);
      if (discounts?.length) {
        const best = pickBestDiscount(discounts, price);
        if (best) {
          const { discountedPrice } = calculateDiscount(price, best.type, Number(best.value));
          return { ...item, activePrice: discountedPrice };
        }
      }
      return { ...item, activePrice: price };
    });

    return this.prisma.$transaction(async (tx) => {
      let subtotal = 0;
      for (const item of itemsWithDiscounts) {
        if (item.variant.stockQuantity < item.quantity) {
          throw new BadRequestException(`Insufficient stock for SKU ${item.variant.sku}`);
        }
        subtotal += item.activePrice * item.quantity;
      }

      let discount = 0;
      if (dto.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: dto.couponCode } });
        if (!coupon) throw new BadRequestException('Invalid coupon');
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new BadRequestException('Coupon expired');
        }
        if (coupon.usedCount >= coupon.maxUsage) throw new BadRequestException('Coupon usage limit reached');
        discount = coupon.type === 'percentage'
          ? subtotal * (Number(coupon.value) / 100)
          : Number(coupon.value);
        discount = Math.min(discount, subtotal);
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      const order = await tx.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          userId,
          addressId: dto.addressId,
          total: subtotal - discount,
          discount,
          shippingCost: 0,
          items: {
            create: itemsWithDiscounts.map((item) => ({
              productId: item.variant.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.activePrice,
              totalPrice: item.activePrice * item.quantity,
            })),
          },
          statusLogs: { create: { status: 'pending', note: 'Order created' } },
        },
        include: orderInclude,
      });

      for (const item of cartItems) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: -item.quantity,
            reason: 'sale',
            referenceId: order.id,
            note: 'Order created',
          },
        });
      }

      if (cart) {
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return order;
    });
  }

  async createGuest(dto: CreateGuestOrderDto) {
    const now = new Date();
    const itemsData: Array<{ variantId: string; quantity: number; productId: string; unitPrice: number }> = [];

    const variantIds = dto.items.map(item => item.variantId);
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: true }
    });

    const validVariants = variants.filter(Boolean) as any[];
    const productIds = validVariants.map(v => v.productId);

    const discountProducts = await this.prisma.discountProduct.findMany({
      where: {
        productId: { in: productIds },
        discount: {
          status: 'active',
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
      },
      include: { discount: true },
    });

    const discountMap = new Map<string, any[]>();
    for (const { productId, discount } of discountProducts) {
      const existing = discountMap.get(productId);
      if (existing) existing.push(discount);
      else discountMap.set(productId, [discount]);
    }

    const calculateDiscount = (price: number, type: 'percentage' | 'fixed', value: number) => {
      const discountAmount = type === 'percentage' ? price * (value / 100) : value;
      const actualDiscount = Math.min(discountAmount, price);
      return {
        discountAmount: Math.round(actualDiscount * 100) / 100,
        discountedPrice: Math.round((price - actualDiscount) * 100) / 100,
      };
    };

    const pickBestDiscount = (discounts: any[], lowestPrice: number) => {
      if (discounts.length === 1) return discounts[0];
      return discounts.reduce((best, current) => {
        const amount = (d: any) =>
          d.type === 'percentage' ? lowestPrice * (Number(d.value) / 100) : Number(d.value);
        return amount(current) > amount(best) ? current : best;
      });
    };

    let subtotal = 0;
    for (const item of dto.items) {
      const variant = validVariants.find(v => v.id === item.variantId);
      if (!variant) throw new NotFoundException(`Variant with ID ${item.variantId} not found`);
      if (variant.stockQuantity < item.quantity) {
        throw new BadRequestException(`Insufficient stock for SKU ${variant.sku}`);
      }

      const price = Number(variant.price);
      const discounts = discountMap.get(variant.productId);
      let unitPrice = price;

      if (discounts?.length) {
        const best = pickBestDiscount(discounts, price);
        if (best) {
          const { discountedPrice } = calculateDiscount(price, best.type, Number(best.value));
          unitPrice = discountedPrice;
        }
      }

      itemsData.push({
        variantId: item.variantId,
        quantity: item.quantity,
        productId: variant.productId,
        unitPrice,
      });
      subtotal += unitPrice * item.quantity;
    }

    return this.prisma.$transaction(async (tx) => {
      let discount = 0;
      if (dto.couponCode) {
        const coupon = await tx.coupon.findUnique({ where: { code: dto.couponCode } });
        if (!coupon) throw new BadRequestException('Invalid coupon');
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
          throw new BadRequestException('Coupon expired');
        }
        if (coupon.usedCount >= coupon.maxUsage) throw new BadRequestException('Coupon usage limit reached');
        discount = coupon.type === 'percentage'
          ? subtotal * (Number(coupon.value) / 100)
          : Number(coupon.value);
        discount = Math.min(discount, subtotal);
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      const order = await tx.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}`,
          total: subtotal - discount,
          discount,
          shippingCost: 0,
          shippingAddress: dto.address as object,
          items: {
            create: itemsData.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.unitPrice * item.quantity,
            })),
          },
          statusLogs: { create: { status: 'pending', note: 'Guest order placed' } },
        },
        include: orderInclude,
      });

      for (const item of itemsData) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        await tx.inventoryLog.create({
          data: {
            variantId: item.variantId,
            change: -item.quantity,
            reason: 'sale',
            referenceId: order.id,
            note: 'Guest order created',
          },
        });
      }

      return order;
    });
  }

  async findAll(query: ListOrdersQueryDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = {};

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phone: { contains: search, mode: 'insensitive' } } },
        { shippingAddress: { path: ['fullName'], string_contains: search } },
        { shippingAddress: { path: ['email'], string_contains: search } },
        { shippingAddress: { path: ['phone'], string_contains: search } },
      ];
    }
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { placedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { data, meta: { page, limit, total } };
  }

  myOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { placedAt: 'desc' },
    });
  }

  async findOne(id: string, userId?: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`Order with ID ${id} not found`);
    return order;
  }

  async trackOrder(orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        placedAt: true,
      },
    });
    if (!order) throw new NotFoundException(`Order not found`);
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = {};
    if (dto.status) {
      data.status = dto.status;
      data.statusLogs = { create: { status: dto.status, note: dto.note } };
    }
    if (dto.paymentStatus) {
      data.paymentStatus = dto.paymentStatus;
    }
    return this.prisma.order.update({
      where: { id },
      data,
      include: orderInclude,
    });
  }

  async cancel(id: string, userId?: string) {
    const order = await this.findOne(id, userId);
    if (['shipped', 'delivered', 'returned'].includes(order.status)) {
      throw new BadRequestException('This order cannot be cancelled');
    }
    return this.updateStatus(id, { status: 'cancelled', note: 'Order cancelled' });
  }
}
