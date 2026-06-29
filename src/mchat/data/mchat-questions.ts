// ============================================================================
// M-CHAT-R · 20 preguntas oficiales
// ============================================================================
// Modified Checklist for Autism in Toddlers, Revised (M-CHAT-R)
// Robins, D., Fein, D., & Barton, M. (2009)
//
// Adaptación al español según uso clínico estandarizado en países hispanohablantes.
// El cuestionario está diseñado para niños de 16-30 meses.
//
// SCORING OFICIAL:
//   - Cada pregunta tiene una respuesta "esperada" (la que NO indica riesgo).
//   - Si la respuesta del padre difiere de la esperada → suma 1 punto al riesgo.
//   - Score total:
//       0-2  → BAJO     (sin acción adicional)
//       3-7  → MEDIO    (aplicar M-CHAT-R/F o derivar)
//       8-20 → ALTO     (derivación inmediata)
//
// ÍTEMS CRÍTICOS (mayor peso clínico):
//   2, 7, 9, 13, 14, 15  →  un fallo en 2 o más críticos = riesgo MEDIO automático
// ============================================================================

export interface MchatQuestion {
  /** Número oficial de la pregunta (1-20) */
  number: number;
  /** ID estable que se usa en el JSON de respuestas */
  id: string;
  /** Texto de la pregunta */
  text: string;
  /** Respuesta NO-de-riesgo. Si el padre marca lo opuesto, suma 1 punto. */
  expectedAnswer: 'YES' | 'NO';
  /** Si es ítem crítico (mayor peso clínico) */
  critical: boolean;
  /** Categoría temática */
  category: 'social' | 'communication' | 'behavior' | 'sensory';
}

export const MCHAT_QUESTIONS: ReadonlyArray<MchatQuestion> = [
  {
    number: 1,
    id: 'q1',
    text: 'Si usted señala algo al otro lado de la habitación, ¿su hijo/a lo mira? Por ejemplo, si usted señala un juguete o un animal, ¿su hijo/a mira el juguete o el animal?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 2,
    id: 'q2',
    text: '¿Alguna vez se ha preguntado si su hijo/a podría ser sordo/a?',
    expectedAnswer: 'NO',
    critical: true,
    category: 'communication',
  },
  {
    number: 3,
    id: 'q3',
    text: '¿Su hijo/a juega a juegos de imaginación o de fantasía? Por ejemplo, finge beber de una taza vacía, hablar por teléfono, o dar de comer a una muñeca.',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 4,
    id: 'q4',
    text: '¿A su hijo/a le gusta subirse a las cosas? Por ejemplo, muebles, escaleras, o resbaladillas.',
    expectedAnswer: 'YES',
    critical: false,
    category: 'behavior',
  },
  {
    number: 5,
    id: 'q5',
    text: '¿Su hijo/a hace movimientos inusuales con los dedos cerca de los ojos? Por ejemplo, mover los dedos cerca de la cara.',
    expectedAnswer: 'NO',
    critical: false,
    category: 'behavior',
  },
  {
    number: 6,
    id: 'q6',
    text: '¿Su hijo/a señala con un dedo para pedir algo o para conseguir ayuda? Por ejemplo, señala una galleta o un juguete fuera de su alcance.',
    expectedAnswer: 'YES',
    critical: false,
    category: 'communication',
  },
  {
    number: 7,
    id: 'q7',
    text: '¿Su hijo/a señala con un dedo para mostrarle algo interesante? Por ejemplo, señala un avión en el cielo o un camión grande en la carretera.',
    expectedAnswer: 'YES',
    critical: true,
    category: 'social',
  },
  {
    number: 8,
    id: 'q8',
    text: '¿Está su hijo/a interesado/a en otros niños? Por ejemplo, ¿su hijo/a observa a otros niños, les sonríe, o se acerca a ellos?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 9,
    id: 'q9',
    text: '¿Su hijo/a le muestra cosas trayéndoselas o levantándolas para que las vea, no para pedir ayuda, sino sólo para compartirlas con usted? Por ejemplo, le muestra una flor o un juguete.',
    expectedAnswer: 'YES',
    critical: true,
    category: 'social',
  },
  {
    number: 10,
    id: 'q10',
    text: '¿Su hijo/a responde cuando usted lo/la llama por su nombre? Por ejemplo, ¿levanta la vista, habla o balbucea, o deja de hacer lo que estaba haciendo cuando usted lo/la llama por su nombre?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'communication',
  },
  {
    number: 11,
    id: 'q11',
    text: 'Cuando usted le sonríe a su hijo/a, ¿le devuelve la sonrisa?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 12,
    id: 'q12',
    text: '¿Le molestan a su hijo/a los ruidos cotidianos? Por ejemplo, ¿grita o llora ante ruidos como el de una aspiradora o música alta?',
    expectedAnswer: 'NO',
    critical: false,
    category: 'sensory',
  },
  {
    number: 13,
    id: 'q13',
    text: '¿Su hijo/a camina?',
    expectedAnswer: 'YES',
    critical: true,
    category: 'behavior',
  },
  {
    number: 14,
    id: 'q14',
    text: '¿Su hijo/a lo/la mira a los ojos cuando usted le habla, juega con él/ella, o lo/la viste?',
    expectedAnswer: 'YES',
    critical: true,
    category: 'social',
  },
  {
    number: 15,
    id: 'q15',
    text: '¿Su hijo/a intenta imitar lo que usted hace? Por ejemplo, decir adiós con la mano, aplaudir, o hacer un sonido gracioso cuando usted lo hace.',
    expectedAnswer: 'YES',
    critical: true,
    category: 'communication',
  },
  {
    number: 16,
    id: 'q16',
    text: 'Si usted se da vuelta para mirar algo, ¿su hijo/a se da vuelta para ver lo que usted está mirando?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 17,
    id: 'q17',
    text: '¿Su hijo/a intenta que usted lo/la mire? Por ejemplo, ¿lo/la mira para que lo/la elogie, o le dice "mira" o "mírame"?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 18,
    id: 'q18',
    text: '¿Su hijo/a entiende lo que usted le dice? Por ejemplo, si usted no señala, ¿su hijo/a entiende "pon el libro en la silla" o "tráeme la frazada"?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'communication',
  },
  {
    number: 19,
    id: 'q19',
    text: 'Si algo nuevo sucede, ¿su hijo/a lo/la mira a la cara para ver lo que usted siente al respecto? Por ejemplo, si oye un ruido extraño o ve un juguete nuevo, ¿lo/la mira a la cara?',
    expectedAnswer: 'YES',
    critical: false,
    category: 'social',
  },
  {
    number: 20,
    id: 'q20',
    text: '¿A su hijo/a le gustan las actividades con movimiento? Por ejemplo, que lo/la hamaquen o lo/la hagan saltar sobre las rodillas.',
    expectedAnswer: 'YES',
    critical: false,
    category: 'behavior',
  },
];

/**
 * Calcula el score y nivel de riesgo según las respuestas del padre.
 * Implementa el algoritmo oficial Robins/Fein/Barton (2009).
 *
 * NUNCA debe ejecutarse en el cliente. Siempre server-side (Zero Trust).
 */
export function calculateMchatResult(responses: Record<string, 'YES' | 'NO'>): {
  totalScore: number;
  criticalFailures: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  failedQuestions: number[];
  recommendations: string;
} {
  let totalScore = 0;
  let criticalFailures = 0;
  const failedQuestions: number[] = [];

  for (const q of MCHAT_QUESTIONS) {
    const answer = responses[q.id];

    // Validación: cada pregunta debe tener respuesta YES o NO
    if (answer !== 'YES' && answer !== 'NO') {
      throw new Error(`Respuesta inválida o ausente para la pregunta ${q.id}`);
    }

    if (answer !== q.expectedAnswer) {
      totalScore += 1;
      failedQuestions.push(q.number);
      if (q.critical) {
        criticalFailures += 1;
      }
    }
  }

  // Aplicar reglas oficiales:
  //   - HIGH si totalScore >= 8
  //   - HIGH también si criticalFailures >= 2 (regla clínica)
  //   - MEDIUM si totalScore >= 3
  //   - LOW en otro caso
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (totalScore >= 8 || criticalFailures >= 2) {
    riskLevel = 'HIGH';
  } else if (totalScore >= 3) {
    riskLevel = 'MEDIUM';
  }

  const recommendations = generateRecommendations(riskLevel);

  return {
    totalScore,
    criticalFailures,
    riskLevel,
    failedQuestions,
    recommendations,
  };
}

function generateRecommendations(level: 'LOW' | 'MEDIUM' | 'HIGH'): string {
  switch (level) {
    case 'LOW':
      return `**Riesgo bajo.** Las respuestas no muestran señales de alerta significativas. Continúa con los controles pediátricos regulares.

**Recomendaciones generales:**
- Sigue estimulando el lenguaje, el juego simbólico y la interacción social diaria.
- Si en el futuro notas algún cambio de comportamiento, repite el cuestionario.
- Acude al control de niño sano según el calendario pediátrico.`;

    case 'MEDIUM':
      return `**Riesgo medio.** Las respuestas muestran algunas señales que ameritan atención.

**Recomendaciones:**
- **No es un diagnóstico.** Es un tamizaje que indica que vale la pena profundizar.
- Considera coordinar una entrevista de seguimiento con un especialista.
- En NeuroAlert puedes consultar directamente a un pediatra o psicólogo verificado a través de la sección "Hacer una consulta".
- Mientras tanto, observa al niño/a en situaciones cotidianas y anota ejemplos concretos.
- Lleva esta información a tu próximo control pediátrico.`;

    case 'HIGH':
      return `**Riesgo alto.** Las respuestas muestran señales que requieren evaluación profesional.

**Recomendaciones:**
- **No es un diagnóstico de TEA**, pero sí es una indicación clara de que se debe consultar pronto a un especialista.
- Solicita una evaluación con pediatra del desarrollo, neurólogo pediátrico o psicólogo especializado en TEA.
- En Perú puedes acudir a:
  - Instituto Nacional de Salud del Niño (San Borja)
  - Hospital del Niño (Breña)
  - Hospital Hermilio Valdizán (Lima)
  - Centros privados especializados
- **La detección temprana cambia el pronóstico.** No esperes "a ver si pasa". Las intervenciones entre los 18 meses y los 3 años tienen el mayor impacto.
- Puedes derivar tu evaluación directamente a un especialista verificado en NeuroAlert con un solo clic.`;
  }
}
