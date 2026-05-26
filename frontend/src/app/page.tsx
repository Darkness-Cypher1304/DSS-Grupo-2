// ============================================================================
// Landing page · NeuroAlert
// ============================================================================
// Primera impresión. Comunica el problema (97.4%), la solución (M-CHAT-R +
// especialistas verificados), y CTAs claros.
// Diseño editorial: tipografía display Fraunces, paleta teal/coral, grain.
// ============================================================================

import Link from 'next/link';
import { ArrowRight, Brain, ClipboardCheck, MessageCircleHeart, ShieldCheck, Sparkles } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-bone-50 selection:bg-teal-700 selection:text-bone-50">
      <Header />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <CTASection />
      <Footer />
    </main>
  );
}

// ============================================================================
// HEADER
// ============================================================================
function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-bone-50/80 border-b border-bone-200">
      <div className="container-wide flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50 group-hover:bg-teal-800 transition-colors">
            <Brain size={18} strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl tracking-tightest font-medium">
            NeuroAlert
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-ink-soft">
          <Link href="/articles" className="hover:text-teal-700 transition-colors">
            Recursos
          </Link>
          <Link href="/about" className="hover:text-teal-700 transition-colors">
            Cómo funciona
          </Link>
          <Link href="/specialists" className="hover:text-teal-700 transition-colors">
            Especialistas
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Iniciar sesión
          </Link>
          <Link href="/register" className="btn-primary">
            Crear cuenta
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

// ============================================================================
// HERO
// ============================================================================
function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fondo editorial con gradiente teal */}
      <div className="absolute inset-0 bg-gradient-to-br from-bone-50 via-teal-50/30 to-bone-100 -z-10" />
      <div className="absolute inset-0 grain-overlay -z-10" />

      <div className="container-wide pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="grid md:grid-cols-12 gap-12 items-center">
          {/* Columna izquierda: texto */}
          <div className="md:col-span-7 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-50 border border-coral-100 text-coral-700 text-xs font-medium mb-6">
              <Sparkles size={14} />
              Plataforma gratuita · validada con M-CHAT-R
            </div>

            <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tightest text-ink mb-6">
              Detectar a tiempo
              <br />
              <span className="italic font-light">cambia</span>
              <br />
              <span className="gradient-text">una vida entera.</span>
            </h1>

            <p className="text-lg md:text-xl text-ink-mute max-w-xl leading-relaxed mb-8">
              En el Perú, el <span className="font-semibold text-ink">97.4%</span> de las
              personas con autismo no están diagnosticadas. NeuroAlert te ayuda a
              identificar señales tempranas con la herramienta validada
              internacionalmente y a conectar con especialistas verificados.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/register" className="btn-primary text-base px-7 py-3.5">
                Empezar evaluación gratuita
                <ArrowRight size={18} />
              </Link>
              <Link href="/articles" className="btn-secondary text-base px-7 py-3.5">
                Aprender sobre el TEA
              </Link>
            </div>

            <p className="mt-6 text-sm text-ink-fade">
              No es un diagnóstico — es una guía para padres respaldada por evidencia.
            </p>
          </div>

          {/* Columna derecha: visual editorial */}
          <div className="md:col-span-5 animate-fade-in">
            <BrainVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// VISUAL DEL HERO — SVG editorial
// ============================================================================
function BrainVisual() {
  return (
    <div className="relative aspect-square">
      {/* Círculo de fondo */}
      <div className="absolute inset-4 rounded-full bg-gradient-to-br from-teal-100 to-coral-100 animate-breathe" />

      {/* Stat principal */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="font-display text-7xl md:text-8xl font-medium text-teal-800 leading-none">
            97<span className="text-coral-500">.</span>4
            <span className="text-3xl md:text-4xl align-top">%</span>
          </div>
          <div className="mt-4 text-xs uppercase tracking-widest text-ink-mute font-mono">
            personas con TEA en Perú
          </div>
          <div className="mt-1 text-sm font-medium text-coral-700">
            sin diagnosticar
          </div>
        </div>
      </div>

      {/* Decoración: pequeños puntos clínicos */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 400 400"
        fill="none"
      >
        <circle cx="60" cy="80" r="3" fill="currentColor" className="text-teal-400/40" />
        <circle cx="340" cy="120" r="2" fill="currentColor" className="text-coral-400/50" />
        <circle cx="320" cy="320" r="4" fill="currentColor" className="text-teal-500/30" />
        <circle cx="80" cy="340" r="2" fill="currentColor" className="text-teal-300/40" />
        <circle cx="200" cy="50" r="2" fill="currentColor" className="text-coral-300/40" />
      </svg>
    </div>
  );
}

// ============================================================================
// SECCIÓN: PROBLEMA
// ============================================================================
function ProblemSection() {
  return (
    <section className="border-y border-bone-200 bg-white py-20">
      <div className="container-wide">
        <div className="max-w-3xl">
          <span className="text-xs font-mono uppercase tracking-widest text-coral-700">
            El problema
          </span>
          <h2 className="font-display text-4xl md:text-5xl mt-3 leading-tight text-ink">
            La ventana crítica de
            <br />
            <span className="italic font-light text-teal-700">18 meses a 3 años</span>
            <br />
            se está perdiendo.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Stat
            number="5–6"
            unit="años"
            description="Edad promedio de diagnóstico de TEA en Perú. Las intervenciones tempranas pierden su mayor potencial."
          />
          <Stat
            number="204k"
            unit="personas"
            description="Estimación OMS para Perú. MINSA solo registra 5,328: una brecha del 97.4%."
          />
          <Stat
            number="4×"
            unit="más en niños"
            description="El TEA tiene un sesgo de detección por género. En niñas se detecta aún menos. Hay que cambiarlo."
          />
        </div>
      </div>
    </section>
  );
}

function Stat({ number, unit, description }: { number: string; unit: string; description: string }) {
  return (
    <div className="border-l-2 border-teal-700 pl-6">
      <div className="font-display text-5xl text-teal-800 leading-none">
        {number}
        <span className="text-base text-ink-mute ml-2 font-sans">{unit}</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">{description}</p>
    </div>
  );
}

// ============================================================================
// SECCIÓN: FEATURES
// ============================================================================
function FeaturesSection() {
  return (
    <section className="py-20 bg-bone-50">
      <div className="container-wide">
        <div className="max-w-2xl mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-teal-700">
            La solución
          </span>
          <h2 className="font-display text-4xl md:text-5xl mt-3 leading-tight">
            Tres puertas hacia el diagnóstico oportuno.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={<ClipboardCheck size={28} />}
            badge="M-CHAT-R"
            title="Cuestionario validado"
            description="Las 20 preguntas oficiales de Robins, Fein & Barton (2009). Cálculo de riesgo server-side. Recomendaciones personalizadas según tu resultado."
          />
          <FeatureCard
            icon={<MessageCircleHeart size={28} />}
            badge="Consultas"
            title="Especialistas verificados"
            description="Pediatras y psicólogos con colegiatura validada por nuestro equipo. Recibe orientación sin salir de casa."
          />
          <FeatureCard
            icon={<ShieldCheck size={28} />}
            badge="Educación"
            title="Información confiable"
            description="Artículos escritos por especialistas peruanos y revisados antes de publicarse. Adiós a los mitos."
          />
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  badge,
  title,
  description,
}: {
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
}) {
  return (
    <div className="card-clinical group">
      <div className="flex items-start justify-between mb-5">
        <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center text-teal-700 group-hover:bg-teal-700 group-hover:text-bone-50 transition-colors">
          {icon}
        </div>
        <span className="text-xs font-mono uppercase tracking-wider text-coral-700">
          {badge}
        </span>
      </div>
      <h3 className="font-display text-2xl mb-2 text-ink">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-mute">{description}</p>
    </div>
  );
}

// ============================================================================
// CTA FINAL
// ============================================================================
function CTASection() {
  return (
    <section className="py-24 bg-teal-900 text-bone-50 relative overflow-hidden">
      <div className="absolute inset-0 grain-overlay opacity-50" />

      <div className="container-narrow text-center relative">
        <h2 className="font-display text-4xl md:text-6xl leading-tight mb-6">
          Tu hijo merece una
          <br />
          <span className="italic font-light text-coral-300">oportunidad temprana.</span>
        </h2>
        <p className="text-lg text-bone-200 max-w-xl mx-auto mb-10">
          Crea tu cuenta gratis. Toma el cuestionario en 5 minutos. Decide los siguientes pasos con información real.
        </p>
        <Link href="/register" className="btn-coral text-base px-8 py-3.5">
          Crear cuenta gratuita
          <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================
function Footer() {
  return (
    <footer className="border-t border-bone-200 bg-bone-100/50 py-12">
      <div className="container-wide">
        <div className="flex flex-col md:flex-row gap-6 justify-between text-sm text-ink-mute">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-teal-700 flex items-center justify-center text-bone-50">
                <Brain size={14} strokeWidth={2.5} />
              </div>
              <span className="font-display text-base font-medium text-ink">NeuroAlert</span>
            </div>
            <p className="text-xs max-w-md leading-relaxed">
              Plataforma educativa sin fines diagnósticos. Para diagnóstico oficial,
              consulta siempre con un profesional de la salud certificado.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs">
            <Link href="/about" className="hover:text-teal-700">
              Sobre el proyecto
            </Link>
            <Link href="/articles" className="hover:text-teal-700">
              Artículos educativos
            </Link>
            <Link href="/login" className="hover:text-teal-700">
              Iniciar sesión
            </Link>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-bone-200 text-xs text-ink-fade flex flex-col md:flex-row justify-between gap-2">
          <span>© 2026 NeuroAlert · Proyecto académico UPC</span>
          <span>Made with ❤️ in Lima, Perú</span>
        </div>
      </div>
    </footer>
  );
}
