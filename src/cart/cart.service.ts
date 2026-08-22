import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const cartInclude = {
  items: {
    include: {
      variant: {
        include: {
          attributes: {
            include: {
              attributeValue: {
                include: {
                  attribute: true,
                },
              },
            },
          },
          media: { include: { media: true } },
          product: { include: { media: { include: { media: true } } } },
        },
      },
    },
    orderBy: {
      createdAt: 'desc' as const,
    },
  },
};

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId, true);
    const enriched = await this.enrichCartWithDiscounts(cart);
    return this.withTotals(enriched);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: dto.variantId } });
    if (!variant) throw new NotFoundException(`Variant with ID ${dto.variantId} not found`);
    if (variant.stockQuantity < dto.quantity) throw new BadRequestException('Insufficient stock');

    const cart = await this.getOrCreateCart(userId);

    const existing = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, variantId: dto.variantId },
    });

    if (existing) {
      const quantity = existing.quantity + dto.quantity;
      if (variant.stockQuantity < quantity) throw new BadRequestException('Insufficient stock');
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId: dto.variantId, quantity: dto.quantity },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.getOwnedItem(userId, itemId);

    if (dto.variantId && dto.variantId !== item.variantId) {
      const newVariant = await this.prisma.productVariant.findUniqueOrThrow({
        where: { id: dto.variantId },
      });
      const targetQty = dto.quantity ?? item.quantity;
      if (newVariant.stockQuantity < targetQty) throw new BadRequestException('Insufficient stock');

      const existing = await this.prisma.cartItem.findFirst({
        where: { cartId: item.cartId, variantId: dto.variantId, id: { not: itemId } },
      });

      if (existing) {
        const mergedQty = existing.quantity + targetQty;
        if (newVariant.stockQuantity < mergedQty) throw new BadRequestException('Insufficient stock');
        
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: mergedQty },
        });
        await this.prisma.cartItem.delete({
          where: { id: itemId },
        });
      } else {
        await this.prisma.cartItem.update({
          where: { id: itemId },
          data: { variantId: dto.variantId, quantity: targetQty },
        });
      }
    } else {
      if (dto.quantity !== undefined) {
        const variant = await this.prisma.productVariant.findUniqueOrThrow({
          where: { id: item.variantId },
        });
        if (variant.stockQuantity < dto.quantity) throw new BadRequestException('Insufficient stock');

        await this.prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity: dto.quantity },
        });
      }
    }

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    await this.getOwnedItem(userId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getCart(userId);
  }

  async clear(userId: string) {
    const cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return { message: 'Cart cleared successfully' };
  }

  private async getOrCreateCart(userId: string, includeItems = false) {
    const existing = await this.prisma.cart.findFirst({
      where: { userId },
      include: includeItems ? cartInclude : undefined,
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.cart.create({
      data: { userId },
      include: includeItems ? cartInclude : undefined,
    });
  }

  private async getOwnedItem(userId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId } },
    });
    if (!item) throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    return item;
  }

  private async enrichCartWithDiscounts(cart: any) {
    if (!cart?.items?.length) return cart;

    const productIds = cart.items.map((item: any) => item.variant.productId);
    const now = new Date();
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

    for (const item of cart.items) {
      const discounts = discountMap.get(item.variant.productId);
      if (discounts?.length) {
        const best = pickBestDiscount(discounts, Number(item.variant.price));
        if (best) {
          const { discountAmount, discountedPrice } = calculateDiscount(
            Number(item.variant.price),
            best.type,
            Number(best.value),
          );
          item.variant.discountAmount = discountAmount;
          item.variant.discountedPrice = discountedPrice;
        }
      }
    }

    return cart;
  }

  private withTotals(cart: any) {
    const subtotal = cart.items.reduce(
      (sum: number, item: any) => {
        const price = item.variant.discountedPrice !== undefined
          ? Number(item.variant.discountedPrice)
          : Number(item.variant.price);
        return sum + price * item.quantity;
      },
      0,
    );
    return { ...cart, subtotal };
  }
}
