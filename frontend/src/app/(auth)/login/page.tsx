'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Brain, Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido').max(255),
  password: z.string().min(1, 'Ingresa tu contraseña').max(128),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const user = await login(values.email, values.password);

      const redirect = searchParams.get('redirect');
      if (redirect) {
        router.push(redirect);
      } else if (user.role === 'PARENT') {
        router.push('/dashboard');
      } else if (user.role === 'SPECIALIST') {
        router.push('/specialist');
      } else {
        router.push('/admin');
      }
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      setServerError(
        error.response?.data?.message || 'No pudimos iniciar sesión. Verifica tus datos.',
      );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="label">Correo electrónico</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu@correo.com"
          className="input"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-xs text-coral-600 mt-1.5">{errors.email.message}</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center">
          <label htmlFor="password" className="label">Contraseña</label>
          <Link href="/forgot-password" className="text-xs text-teal-700 hover:underline">
            ¿La olvidaste?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••••••"
            className="input pr-12"
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute hover:text-ink-soft"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {errors.password && (
          <p className="text-xs text-coral-600 mt-1.5">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800">
          {serverError}
        </div>
      )}

      <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
        {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Iniciar sesión'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Lado izquierdo: formulario */}
      <div className="flex flex-col justify-center p-8 md:p-16 bg-bone-50">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 mb-12 group">
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50 group-hover:bg-teal-800 transition-colors">
              <Brain size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl tracking-tightest font-medium">NeuroAlert</span>
          </Link>

          <h1 className="font-display text-4xl tracking-tightest mb-2">
            Bienvenido de vuelta
          </h1>
          <p className="text-ink-mute mb-8">
            Inicia sesión para continuar con tu evaluación o consultas.
          </p>

          <Suspense fallback={<div className="h-64 animate-pulse bg-gray-100 rounded-xl" />}>
            <LoginForm />
          </Suspense>

          <p className="mt-8 text-sm text-ink-mute text-center">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="text-teal-700 font-medium hover:underline">
              Crear cuenta gratis
            </Link>
          </p>
        </div>
      </div>

      {/* Lado derecho: visual editorial */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-teal-800 via-teal-900 to-teal-950 text-bone-50 overflow-hidden">
        <div className="absolute inset-0 grain-overlay opacity-50" />
        <div className="relative z-10 flex flex-col justify-between p-16 w-full">
          <div className="text-xs font-mono uppercase tracking-widest text-teal-300">
            NeuroAlert · 2026
          </div>

          <div>
            <p className="font-display text-4xl leading-tight mb-6">
              "La detección temprana es el regalo más grande que puedes darle a tu hijo."
            </p>
            <div className="text-sm text-teal-200">
              Pediatría del Desarrollo, Hospital del Niño · Lima
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-sm">
            <Stat label="Evaluaciones" value="1,200+" />
            <Stat label="Especialistas" value="40" />
            <Stat label="Familias" value="850" />
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-3xl text-coral-300">{value}</div>
      <div className="text-xs uppercase tracking-wider text-teal-300">{label}</div>
    </div>
  );
}
