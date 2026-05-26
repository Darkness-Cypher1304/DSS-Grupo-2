'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X, XCircle, FileText } from 'lucide-react';

import { apiGet, apiPatch } from '@/lib/api-client';

interface PendingContent {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  tags: string[];
  updatedAt: string;
  author: { id: string; fullName: string; email: string };
}

export default function AdminContentPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data, isLoading } = useQuery<PendingContent[]>({
    queryKey: ['admin-pending-content'],
    queryFn: () => apiGet<PendingContent[]>('/content/admin/pending'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      apiPatch(`/content/admin/${id}/status`, { status, reviewNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-content'] });
      setRejectingId(null);
      setReviewNotes('');
    },
  });

  return (
    <div className="container-wide py-12">
      <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
        Editorial
      </span>
      <h1 className="font-display text-4xl tracking-tightest mt-2 mb-2">
        Revisión de contenido
      </h1>
      <p className="text-ink-mute mb-8 max-w-xl">
        Aprueba o rechaza artículos enviados por los especialistas. Considera precisión clínica,
        claridad y sensibilidad cultural.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-teal-700" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={28} className="mx-auto text-teal-300 mb-2" />
          <p className="text-ink-mute text-sm">No hay artículos pendientes de revisión.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((c) => {
            const isExpanded = expanded === c.id;
            return (
              <div key={c.id} className="card">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <span className="text-xs font-mono uppercase tracking-wider text-coral-700">
                      {c.category}
                    </span>
                    <h3 className="font-display text-xl leading-tight mt-1 mb-2">{c.title}</h3>
                    <div className="text-sm text-ink-mute mb-2">
                      por {c.author.fullName}{' '}
                      <span className="text-ink-fade">· {c.author.email}</span>
                    </div>
                    <p className="text-sm text-ink-soft">{c.summary}</p>
                  </div>
                  <span className="text-xs text-ink-fade flex-shrink-0">
                    {new Date(c.updatedAt).toLocaleDateString('es-PE')}
                  </span>
                </div>

                <button
                  onClick={() => setExpanded(isExpanded ? null : c.id)}
                  className="btn-ghost text-xs px-3 py-1.5 mb-3"
                >
                  {isExpanded ? <><ChevronUp size={14} /> Ocultar</> : <><ChevronDown size={14} /> Ver contenido completo</>}
                </button>

                {isExpanded && (
                  <div className="bg-bone-50 rounded-xl p-6 mb-4 prose prose-sm max-w-none animate-fade-in">
                    <ReactMarkdown>{c.body}</ReactMarkdown>
                  </div>
                )}

                {rejectingId === c.id ? (
                  <div className="border-t border-bone-200 pt-4">
                    <label className="label">Notas de revisión (opcional)</label>
                    <textarea
                      rows={3}
                      className="input resize-y"
                      placeholder="Comentarios para el especialista sobre por qué se rechaza."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() =>
                          statusMutation.mutate({ id: c.id, status: 'ARCHIVED', notes: reviewNotes })
                        }
                        disabled={statusMutation.isPending}
                        className="btn-coral text-sm"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setReviewNotes('');
                        }}
                        className="btn-ghost text-sm"
                      >
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 border-t border-bone-200 pt-4">
                    <button
                      onClick={() => statusMutation.mutate({ id: c.id, status: 'PUBLISHED' })}
                      disabled={statusMutation.isPending}
                      className="btn-primary text-sm"
                    >
                      {statusMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Publicar
                        </>
                      )}
                    </button>
                    <button onClick={() => setRejectingId(c.id)} className="btn-secondary text-sm">
                      <XCircle size={14} /> Rechazar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
