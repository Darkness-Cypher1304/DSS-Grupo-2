// ============================================================================
// NeuroAlert · Prisma Seed
// ============================================================================
// Ejecuta `npm run prisma:seed` para popular la BD con datos de prueba.
// Crea:
//   - 1 administrador
//   - 1 especialista verificado (pediatra)
//   - 1 padre de prueba
//   - 4 artículos educativos sobre TEA
// ============================================================================

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de NeuroAlert...');

  const password = await bcrypt.hash('Password2026!', 12);

  // --------------------------------------------------------------------------
  // ADMIN
  // --------------------------------------------------------------------------
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neuroalert.pe' },
    update: {},
    create: {
      email: 'admin@neuroalert.pe',
      passwordHash: password,
      fullName: 'Administrador NeuroAlert',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  console.log(`✅ Admin creado: ${admin.email} (password: Password2026!)`);

  // --------------------------------------------------------------------------
  // ESPECIALISTA
  // --------------------------------------------------------------------------
  const specialist = await prisma.user.upsert({
    where: { email: 'pediatra@neuroalert.pe' },
    update: {},
    create: {
      email: 'pediatra@neuroalert.pe',
      passwordHash: password,
      fullName: 'Dra. María López Quispe',
      phoneNumber: '+51987654321',
      role: 'SPECIALIST',
      status: 'ACTIVE',
      emailVerified: true,
      specialistProfile: {
        create: {
          licenseNumber: 'CMP-12345',
          specialty: 'Pediatría del Desarrollo',
          institution: 'Hospital del Niño - Lima',
          yearsOfExperience: 12,
          bio: 'Pediatra especializada en trastornos del neurodesarrollo. Más de una década atendiendo niños con TEA en el Hospital del Niño.',
          verificationStatus: 'APPROVED',
          verifiedAt: new Date(),
          verifiedById: admin.id,
        },
      },
    },
  });
  console.log(`✅ Especialista creado: ${specialist.email} (password: Password2026!)`);

  // --------------------------------------------------------------------------
  // PADRE DE PRUEBA
  // --------------------------------------------------------------------------
  const parent = await prisma.user.upsert({
    where: { email: 'padre@neuroalert.pe' },
    update: {},
    create: {
      email: 'padre@neuroalert.pe',
      passwordHash: password,
      fullName: 'Carlos Ramírez',
      phoneNumber: '+51912345678',
      role: 'PARENT',
      status: 'ACTIVE',
      emailVerified: true,
    },
  });
  console.log(`✅ Padre creado: ${parent.email} (password: Password2026!)`);

  // --------------------------------------------------------------------------
  // ARTÍCULOS EDUCATIVOS
  // --------------------------------------------------------------------------
  const articles = [
    {
      slug: 'que-es-el-tea',
      title: '¿Qué es el Trastorno del Espectro Autista (TEA)?',
      summary:
        'Explicación clara y accesible sobre qué es el TEA, sus características principales y cómo se manifiesta en niños pequeños.',
      category: 'Conceptos básicos',
      tags: ['TEA', 'autismo', 'introducción'],
      body: `# ¿Qué es el Trastorno del Espectro Autista (TEA)?

El TEA es un trastorno del neurodesarrollo que afecta cómo una persona percibe el mundo, interactúa con otros y aprende.

## Características principales

Las personas con TEA pueden presentar:

- **Dificultades en la comunicación social**: dificultad para mantener conversaciones, entender el lenguaje no verbal o expresar sus emociones.
- **Patrones de comportamiento repetitivos o restringidos**: intereses muy específicos, rutinas rígidas, movimientos repetitivos (aleteo de manos, balanceo).
- **Sensibilidad sensorial diferente**: pueden ser muy sensibles a sonidos, luces, texturas, o por el contrario, buscar estimulación sensorial intensa.

## ¿Por qué se llama "espectro"?

Porque cada persona con TEA es diferente. Algunas necesitan mucho apoyo en su día a día; otras viven de forma totalmente independiente. No hay dos casos iguales.

## ¿Qué NO es el TEA?

El TEA NO es:
- Una enfermedad que se "cura"
- Causado por la crianza de los padres
- Causado por las vacunas (esto está completamente refutado por la ciencia)

## En Perú

Se estima que más de **204,000 personas** tienen TEA en Perú, pero solo el 2.6% está formalmente diagnosticado. Esto significa que la mayoría no recibe el apoyo que podría recibir.`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      authorId: specialist.id,
    },
    {
      slug: 'senales-tempranas-18-meses',
      title: 'Señales tempranas del TEA en niños de 18 meses',
      summary:
        'Las señales más importantes que pueden indicar un posible TEA en niños de 16 a 24 meses, edad clave para la detección.',
      category: 'Señales tempranas',
      tags: ['detección temprana', 'señales', '18 meses'],
      body: `# Señales tempranas del TEA a los 18 meses

La ventana de **18 meses a 3 años** es crítica. Las intervenciones tempranas en esta etapa tienen un impacto enorme en el desarrollo del niño.

## ⚠️ Señales que ameritan consultar al pediatra

### Comunicación
- No responde a su nombre cuando lo llamas
- No señala con el dedo para mostrar interés (por ejemplo, un avión en el cielo)
- No imita gestos simples (saludar con la mano, aplaudir)
- Pérdida de palabras o habilidades que ya tenía

### Interacción social
- Poco o ningún contacto visual
- No sonríe en respuesta a tu sonrisa
- No comparte alegría (no te muestra cosas que le gustan)
- Prefiere jugar solo de manera consistente

### Comportamiento
- Movimientos repetitivos inusuales (aleteo de manos, girar)
- Apego intenso a objetos extraños
- Reacciones desproporcionadas a sonidos, luces o texturas
- Resistencia muy fuerte a cambios pequeños en la rutina

## ✅ Qué hacer si notas estas señales

1. **No entres en pánico**: una señal aislada no significa TEA.
2. **Observa por unas semanas**: anota cuándo ocurren las señales.
3. **Toma el cuestionario M-CHAT-R** en NeuroAlert (es la herramienta validada internacionalmente).
4. **Consulta a tu pediatra** llevando tus observaciones por escrito.

> **Importante**: solo un especialista puede dar un diagnóstico. NeuroAlert es una herramienta de orientación, no de diagnóstico.`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      authorId: specialist.id,
    },
    {
      slug: 'mitos-sobre-el-autismo',
      title: '5 mitos sobre el autismo que debes desterrar',
      summary:
        'Desmontamos los mitos más comunes sobre el TEA con base en la evidencia científica actual.',
      category: 'Educación',
      tags: ['mitos', 'desinformación', 'ciencia'],
      body: `# 5 mitos sobre el autismo que debes desterrar

## Mito 1: "Las vacunas causan autismo"

**FALSO**. El estudio que originó este mito (Wakefield, 1998) fue retirado y su autor perdió su licencia médica por fraude. Decenas de estudios con millones de niños han confirmado: **NO hay relación entre vacunas y autismo**.

## Mito 2: "Los niños con TEA no sienten emociones"

**FALSO**. Las personas con TEA sienten emociones igual o incluso más intensamente. Lo que les cuesta es **expresarlas o reconocerlas en otros** del modo neurotípico.

## Mito 3: "El TEA se cura con dietas o tratamientos alternativos"

**FALSO**. El TEA no es una enfermedad que se cure. Es una condición del neurodesarrollo. Lo que SÍ ayuda son las terapias basadas en evidencia (ABA, TEACCH, terapia ocupacional) iniciadas tempranamente.

## Mito 4: "Es porque los papás trabajan mucho / no juegan con el niño"

**FALSO Y DAÑINO**. La crianza NO causa TEA. Esta idea (la "madre nevera" de los años 50) ya fue completamente refutada. El TEA tiene origen neurobiológico.

## Mito 5: "Si habla, no es autista"

**FALSO**. El TEA es un espectro. Hay personas con TEA muy verbales, otras no verbales, y todo lo intermedio.`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      authorId: specialist.id,
    },
    {
      slug: 'a-donde-acudir-en-peru',
      title: '¿A dónde acudir en Perú si sospechas de TEA?',
      summary:
        'Guía práctica de centros públicos y privados en Perú para evaluación y diagnóstico del TEA.',
      category: 'Recursos en Perú',
      tags: ['Perú', 'centros', 'diagnóstico'],
      body: `# ¿A dónde acudir en Perú si sospechas de TEA?

Si has identificado señales y necesitas una evaluación profesional, estas son tus opciones en Perú.

## 🏥 Centros públicos (cobertura SIS)

### Lima
- **Instituto Nacional de Salud del Niño (San Borja)** — Servicio de Neurología y Psiquiatría infantil
- **Hospital Nacional Hermilio Valdizán** — Servicio de Neurodesarrollo
- **Hospital del Niño (Breña)** — Consulta de Pediatría del Desarrollo

### Provincias
Consulta el centro de salud más cercano y pide referencia al hospital regional. La mayoría de hospitales regionales tienen consulta de pediatría que puede iniciar el proceso.

## 🏥 Centros privados

Existen muchos centros especializados en Lima y principales ciudades. Busca profesionales con certificación en:
- Pediatría del Desarrollo
- Neurología pediátrica
- Psicología clínica con experiencia en TEA

## 📋 Qué llevar a la primera consulta

- **Cartilla de vacunación y de control del niño**
- **Lista escrita de las señales** que has observado, con fechas
- **Resultado del M-CHAT-R** si lo has tomado
- **Videos cortos** del niño en situaciones cotidianas (muy útiles)

## ⏱ Tiempos realistas

Por desgracia, en el sistema público las citas pueden demorar 2-6 meses. Mientras esperas:
- No esperes a confirmar el diagnóstico para empezar **estimulación temprana**
- Habla con el pediatra de cabecera sobre derivación a terapia
- Conecta con asociaciones de padres (apoyo emocional + información)

## 🆘 Asociaciones de padres en Perú

- **APAEP** (Asociación de Padres y Amigos de Personas con Autismo del Perú)
- **Soy Autista** (red de apoyo virtual)
- **Mira por mí** (Cusco)`,
      status: 'PUBLISHED' as const,
      publishedAt: new Date(),
      authorId: specialist.id,
    },
  ];

  for (const article of articles) {
    await prisma.content.upsert({
      where: { slug: article.slug },
      update: {},
      create: article,
    });
  }
  console.log(`✅ ${articles.length} artículos publicados`);

  console.log('');
  console.log('🎉 Seed completado. Credenciales de prueba:');
  console.log('');
  console.log('   👤 ADMIN:        admin@neuroalert.pe       / Password2026!');
  console.log('   👨‍⚕️  ESPECIALISTA: pediatra@neuroalert.pe   / Password2026!');
  console.log('   👨‍👩‍👧 PADRE:        padre@neuroalert.pe       / Password2026!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
