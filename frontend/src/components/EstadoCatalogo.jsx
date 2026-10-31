// Catálogo de la web mientras llega la información de la base: tarjetas de espera o el aviso de error con
// «Reintentar». Con la base conectada nunca se muestran los modelos de demostración del front.
import { useState } from "react";
import { useApp } from "../store/appStore.jsx";

// Tarjetas grises con la forma de las tarjetas de modelo
export function CargandoModelos({ n = 4, className = "mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" }) {
  return (
    <div className={className} data-cargando-catalogo role="status" aria-live="polite">
      <span className="sr-only">Cargando modelos…</span>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="animate-pulse motion-reduce:animate-none" aria-hidden="true">
          <div className="aspect-[4/3] rounded-2xl bg-slate-200/80 dark:bg-white/10" />
          <div className="mt-4 h-5 w-2/3 rounded bg-slate-200/80 dark:bg-white/10" />
          <div className="mt-2 h-4 w-1/3 rounded bg-slate-200/70 dark:bg-white/[0.07]" />
        </div>
      ))}
    </div>
  );
}

// No se pudo leer el catálogo de la base (y no hay uno confirmado antes)
export function ErrorCatalogo({ className = "mt-10" }) {
  const { catalogo } = useApp();
  const [reintentando, setReintentando] = useState(false);
  const reintentar = async () => { setReintentando(true); try { await catalogo.reintentar(); } finally { setReintentando(false); } };
  return (
    <div className={`${className} rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-white/15`} data-error-catalogo role="alert">
      <p className="text-lg font-semibold text-marino dark:text-white">No pudimos cargar los modelos</p>
      <p className="mt-1 text-slate-500">Revisa tu conexión e inténtalo otra vez. También puedes escribirnos por WhatsApp.</p>
      <button className="btn btn-secondary mt-5" onClick={reintentar} disabled={reintentando} data-reintentar-catalogo>{reintentando ? "Cargando…" : "Reintentar"}</button>
    </div>
  );
}

// Muestra el contenido solo cuando el catálogo de la base ya llegó
export function BloqueCatalogo({ children, n, className }) {
  const { catalogo } = useApp();
  if (catalogo?.estado === "cargando") return <CargandoModelos n={n} className={className} />;
  if (catalogo?.estado === "error") return <ErrorCatalogo />;
  return children;
}
