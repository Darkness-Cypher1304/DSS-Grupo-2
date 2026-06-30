// ============================================================================
// Validador de `responses` del M-CHAT-R (OWASP A03 · entrada no confiable)
// ============================================================================
// El campo `responses` era un objeto libre (@IsObject), así que el ValidationPipe
// global (whitelist/forbidNonWhitelisted) NO entraba a validar su contenido: un
// cliente podía mandar claves arbitrarias o valores no esperados. Este validador
// exige que `responses` contenga EXACTAMENTE las 20 respuestas del M-CHAT-R
// (las ids reales del cuestionario, no un patrón asumido) y que cada valor sea
// estrictamente "YES" o "NO". Defensa en el borde; el scoring server-side sigue
// siendo la fuente de verdad.
// ============================================================================

import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

import { MCHAT_QUESTIONS } from '../data/mchat-questions';

// Ids esperadas tomadas de la fuente real (q1..q20), no hardcodeadas.
const EXPECTED_IDS: ReadonlySet<string> = new Set(MCHAT_QUESTIONS.map((q) => q.id));

@ValidatorConstraint({ name: 'isMchatResponses', async: false })
export class IsMchatResponsesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    // Debe ser un objeto plano (no null, no array)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return false;
    }

    const entries = Object.entries(value as Record<string, unknown>);

    // Ni de más ni de menos: exactamente las 20 respuestas esperadas.
    if (entries.length !== EXPECTED_IDS.size) {
      return false;
    }

    // Cada clave debe ser una id válida y cada valor estrictamente YES/NO.
    return entries.every(
      ([key, val]) => EXPECTED_IDS.has(key) && (val === 'YES' || val === 'NO'),
    );
  }

  defaultMessage(): string {
    return `El campo "responses" debe contener exactamente las ${EXPECTED_IDS.size} respuestas del M-CHAT-R (q1..q20), cada una con valor "YES" o "NO".`;
  }
}

export function IsMchatResponses(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: IsMchatResponsesConstraint,
    });
  };
}
