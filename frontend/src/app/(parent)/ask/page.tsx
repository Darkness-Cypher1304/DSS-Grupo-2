'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2, MessageCircle, Plus } from 'lucide-react';

import { apiGet, apiPost } from '@/lib/api-client';

const schema = z.object({
  title: z.string().min(10, 'Mínimo 10 caracteres').max(200),
  body: z.string().min(20, 'Cuéntanos un poco más').max(5000),
  childAgeMonths: z.coerce.number().int().min(0).max(216).optional(),
  isUrgent: z.boolean().optional(),
  isAnonymous: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Question {
  id: string;
  title: string;
  body: string;
  status: 'OPEN' | 'ASSIGNED' | 'ANSWERED' | 'CLOSED';
  isUrgent: boolean;
  createdAt: string;
  answers: { id: string }[];
  assignedTo?: { fullName: string } | null;
}

export default function AskPage() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: questions, isLoading } = useQuery<Question[]>({
    queryKey: ['my-questions'],
    queryFn: () => apiGet<Question[]>('/questions'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: FormValues) => apiPost('/questions', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-questions'] });
      setShowForm(false);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { isAnonymous: true, isUrgent: false },
  });

  function onSubmit(values: FormValues) {
    createMutation.mutate(values, { onSuccess: () => reset() });
  }

  return (
    <div className="container-wide py-12">
      <div className="flex items-start justify-between mb-10 gap-4 flex-wrap">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
            Tus consultas
          </span>
          <h1 className="font-display text-4xl tracking-tightest mt-2">
            Pregúntale a un especialista
          </h1>
          <p className="text-ink-mute mt-2 max-w-xl">
            Especialistas verificados responden tus preguntas en 24-48 hrs en promedio.
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          <Plus size={16} />
          Nueva consulta
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card-clinical mb-10 animate-fade-in-up"
          noValidate
        >
          <h2 className="font-display text-2xl mb-5">Nueva consulta</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Título breve</label>
              <input
                type="text"
                placeholder="¿Mi hijo de 20 meses no me mira a los ojos, debo preocuparme?"
                className="input"
                {...register('title')}
              />
              {errors.title && <p className="text-xs text-coral-600 mt-1">{errors.title.message}</p>}
            </div>

            <div>
              <label className="label">Detalles</label>
              <textarea
                rows={6}
                placeholder="Describe lo que has observado, desde cuándo, ejemplos concretos..."
                className="input resize-y"
                {...register('body')}
              />
              {errors.body && <p className="text-xs text-coral-600 mt-1">{errors.body.message}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="label">Edad del niño/a (meses)</label>
                <input
                  type="number"
                  min={0}
                  max={216}
                  className="input"
                  {...register('childAgeMonths')}
                />
              </div>
              <div className="flex flex-col justify-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('isAnonymous')} className="accent-teal-700" />
                  Mantener mi consulta anónima
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" {...register('isUrgent')} className="accent-coral-600" />
                  Marcar como urgente
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={isSubmitting} className="btn-primary">
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Enviar consulta'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-teal-700" />
        </div>
      ) : questions && questions.length > 0 ? (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionItem key={q.id} question={q} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <MessageCircle size={32} className="mx-auto text-teal-300 mb-3" />
          <p className="text-ink-mute">Aún no has hecho consultas. Crea la primera arriba.</p>
        </div>
      )}
    </div>
  );
}

function QuestionItem({ question }: { question: Question }) {
  const statusConfig = {
    OPEN: { label: 'Esperando especialista', color: 'badge bg-amber-100 text-amber-800' },
    ASSIGNED: { label: 'En revisión', color: 'badge bg-teal-100 text-teal-800' },
    ANSWERED: { label: 'Respondida', color: 'badge bg-teal-200 text-teal-900' },
    CLOSED: { label: 'Cerrada', color: 'badge bg-bone-200 text-ink-mute' },
  };
  const cfg = statusConfig[question.status];

  return (
    <Link
      href={`/ask/${question.id}`}
      className="card flex items-start justify-between gap-4 hover:border-teal-300 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className={cfg.color}>
            {question.status === 'ANSWERED' && <CheckCircle2 size={12} />}
            {cfg.label}
          </span>
          {question.isUrgent && (
            <span className="badge bg-coral-100 text-coral-800">Urgente</span>
          )}
          {question.answers.length > 0 && (
            <span className="text-xs text-ink-fade">
              · {question.answers.length} respuesta{question.answers.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h3 className="font-display text-lg leading-tight mb-1">{question.title}</h3>
        <p className="text-sm text-ink-mute line-clamp-2">{question.body}</p>
      </div>
      <span className="text-xs text-ink-fade flex-shrink-0">
        {new Date(question.createdAt).toLocaleDateString('es-PE')}
      </span>
    </Link>
  );
}
