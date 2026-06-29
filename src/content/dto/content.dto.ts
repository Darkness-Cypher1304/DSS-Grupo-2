// ============================================================================
// DTOs de Content
// ============================================================================

import { IsArray, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ContentStatus } from '@prisma/client';

export class CreateContentDto {
  @ApiProperty({ example: '¿Qué señales tempranas debo observar a los 18 meses?' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'Resumen breve de hasta 500 caracteres' })
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  summary!: string;

  @ApiProperty({ description: 'Contenido en Markdown' })
  @IsString()
  @MinLength(50)
  @MaxLength(50000)
  body!: string;

  @ApiProperty({ example: 'Señales tempranas' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category!: string;

  @ApiProperty({ type: [String], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateContentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(500)
  summary?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(50)
  @MaxLength(50000)
  body?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  category?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class ChangeContentStatusDto {
  @ApiProperty({ enum: ContentStatus })
  @IsEnum(ContentStatus)
  status!: ContentStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNotes?: string;
}
