'use client';

// ============================================================================
// M-CHAT-R · Cuestionario interactivo
// ============================================================================
// EL HIGHLIGHT del proyecto. UX cuidadosa:
//   - Una pregunta a la vez
//   - Progress bar
//   - Datos del niño primero (edad, género)
//   - Resultado con riskLevel + recomendaciones + CTA a especialista
// ============================================================================

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
  ShieldCheck,
} from 'lucide-react';

import { apiGet, apiPost } from '@/lib/api-client';

interface Question {
  number: number;
  id: string;
  text: string;
  category: 'social' | 'communication' | 'behavior' | 'sensory';
}

interface MchatResult {
  id: string;
  childAgeMonths: number;
  totalScore: number;
  criticalFailures: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  failedQuestions: number[];
  recommendations: string;
  createdAt: string;
}

type Stage = 'intro' | 'demographics' | 'questions' | 'review' | 'result';

interface Demographics {
  childName: string;
  childAgeMonths: number;
  childGender: 'M' | 'F' | 'OTHER' | '';
}

export default function MchatPage() {
  const [stage, setStage] = useState<Stage>('intro');
  const [demographics, setDemographics] = useState<Demographics>({
    childName: '',
    childAgeMonths: 24,
    childGender: '',
  });
  const [responses, setResponses] = useState<Record<string, 'YES' | 'NO'>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [result, setResult] = useState<MchatResult | null>(null);

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ['mchat-questions'],
    queryFn: () => apiGet<Question[]>('/mchat/questions'),
  });

  const submitMutation = useMutation({
    mutationFn: (payload: object) => apiPost<MchatResult>('/mchat', payload),
    onSuccess: (data) => {
      setResult(data);
      setStage('result');
      window.scrollTo(0, 0);
    },
  });

  function handleAnswer(answer: 'YES' | 'NO') {
    if (!questions) return;
    const q = questions[currentIndex];
    setResponses((prev) => ({ ...prev, [q.id]: answer }));

    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex((i) => i + 1), 220);
    } else {
      setTimeout(() => setStage('review'), 220);
    }
  }

  function handleSubmit() {
    if (!questions) return;
    submitMutation.mutate({
      childName: demographics.childName || undefined,
      childAgeMonths: demographics.childAgeMonths,
      childGender: demographics.childGender || undefined,
      responses,
    });
  }

  if (isLoading || !questions) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="container-narrow py-12 min-h-screen">
      {stage === 'intro' && <IntroStage onStart={() => setStage('demographics')} />}

      {stage === 'demographics' && (
        <DemographicsStage
          value={demographics}
          onChange={setDemographics}
          onNext={() => setStage('questions')}
          onBack={() => setStage('intro')}
        />
      )}

      {stage === 'questions' && (
        <QuestionsStage
          questions={questions}
          currentIndex={currentIndex}
          responses={responses}
          onAnswer={handleAnswer}
          onBack={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        />
      )}

      {stage === 'review' && (
        <ReviewStage
          questions={questions}
          responses={responses}
          onSubmit={handleSubmit}
          onEdit={(idx: number) => {
            setCurrentIndex(idx);
            setStage('questions');
          }}
          isSubmitting={submitMutation.isPending}
          error={submitMutation.error}
        />
      )}

      {stage === 'result' && result && <ResultStage result={result} />}
    </div>
  );
}

// ============================================================================
// STAGE: INTRO
// ============================================================================
function IntroStage({ onStart }: { onStart: () => void }) {
  return (
    <div className="animate-fade-in">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-teal-700 mb-8"
      >
        <ArrowLeft size={16} />
        Volver
      </Link>

      <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
        Cuestionario · Robins, Fein & Barton (2009)
      </span>
      <h1 className="font-display text-4xl md:text-6xl tracking-tightest leading-tight mt-3 mb-6">
        M-CHAT-R
        <br />
        <span className="italic font-light text-teal-700">en 20 preguntas.</span>
      </h1>

      <p className="text-lg text-ink-mute leading-relaxed mb-8 max-w-xl">
        El Modified Checklist for Autism in Toddlers, Revised es la herramienta de
        tamizaje más usada internacionalmente. Es <strong>educativa</strong>, no diagnóstica.
        Te dará un nivel de riesgo y recomendaciones para los siguientes pasos.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <InfoCard
          icon={<Info size={20} />}
          title="Edad ideal"
          text="16 a 30 meses"
        />
        <InfoCard
          icon={<CheckCircle2 size={20} />}
          title="Duración"
          text="5 minutos aprox."
        />
        <InfoCard
          icon={<ShieldCheck size={20} />}
          title="Privacidad"
          text="Solo tú lo verás"
        />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8 flex gap-3">
        <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900 leading-relaxed">
          <strong>Importante:</strong> este cuestionario NO es un diagnóstico. Solo un
          profesional de la salud puede diagnosticar TEA. Si el resultado es alto,
          NeuroAlert te ayudará a derivarte a un especialista verificado.
        </p>
      </div>

      <button onClick={onStart} className="btn-primary text-base px-8 py-3.5">
        Empezar las 20 preguntas
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card-clinical">
      <div className="text-teal-700 mb-2">{icon}</div>
      <div className="text-xs uppercase tracking-wider text-ink-fade font-mono mb-1">{title}</div>
      <div className="text-sm font-medium">{text}</div>
    </div>
  );
}

// ============================================================================
// STAGE: DEMOGRAPHICS
// ============================================================================
function DemographicsStage({
  value,
  onChange,
  onNext,
  onBack,
}: {
  value: Demographics;
  onChange: (d: Demographics) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isValid = value.childAgeMonths >= 12 && value.childAgeMonths <= 48;

  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-teal-700 mb-8">
        <ArrowLeft size={16} /> Volver
      </button>

      <span className="text-xs font-mono uppercase tracking-widest text-teal-700">
        Paso 1 de 2
      </span>
      <h1 className="font-display text-4xl tracking-tightest mt-2 mb-6">
        Cuéntame sobre tu hijo/a.
      </h1>
      <p className="text-ink-mute mb-8">
        Estos datos nos ayudan a personalizar el resultado. Puedes dejar el nombre vacío si prefieres.
      </p>

      <div className="space-y-5 max-w-md">
        <div>
          <label className="label">Nombre <span className="text-ink-fade font-normal">(opcional)</span></label>
          <input
            type="text"
            className="input"
            placeholder="Mateo"
            value={value.childName}
            onChange={(e) => onChange({ ...value, childName: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Edad en meses</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={12}
              max={48}
              value={value.childAgeMonths}
              onChange={(e) => onChange({ ...value, childAgeMonths: parseInt(e.target.value, 10) })}
              className="flex-1 accent-teal-700"
            />
            <div className="font-display text-3xl text-teal-800 w-20 text-right">
              {value.childAgeMonths}
              <span className="text-sm text-ink-mute ml-1">m</span>
            </div>
          </div>
          <p className="text-xs text-ink-fade mt-1">
            El M-CHAT-R está validado para 16-30 meses. Para otras edades, los resultados son orientativos.
          </p>
        </div>

        <div>
          <label className="label">Sexo asignado al nacer <span className="text-ink-fade font-normal">(opcional)</span></label>
          <div className="grid grid-cols-3 gap-2">
            {(['M', 'F', 'OTHER'] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onChange({ ...value, childGender: g })}
                className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  value.childGender === g
                    ? 'bg-teal-700 text-bone-50 border-teal-700'
                    : 'bg-bone-50 border-bone-300 hover:border-teal-400'
                }`}
              >
                {g === 'M' ? 'Masculino' : g === 'F' ? 'Femenino' : 'Otro / prefiero no decir'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!isValid}
        className="btn-primary mt-10 px-8 py-3.5 text-base"
      >
        Continuar a las preguntas
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

// ============================================================================
// STAGE: QUESTIONS
// ============================================================================
function QuestionsStage({
  questions,
  currentIndex,
  responses,
  onAnswer,
  onBack,
}: {
  questions: Question[];
  currentIndex: number;
  responses: Record<string, 'YES' | 'NO'>;
  onAnswer: (a: 'YES' | 'NO') => void;
  onBack: () => void;
}) {
  const question = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const currentAnswer = responses[question.id];

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs font-mono uppercase tracking-widest text-ink-mute mb-2">
          <span>Pregunta {currentIndex + 1} de {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-bone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-700 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div key={question.id} className="animate-fade-in-up">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          {labelForCategory(question.category)}
        </span>
        <h2 className="font-display text-2xl md:text-3xl leading-snug mt-2 mb-10 text-ink">
          {question.text}
        </h2>

        <div className="grid md:grid-cols-2 gap-3">
          <AnswerButton
            label="Sí"
            selected={currentAnswer === 'YES'}
            onClick={() => onAnswer('YES')}
          />
          <AnswerButton
            label="No"
            selected={currentAnswer === 'NO'}
            onClick={() => onAnswer('NO')}
          />
        </div>

        <div className="flex justify-between items-center mt-8">
          <button
            onClick={onBack}
            disabled={currentIndex === 0}
            className="btn-ghost disabled:opacity-30"
          >
            <ArrowLeft size={16} /> Anterior
          </button>
          <span className="text-xs text-ink-fade">Tus respuestas se guardan automáticamente</span>
        </div>
      </div>
    </div>
  );
}

function labelForCategory(c: Question['category']): string {
  const map: Record<Question['category'], string> = {
    social: 'Interacción social',
    communication: 'Comunicación',
    behavior: 'Comportamiento',
    sensory: 'Procesamiento sensorial',
  };
  return map[c];
}

function AnswerButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-6 py-8 rounded-2xl border-2 text-2xl font-display tracking-tightest transition-all ${
        selected
          ? 'bg-teal-700 text-bone-50 border-teal-700 scale-[0.98]'
          : 'bg-white border-bone-300 hover:border-teal-500 hover:bg-teal-50/40 active:scale-[0.98]'
      }`}
    >
      {label}
      {selected && (
        <CheckCircle2
          size={20}
          className="absolute top-4 right-4 text-coral-300"
        />
      )}
    </button>
  );
}

// ============================================================================
// STAGE: REVIEW
// ============================================================================
function ReviewStage({
  questions,
  responses,
  onSubmit,
  onEdit,
  isSubmitting,
  error,
}: {
  questions: Question[];
  responses: Record<string, 'YES' | 'NO'>;
  onSubmit: () => void;
  onEdit: (idx: number) => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const errMsg = error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
      'No pudimos procesar tu evaluación. Intenta nuevamente.'
    : null;

  return (
    <div className="animate-fade-in">
      <span className="text-xs font-mono uppercase tracking-widest text-teal-700">
        Casi listo
      </span>
      <h1 className="font-display text-4xl tracking-tightest mt-2 mb-3">
        Revisa tus respuestas
      </h1>
      <p className="text-ink-mute mb-8">
        Puedes hacer clic en cualquier pregunta para modificarla antes de enviar.
      </p>

      <div className="bg-white rounded-2xl border border-bone-200 divide-y divide-bone-200 mb-8">
        {questions.map((q, idx) => {
          const a = responses[q.id];
          return (
            <button
              key={q.id}
              onClick={() => onEdit(idx)}
              className="w-full text-left px-5 py-4 flex justify-between items-start gap-4 hover:bg-bone-50 transition-colors"
            >
              <div className="flex-1">
                <div className="text-xs text-ink-fade font-mono mb-1">P{idx + 1}</div>
                <div className="text-sm text-ink-soft">{q.text}</div>
              </div>
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  a === 'YES' ? 'bg-teal-100 text-teal-800' : 'bg-coral-100 text-coral-800'
                }`}
              >
                {a === 'YES' ? 'Sí' : 'No'}
              </span>
            </button>
          );
        })}
      </div>

      {errMsg && (
        <div className="rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800 mb-4">
          {errMsg}
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        className="btn-primary text-base px-8 py-3.5"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Procesando...
          </>
        ) : (
          <>
            Ver mi resultado
            <ArrowRight size={18} />
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// STAGE: RESULT
// ============================================================================
function ResultStage({ result }: { result: MchatResult }) {
  const config = useMemo(() => {
    if (result.riskLevel === 'LOW') {
      return {
        title: 'Riesgo bajo',
        accent: 'text-teal-700',
        badge: 'bg-teal-100 text-teal-800',
        gradient: 'from-teal-700 to-teal-900',
        emoji: '🌿',
      };
    }
    if (result.riskLevel === 'MEDIUM') {
      return {
        title: 'Riesgo medio',
        accent: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-800',
        gradient: 'from-amber-600 to-amber-800',
        emoji: '🌤',
      };
    }
    return {
      title: 'Riesgo alto',
      accent: 'text-coral-700',
      badge: 'bg-coral-100 text-coral-800',
      gradient: 'from-coral-600 to-coral-800',
      emoji: '⚠️',
    };
  }, [result.riskLevel]);

  return (
    <div className="animate-fade-in-up">
      <div
        className={`bg-gradient-to-br ${config.gradient} text-bone-50 rounded-3xl p-8 md:p-10 mb-8 relative overflow-hidden`}
      >
        <div className="absolute inset-0 grain-overlay opacity-50" />
        <div className="relative z-10">
          <div className="text-5xl mb-4">{config.emoji}</div>
          <span className="text-xs font-mono uppercase tracking-widest text-bone-200">
            Resultado · {new Date(result.createdAt).toLocaleDateString('es-PE')}
          </span>
          <h1 className="font-display text-5xl md:text-6xl tracking-tightest mt-2 mb-3">
            {config.title}
          </h1>
          <div className="flex flex-wrap gap-6 mt-6">
            <div>
              <div className="text-xs uppercase tracking-wider text-bone-300">Score</div>
              <div className="font-display text-4xl">
                {result.totalScore}<span className="text-bone-300">/20</span>
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-bone-300">Críticos</div>
              <div className="font-display text-4xl">{result.criticalFailures}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-bone-300">Edad</div>
              <div className="font-display text-4xl">{result.childAgeMonths}m</div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="font-display text-2xl mb-4">Recomendaciones</h2>
      <div className="prose prose-sm max-w-none text-ink-soft whitespace-pre-line">
        {result.recommendations}
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-3">
        {result.riskLevel !== 'LOW' && (
          <Link href="/ask" className="btn-coral py-3.5">
            Hablar con un especialista
            <ArrowRight size={16} />
          </Link>
        )}
        <Link href="/dashboard" className="btn-secondary py-3.5">
          Volver al inicio
        </Link>
      </div>

      <p className="text-xs text-ink-fade mt-8 text-center">
        Recuerda: este resultado NO es un diagnóstico. Es una guía orientativa.
        Solo un profesional de salud puede diagnosticar TEA.
      </p>
    </div>
  );
}
