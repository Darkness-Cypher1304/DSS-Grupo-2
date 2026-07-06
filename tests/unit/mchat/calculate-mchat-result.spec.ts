// ============================================================================
// Unit · M-CHAT-R scoring (calculateMchatResult) — CRÍTICO (Zero Trust)
// ============================================================================
// El scoring es la fuente de verdad del riesgo y SIEMPRE corre en el servidor.
// Se prueba el algoritmo oficial (Robins/Fein/Barton 2009): puntaje, ítems
// críticos y umbrales LOW/MEDIUM/HIGH, además de la validación de entrada.
// ============================================================================

import { calculateMchatResult } from '../../../src/mchat/data/mchat-questions';
import {
  expectedAnswers,
  failAnswers,
  failFirstNonCritical,
  CRITICAL_IDS,
} from '../../fixtures/mchat.fixture';

describe('calculateMchatResult', () => {
  describe('nivel de riesgo por puntaje total', () => {
    it('retorna LOW con 0 fallos (todas las respuestas esperadas)', () => {
      // ARRANGE
      const answers = expectedAnswers();

      // ACT
      const result = calculateMchatResult(answers);

      // ASSERT
      expect(result.totalScore).toBe(0);
      expect(result.criticalFailures).toBe(0);
      expect(result.riskLevel).toBe('LOW');
      expect(result.failedQuestions).toEqual([]);
    });

    it('retorna LOW con 2 fallos no críticos (límite inferior)', () => {
      const result = calculateMchatResult(failFirstNonCritical(2));

      expect(result.totalScore).toBe(2);
      expect(result.criticalFailures).toBe(0);
      expect(result.riskLevel).toBe('LOW');
    });

    it('retorna MEDIUM con 3 fallos no críticos (umbral MEDIUM)', () => {
      const result = calculateMchatResult(failFirstNonCritical(3));

      expect(result.totalScore).toBe(3);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('retorna MEDIUM con 7 fallos no críticos (límite superior MEDIUM)', () => {
      const result = calculateMchatResult(failFirstNonCritical(7));

      expect(result.totalScore).toBe(7);
      expect(result.riskLevel).toBe('MEDIUM');
    });

    it('retorna HIGH con 8 fallos no críticos (umbral HIGH por puntaje)', () => {
      const result = calculateMchatResult(failFirstNonCritical(8));

      expect(result.totalScore).toBe(8);
      expect(result.riskLevel).toBe('HIGH');
    });
  });

  describe('regla clínica de ítems críticos', () => {
    it('cuenta como crítico cada ítem crítico fallado', () => {
      const result = calculateMchatResult(failAnswers([CRITICAL_IDS[0]]));

      expect(result.criticalFailures).toBe(1);
      expect(result.totalScore).toBe(1);
      // 1 crítico y score<3 → sigue siendo LOW
      expect(result.riskLevel).toBe('LOW');
    });

    it('retorna HIGH con 2 ítems críticos fallados aunque el puntaje sea bajo', () => {
      // ARRANGE — solo 2 críticos → totalScore 2 (<3) pero criticalFailures>=2
      const answers = failAnswers([CRITICAL_IDS[0], CRITICAL_IDS[1]]);

      // ACT
      const result = calculateMchatResult(answers);

      // ASSERT
      expect(result.totalScore).toBe(2);
      expect(result.criticalFailures).toBe(2);
      expect(result.riskLevel).toBe('HIGH');
    });
  });

  describe('reporte de preguntas falladas', () => {
    it('lista los números de pregunta fallados', () => {
      const result = calculateMchatResult(failFirstNonCritical(3));

      expect(result.failedQuestions).toHaveLength(3);
      result.failedQuestions.forEach((n) => expect(typeof n).toBe('number'));
    });
  });

  describe('recomendaciones por nivel', () => {
    it('incluye texto de "Riesgo bajo" en LOW', () => {
      expect(calculateMchatResult(expectedAnswers()).recommendations).toContain('Riesgo bajo');
    });

    it('incluye texto de "Riesgo medio" en MEDIUM', () => {
      expect(calculateMchatResult(failFirstNonCritical(3)).recommendations).toContain(
        'Riesgo medio',
      );
    });

    it('incluye texto de "Riesgo alto" en HIGH', () => {
      expect(calculateMchatResult(failFirstNonCritical(8)).recommendations).toContain(
        'Riesgo alto',
      );
    });
  });

  describe('validación de entrada (Zero Trust)', () => {
    it('lanza error si falta una respuesta', () => {
      const answers = expectedAnswers();
      delete answers['q1'];

      expect(() => calculateMchatResult(answers)).toThrow(/q1/);
    });

    it('lanza error si una respuesta no es YES/NO', () => {
      const answers = expectedAnswers();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (answers as any)['q1'] = 'MAYBE';

      expect(() => calculateMchatResult(answers)).toThrow(/q1/);
    });
  });
});
