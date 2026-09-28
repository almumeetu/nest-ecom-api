import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateIf, ValidateNested } from 'class-validator';

const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded'] as const;

export class ListOrdersQueryDto {
  @ApiPropertyOptional({ description: 'Search by order number or customer name/phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ORDER_STATUSES })
  @IsOptional()
  @IsIn(ORDER_STATUSES)
  status?: (typeof ORDER_STATUSES)[number];

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  paymentStatus?: (typeof PAYMENT_STATUSES)[number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}

export class GuestOrderItemDto {
  @ApiProperty({ example: 'variant-uuid' })
  @IsUUID()
  variantId: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'address-uuid' })
  @IsUUID()
  addressId: string;

  @ApiPropertyOptional({ example: 'coupon-code' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingCost?: number;

  @ApiPropertyOptional({ example: 'Please call before delivery' })
  @IsOptional()
  @IsString()
  orderNote?: string;

  @ApiPropertyOptional({ type: [GuestOrderItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GuestOrderItemDto)
  items?: GuestOrderItemDto[];
}

export class GuestAddressDto {
  @ApiPropertyOptional({ example: 'guest@example.com' })
  @IsOptional()
  @ValidateIf((o) => Boolean(o.email))
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  fullName: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  phone: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  addressLine1: string;

  @ApiPropertyOptional({ example: 'Apt 4B' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Dhaka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '1200' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Bangladesh' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateGuestOrderDto {
  @ApiProperty({ type: GuestAddressDto })
  @ValidateNested()
  @Type(() => GuestAddressDto)
  address: GuestAddressDto;

  @ApiProperty({ type: [GuestOrderItemDto] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GuestOrderItemDto)
  items: GuestOrderItemDto[];

  @ApiPropertyOptional({ example: 'SUMMER20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  shippingCost?: number;

  @ApiPropertyOptional({ example: 'Please call before delivery' })
  @IsOptional()
  @IsString()
  orderNote?: string;
}

export class UpdateOrderStatusDto {
  @ApiPropertyOptional({ enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] })
  @IsOptional()
  @IsIn(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'])
  status?: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: ['unpaid', 'paid', 'refunded'] })
  @IsOptional()
  @IsIn(['unpaid', 'paid', 'refunded'])
  paymentStatus?: 'unpaid' | 'paid' | 'refunded';
}
