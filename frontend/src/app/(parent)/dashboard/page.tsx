'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, MessageCircle, FileText, Sparkles } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

export default function ParentDashboard() {
  const { user } = useAuth();

  return (
    <div className="container-wide py-12">
      {/* Welcome */}
      <div className="mb-12">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Tu espacio · NeuroAlert
        </span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest mt-2">
          Hola, <span className="italic font-light">{user?.fullName?.split(' ')[0]}</span>.
        </h1>
        <p className="text-ink-mute max-w-2xl mt-3">
          Aquí puedes evaluar el desarrollo de tu hijo/a, aprender sobre el TEA, y conectar
          con especialistas. Tu información está protegida y solo tú puedes verla.
        </p>
      </div>

      {/* Action principal: M-CHAT-R */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 text-bone-50 rounded-3xl p-8 md:p-10 relative overflow-hidden mb-8">
        <div className="absolute inset-0 grain-overlay opacity-50" />
        <div className="relative z-10 grid md:grid-cols-2 gap-6 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-coral-300/20 text-coral-200 text-xs font-medium mb-4">
              <Sparkles size={14} />
              Recomendado
            </div>
            <h2 className="font-display text-3xl md:text-4xl leading-tight mb-3">
              Comienza el cuestionario
              <br />
              <span className="italic font-light text-coral-300">M-CHAT-R</span>
            </h2>
            <p className="text-bone-200 mb-6 max-w-md">
              20 preguntas validadas internacionalmente para detectar señales tempranas
              de TEA en niños de 16-30 meses. Toma 5 minutos.
            </p>
            <Link href="/mchat" className="btn-coral">
              Empezar evaluación
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hidden md:flex justify-end">
            <div className="font-display text-9xl font-light text-coral-300/30 leading-none">
              5'
            </div>
          </div>
        </div>
      </div>

      {/* Acciones secundarias */}
      <div className="grid md:grid-cols-3 gap-5">
        <ActionCard
          href="/signals"
          icon={<BookOpen size={24} />}
          title="Señales tempranas"
          description="Aprende qué observar a los 18 meses, los 2 y los 3 años. Información clara y validada."
        />
        <ActionCard
          href="/ask"
          icon={<MessageCircle size={24} />}
          title="Hacer una consulta"
          description="Conecta con pediatras y psicólogos verificados. Recibe orientación personalizada."
        />
        <ActionCard
          href="/resources"
          icon={<FileText size={24} />}
          title="Biblioteca de recursos"
          description="PDFs descargables, guías para llevar al pediatra y materiales para imprimir."
        />
      </div>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="card-clinical group">
      <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 mb-5 group-hover:bg-teal-700 group-hover:text-bone-50 transition-colors">
        {icon}
      </div>
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-ink-mute leading-relaxed">{description}</p>
      <div className="flex items-center gap-1 text-sm text-teal-700 mt-4 group-hover:gap-2 transition-all">
        Ir <ArrowRight size={14} />
      </div>
    </Link>
  );
}
