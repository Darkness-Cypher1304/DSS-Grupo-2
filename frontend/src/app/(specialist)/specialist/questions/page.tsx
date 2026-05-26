'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageCircle, Lock } from 'lucide-react';

import { apiGet, apiPost } from '@/lib/api-client';

const answerSchema = z.object({
  body: z.string().min(20, 'Tu respuesta debe ser más detallada').max(5000),
});

type AnswerForm = z.infer<typeof answerSchema>;

interface Question {
  id: string;
  title: string;
  body: string;
  status: 'OPEN' | 'ASSIGNED' | 'ANSWERED' | 'CLOSED';
  isUrgent: boolean;
  isAnonymous: boolean;
  childAgeMonths: number | null;
  createdAt: string;
  author: { fullName: string };
  assignedTo: { fullName: string } | null;
  answers: { id: string }[];
}

type FilterTab = 'open' | 'mine' | 'all';

export default function SpecialistQuestionsPage() {
  const [tab, setTab] = useState<FilterTab>('open');

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ['specialist-questions-all'],
    queryFn: () => apiGet<Question[]>('/questions'),
  });

  const filtered = (questions || []).filter((q) => {
    if (tab === 'open') return q.status === 'OPEN';
    if (tab === 'mine') return q.status === 'ASSIGNED' || q.status === 'ANSWERED';
    return true;
  });

  return (
    <div className="container-wide py-12">
      <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
        Bandeja
      </span>
      <h1 className="font-display text-4xl tracking-tightest mt-2 mb-2">
        Consultas de padres
      </h1>
      <p className="text-ink-mute mb-8">
        Toma una consulta para responderla. Tus respuestas son visibles para todos los padres
        verificados como acreditadas.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-bone-200">
        <TabButton active={tab === 'open'} onClick={() => setTab('open')}>
          Sin asignar ({(questions || []).filter((q) => q.status === 'OPEN').length})
        </TabButton>
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          En mis manos
        </TabButton>
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>
          Todas
        </TabButton>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-teal-700" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <MessageCircle size={28} className="mx-auto text-teal-300 mb-2" />
          <p className="text-ink-mute text-sm">No hay consultas en esta bandeja.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q) => (
            <QuestionCard key={q.id} question={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active ? 'border-teal-700 text-teal-700' : 'border-transparent text-ink-mute hover:text-ink-soft'
      }`}
    >
      {children}
    </button>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const [expanded, setExpanded] = useState(false);
  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const queryClient = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: () => apiPost(`/questions/${question.id}/assign-to-me`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['specialist-questions-all'] }),
  });

  const answerMutation = useMutation({
    mutationFn: (payload: AnswerForm) => apiPost(`/questions/${question.id}/answer`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['specialist-questions-all'] });
      setShowAnswerForm(false);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AnswerForm>({ resolver: zodResolver(answerSchema) });

  const statusBadge = {
    OPEN: { label: 'Esperando especialista', color: 'bg-amber-100 text-amber-800' },
    ASSIGNED: { label: 'En revisión', color: 'bg-teal-100 text-teal-800' },
    ANSWERED: { label: 'Respondida', color: 'bg-teal-200 text-teal-900' },
    CLOSED: { label: 'Cerrada', color: 'bg-bone-200 text-ink-mute' },
  }[question.status];

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${statusBadge.color}`}>{statusBadge.label}</span>
          {question.isUrgent && (
            <span className="badge bg-coral-100 text-coral-800">Urgente</span>
          )}
          {question.isAnonymous && (
            <span className="badge bg-bone-200 text-ink-mute inline-flex items-center gap-1">
              <Lock size={11} /> Anónima
            </span>
          )}
        </div>
        <span className="text-xs text-ink-fade flex-shrink-0">
          {new Date(question.createdAt).toLocaleDateString('es-PE')}
        </span>
      </div>

      <h3 className="font-display text-lg leading-tight mb-2">{question.title}</h3>

      <div className="text-sm text-ink-mute mb-3">
        {question.author.fullName}
        {question.childAgeMonths != null && ` · niño/a de ${question.childAgeMonths} meses`}
      </div>

      {expanded && (
        <p className="text-sm text-ink-soft whitespace-pre-line mt-3 mb-4 p-4 bg-bone-50 rounded-xl">
          {question.body}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="btn-ghost text-xs px-3 py-1.5"
        >
          {expanded ? <><ChevronUp size={14} /> Ocultar</> : <><ChevronDown size={14} /> Ver detalles</>}
        </button>

        {question.status === 'OPEN' && (
          <button
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
            className="btn-primary text-xs px-3 py-1.5"
          >
            {assignMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Tomar consulta'}
          </button>
        )}

        {(question.status === 'ASSIGNED' || question.status === 'ANSWERED') && (
          <button
            onClick={() => setShowAnswerForm((s) => !s)}
            className="btn-coral text-xs px-3 py-1.5"
          >
            {showAnswerForm ? 'Cancelar' : question.answers.length === 0 ? 'Responder' : 'Añadir respuesta'}
          </button>
        )}
      </div>

      {showAnswerForm && (
        <form
          onSubmit={handleSubmit((v) => answerMutation.mutate(v))}
          className="mt-5 pt-5 border-t border-bone-200 animate-fade-in"
          noValidate
        >
          <label className="label">Tu respuesta clínica</label>
          <textarea
            rows={6}
            placeholder="Sé claro, empático y orientativo. Recuerda que esto NO es un diagnóstico."
            className="input resize-y"
            {...register('body')}
          />
          {errors.body && <p className="text-xs text-coral-600 mt-1">{errors.body.message}</p>}

          <div className="flex gap-2 mt-3">
            <button type="submit" disabled={isSubmitting} className="btn-primary text-sm">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} /> Enviar respuesta</>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
