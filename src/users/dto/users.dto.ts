// ============================================================================
// DTOs de Users
// ============================================================================

import { IsEnum, IsOptional, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';

// ----------------------------------------------------------------------------
// Actualizar perfil propio
// ----------------------------------------------------------------------------
export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]+$/)
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s-]{6,20}$/)
  phoneNumber?: string;
}

// ----------------------------------------------------------------------------
// Cambiar status (admin only)
// ----------------------------------------------------------------------------
export class UpdateUserStatusDto {
  @ApiProperty({ enum: UserStatus })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

// ----------------------------------------------------------------------------
// Autoeliminación de cuenta — PADRE (Etapa 3)
// Requiere reautenticación con la contraseña actual (además del "ELIMINAR" del UI).
// ----------------------------------------------------------------------------
export class RequestAccountDeletionDto {
  @ApiProperty({ description: 'Contraseña actual (reautenticación)' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ required: false, description: 'Motivo opcional' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ----------------------------------------------------------------------------
// Solicitud de baja — ESPECIALISTA (Etapa 3)
// ----------------------------------------------------------------------------
export class RequestLeaveDto {
  @ApiProperty({ example: 'Finalización de colaboración' })
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reason!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}

// ----------------------------------------------------------------------------
// Decisión del admin sobre una solicitud de baja (aprobar/rechazar) — nota opcional
// ----------------------------------------------------------------------------
export class LeaveDecisionDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
