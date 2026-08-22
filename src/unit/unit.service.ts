import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

@Injectable()
export class UnitService {
  constructor(private readonly prisma: PrismaService) {}

  private get unitModel() {
    return (this.prisma as any).unit;
  }

  async create(dto: CreateUnitDto) {
    const existing = await this.unitModel.findUnique({
      where: { abbreviation: dto.abbreviation },
    });

    if (existing) {
      throw new ConflictException('Unit abbreviation already exists');
    }

    if (dto.parentId) {
      const parent = await this.unitModel.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new BadRequestException('Parent unit not found');
      }
    }

    return this.unitModel.create({
      data: {
        name: dto.name,
        abbreviation: dto.abbreviation,
        factor: dto.factor ?? 1,
        parentId: dto.parentId || null,
        isActive: dto.isActive ?? true,
      },
      include: {
        parent: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { products: true } },
      },
    });
  }

  findAll() {
    return this.unitModel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        parent: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { products: true } },
      },
    });
  }

  async findOne(id: string) {
    const unit = await this.unitModel.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { products: true } },
      },
    });

    if (!unit) {
      throw new NotFoundException(`Unit with ID ${id} not found`);
    }

    return unit;
  }

  async update(id: string, dto: UpdateUnitDto) {
    await this.findOne(id);

    if (dto.abbreviation) {
      const existing = await this.unitModel.findUnique({
        where: { abbreviation: dto.abbreviation },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Unit abbreviation already exists');
      }
    }

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('A unit cannot be its own parent');
      }
      if (dto.parentId) {
        const parent = await this.unitModel.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new BadRequestException('Parent unit not found');
        }
      }
    }

    return this.unitModel.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.abbreviation !== undefined && { abbreviation: dto.abbreviation }),
        ...(dto.factor !== undefined && { factor: dto.factor }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        parent: { select: { id: true, name: true, abbreviation: true } },
        _count: { select: { products: true } },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.unitModel.delete({ where: { id } });
  }
}
