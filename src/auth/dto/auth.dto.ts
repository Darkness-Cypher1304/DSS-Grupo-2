// ============================================================================
// DTOs de Autenticación
// ============================================================================
// Validación estricta con class-validator. Bloquea OWASP A03 (Injection)
// desde el borde del sistema.
// SEPARACIÓN DE DTOs: Input != Output != Internal
// ============================================================================

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
  IsPhoneNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

// ---------------------------------------------------------------------------
// REGISTRO
// ---------------------------------------------------------------------------
export class RegisterDto {
  @ApiProperty({ example: 'maria.perez@gmail.com', description: 'Email único del usuario' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({ example: 'MiClave2026Segura!', description: 'Contraseña (mín 12 caracteres)' })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @MaxLength(128, { message: 'La contraseña no puede tener más de 128 caracteres' })
  // No exigimos complejidad obligatoria (NIST 2017+ desaconseja),
  // pero sí prohibimos las contraseñas más comunes (server-side check después)
  password!: string;

  @ApiProperty({ example: 'María Pérez Quispe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  // Permite letras, espacios, tildes, guiones (nombres compuestos)
  @Matches(/^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]+$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  fullName!: string;

  @ApiProperty({ example: '+51987654321', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  // Permite +51..., también números peruanos sin código país
  @Matches(/^\+?[0-9\s-]{6,20}$/, { message: 'El teléfono no es válido' })
  phoneNumber?: string;

  // role NO se acepta del cliente — siempre se crea como PARENT por defecto.
  // Cambiar a SPECIALIST requiere flujo separado con verificación de admin.
  // ESTO ES PREVENCIÓN DE MASS ASSIGNMENT.
}

// ---------------------------------------------------------------------------
// REGISTRO DE ESPECIALISTA (público)
// Crea la cuenta (rol PARENT, PENDING_VERIFICATION) + perfil de especialista en
// estado PENDING. El rol sube a SPECIALIST solo cuando el ADMIN aprueba.
// ---------------------------------------------------------------------------
export class RegisterSpecialistDto {
  @ApiProperty({ example: 'dra.lopez@hospital.pe' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({ example: 'MiClave2026Segura!' })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'María López Quispe' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[A-Za-zÀ-ÿñÑ\s'-]+$/, {
    message: 'El nombre solo puede contener letras y espacios',
  })
  fullName!: string;

  @ApiProperty({ required: false, example: '+51987654321' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s-]{6,20}$/, { message: 'El teléfono no es válido' })
  phoneNumber?: string;

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
}

// ---------------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------------
export class LoginDto {
  @ApiProperty({ example: 'maria.perez@gmail.com' })
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({ example: 'MiClave2026Segura!' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

// ---------------------------------------------------------------------------
// CAMBIO DE CONTRASEÑA
// ---------------------------------------------------------------------------
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

// ---------------------------------------------------------------------------
// RECUPERACIÓN DE CONTRASEÑA
// ---------------------------------------------------------------------------
export class RequestPasswordResetDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty()
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  newPassword!: string;
}

// ---------------------------------------------------------------------------
// ACTIVACIÓN DE ESPECIALISTA (pantalla 14) — crear contraseña con token
// El especialista aprobado define su contraseña vía enlace de un solo uso.
// ---------------------------------------------------------------------------
export class ActivateSpecialistDto {
  @ApiProperty({ description: 'Token de activación recibido por correo' })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;

  @ApiProperty({ example: 'MiClave2026Segura!', description: 'Contraseña (mín 12 caracteres)' })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @MaxLength(128)
  password!: string;
}

// ---------------------------------------------------------------------------
// VERIFICACIÓN DE EMAIL
// ---------------------------------------------------------------------------
export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}

// ---------------------------------------------------------------------------
// REENVÍO DE VERIFICACIÓN DE EMAIL
// ---------------------------------------------------------------------------
export class ResendVerificationDto {
  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;
}

// ---------------------------------------------------------------------------
// RESPONSE DTOs (lo que SE DEVUELVE al cliente)
// Importante: jamás incluyen passwordHash, tokens internos, etc.
// ---------------------------------------------------------------------------
export class AuthUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty()
  emailVerified!: boolean;
}

export class LoginResponseDto {
  @ApiProperty()
  user!: AuthUserResponseDto;

  @ApiProperty({ description: 'Access token JWT (15 min)' })
  accessToken!: string;

  // El refreshToken NO viaja en el body —  va en cookie HttpOnly
  // (ver auth.controller.ts setRefreshTokenCookie)
}
