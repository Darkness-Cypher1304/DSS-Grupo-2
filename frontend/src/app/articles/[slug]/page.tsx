'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Brain, Loader2 } from 'lucide-react';

import { apiGet } from '@/lib/api-client';

interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  tags: string[];
  publishedAt: string;
  author: {
    id: string;
    fullName: string;
    specialistProfile?: {
      specialty?: string;
      institution?: string | null;
    } | null;
  };
}

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery<Article>({
    queryKey: ['article', slug],
    queryFn: () => apiGet<Article>(`/content/by-slug/${slug}`),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-teal-700" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-display text-3xl mb-3">Artículo no encontrado</h1>
        <p className="text-ink-mute mb-6">Es posible que haya sido archivado.</p>
        <Link href="/" className="btn-primary">
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-bone-50">
      {/* Header simple */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bone-50/80 border-b border-bone-200">
        <div className="container-wide flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50">
              <Brain size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl tracking-tightest font-medium">NeuroAlert</span>
          </Link>
          <Link href="/" className="text-sm text-ink-mute hover:text-teal-700">
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <article className="container-narrow py-16">
        <Link
          href="/articles"
          className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-teal-700 mb-6"
        >
          <ArrowLeft size={16} />
          Todos los artículos
        </Link>

        <div className="mb-2">
          <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
            {data.category}
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl tracking-tightest leading-tight mb-6">
          {data.title}
        </h1>

        <p className="text-xl text-ink-mute leading-relaxed mb-8 max-w-2xl">
          {data.summary}
        </p>

        <div className="flex items-center gap-4 pb-8 mb-10 border-b border-bone-200">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-display text-xl">
            {data.author.fullName.charAt(0)}
          </div>
          <div>
            <div className="font-medium">{data.author.fullName}</div>
            <div className="text-xs text-ink-fade">
              {data.author.specialistProfile?.specialty || 'Especialista'}
              {data.author.specialistProfile?.institution &&
                ` · ${data.author.specialistProfile.institution}`}
              {' · '}
              {new Date(data.publishedAt).toLocaleDateString('es-PE', { dateStyle: 'long' })}
            </div>
          </div>
        </div>

        {/* Cuerpo del artículo */}
        <div className="prose prose-lg max-w-none prose-headings:font-display prose-headings:tracking-tightest prose-h2:text-3xl prose-h3:text-2xl prose-a:text-teal-700 prose-strong:text-ink prose-li:text-ink-soft prose-p:text-ink-soft prose-p:leading-relaxed">
          <ReactMarkdown>{data.body}</ReactMarkdown>
        </div>

        {data.tags.length > 0 && (
          <div className="mt-12 pt-6 border-t border-bone-200">
            <span className="text-xs font-mono uppercase tracking-widest text-ink-fade mr-3">
              Tags:
            </span>
            {data.tags.map((tag) => (
              <span
                key={tag}
                className="inline-block text-xs px-3 py-1 rounded-full bg-bone-100 text-ink-mute mr-2"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 text-bone-50 text-center">
          <h3 className="font-display text-2xl mb-3">¿Tienes dudas sobre tu hijo/a?</h3>
          <p className="text-bone-200 mb-6 max-w-md mx-auto">
            Toma el cuestionario M-CHAT-R en 5 minutos o consulta directamente a un especialista.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register" className="btn-coral">Crear cuenta gratis</Link>
            <Link href="/login" className="btn-secondary">Ya tengo cuenta</Link>
          </div>
        </div>
      </article>
    </main>
  );
}
