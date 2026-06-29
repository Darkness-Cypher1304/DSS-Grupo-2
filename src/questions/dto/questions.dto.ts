// ============================================================================
// DTOs de Questions y Answers
// ============================================================================

import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ example: '¿Cómo sé si necesita evaluación?' })
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  body!: string;

  @ApiProperty({ required: false, minimum: 0, maximum: 216 }) // 18 años en meses
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(216)
  childAgeMonths?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isUrgent?: boolean;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;
}

export class CreateAnswerDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(5000)
  body!: string;
}
