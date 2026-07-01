// ============================================================================
// DTOs de Postulación de Especialista (MedicalApplication)
// ============================================================================
// La postulación llega como multipart/form-data (campos de texto + 2 archivos:
// cv y dni). Los campos de texto de un multipart siempre llegan como STRING, así
// que coaccionamos números/booleanos con @Transform antes de validar.
// ============================================================================

import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1' || value === 'on';

const toInt = ({ value }: { value: unknown }): number =>
  typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);

// ---------------------------------------------------------------------------
// ENVIAR POSTULACIÓN (pantalla 9.5) — público, sin cuenta
// ---------------------------------------------------------------------------
export class SubmitApplicationDto {
  @ApiProperty({ example: 'María' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[A-Za-zÀ-ÿñÑ\s'-]+$/, { message: 'El nombre solo puede contener letras y espacios' })
  firstName!: string;

  @ApiProperty({ example: 'López Quispe' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/^[A-Za-zÀ-ÿñÑ\s'-]+$/, { message: 'El apellido solo puede contener letras y espacios' })
  lastName!: string;

  @ApiProperty({ example: 'dra.lopez@gmail.com' })
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase().trim() : value))
  email!: string;

  @ApiProperty({ example: '+51987654321' })
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[0-9\s-]{6,20}$/, { message: 'El teléfono no es válido' })
  phoneNumber!: string;

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

  @ApiProperty({ example: 'Universidad Peruana Cayetano Heredia' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  university!: string;

  @ApiProperty({ example: 'Perú' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  country!: string;

  @ApiProperty({ required: false, example: 'https://linkedin.com/in/dra-lopez' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w\-._~:/?#[\]@!$&'()*+,;=]*)?$/, {
    message: 'El enlace de LinkedIn no es una URL válida',
  })
  linkedinUrl?: string;

  @ApiProperty({ example: 5, minimum: 0, maximum: 60, description: 'Años de experiencia' })
  @Transform(toInt)
  @IsInt({ message: 'Los años de experiencia deben ser un número' })
  @Min(0)
  @Max(60)
  yearsOfExperience!: number;

  @ApiProperty({ example: 'Lunes a viernes, tardes' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  availability!: string;

  @ApiProperty({ example: 'Deseo colaborar con NeuroAlert porque...' })
  @IsString()
  @MinLength(20, { message: 'La carta de motivación es demasiado corta' })
  @MaxLength(3000)
  motivationLetter!: string;

  @ApiProperty({ example: true, description: 'Acepta que NeuroAlert verifique sus credenciales' })
  @Transform(toBool)
  @IsBoolean()
  consentAccepted!: boolean;
}

// ---------------------------------------------------------------------------
// CHECKLIST de verificación del ADMIN (pantalla 12) — los 6 ítems deben ir true
// ---------------------------------------------------------------------------
export class ApplicationChecklistDto {
  @ApiProperty() @IsBoolean() dniValidated!: boolean;
  @ApiProperty() @IsBoolean() cmpVerified!: boolean;
  @ApiProperty() @IsBoolean() cvReviewed!: boolean;
  @ApiProperty() @IsBoolean() interviewDone!: boolean;
  @ApiProperty() @IsBoolean() documentsComplete!: boolean;
  @ApiProperty() @IsBoolean() noInconsistencies!: boolean;
}

// ---------------------------------------------------------------------------
// APROBAR postulación (ADMIN) — exige el checklist completo
// ---------------------------------------------------------------------------
export class ApproveApplicationDto {
  @ApiProperty({ type: ApplicationChecklistDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicationChecklistDto)
  checklist!: ApplicationChecklistDto;
}

// ---------------------------------------------------------------------------
// RECHAZAR postulación (ADMIN) — con motivo
// ---------------------------------------------------------------------------
export class RejectApplicationDto {
  @ApiProperty({ example: 'La colegiatura no pudo ser verificada.' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  rejectionReason!: string;
}
