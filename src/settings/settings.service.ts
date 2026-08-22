import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(id: string) {
    const setting = await this.prisma.setting.findUnique({
      where: { id },
    });

    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }

    return setting;
  }

  async findFirst() {
    const setting = await this.prisma.setting.findFirst();
    if (!setting) {
      throw new NotFoundException('Settings have not been configured yet');
    }
    return setting;
  }

  async upsert(updateSettingDto: UpdateSettingDto) {
    const currentYear = new Date().getFullYear().toString();
    const data = { ...updateSettingDto, copyrightYear: currentYear };

    const setting = await this.prisma.setting.findFirst();

    if (!setting) {
      return this.prisma.setting.create({
        data: data as CreateSettingDto,
      });
    }

    return this.prisma.setting.update({
      where: { id: setting.id },
      data,
    });
  }
}
