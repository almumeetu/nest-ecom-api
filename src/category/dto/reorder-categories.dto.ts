import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderCategoryItemDto {
  @ApiProperty({ description: 'Category ID being positioned' })
  @IsUUID()
  id: string;

  @ApiProperty({
    description: 'New parent category ID, or null for a root category',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @ApiProperty({ description: 'Zero-based position within its parent' })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({
    description: 'Full flat list of categories with their new parent + order',
    type: [ReorderCategoryItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoryItemDto)
  items: ReorderCategoryItemDto[];
}
