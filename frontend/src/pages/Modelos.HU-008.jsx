import { useState } from "react";
import { Link } from "react-router-dom";
import { MODELOS } from "../data/mockData";
import MotoIllustration from "../components/MotoIllustration";
import HUBadge from "../components/HUBadge";

/**
 * Modelos.jsx — HU-008 "Explorar modelos en un catálogo"
 * -----------------------------------------------------------------
 * Reglas de la historia:
 *  - Solo se muestran los modelos en estado "Publicado".
 *  - Si no hay ninguno publicado, se muestra un estado vacío claro
 *    (no una pantalla en blanco).
 *  - La grilla se probó especialmente a 375px (el ancho típico de
 *    un celular de gama de entrada): a ese ancho queda en 1 columna.
 * El interruptor de abajo es solo para que puedas DEMOSTRAR el
 * estado vacío en la Sprint Review sin tener que borrar datos.
 * -----------------------------------------------------------------
 */
export default function Modelos() {
  const [demoVacio, setDemoVacio] = useState(false);

  const publicados = demoVacio ? [] : MODELOS.filter((m) => m.estado === "Publicado");

  return (
    <div className="fade-in mx-auto max-w-6xl px-6 py-14">
      <HUBadge code="HU-008" titulo="Explorar modelos en un catálogo" />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-marino dark:text-white">Modelos</h1>
          <p className="mt-1 text-slate-500">Explora los modelos publicados por EPSA Motor.</p>
        </div>
        {/* Interruptor solo de demostración, no es parte del flujo del cliente */}
        <label className="hidden shrink-0 items-center gap-2 text-[12px] text-slate-400 md:flex">
          <input type="checkbox" checked={demoVacio} onChange={(e) => setDemoVacio(e.target.checked)} />
          Simular catálogo vacío
        </label>
      </div>

      {publicados.length === 0 ? (
        // ---------- Estado vacío ----------
        <div className="mt-10 rounded-xl2 border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <MotoIllustration className="mx-auto w-28 opacity-40" />
          <h2 className="mt-4 text-lg font-semibold">Aún no hay modelos publicados</h2>
          <p className="mt-1 text-slate-500">Vuelve más tarde para descubrir nuestros modelos.</p>
          <Link to="/" className="btn btn-secondary mt-5">Volver al inicio</Link>
        </div>
      ) : (
        // ---------- Grilla de modelos: 1 col en 375px, 2 en tablet, 3 en desktop ----------
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((m) => (
            <Link
              key={m.id}
              to={`/modelos/${m.id}`}
              className="group rounded-xl2 border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-cardHover dark:border-white/5 dark:bg-[#121a2b]"
            >
              <div className="overflow-hidden rounded-lg bg-marino-50 dark:bg-white/5">
                <MotoIllustration className="aspect-[4/3] w-full p-4 transition group-hover:scale-105" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-marino dark:text-white">{m.nombre}</h3>
              <span className="text-[13.5px] font-medium text-marino-700 dark:text-white/60">Ver ficha →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
