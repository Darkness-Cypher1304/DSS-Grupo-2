'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Loader2, Lock, MessageCircle, Star } from 'lucide-react';

import { apiGet, apiPatch } from '@/lib/api-client';

interface Specialist {
  id: string;
  fullName: string;
  specialistProfile?: {
    specialty?: string;
    institution?: string | null;
  } | null;
}

interface Answer {
  id: string;
  body: string;
  isAccepted: boolean;
  createdAt: string;
  specialist: Specialist;
}

interface QuestionDetail {
  id: string;
  title: string;
  body: string;
  status: 'OPEN' | 'ASSIGNED' | 'ANSWERED' | 'CLOSED';
  isUrgent: boolean;
  isAnonymous: boolean;
  childAgeMonths: number | null;
  createdAt: string;
  answers: Answer[];
}

export default function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<QuestionDetail>({
    queryKey: ['question', id],
    queryFn: () => apiGet<QuestionDetail>(`/questions/${id}`),
  });

  const acceptMutation = useMutation({
    mutationFn: (answerId: string) => apiPatch(`/questions/answers/${answerId}/accept`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', id] }),
  });

  const closeMutation = useMutation({
    mutationFn: () => apiPatch(`/questions/${id}/close`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['question', id] }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-teal-700" />
      </div>
    );
  }

  const statusConfig = {
    OPEN: { label: 'Esperando especialista', color: 'bg-amber-100 text-amber-800' },
    ASSIGNED: { label: 'En revisión', color: 'bg-teal-100 text-teal-800' },
    ANSWERED: { label: 'Respondida', color: 'bg-teal-200 text-teal-900' },
    CLOSED: { label: 'Cerrada', color: 'bg-bone-200 text-ink-mute' },
  };
  const cfg = statusConfig[data.status];

  return (
    <div className="container-narrow py-12">
      <button
        onClick={() => router.push('/ask')}
        className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-teal-700 mb-8"
      >
        <ArrowLeft size={16} />
        Volver a mis consultas
      </button>

      <div className="flex items-center gap-2 mb-3">
        <span className={`badge ${cfg.color}`}>{cfg.label}</span>
        {data.isUrgent && <span className="badge bg-coral-100 text-coral-800">Urgente</span>}
        {data.isAnonymous && (
          <span className="badge bg-bone-200 text-ink-mute inline-flex items-center gap-1">
            <Lock size={11} /> Anónima
          </span>
        )}
      </div>

      <h1 className="font-display text-3xl md:text-4xl tracking-tightest mb-3">
        {data.title}
      </h1>
      <p className="text-xs text-ink-fade mb-8">
        Creada el {new Date(data.createdAt).toLocaleDateString('es-PE', { dateStyle: 'long' })}
        {data.childAgeMonths != null && ` · niño/a de ${data.childAgeMonths} meses`}
      </p>

      <div className="card-clinical mb-10">
        <p className="text-ink-soft whitespace-pre-line leading-relaxed">{data.body}</p>
      </div>

      {/* Respuestas */}
      <h2 className="font-display text-2xl mb-5">
        {data.answers.length === 0
          ? 'Aún sin respuestas'
          : `${data.answers.length} respuesta${data.answers.length === 1 ? '' : 's'}`}
      </h2>

      {data.answers.length === 0 ? (
        <div className="card text-center py-10">
          <MessageCircle size={28} className="mx-auto text-teal-300 mb-2" />
          <p className="text-ink-mute text-sm">
            Un especialista verificado responderá tu consulta pronto.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.answers.map((a) => (
            <div
              key={a.id}
              className={`card ${a.isAccepted ? 'border-teal-400 bg-teal-50/30' : ''}`}
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="font-medium">{a.specialist.fullName}</div>
                  <div className="text-xs text-ink-fade">
                    {a.specialist.specialistProfile?.specialty || 'Especialista'}
                    {a.specialist.specialistProfile?.institution &&
                      ` · ${a.specialist.specialistProfile.institution}`}
                  </div>
                </div>
                {a.isAccepted && (
                  <span className="badge bg-teal-100 text-teal-800 inline-flex items-center gap-1">
                    <Star size={12} /> Aceptada
                  </span>
                )}
              </div>

              <p className="text-ink-soft whitespace-pre-line leading-relaxed">{a.body}</p>

              <div className="flex items-center justify-between mt-5 pt-4 border-t border-bone-200">
                <span className="text-xs text-ink-fade">
                  {new Date(a.createdAt).toLocaleDateString('es-PE')}
                </span>
                {!a.isAccepted && data.status !== 'CLOSED' && (
                  <button
                    onClick={() => acceptMutation.mutate(a.id)}
                    disabled={acceptMutation.isPending}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Marcar como aceptada
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.status !== 'CLOSED' && (
        <div className="mt-10 pt-6 border-t border-bone-200 flex justify-between items-center">
          <p className="text-xs text-ink-mute max-w-md">
            Si la respuesta resolvió tu duda, marca una como aceptada y cierra la consulta.
          </p>
          <button
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
            className="btn-ghost text-sm"
          >
            Cerrar consulta
          </button>
        </div>
      )}
    </div>
  );
}
