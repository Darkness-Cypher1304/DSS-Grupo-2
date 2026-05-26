'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Brain, CheckCircle, Loader2 } from 'lucide-react';

import { useAuth } from '@/lib/auth-context';

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Tu nombre es muy corto')
    .max(100)
    .regex(/^[A-Za-zÀ-ÿ\u00f1\u00d1\s'-]+$/, 'Solo letras y espacios'),
  email: z.string().email('Correo inválido').max(255),
  phoneNumber: z.string().regex(/^\+?[0-9\s-]{6,20}$/, 'Teléfono inválido').optional().or(z.literal('')),
  password: z
    .string()
    .min(12, 'Mínimo 12 caracteres')
    .max(128, 'Máximo 128 caracteres'),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: 'Las contraseñas no coinciden',
  path: ['passwordConfirm'],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { register: doRegister } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  const password = watch('password', '');

  async function onSubmit(values: RegisterFormValues) {
    setServerError(null);
    try {
      const result = await doRegister({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phoneNumber: values.phoneNumber || undefined,
      });
      setSuccess(result.message);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const msg = error.response?.data?.message;
      setServerError(
        Array.isArray(msg)
          ? msg.join(' · ')
          : msg || 'No pudimos crear tu cuenta. Intenta nuevamente.',
      );
    }
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-bone-50">
      <div className="flex flex-col justify-center p-8 md:p-16">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 mb-10 group">
            <div className="w-9 h-9 rounded-xl bg-teal-700 flex items-center justify-center text-bone-50 group-hover:bg-teal-800 transition-colors">
              <Brain size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl tracking-tightest font-medium">NeuroAlert</span>
          </Link>

          <h1 className="font-display text-4xl tracking-tightest mb-2">Crear cuenta</h1>
          <p className="text-ink-mute mb-8">
            Empieza tu cuenta gratuita en 1 minuto. Te enviaremos un correo para verificar.
          </p>

          {success ? (
            <div className="rounded-2xl bg-teal-50 border border-teal-200 p-6 text-center">
              <CheckCircle className="mx-auto text-teal-700 mb-3" size={40} />
              <h3 className="font-display text-2xl mb-2">¡Listo!</h3>
              <p className="text-sm text-ink-soft">{success}</p>
              <p className="text-xs text-ink-mute mt-3">Te redirigiremos al login...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div>
                <label htmlFor="fullName" className="label">Nombre completo</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="María Pérez Quispe"
                  className="input"
                  {...register('fullName')}
                />
                {errors.fullName && <p className="text-xs text-coral-600 mt-1.5">{errors.fullName.message}</p>}
              </div>

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
                {errors.email && <p className="text-xs text-coral-600 mt-1.5">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="phoneNumber" className="label">
                  Teléfono <span className="text-ink-fade font-normal">(opcional)</span>
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+51 987 654 321"
                  className="input"
                  {...register('phoneNumber')}
                />
                {errors.phoneNumber && <p className="text-xs text-coral-600 mt-1.5">{errors.phoneNumber.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="label">Contraseña</label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 12 caracteres"
                  className="input"
                  {...register('password')}
                />
                {errors.password && <p className="text-xs text-coral-600 mt-1.5">{errors.password.message}</p>}
                <PasswordStrength value={password} />
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="label">Confirma tu contraseña</label>
                <input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repítela"
                  className="input"
                  {...register('passwordConfirm')}
                />
                {errors.passwordConfirm && <p className="text-xs text-coral-600 mt-1.5">{errors.passwordConfirm.message}</p>}
              </div>

              {serverError && (
                <div className="rounded-xl bg-coral-50 border border-coral-200 px-4 py-3 text-sm text-coral-800">
                  {serverError}
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base">
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Crear mi cuenta'}
              </button>

              <p className="text-xs text-ink-fade text-center mt-4">
                Al registrarte, aceptas que NeuroAlert es una plataforma educativa
                sin fines diagnósticos.
              </p>
            </form>
          )}

          <p className="mt-8 text-sm text-ink-mute text-center">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-teal-700 font-medium hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>

      {/* Lado decorativo */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-coral-100 via-bone-100 to-teal-100 overflow-hidden p-16">
        <div className="absolute inset-0 grain-overlay opacity-40" />
        <div className="relative z-10 flex flex-col justify-center max-w-md">
          <span className="text-xs font-mono uppercase tracking-widest text-coral-700 mb-4">
            Por qué NeuroAlert
          </span>
          <h2 className="font-display text-4xl leading-tight mb-8 text-ink">
            Información clara,
            <br />
            <span className="italic font-light">sin alarmas falsas.</span>
          </h2>

          <div className="space-y-4">
            <FeatureBullet>El cuestionario M-CHAT-R completo y validado</FeatureBullet>
            <FeatureBullet>Cálculo de riesgo con criterios oficiales</FeatureBullet>
            <FeatureBullet>Acceso directo a especialistas verificados</FeatureBullet>
            <FeatureBullet>Recursos educativos con base científica</FeatureBullet>
            <FeatureBullet>Tus datos protegidos con cifrado y aislamiento por usuario</FeatureBullet>
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <CheckCircle size={20} className="text-teal-700 flex-shrink-0 mt-0.5" />
      <span className="text-sm text-ink-soft">{children}</span>
    </div>
  );
}

function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;

  let strength = 0;
  if (value.length >= 12) strength += 1;
  if (value.length >= 16) strength += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) strength += 1;
  if (/[0-9]/.test(value)) strength += 1;
  if (/[^A-Za-z0-9]/.test(value)) strength += 1;

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
  const colors = ['bg-coral-500', 'bg-coral-400', 'bg-amber-400', 'bg-teal-400', 'bg-teal-600'];
  const idx = Math.min(strength, 4);

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= idx ? colors[idx] : 'bg-bone-200'}`}
          />
        ))}
      </div>
      <p className="text-xs text-ink-mute mt-1">Fuerza: {labels[idx]}</p>
    </div>
  );
}
