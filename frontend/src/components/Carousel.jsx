// Carrusel de modelos (inicio)
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ModeloImg from "./ModeloImg";
import VideoFondo from "./VideoFondo";
import { formatoSoles } from "../data/mockData";

export default function Carousel({ slides, onCotizar }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(0);
  const [pausa, setPausa] = useState(false);
  const n = slides.length;
  const toque = useRef(null);
  const reanudar = useRef(null);
  const reducido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Avance automático
  useEffect(() => {
    if (pausa || reducido || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [pausa, reducido, n]);
  useEffect(() => { const t = setTimeout(() => setVisible(i), 450); return () => clearTimeout(t); }, [i]);
  useEffect(() => () => clearTimeout(reanudar.current), []);

  const ir = (k) => { setI((k + n) % n); setVisible((k + n) % n); };
  const pausarPorToque = () => { setPausa(true); clearTimeout(reanudar.current); reanudar.current = setTimeout(() => setPausa(false), 10000); };

  return (
    <section aria-roledescription="carrusel" aria-label="Modelos destacados" className="relative overflow-hidden bg-marino text-white"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}
      onTouchStart={(e) => { pausarPorToque(); toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (toque.current == null) return; const d = e.changedTouches[0].clientX - toque.current; if (Math.abs(d) > 50) ir(i + (d < 0 ? 1 : -1)); toque.current = null; }}>
      <VideoFondo opacidad="opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-marino via-marino/80 to-marino/10" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-marino to-transparent" aria-hidden="true" />

      <div className="relative grid lg:min-h-[580px]">
        {/* Diapositivas */}
        {slides.map((s, idx) => {
          const m = s.modelo;
          if (!m) return null;
          const activo = idx === i;
          const clicable = activo && idx === visible;
          return (
            <div key={s.modeloId} aria-hidden={!activo} data-modelo={m.id} className={`col-start-1 row-start-1 transition-opacity duration-500 ${activo ? "opacity-100" : "opacity-0"} ${clicable ? "" : "pointer-events-none"}`}>
              <div className="wrap grid h-full items-center gap-5 pb-16 pt-6 sm:gap-6 sm:pb-20 sm:pt-10 lg:grid-cols-[1fr_1.1fr] lg:pb-16">
                <div className={`order-2 min-w-0 lg:order-1 ${activo ? "animate-[subir_.7s_ease_both]" : ""}`}>
                  <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-white/15 backdrop-blur-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-acento" />{s.etiqueta || m.familia}
                  </p>
                  <h2 className="mt-3 font-display text-[2.5rem] font-bold uppercase leading-[0.9] tracking-tight min-[380px]:text-[2.9rem] sm:text-[4.5rem] lg:text-[5.4rem]">{m.nombre}</h2>
                  <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-white/75 sm:mt-4 sm:text-[17px]">{s.texto}</p>
                  <div className="mt-5 flex items-baseline gap-2 sm:mt-6">
                    <span className="text-[13px] text-white/60">Desde</span>
                    <span className="cifra font-display text-[2.1rem] font-bold leading-none sm:text-[2.5rem]">{formatoSoles(m.precioDesde)}</span>
                    <span className="text-[12px] text-white/50">sin techo</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
                    <Link to={`/modelos/${m.id}`} tabIndex={clicable ? 0 : -1} className="btn flex-1 bg-white text-marino hover:bg-white/90 sm:flex-none">Ver modelo</Link>
                    <button type="button" tabIndex={clicable ? 0 : -1} onClick={() => { setPausa(true); onCotizar?.(m.id); }} className="btn btn-acento flex-1 shadow-lg shadow-acento/30 sm:flex-none">Cotizar</button>
                  </div>
                </div>
                <div className="order-1 flex items-end justify-center lg:order-2">
                  <div className={`relative w-full max-w-[640px] ${activo ? "animate-[entrar_.8s_cubic-bezier(.2,.8,.2,1)_both]" : ""}`}>
                    <div className="absolute inset-x-[12%] bottom-[5%] h-[12%] rounded-[50%] bg-black/45 blur-2xl" />
                    <ModeloImg modelo={m} className="relative mx-auto max-h-[190px] w-full object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,.35)] min-[380px]:max-h-[220px] sm:max-h-[330px] lg:max-h-[430px]" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Puntos y flechas */}
      <div className="absolute inset-x-0 bottom-5 sm:bottom-6">
        <div className="wrap flex items-center gap-4">
          <div className="flex gap-2">
            {slides.map((s, idx) => (
              <button key={s.modeloId} onClick={() => ir(idx)} aria-label={`Ver ${s.modelo?.nombre}`} aria-current={idx === i}
                className={`relative h-1.5 overflow-hidden rounded-full transition-all ${idx === i ? "w-12 bg-white/30" : "w-5 bg-white/30 hover:bg-white/60"}`}>
                {idx === i && <span key={`${i}-${pausa}`} className={`absolute inset-y-0 left-0 rounded-full bg-white ${pausa || reducido ? "w-full" : "animate-[progreso_6s_linear_both]"}`} />}
              </button>
            ))}
          </div>
          <div className="ml-auto hidden gap-2 sm:flex">
            <button onClick={() => ir(i - 1)} aria-label="Modelo anterior" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-xl backdrop-blur-sm hover:bg-white/10">‹</button>
            <button onClick={() => ir(i + 1)} aria-label="Modelo siguiente" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-xl backdrop-blur-sm hover:bg-white/10">›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
