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
    let setting = await this.prisma.setting.findFirst();
    if (!setting) {
      setting = await this.prisma.setting.create({
        data: {
          shopName: 'NovaMart',
          slogan: "Bangladesh's Premier Multi-Category Online Store",
          currency: 'BDT',
          deliveryChargeInside: 60,
          deliveryChargeOutside: 120,
          deliveryChargeNearCity: 80,
          contactNumber: [
            { title: 'Hotline Support', value: '+880 1722-301927' },
            { title: 'Customer Care', value: '01722301927' },
          ],
          socialContact: {
            whatsapp: '8801722301927',
            facebook: 'https://facebook.com/novamart.bd',
            instagram: 'https://instagram.com/novamart.bd',
            youtube: 'https://youtube.com/@novamartbd',
          },
        },
      });
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
