import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminCreateReviewDto, CreateReviewDto, ListReviewsQueryDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException(`Product with ID ${productId} not found`);
    return this.prisma.review.create({ data: { rating: dto.rating, comment: dto.comment, isApproved: true, userId, productId } });
  }

  async createAdmin(userId: string, dto: AdminCreateReviewDto) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, deletedAt: null } });
    if (!product) throw new NotFoundException(`Product with ID ${dto.productId} not found`);
    return this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        isApproved: true,
        productId: dto.productId,
        userId,
      },
    });
  }

  async findAll(query: ListReviewsQueryDto) {
    const { search, isApproved, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (isApproved !== undefined) where.isApproved = isApproved;
    if (search) {
      where.OR = [
        { comment: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        include: {
          product: { select: { id: true, name: true, slug: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  productReviews(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, isApproved: true },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pending(query: ListReviewsQueryDto) {
    return this.findAll({ ...query, isApproved: false });
  }

  async update(id: string, dto: UpdateReviewDto) {
    await this.ensureReview(id);
    return this.prisma.review.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.ensureReview(id);
    await this.prisma.review.delete({ where: { id } });
    return { message: 'Review deleted successfully' };
  }

  private async ensureReview(id: string) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException(`Review with ID ${id} not found`);
    return review;
  }
}
