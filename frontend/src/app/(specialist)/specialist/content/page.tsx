'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit, Loader2, Plus, Send, Sparkles, X } from 'lucide-react';

import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

const contentSchema = z.object({
  title: z.string().min(10).max(200),
  summary: z.string().min(20).max(500),
  body: z.string().min(50).max(50000),
  category: z.string().min(2).max(50),
  tags: z.string().optional(),
});

type ContentForm = z.infer<typeof contentSchema>;

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  tags: string[];
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

export default function SpecialistContentPage() {
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<ContentItem[]>({
    queryKey: ['my-content'],
    queryFn: () => apiGet<ContentItem[]>('/content/mine'),
  });

  const submitForReviewMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/content/${id}/submit`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-content'] }),
  });

  return (
    <div className="container-wide py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
            Mis artículos
          </span>
          <h1 className="font-display text-4xl tracking-tightest mt-2">Contenido educativo</h1>
          <p className="text-ink-mute mt-2 max-w-xl">
            Escribe artículos que llegan a miles de padres. Pasan por revisión antes de publicarse.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          <Plus size={16} />
          Nuevo artículo
        </button>
      </div>

      {showForm && (
        <ContentForm
          editing={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-teal-700" />
        </div>
      ) : !items || items.length === 0 ? (
        <div className="card text-center py-12">
          <Sparkles size={28} className="mx-auto text-coral-300 mb-2" />
          <p className="text-ink-mute text-sm">
            Aún no tienes artículos. Crea el primero arriba.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              onEdit={() => {
                setEditing(item);
                setShowForm(true);
              }}
              onSubmit={() => submitForReviewMutation.mutate(item.id)}
              isSubmitting={submitForReviewMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContentCard({
  item,
  onEdit,
  onSubmit,
  isSubmitting,
}: {
  item: ContentItem;
  onEdit: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) {
  const statusConfig = {
    DRAFT: { label: 'Borrador', color: 'bg-bone-200 text-ink-mute' },
    PENDING: { label: 'En revisión', color: 'bg-amber-100 text-amber-800' },
    PUBLISHED: { label: 'Publicado', color: 'bg-teal-100 text-teal-800' },
    ARCHIVED: { label: 'Archivado', color: 'bg-coral-100 text-coral-800' },
  }[item.status];

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <span className={`badge ${statusConfig.color}`}>{statusConfig.label}</span>
        <span className="text-xs text-ink-fade">
          {new Date(item.updatedAt).toLocaleDateString('es-PE')}
        </span>
      </div>
      <h3 className="font-display text-xl leading-tight mb-2">{item.title}</h3>
      <p className="text-sm text-ink-mute leading-relaxed line-clamp-2 mb-4">{item.summary}</p>

      <div className="flex flex-wrap gap-2">
        <button onClick={onEdit} className="btn-secondary text-xs px-3 py-1.5">
          <Edit size={14} />
          Editar
        </button>
        {item.status === 'DRAFT' && (
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <Send size={14} />
            Enviar a revisión
          </button>
        )}
      </div>
    </div>
  );
}

function ContentForm({
  editing,
  onClose,
}: {
  editing: ContentItem | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContentForm>({
    resolver: zodResolver(contentSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          summary: editing.summary,
          body: editing.body,
          category: editing.category,
          tags: editing.tags.join(', '),
        }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (values: ContentForm) => {
      const payload = {
        ...values,
        tags: values.tags
          ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : [],
      };
      if (editing) {
        return apiPatch(`/content/${editing.id}`, payload);
      }
      return apiPost('/content', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-content'] });
      onClose();
    },
  });

  return (
    <div className="card-clinical mb-8 animate-fade-in-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-2xl">{editing ? 'Editar artículo' : 'Nuevo artículo'}</h2>
        <button onClick={onClose} className="text-ink-mute hover:text-ink p-1">
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        <div>
          <label className="label">Título</label>
          <input type="text" className="input" {...register('title')} />
          {errors.title && <p className="text-xs text-coral-600 mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label className="label">Resumen breve (aparecerá en la lista)</label>
          <textarea rows={2} className="input resize-y" {...register('summary')} />
          {errors.summary && <p className="text-xs text-coral-600 mt-1">{errors.summary.message}</p>}
        </div>

        <div>
          <label className="label">Categoría</label>
          <input type="text" placeholder="Ej: Señales tempranas" className="input" {...register('category')} />
          {errors.category && <p className="text-xs text-coral-600 mt-1">{errors.category.message}</p>}
        </div>

        <div>
          <label className="label">
            Tags <span className="font-normal text-ink-fade">(separados por coma)</span>
          </label>
          <input type="text" placeholder="autismo, 18 meses, M-CHAT-R" className="input" {...register('tags')} />
        </div>

        <div>
          <label className="label">Contenido (Markdown soportado)</label>
          <textarea rows={14} className="input resize-y font-mono text-sm" {...register('body')} />
          {errors.body && <p className="text-xs text-coral-600 mt-1">{errors.body.message}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={isSubmitting} className="btn-primary">
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : 'Guardar borrador'}
          </button>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
