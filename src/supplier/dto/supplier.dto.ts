import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'Supplier Company Ltd.' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '01712345678', required: false })
  @Matches(/^\+?[0-9][0-9\s\-()]{6,19}$/, { message: 'Invalid phone number format' })
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'supplier@example.com', required: false })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123 Main St, Dhaka', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
