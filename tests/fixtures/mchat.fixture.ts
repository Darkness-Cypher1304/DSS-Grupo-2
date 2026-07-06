// ============================================================================
// Fixtures del M-CHAT-R
// ============================================================================
// Construye juegos de respuestas a partir de la FUENTE REAL (MCHAT_QUESTIONS),
// no de un patrón asumido. Permite generar escenarios de riesgo LOW/MEDIUM/HIGH
// de forma determinista.
// ============================================================================

import { MCHAT_QUESTIONS } from '../../src/mchat/data/mchat-questions';

export type MchatAnswers = Record<string, 'YES' | 'NO'>;

/** IDs de los ítems críticos (2,7,9,13,14,15) según la fuente. */
export const CRITICAL_IDS: string[] = MCHAT_QUESTIONS.filter((q) => q.critical).map((q) => q.id);

/** Todas las respuestas = la esperada (no-riesgo) → score 0, LOW. */
export function expectedAnswers(): MchatAnswers {
  const answers: MchatAnswers = {};
  for (const q of MCHAT_QUESTIONS) {
    answers[q.id] = q.expectedAnswer;
  }
  return answers;
}

/** Voltea (a la respuesta de riesgo) exactamente los IDs indicados. */
export function failAnswers(ids: string[]): MchatAnswers {
  const answers = expectedAnswers();
  for (const q of MCHAT_QUESTIONS) {
    if (ids.includes(q.id)) {
      answers[q.id] = q.expectedAnswer === 'YES' ? 'NO' : 'YES';
    }
  }
  return answers;
}

/** Voltea los primeros `n` ítems NO críticos → sube el score sin criticals. */
export function failFirstNonCritical(n: number): MchatAnswers {
  const nonCritical = MCHAT_QUESTIONS.filter((q) => !q.critical)
    .slice(0, n)
    .map((q) => q.id);
  return failAnswers(nonCritical);
}
