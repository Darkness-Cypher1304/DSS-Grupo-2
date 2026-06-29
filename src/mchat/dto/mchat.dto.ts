// ============================================================================
// DTOs de M-CHAT-R
// ============================================================================

import { IsEnum, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

// ----------------------------------------------------------------------------
// Submit del cuestionario
// ----------------------------------------------------------------------------
export class SubmitMchatDto {
  @ApiProperty({ required: false, example: 'Mateo' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  childName?: string;

  @ApiProperty({ example: 24, minimum: 12, maximum: 48 })
  @IsInt()
  @Min(12)
  @Max(48)
  childAgeMonths!: number;

  @ApiProperty({ enum: ['M', 'F', 'OTHER'], required: false })
  @IsOptional()
  @IsEnum({ M: 'M', F: 'F', OTHER: 'OTHER' })
  childGender?: 'M' | 'F' | 'OTHER';

  /**
   * Respuestas a las 20 preguntas como objeto:
   *   { q1: 'YES', q2: 'NO', q3: 'YES', ... q20: 'YES' }
   */
  @ApiProperty({
    description: 'Mapa de respuestas { q1: "YES" | "NO", ..., q20: ... }',
    example: { q1: 'YES', q2: 'NO', q3: 'YES' /* ... */ },
  })
  @IsObject()
  responses!: Record<string, 'YES' | 'NO'>;
}
