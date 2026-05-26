'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MessageCircle, FileText, Clock, CheckCircle2 } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';

interface QuestionItem {
  id: string;
  title: string;
  status: 'OPEN' | 'ASSIGNED' | 'ANSWERED' | 'CLOSED';
  isUrgent: boolean;
  createdAt: string;
  childAgeMonths: number | null;
}

interface ContentItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
}

export default function SpecialistDashboard() {
  const { user } = useAuth();

  const { data: questions } = useQuery<QuestionItem[]>({
    queryKey: ['specialist-questions'],
    queryFn: () => apiGet<QuestionItem[]>('/questions'),
  });

  const { data: myContent } = useQuery<ContentItem[]>({
    queryKey: ['my-content'],
    queryFn: () => apiGet<ContentItem[]>('/content/mine'),
  });

  const openQuestions = questions?.filter((q) => q.status === 'OPEN') || [];
  const myAssigned = questions?.filter((q) => q.status === 'ASSIGNED') || [];
  const publishedCount = myContent?.filter((c) => c.status === 'PUBLISHED').length || 0;
  const draftCount = myContent?.filter((c) => c.status === 'DRAFT').length || 0;

  return (
    <div className="container-wide py-12">
      <div className="mb-10">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Panel del especialista
        </span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest mt-2">
          Buen día, <span className="italic font-light">{user?.fullName?.split(' ')[0]}</span>.
        </h1>
        <p className="text-ink-mute mt-2 max-w-xl">
          Bandeja de consultas pendientes y panel de contenido educativo.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid md:grid-cols-4 gap-4 mb-10">
        <Stat
          label="Consultas abiertas"
          value={openQuestions.length}
          icon={<Clock size={20} />}
          color="text-coral-700 bg-coral-100"
        />
        <Stat
          label="En mis manos"
          value={myAssigned.length}
          icon={<MessageCircle size={20} />}
          color="text-amber-700 bg-amber-100"
        />
        <Stat
          label="Artículos publicados"
          value={publishedCount}
          icon={<CheckCircle2 size={20} />}
          color="text-teal-700 bg-teal-100"
        />
        <Stat
          label="Borradores"
          value={draftCount}
          icon={<FileText size={20} />}
          color="text-ink-mute bg-bone-200"
        />
      </div>

      {/* Bandeja rápida */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card-clinical">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl">Consultas sin asignar</h2>
            <Link href="/specialist/questions" className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1">
              Ver todas <ArrowRight size={14} />
            </Link>
          </div>

          {openQuestions.length === 0 ? (
            <p className="text-sm text-ink-mute py-6 text-center">
              No hay consultas pendientes 🎉
            </p>
          ) : (
            <div className="space-y-2">
              {openQuestions.slice(0, 5).map((q) => (
                <Link
                  key={q.id}
                  href={`/specialist/questions`}
                  className="block px-4 py-3 rounded-xl hover:bg-bone-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm flex-1 min-w-0">
                      <div className="font-medium truncate">{q.title}</div>
                      <div className="text-xs text-ink-fade mt-1">
                        {q.childAgeMonths != null && `niño/a de ${q.childAgeMonths}m · `}
                        {new Date(q.createdAt).toLocaleDateString('es-PE')}
                      </div>
                    </div>
                    {q.isUrgent && (
                      <span className="badge bg-coral-100 text-coral-800 flex-shrink-0">
                        Urgente
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card-clinical">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl">Mi contenido</h2>
            <Link href="/specialist/content" className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1">
              Gestionar <ArrowRight size={14} />
            </Link>
          </div>

          {!myContent || myContent.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-ink-mute mb-3">Aún no has escrito artículos.</p>
              <Link href="/specialist/content" className="btn-primary text-sm">
                Crear primer artículo
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {myContent.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-bone-50">
                  <span className="text-sm font-medium truncate">{c.title}</span>
                  <span className={`badge ${
                    c.status === 'PUBLISHED' ? 'bg-teal-100 text-teal-800' :
                    c.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    c.status === 'DRAFT' ? 'bg-bone-200 text-ink-mute' :
                    'bg-coral-100 text-coral-800'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="card">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <div className="font-display text-3xl text-ink leading-none">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-fade mt-2">{label}</div>
    </div>
  );
}
