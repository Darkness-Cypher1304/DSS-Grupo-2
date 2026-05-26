'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';

import { apiGet } from '@/lib/api-client';

interface ContentItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  publishedAt: string;
  author: { fullName: string };
}

interface ContentList {
  items: ContentItem[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

export default function SignalsPage() {
  const { data, isLoading } = useQuery<ContentList>({
    queryKey: ['articles'],
    queryFn: () => apiGet<ContentList>('/content?perPage=20'),
  });

  return (
    <div className="container-wide py-12">
      <div className="mb-12 max-w-2xl">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Recursos educativos
        </span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest mt-2 mb-3">
          Aprende sobre el <span className="italic font-light text-teal-700">desarrollo</span>
          <br />
          de tu hijo/a.
        </h1>
        <p className="text-ink-mute">
          Artículos escritos y revisados por especialistas peruanos. Sin mitos. Sin alarmismo.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-teal-700" />
        </div>
      ) : data && data.items.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-ink-mute">
          Aún no hay artículos publicados. Vuelve pronto.
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: ContentItem }) {
  return (
    <Link href={`/articles/${article.slug}`} className="card group block">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono uppercase tracking-wider text-coral-700">
          {article.category}
        </span>
      </div>
      <h3 className="font-display text-xl leading-tight mb-3 group-hover:text-teal-700 transition-colors">
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
  );
}
