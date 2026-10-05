import { useParams, Link } from "react-router-dom";
import { MODELOS } from "../data/mockData";
import MotoIllustration from "../components/MotoIllustration";
import WhatsAppButton from "../components/WhatsAppButton.HU-013";
import HUBadge from "../components/HUBadge";

/**
 * ModeloDetalle.jsx — HU-009 "Consultar la ficha de un modelo"
 * -----------------------------------------------------------------
 * Toma el id de la URL (/modelos/:id) y busca el modelo en los
 * datos de ejemplo. Dos casos posibles:
 *   1) No existe ese id, o existe pero está en Borrador → pantalla
 *      de error (ruta inválida / modelo no publicado).
 *   2) Existe y está Publicado → se muestra la ficha completa.
 * -----------------------------------------------------------------
 */
export default function ModeloDetalle() {
  const { id } = useParams();
  const modelo = MODELOS.find((m) => m.id === id && m.estado === "Publicado");

  if (!modelo) {
    // ---------- Estado de error: modelo no publicado o enlace inválido ----------
    return (
      <div className="fade-in mx-auto max-w-2xl px-6 py-24 text-center">
        <HUBadge code="HU-009" titulo="Ficha de modelo (error de ruta)" />
        <div className="rounded-xl2 border border-red-200 bg-red-50 p-10 dark:border-red-900/40 dark:bg-red-950/30">
          <h1 className="text-xl font-bold text-red-700 dark:text-red-400">
            Este modelo no está disponible en el catálogo
          </h1>
          <p className="mt-2 text-red-700/80 dark:text-red-300/70">
            Puede que ya no se publique o que el enlace no sea válido.
          </p>
          <Link to="/modelos" className="btn btn-secondary mt-6">Volver al catálogo</Link>
        </div>
      </div>
    );
  }

  // ---------- Ficha completa ----------
  return (
    <div className="fade-in mx-auto max-w-6xl px-6 py-14">
      <HUBadge code="HU-009" titulo="Consultar la ficha de un modelo" />
      <p className="text-[13px] text-slate-400">
        <Link to="/modelos" className="hover:underline">Modelos</Link> / {modelo.nombre}
      </p>
      <div className="mt-4 grid gap-10 lg:grid-cols-2">
        <div className="rounded-xl2 bg-marino-50 p-8 dark:bg-white/5">
          <MotoIllustration className="w-full" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-marino dark:text-white">{modelo.nombre}</h1>
          <p className="mt-1 text-slate-500">Motocar Bajaj</p>

          <div className="mt-5 rounded-lg bg-marino-50 p-4 text-[14px] text-marino dark:bg-white/5 dark:text-white/80">
            Precio, colores y disponibilidad se confirman con un asesor.
          </div>

          <h2 className="mt-6 text-[17px] font-semibold">Características</h2>
          <dl className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
            {[
              ["Techo", modelo.techo],
              ["Uso", modelo.uso],
              ["Capacidad", modelo.capacidad],
              ["Motor", modelo.motor],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2.5 text-[14px]">
                <dt className="font-semibold">{k}</dt>
                <dd className="text-right text-slate-500">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/#consulta" className="btn btn-primary">Consultar por este modelo</Link>
            <WhatsAppButton mensaje={`Hola, quisiera información sobre el ${modelo.nombre}.`} />
          </div>
        </div>
      </div>
    </div>
  );
}
