'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, FileText, ShieldCheck, Users } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { apiGet } from '@/lib/api-client';

interface PendingSpecialist {
  id: string;
  user: { id: string; email: string; fullName: string };
  specialty: string;
  licenseNumber: string;
}

interface PendingContent {
  id: string;
  title: string;
  author: { fullName: string };
}

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: pendingSpecialists } = useQuery<PendingSpecialist[]>({
    queryKey: ['admin-pending-specialists'],
    queryFn: () => apiGet<PendingSpecialist[]>('/users/admin/specialists/pending'),
  });

  const { data: pendingContent } = useQuery<PendingContent[]>({
    queryKey: ['admin-pending-content'],
    queryFn: () => apiGet<PendingContent[]>('/content/admin/pending'),
  });

  return (
    <div className="container-wide py-12">
      <div className="mb-10">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Panel de administración
        </span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest mt-2">
          Bienvenido, <span className="italic font-light">{user?.fullName?.split(' ')[0]}</span>.
        </h1>
        <p className="text-ink-mute mt-2">
          Supervisa la calidad del contenido y la verificación de especialistas.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <Stat
          label="Especialistas por verificar"
          value={pendingSpecialists?.length ?? 0}
          icon={<ShieldCheck size={20} />}
          href="/admin/specialists"
        />
        <Stat
          label="Artículos por revisar"
          value={pendingContent?.length ?? 0}
          icon={<FileText size={20} />}
          href="/admin/content"
        />
        <Stat
          label="Gestión de usuarios"
          value="—"
          icon={<Users size={20} />}
          href="/admin/users"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <PreviewCard
          title="Especialistas pendientes"
          href="/admin/specialists"
          isEmpty={!pendingSpecialists || pendingSpecialists.length === 0}
          emptyMessage="✓ Sin solicitudes pendientes"
        >
          {pendingSpecialists?.slice(0, 5).map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-bone-50">
              <div className="text-sm flex-1 min-w-0">
                <div className="font-medium truncate">{s.user.fullName}</div>
                <div className="text-xs text-ink-fade">{s.specialty} · {s.licenseNumber}</div>
              </div>
            </div>
          ))}
        </PreviewCard>

        <PreviewCard
          title="Contenido pendiente"
          href="/admin/content"
          isEmpty={!pendingContent || pendingContent.length === 0}
          emptyMessage="✓ Sin artículos pendientes"
        >
          {pendingContent?.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl hover:bg-bone-50">
              <div className="text-sm flex-1 min-w-0">
                <div className="font-medium truncate">{c.title}</div>
                <div className="text-xs text-ink-fade">por {c.author.fullName}</div>
              </div>
            </div>
          ))}
        </PreviewCard>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="card group">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">
          {icon}
        </div>
        <ArrowRight size={16} className="text-ink-fade group-hover:text-teal-700 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="font-display text-3xl text-ink leading-none">{value}</div>
      <div className="text-xs uppercase tracking-wider text-ink-fade mt-2">{label}</div>
    </Link>
  );
}

function PreviewCard({
  title,
  href,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  href: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-clinical">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display text-2xl">{title}</h2>
        <Link href={href} className="text-sm text-teal-700 hover:underline inline-flex items-center gap-1">
          Ver todos <ArrowRight size={14} />
        </Link>
      </div>
      {isEmpty ? (
        <p className="text-sm text-ink-mute py-6 text-center">{emptyMessage}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}
