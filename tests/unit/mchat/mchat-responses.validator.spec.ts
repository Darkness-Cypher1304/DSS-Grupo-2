// ============================================================================
// Unit · IsMchatResponsesConstraint (OWASP A03 — validación de entrada)
// ============================================================================

import { IsMchatResponsesConstraint } from '../../../src/mchat/dto/mchat-responses.validator';
import { expectedAnswers, failAnswers, CRITICAL_IDS } from '../../fixtures/mchat.fixture';

describe('IsMchatResponsesConstraint', () => {
  const validator = new IsMchatResponsesConstraint();

  it('acepta exactamente las 20 respuestas válidas (YES/NO)', () => {
    expect(validator.validate(expectedAnswers())).toBe(true);
    expect(validator.validate(failAnswers([CRITICAL_IDS[0]]))).toBe(true);
  });

  it('rechaza si no es un objeto plano (null, array, string)', () => {
    expect(validator.validate(null)).toBe(false);
    expect(validator.validate(['q1'])).toBe(false);
    expect(validator.validate('q1')).toBe(false);
  });

  it('rechaza si sobran o faltan respuestas', () => {
    const missing = expectedAnswers();
    delete missing['q1'];
    expect(validator.validate(missing)).toBe(false);

    const extra = { ...expectedAnswers(), q21: 'YES' };
    expect(validator.validate(extra)).toBe(false);
  });

  it('rechaza si alguna clave no es un id válido', () => {
    const answers = expectedAnswers();
    delete answers['q1'];
    (answers as Record<string, string>)['qX'] = 'YES';
    expect(validator.validate(answers)).toBe(false);
  });

  it('rechaza si algún valor no es estrictamente YES/NO', () => {
    const answers = expectedAnswers();
    (answers as Record<string, string>)['q1'] = 'MAYBE';
    expect(validator.validate(answers)).toBe(false);
  });

  it('expone un mensaje de error descriptivo', () => {
    expect(validator.defaultMessage()).toContain('20');
  });
});
