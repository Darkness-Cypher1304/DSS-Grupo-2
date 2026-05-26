'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Brain, Loader2 } from 'lucide-react';

import { apiGet } from '@/lib/api-client';

interface ContentItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  publishedAt: string;
  author: { fullName: string };
}

interface ContentList {
  items: ContentItem[];
}

export default function PublicArticlesPage() {
  const { data, isLoading } = useQuery<ContentList>({
    queryKey: ['public-articles'],
    queryFn: () => apiGet<ContentList>('/content?perPage=30'),
  });

  return (
    <main className="min-h-screen bg-bone-50">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-bone-50/80 border-b border-bone-200">
        <div className="container-wide flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50">
              <Brain size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl tracking-tightest font-medium">NeuroAlert</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-ghost text-sm">Iniciar sesión</Link>
            <Link href="/register" className="btn-primary text-sm">Crear cuenta</Link>
          </div>
        </div>
      </header>

      <section className="container-wide py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-teal-700 mb-6"
        >
          <ArrowLeft size={16} /> Volver al inicio
        </Link>

        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Recursos educativos
        </span>
        <h1 className="font-display text-5xl md:text-6xl tracking-tightest mt-3 mb-4 max-w-2xl leading-tight">
          Información validada,
          <br />
          <span className="italic font-light text-teal-700">sin alarmismo.</span>
        </h1>
        <p className="text-ink-mute max-w-xl mb-12">
          Artículos escritos por especialistas peruanos verificados. Revisados antes de
          publicarse.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-teal-700" />
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((article) => (
              <Link
                key={article.id}
                href={`/articles/${article.slug}`}
                className="card group block"
              >
                <span className="text-xs font-mono uppercase tracking-wider text-coral-700">
                  {article.category}
                </span>
                <h3 className="font-display text-xl leading-tight mt-2 mb-3 group-hover:text-teal-700 transition-colors">
                  {article.title}
                </h3>
                <p className="text-sm text-ink-mute leading-relaxed line-clamp-3 mb-4">
                  {article.summary}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink-fade">por {article.author.fullName}</span>
                  <span className="inline-flex items-center gap-1 text-teal-700 group-hover:gap-2 transition-all">
                    Leer <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-ink-mute">
            Aún no hay artículos publicados.
          </div>
        )}
      </section>
    </main>
  );
}
