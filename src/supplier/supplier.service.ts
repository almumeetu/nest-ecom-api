import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto, UpdateSupplierDto } from './dto/supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    return (this.prisma as any).supplier.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        isActive: dto.isActive ?? true,
      },
      include: { _count: { select: { products: true } } },
    });
  }

  findAll() {
    return (this.prisma as any).supplier.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(id: string) {
    const supplier = await (this.prisma as any).supplier.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!supplier) {
      throw new NotFoundException(`Supplier with ID ${id} not found`);
    }

    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    return (this.prisma as any).supplier.update({
      where: { id },
      data: dto,
      include: { _count: { select: { products: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return (this.prisma as any).supplier.delete({ where: { id } });
  }
}
