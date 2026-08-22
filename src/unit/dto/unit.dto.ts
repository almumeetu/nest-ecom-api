import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateUnitDto {
  @ApiProperty({ example: 'Box' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'bx' })
  @IsString()
  @IsNotEmpty()
  abbreviation: string;

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsNumber()
  @Min(0.0001)
  @IsOptional()
  factor?: number;

  @ApiProperty({ example: 'parent-unit-uuid', required: false, nullable: true })
  @IsString()
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateUnitDto extends PartialType(CreateUnitDto) {}
