'use client';

// ============================================================================
// NeuroLoader — overlay de carga "señal neuronal"
// ============================================================================
// Tema: una red de neuronas que late mientras pulsos sinápticos viajan por sus
// conexiones, con el cerebro de NeuroAlert irradiando anillos de actividad.
// Animado con SVG SMIL + CSS (sin dependencias extra). Combina con la marca:
// teal #235452 · coral #e35a3e · bone #f7f4ed · Fraunces para el wordmark.
// ============================================================================

import { Brain } from 'lucide-react';

interface NeuroLoaderProps {
  /** Mensaje bajo el wordmark. */
  message?: string;
  /** A pantalla completa fija (default) o embebido en su contenedor. */
  fullscreen?: boolean;
}

// Nodos exteriores (red neuronal) en un viewBox 320x320, centro 160,160, radio 116.
const C = 160;
const R = 116;
const NODES = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2; // -90° para empezar arriba
  return { x: +(C + R * Math.cos(a)).toFixed(1), y: +(C + R * Math.sin(a)).toFixed(1) };
});

export function NeuroLoader({ message = 'Preparando tu espacio…', fullscreen = true }: NeuroLoaderProps) {
  return (
    <div className={`neuro-loader ${fullscreen ? 'is-fixed' : 'is-inline'}`} role="status" aria-live="polite">
      <div className="grain-overlay neuro-grain" />

      {/* Auroras de fondo a la deriva */}
      <span className="aurora aurora--teal" />
      <span className="aurora aurora--coral" />

      <div className="neuro-stage">
        <svg viewBox="0 0 320 320" className="neuro-net" aria-hidden="true">
          {/* Conexiones: centro→nodo y anillo entre nodos adyacentes */}
          <g stroke="#3f7e79" strokeOpacity="0.35" strokeWidth="1.2" fill="none">
            {NODES.map((n, i) => (
              <line key={`s${i}`} x1={C} y1={C} x2={n.x} y2={n.y} />
            ))}
            {NODES.map((n, i) => {
              const m = NODES[(i + 1) % NODES.length];
              return <line key={`r${i}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} />;
            })}
          </g>

          {/* Pulsos sinápticos viajando del centro hacia cada nodo */}
          {NODES.map((n, i) => (
            <circle key={`p${i}`} r="3.2" fill="#e35a3e" opacity="0.95">
              <animateMotion
                dur="1.6s"
                begin={`${i * 0.22}s`}
                repeatCount="indefinite"
                path={`M${C},${C} L${n.x},${n.y}`}
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1"
              />
              <animate attributeName="opacity" values="0;1;1;0" dur="1.6s" begin={`${i * 0.22}s`} repeatCount="indefinite" />
            </circle>
          ))}

          {/* Nodos exteriores que laten */}
          {NODES.map((n, i) => (
            <g key={`n${i}`}>
              <circle cx={n.x} cy={n.y} r="9" fill="#6fd6cf" opacity="0.18">
                <animate attributeName="r" values="9;15;9" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.18;0.04;0.18" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={n.x} cy={n.y} r="4.5" fill="#bff0ec">
                <animate attributeName="r" values="4.5;6;4.5" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>

        {/* Cerebro central con anillos de actividad */}
        <div className="neuro-core">
          <span className="ring" />
          <span className="ring ring--2" />
          <span className="ring ring--3" />
          <div className="neuro-brain">
            <Brain size={30} strokeWidth={2} />
          </div>
        </div>
      </div>

      <div className="neuro-text">
        <div className="neuro-word">NeuroAlert</div>
        <div className="neuro-msg">
          {message}
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      </div>

      <style jsx>{`
        .neuro-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2.25rem;
          overflow: hidden;
          background:
            radial-gradient(120% 120% at 50% 35%, #16403d 0%, #0e2c2a 45%, #081c1b 100%);
          color: #f7f4ed;
          isolation: isolate;
        }
        .is-fixed {
          position: fixed;
          inset: 0;
          z-index: 60;
        }
        .is-inline {
          position: relative;
          width: 100%;
          min-height: 100vh;
        }
        .neuro-grain {
          opacity: 0.5;
          mix-blend-mode: overlay;
        }
        .aurora {
          position: absolute;
          width: 46vmin;
          height: 46vmin;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.5;
          z-index: -1;
          will-change: transform;
        }
        .aurora--teal {
          background: #2f8e86;
          top: 12%;
          left: 16%;
          animation: drift 13s ease-in-out infinite;
        }
        .aurora--coral {
          background: #e35a3e;
          opacity: 0.3;
          bottom: 12%;
          right: 14%;
          animation: drift 16s ease-in-out infinite reverse;
        }
        @keyframes drift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
          50% { transform: translate3d(6vmin, -5vmin, 0) scale(1.15); }
        }

        .neuro-stage {
          position: relative;
          width: 248px;
          height: 248px;
          display: grid;
          place-items: center;
        }
        .neuro-net {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 0 6px rgba(111, 214, 207, 0.25));
          animation: spin 38s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .neuro-core {
          position: relative;
          display: grid;
          place-items: center;
          width: 92px;
          height: 92px;
        }
        .neuro-brain {
          position: relative;
          z-index: 2;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #16403d;
          background: radial-gradient(circle at 35% 30%, #ffffff 0%, #cfeeea 55%, #6fd6cf 100%);
          box-shadow: 0 0 28px rgba(111, 214, 207, 0.55), inset 0 0 12px rgba(255, 255, 255, 0.6);
          animation: breathe 2.6s ease-in-out infinite;
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); box-shadow: 0 0 24px rgba(111, 214, 207, 0.45), inset 0 0 12px rgba(255,255,255,0.6); }
          50% { transform: scale(1.08); box-shadow: 0 0 40px rgba(111, 214, 207, 0.85), inset 0 0 14px rgba(255,255,255,0.8); }
        }
        .ring {
          position: absolute;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 1.5px solid rgba(111, 214, 207, 0.6);
          animation: ripple 2.8s ease-out infinite;
        }
        .ring--2 { animation-delay: 0.9s; border-color: rgba(227, 90, 62, 0.5); }
        .ring--3 { animation-delay: 1.8s; }
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.7); opacity: 0; }
        }

        .neuro-text {
          text-align: center;
          z-index: 1;
        }
        .neuro-word {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 1.85rem;
          letter-spacing: -0.02em;
          background: linear-gradient(100deg, #f7f4ed 30%, #ffd9b0 45%, #6fd6cf 55%, #f7f4ed 70%);
          background-size: 250% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: shimmer 3.2s linear infinite;
        }
        @keyframes shimmer {
          0% { background-position: 150% 0; }
          100% { background-position: -150% 0; }
        }
        .neuro-msg {
          margin-top: 0.5rem;
          font-size: 0.82rem;
          letter-spacing: 0.06em;
          color: rgba(191, 240, 236, 0.75);
          display: inline-flex;
          align-items: baseline;
        }
        .dot {
          width: 3px;
          height: 3px;
          margin-left: 3px;
          border-radius: 50%;
          background: #e35a3e;
          display: inline-block;
          animation: blink 1.4s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes blink {
          0%, 100% { opacity: 0.2; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .neuro-net, .neuro-brain, .ring, .aurora, .neuro-word, .dot { animation: none; }
        }
      `}</style>
    </div>
  );
}

export default NeuroLoader;
