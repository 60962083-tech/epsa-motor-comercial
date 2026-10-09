import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ModeloImg from "./ModeloImg";
import { formatoSoles } from "../data/mockData";

/**
 * Carrusel del inicio: una diapositiva por modelo, con su foto real, nombre en estilo Torito,
 * una frase, el precio desde y dos acciones. Pasa solo cada 6 s (si el usuario no pidió menos
 * movimiento), se pausa con el mouse o el foco, y se maneja con flechas, puntos o deslizando.
 */
export default function Carousel({ slides, onCotizar }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const n = slides.length;
  const toque = useRef(null);
  const reducido = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (pausa || reducido || n < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 6000);
    return () => clearInterval(t);
  }, [pausa, reducido, n]);

  const ir = (k) => setI((k + n) % n);

  return (
    <section aria-roledescription="carrusel" aria-label="Modelos destacados" className="relative overflow-hidden bg-marino text-white"
      onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)}
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (toque.current == null) return; const d = e.changedTouches[0].clientX - toque.current; if (Math.abs(d) > 50) ir(i + (d < 0 ? 1 : -1)); toque.current = null; }}>
      <div className="pointer-events-none absolute -right-40 top-1/2 h-[640px] w-[640px] -translate-y-1/2 rounded-full bg-white/[0.04]" />
      {/* Todas las diapositivas ocupan la misma celda de la grilla: el alto se ajusta a la más alta y nada se desborda en celular */}
      <div className="relative grid lg:min-h-[560px]">
        {slides.map((s, idx) => {
          const m = s.modelo;
          if (!m) return null;
          const activo = idx === i;
          return (
            <div key={s.modeloId} aria-hidden={!activo} className={`col-start-1 row-start-1 transition-opacity duration-700 ${activo ? "opacity-100" : "pointer-events-none opacity-0"}`}>
              <div className="wrap grid h-full items-center gap-5 pb-16 pt-6 sm:gap-6 sm:pb-20 sm:pt-10 lg:grid-cols-[1fr_1.1fr] lg:pb-16">
                <div className="order-2 min-w-0 lg:order-1">
                  <p className="text-[13.5px] font-medium text-white/60 sm:text-[14px]">{s.etiqueta || m.familia}</p>
                  <h2 className="mt-2 font-display text-[2.5rem] font-bold uppercase leading-[0.9] tracking-tight min-[380px]:text-[2.9rem] sm:text-[4.5rem] lg:text-[5.25rem]">{m.nombre}</h2>
                  <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-white/75 sm:mt-4 sm:text-[17px]">{s.texto}</p>
                  <div className="mt-5 flex items-baseline gap-2 sm:mt-6">
                    <span className="text-[13px] text-white/60">Desde</span>
                    <span className="cifra font-display text-[2.1rem] font-bold leading-none sm:text-[2.4rem]">{formatoSoles(m.precioDesde)}</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
                    <Link to={`/modelos/${m.id}`} tabIndex={activo ? 0 : -1} className="btn flex-1 bg-white text-marino hover:bg-white/90 sm:flex-none">Ver modelo</Link>
                    <button type="button" tabIndex={activo ? 0 : -1} onClick={() => onCotizar?.(m.id)} className="btn btn-acento flex-1 sm:flex-none">Cotizar</button>
                  </div>
                </div>
                <div className="order-1 flex items-end justify-center lg:order-2">
                  <div className="relative w-full max-w-[620px]">
                    <div className="absolute inset-x-[12%] bottom-[6%] h-[14%] rounded-[50%] bg-black/30 blur-2xl" />
                    <ModeloImg modelo={m} className="relative mx-auto max-h-[190px] w-full object-contain min-[380px]:max-h-[220px] sm:max-h-[330px] lg:max-h-[420px]" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="absolute inset-x-0 bottom-5 sm:bottom-6">
        <div className="wrap flex items-center gap-4">
          <div className="flex gap-2">
            {slides.map((s, idx) => (
              <button key={s.modeloId} onClick={() => ir(idx)} aria-label={`Ver ${s.modelo?.nombre}`} aria-current={idx === i}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-10 bg-white" : "w-5 bg-white/30 hover:bg-white/60"}`} />
            ))}
          </div>
          <div className="ml-auto hidden gap-2 sm:flex">
            <button onClick={() => ir(i - 1)} aria-label="Modelo anterior" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-xl hover:bg-white/10">‹</button>
            <button onClick={() => ir(i + 1)} aria-label="Modelo siguiente" className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-xl hover:bg-white/10">›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
