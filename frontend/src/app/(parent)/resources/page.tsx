'use client';

import { Download, FileText, ExternalLink } from 'lucide-react';

// Para el MVP, los recursos están hardcodeados. En producción se sirven desde MinIO.
const STATIC_RESOURCES = [
  {
    id: '1',
    title: 'Guía para tu primera visita al pediatra',
    description: 'Cómo prepararte, qué preguntar, qué documentación llevar.',
    category: 'Preparación',
    pages: 4,
    download: '#',
  },
  {
    id: '2',
    title: 'Calendario de hitos del desarrollo (12-36 meses)',
    description: 'Hitos clave por edad y cuándo consultar si hay retraso.',
    category: 'Desarrollo',
    pages: 6,
    download: '#',
  },
  {
    id: '3',
    title: 'Hablando de TEA con la familia',
    description: 'Cómo explicar a hermanos, abuelos y profesores qué es el TEA.',
    category: 'Familia',
    pages: 5,
    download: '#',
  },
  {
    id: '4',
    title: 'Centros de evaluación TEA en Lima',
    description: 'Listado actualizado con horarios, contactos y cobertura SIS.',
    category: 'Recursos Lima',
    pages: 3,
    download: '#',
  },
];

const EXTERNAL_LINKS = [
  {
    title: 'CONADIS · Carnet de discapacidad',
    description: 'Procedimiento oficial para obtener el carnet en Perú.',
    url: 'https://www.gob.pe/conadis',
  },
  {
    title: 'MINSA · Salud Mental',
    description: 'Recursos oficiales del Ministerio de Salud.',
    url: 'https://www.gob.pe/minsa',
  },
  {
    title: 'Autism Speaks · Recursos en español',
    description: 'Información validada internacionalmente.',
    url: 'https://www.autismspeaks.org/es',
  },
];

export default function ResourcesPage() {
  return (
    <div className="container-wide py-12">
      <div className="mb-10 max-w-2xl">
        <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
          Biblioteca
        </span>
        <h1 className="font-display text-4xl md:text-5xl tracking-tightest mt-2 mb-3">
          Recursos descargables
        </h1>
        <p className="text-ink-mute">
          Guías PDF para llevar al pediatra, hitos del desarrollo y materiales para imprimir.
        </p>
      </div>

      {/* Recursos descargables */}
      <h2 className="font-display text-2xl mb-5">PDFs para descargar</h2>
      <div className="grid md:grid-cols-2 gap-5 mb-12">
        {STATIC_RESOURCES.map((r) => (
          <ResourceCard key={r.id} resource={r} />
        ))}
      </div>

      {/* Enlaces externos */}
      <h2 className="font-display text-2xl mb-5">Sitios oficiales</h2>
      <div className="space-y-3">
        {EXTERNAL_LINKS.map((l) => (
          <a
            key={l.url}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card flex items-center justify-between gap-4 group hover:border-teal-300"
          >
            <div>
              <div className="font-medium group-hover:text-teal-700 transition-colors">
                {l.title}
              </div>
              <div className="text-sm text-ink-mute mt-0.5">{l.description}</div>
            </div>
            <ExternalLink size={18} className="text-ink-fade group-hover:text-teal-700 transition-colors flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

function ResourceCard({
  resource,
}: {
  resource: { title: string; description: string; category: string; pages: number; download: string };
}) {
  return (
    <div className="card-clinical group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-coral-100 flex items-center justify-center text-coral-700">
          <FileText size={20} />
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-ink-fade">
          {resource.category}
        </span>
      </div>
      <h3 className="font-display text-lg mb-2 leading-tight">{resource.title}</h3>
      <p className="text-sm text-ink-mute mb-5 leading-relaxed">{resource.description}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-fade">{resource.pages} páginas</span>
        <button className="btn-secondary text-xs px-3 py-1.5">
          <Download size={14} />
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
