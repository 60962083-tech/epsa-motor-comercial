import { enlaceGoogleMaps, enlaceMapaEmbebido } from "../data/mockData";
import { useCatalog } from "../store/catalogStore.jsx";
import WhatsAppButton from "../components/WhatsAppButton.HU-013";
import HUBadge from "../components/HUBadge";
import { IconPhone, IconMail } from "../components/Icons";

/**
 * Sedes.jsx — corrige DEF-001 (la ruta "/sedes" no existía y quedaba
 * en blanco) y OBS-002 (sedes duplicadas en "Quiénes somos"; ahora
 * el detalle completo vive solo aquí).
 */
export default function Sedes() {
  const { ubicaciones } = useCatalog();
  const sedes = ubicaciones.filter((u) => u.tipo === "Sede propia" && u.activo);

  return (
    <div className="fade-in">
      <HUBadge code="HU-010" titulo="Sedes y sucursales (corrige DEF-001)" />
      <div className="bg-gradient-to-b from-marino-50 to-white py-14 text-center dark:from-[#0f1830] dark:to-[#0b1220]">
        <span className="text-[12.5px] font-semibold uppercase tracking-wider text-acento">Visítanos</span>
        <h1 className="mt-2 text-3xl font-bold text-marino dark:text-white">Sedes y sucursales</h1>
        <p className="mx-auto mt-2 max-w-md text-slate-500">
          Visítanos para conocer las unidades o escríbenos por WhatsApp si prefieres resolverlo antes de ir.
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sedes.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card dark:border-white/5 dark:bg-[#121a2b]">
            <iframe
              title={`Mapa de ${s.nombre}`}
              src={enlaceMapaEmbebido(s.direccion)}
              className="h-40 w-full border-0 grayscale-[20%]"
              loading="lazy"
            />
            <div className="p-5">
              <span className="inline-block rounded-full bg-marino-50 px-2.5 py-1 text-[11px] font-semibold text-marino-700 dark:bg-white/10 dark:text-white/70">
                SEDE OFICIAL
              </span>
              <h3 className="mt-2 text-[17px] font-semibold text-marino dark:text-white">{s.nombre}</h3>
              <p className="mt-1 text-[13.5px] text-slate-500">{s.direccion}</p>
              <p className="mt-3 text-[13px] font-medium">{s.horario}</p>
              <p className="text-[12.5px] text-slate-400">{s.horarioNota}</p>

              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-[13px] text-slate-500 dark:border-white/10">
                <p className="flex items-center gap-2"><IconPhone className="h-4 w-4" /> +{s.telefono}</p>
                <p className="flex items-center gap-2"><IconMail className="h-4 w-4" /> {s.correo}</p>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={enlaceGoogleMaps(s.direccion)}
                  target="_blank" rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm flex-1"
                >
                  Cómo llegar
                </a>
              </div>
              <WhatsAppButton
                className="mt-2 w-full"
                mensaje={`Hola, quisiera visitar la sede de ${s.nombre}.`}
              />
            </div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
