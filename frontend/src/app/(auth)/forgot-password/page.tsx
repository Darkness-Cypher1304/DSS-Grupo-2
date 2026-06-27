'use client';

import Link from 'next/link';
import { Brain, ArrowLeft, ShieldCheck, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Lado izquierdo: contenido */}
      <div className="flex flex-col justify-center p-8 md:p-16 bg-bone-50">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 mb-12 group">
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50 group-hover:bg-teal-800 transition-colors">
              <Brain size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl tracking-tightest font-medium">NeuroAlert</span>
          </Link>

          <h1 className="font-display text-4xl tracking-tightest mb-2">
            Recuperar acceso
          </h1>
          <p className="text-ink-mute mb-8">
            Por seguridad, NeuroAlert no restablece contraseñas de forma automática.
            Tu acceso se recupera con verificación asistida.
          </p>

          <div className="rounded-2xl border border-bone-200 bg-white p-6 space-y-5">
            <div className="flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Verificación asistida</div>
                <p className="text-sm text-ink-mute mt-0.5">
                  Escribe al administrador desde tu correo registrado para validar tu
                  identidad y recibir un acceso temporal.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-coral-50 flex items-center justify-center text-coral-700">
                <Mail size={18} />
              </div>
              <div>
                <div className="text-sm font-medium">Contacto de soporte</div>
                <a
                  href="mailto:admin@neuroalert.pe?subject=Recuperar%20acceso%20a%20NeuroAlert"
                  className="text-sm text-teal-700 hover:underline mt-0.5 inline-block"
                >
                  admin@neuroalert.pe
                </a>
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className="mt-8 inline-flex items-center gap-2 text-sm text-teal-700 font-medium hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a iniciar sesión
          </Link>
        </div>
      </div>

      {/* Lado derecho: visual editorial (igual que el login) */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-teal-800 via-teal-900 to-teal-950 text-bone-50 overflow-hidden">
        <div className="absolute inset-0 grain-overlay opacity-50" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div className="text-xs font-mono uppercase tracking-widest text-teal-300">
            NeuroAlert · Seguridad
          </div>

          <div>
            <p className="font-display text-4xl leading-tight mb-6">
              "Proteger los datos de cada familia es parte del cuidado."
            </p>
            <div className="text-sm text-teal-200">
              Recuperación verificada · sin restablecimientos automáticos
            </div>
          </div>

          <div className="text-sm text-teal-300">
            Tus datos están cifrados y auditados.
          </div>
        </div>
      </div>
    </main>
  );
}
