import { useEffect, useRef, useState } from "react";
import { IconGiro } from "./Icons";

/**
 * Vista 360° manual con fotos reales (no es video): arrastra la moto, usa la barra «360°»,
 * las flechas del teclado o el botón Girar. Cada fotograma intenta primero la URL oficial
 * y luego la copia local; si no cargan al menos dos, avisa con onNoDisponible().
 */
export default function Viewer360({ frames = [], locales = [], alt = "", onNoDisponible }) {
  const [fuentes, setFuentes] = useState(null); // URLs que sí cargaron, en orden de giro
  const [i, setI] = useState(0);
  const [girando, setGirando] = useState(false);
  const drag = useRef(null);
  const clave = frames.join("|");

  useEffect(() => {
    let vivo = true;
    const probar = (urls) => new Promise((res) => {
      const intento = (k) => {
        if (k >= urls.length) return res(null);
        const img = new Image();
        img.onload = () => res(urls[k]);
        img.onerror = () => intento(k + 1);
        img.src = urls[k];
      };
      intento(0);
    });
    Promise.all(frames.map((f, k) => probar([f, locales[k]].filter(Boolean)))).then((r) => {
      if (!vivo) return;
      const ok = r.filter(Boolean);
      setFuentes(ok);
      if (ok.length < 2) onNoDisponible?.();
    });
    return () => { vivo = false; };
  }, [clave]); // eslint-disable-line

  useEffect(() => {
    if (!girando || !fuentes?.length) return;
    const t = setInterval(() => setI((x) => (x + 1) % fuentes.length), 350);
    return () => clearInterval(t);
  }, [girando, fuentes]);

  if (!fuentes) return <div className="grid aspect-[4/3] w-full place-items-center text-[13px] text-slate-400">Cargando vista 360°…</div>;
  if (fuentes.length < 2) return null;
  const n = fuentes.length;
  const idx = ((i % n) + n) % n;

  const mover = (x) => {
    if (!drag.current) return;
    const pasos = Math.round((x - drag.current.x) / 36);
    setI(drag.current.i - pasos);
  };

  return (
    <div className="w-full">
      <div
        role="img" aria-label={`${alt}: vista ${idx + 1} de ${n}. Arrastra para girar.`} tabIndex={0}
        className="relative cursor-grab touch-pan-y select-none outline-none active:cursor-grabbing"
        onPointerDown={(e) => { setGirando(false); drag.current = { x: e.clientX, i: idx }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => mover(e.clientX)}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setI(idx - 1); if (e.key === "ArrowRight") setI(idx + 1); }}
      >
        {fuentes.map((src, k) => (
          <img key={src} src={src} alt="" draggable={false} referrerPolicy="no-referrer"
            className={`mx-auto aspect-[4/3] w-full object-contain ${k === idx ? "" : "hidden"}`} />
        ))}
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-marino shadow-sm dark:bg-[#101c33]/90 dark:text-white">
          <IconGiro className="h-4 w-4" /> Arrastra para girar
        </span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="font-display text-[15px] font-bold text-marino dark:text-white">360°</span>
        <input type="range" min={0} max={n - 1} value={idx} onChange={(e) => { setGirando(false); setI(Number(e.target.value)); }} aria-label="Girar la moto" className="h-1.5 flex-1 cursor-pointer accent-acento" />
        <button type="button" onClick={() => setGirando((g) => !g)} className="rounded-full border border-slate-300 px-3 py-1 text-[12.5px] font-semibold text-marino hover:bg-white dark:border-white/15 dark:text-white dark:hover:bg-white/10">{girando ? "Pausar" : "Girar"}</button>
      </div>
    </div>
  );
}
