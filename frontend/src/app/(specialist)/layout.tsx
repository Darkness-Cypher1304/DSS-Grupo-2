'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Home, MessageCircle, FileText, LogOut, Stethoscope } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';
import { NeuroLoader } from '@/components/neuro-loader';

export default function SpecialistLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SPECIALIST')) {
      router.push('/login?redirect=/specialist');
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'SPECIALIST') {
    return <NeuroLoader message="Verificando acceso…" />;
  }

  return (
    <div className="min-h-screen bg-bone-50 flex">
      <aside className="hidden md:flex flex-col w-64 border-r border-bone-200 bg-white">
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-coral-600 flex items-center justify-center text-bone-50">
              <Stethoscope size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-base tracking-tightest font-medium leading-none">NeuroAlert</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-fade mt-1">Especialista</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1">
          <NavItem href="/specialist" icon={<Home size={18} />} label="Inicio" />
          <NavItem href="/specialist/questions" icon={<MessageCircle size={18} />} label="Bandeja consultas" />
          <NavItem href="/specialist/content" icon={<FileText size={18} />} label="Mis artículos" />
        </nav>

        <div className="p-4 border-t border-bone-200">
          <div className="px-3 py-2 mb-2">
            <div className="text-sm font-medium truncate">{user.fullName}</div>
            <div className="text-xs text-ink-fade truncate">{user.email}</div>
          </div>
          <button
            onClick={() => logout().then(() => router.push('/'))}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-ink-mute hover:bg-bone-100 hover:text-coral-700 transition-colors"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-ink-soft hover:bg-bone-100 hover:text-teal-700 transition-colors"
    >
      <span className="text-ink-mute">{icon}</span>
      {label}
    </Link>
  );
}
