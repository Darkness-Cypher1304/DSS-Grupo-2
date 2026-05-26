import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/lib/providers';

export const metadata: Metadata = {
  title: {
    default: 'NeuroAlert · Detección temprana del TEA',
    template: '%s · NeuroAlert',
  },
  description:
    'Plataforma educativa peruana para la detección temprana del Trastorno del Espectro Autista. M-CHAT-R, contenido validado, y consultas con especialistas.',
  keywords: ['TEA', 'autismo', 'detección temprana', 'M-CHAT-R', 'Perú'],
  authors: [{ name: 'NeuroAlert' }],
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    title: 'NeuroAlert',
    description: 'Detección temprana del TEA en Perú',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PE" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
