// Opiniones de clientes (inicio)
import { useState } from "react";
import { useApp } from "../store/appStore.jsx";
import ModeloImg from "./ModeloImg";

const TONOS = ["bg-marino text-white", "bg-acento text-white"];

// Estrellas
function Estrellas({ n }) {
  return (
    <span className="flex gap-0.5 text-acento" aria-label={`${n} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={`h-4 w-4 ${i <= n ? "fill-current" : "fill-slate-200 dark:fill-white/15"}`} aria-hidden="true"><path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L10 14.9l-5.2 2.8 1-5.9L1.5 7.7l5.9-.8z" /></svg>
      ))}
    </span>
  );
}

// Tarjeta de opinión
function Tarjeta({ o, modelo, i }) {
  return (
    <article className="relative flex h-full w-[290px] shrink-0 flex-col rounded-2xl border-l-4 border-acento bg-white p-5 text-left shadow-lg shadow-black/20 sm:w-[330px] dark:bg-[#101c33]">
      <div className="flex items-center justify-between gap-2">
        <Estrellas n={o.estrellas} />
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${TONOS[i % 2]}`}>{o.etiqueta}</span>
      </div>
      <p className="mt-4 flex-1 text-[14px] italic leading-relaxed text-slate-600 dark:text-white/75">“{o.texto}”</p>
      <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
        <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-escenario ring-2 ring-acento/30 dark:bg-escenario-oscuro">
          {modelo ? <ModeloImg modelo={modelo} className="h-9 w-9 object-contain" alt="" /> : <span className="font-bold text-marino">{o.nombre[0]}</span>}
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-[16px] font-bold uppercase tracking-wide text-marino dark:text-white">{o.nombre}</p>
          <p className="truncate text-[12px] text-slate-500 dark:text-white/55">{o.sede}{modelo ? ` · ${modelo.nombre.replace(/^Torito /, "")}` : ""}</p>
        </div>
      </div>
      {o.ejemplo && <span className="absolute -top-2 right-4 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">Ejemplo</span>}
    </article>
  );
}

// Sección con dos filas en movimiento
export default function Opiniones() {
  const { opiniones = [], publicos } = useApp();
  const [pausa, setPausa] = useState(false);
  const lista = opiniones.filter((o) => o.publicado);
  if (lista.length === 0) return null;
  const mitad = Math.ceil(lista.length / 2);
  const llenar = (f) => { let r = [...f]; while (r.length < 6) r = [...r, ...f]; return r; };
  const filas = (lista.length > 3 ? [lista.slice(0, mitad), lista.slice(mitad)] : [lista]).map(llenar);
  const modelo = (id) => publicos.find((m) => m.id === id);

  return (
    <section aria-labelledby="titulo-opiniones" className={`relative overflow-hidden bg-gradient-to-b from-marino via-[#0b2a5c] to-marino py-16 text-white lg:py-20 ${pausa ? "marquesina-pausa" : ""}`}>
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-acento/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" aria-hidden="true" />
      <div className="wrap relative text-center">
        <p className="text-[12.5px] font-semibold uppercase tracking-[0.2em] text-red-300">Opiniones de clientes</p>
        <h2 id="titulo-opiniones" className="mt-2 font-display text-[2.4rem] font-bold leading-none tracking-tight sm:text-[3.2rem]">Historias de éxito comercial</h2>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-white/70">Emprendedores que trabajan con su Torito gracias a la venta y el financiamiento de EPSA Motor.</p>
        <button type="button" onClick={() => setPausa(!pausa)} aria-pressed={!pausa} className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-[13.5px] font-semibold text-white/90 transition hover:bg-white/10">
          {pausa
            ? <><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>Reproducir opiniones</>
            : <><svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>Pausar opiniones</>}
        </button>
      </div>

      <div className="marquesina-zona relative mt-10 space-y-5 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        {filas.map((fila, f) => (
          <div key={f} className="overflow-hidden py-2">
            <div className={`marquesina flex w-max gap-5 px-2.5 ${f % 2 ? "reversa" : ""}`} style={{ "--dur": `${Math.max(35, fila.length * 11)}s` }}>
              {[...fila, ...fila].map((o, k) => <div key={k} className="flex" aria-hidden={k >= fila.length}><Tarjeta o={o} modelo={modelo(o.modelo)} i={k + f} /></div>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
