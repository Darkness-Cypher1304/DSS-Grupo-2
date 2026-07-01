// ============================================================================
// DTOs de Users
// ============================================================================

import { IsEnum, IsOptional, IsString, MaxLength, MinLength, IsInt, Min, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserStatus, SpecialistVerificationStatus } from '@prisma/client';

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
// Solicitud de upgrade a SPECIALIST
// ----------------------------------------------------------------------------
export class RequestSpecialistUpgradeDto {
  @ApiProperty({ example: 'CMP-12345', description: 'Número de colegiatura (CMP/CPsP)' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  licenseNumber!: string;

  @ApiProperty({ example: 'Pediatría del Desarrollo' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  specialty!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  institution?: string;

  @ApiProperty({ example: 5, minimum: 0, maximum: 60 })
  @IsInt()
  @Min(0)
  @Max(60)
  yearsOfExperience!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  // RF-10: IDs de FileObject (subidos antes vía POST /storage/upload con
  // folder='specialist-docs'). El backend valida tipo y tamaño en la subida.
  @ApiProperty({ required: false, description: 'ID del documento de licencia (FileObject)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseDocumentId?: string;

  @ApiProperty({ required: false, description: 'ID del CV (FileObject)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cvDocumentId?: string;
}

// ----------------------------------------------------------------------------
// Aprobación/rechazo de especialista (admin)
// ----------------------------------------------------------------------------
export class VerifySpecialistDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] })
  @IsEnum({ APPROVED: 'APPROVED', REJECTED: 'REJECTED' })
  decision!: 'APPROVED' | 'REJECTED';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  rejectionReason?: string;
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
