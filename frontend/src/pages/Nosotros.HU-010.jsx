import { UBICACIONES } from "../data/mockData";
import MotoIllustration from "../components/MotoIllustration";
import WhatsAppButton from "../components/WhatsAppButton.HU-013";
import { IconPin } from "../components/Icons";
import HUBadge from "../components/HUBadge";

/**
 * Nosotros.jsx — HU-010 "Ver información de EPSA Motor y sus sedes"
 * -----------------------------------------------------------------
 * Sección institucional corta + tarjetas de sedes. Solo se listan
 * las ubicaciones con tipo "Sede propia" (los almacenes/proveedores
 * de HU-026 son información interna, no van aquí).
 * Las tarjetas se apilan en 1 columna en celular y pasan a 3 en
 * pantallas grandes (mobile-first, como pide la historia).
 * -----------------------------------------------------------------
 */
export default function Nosotros() {
  const sedes = UBICACIONES.filter((u) => u.tipo === "Sede propia" && u.activo);

  return (
    <div className="fade-in">
      <HUBadge code="HU-010" titulo="Información de EPSA Motor y sus sedes" />
      <section className="bg-gradient-to-b from-marino-50 to-white dark:from-[#0f1830] dark:to-[#0b1220]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold text-marino dark:text-white md:text-4xl">
              Distribuidor autorizado Bajaj
            </h1>
            <p className="mt-3 max-w-md text-slate-600 dark:text-slate-400">
              Más de 12 años en el mercado ofreciendo motocars en Lima Norte y Callao.
            </p>
          </div>
          <div className="rounded-xl2 bg-white/60 p-6 shadow-card dark:bg-white/5">
            <MotoIllustration className="w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-xl font-bold text-marino dark:text-white">Quiénes somos</h2>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
          EPSA Motor es distribuidor autorizado de motocars Bajaj, adquiridos a través de
          Crosland Perú S.A.C. Atendemos en tres sedes de Lima Norte y Callao.
        </p>

        <h2 className="mt-10 text-xl font-bold text-marino dark:text-white">Dónde atendemos</h2>
        {/* grid-cols-1 por defecto (375px y en general móvil) → sm:grid-cols-2 → lg:grid-cols-3 */}
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sedes.map((s) => (
            <div key={s.id} className="rounded-xl2 border border-slate-100 bg-white p-5 shadow-card dark:border-white/5 dark:bg-[#121a2b]">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-marino dark:text-white">
                <IconPin /> Sede {s.nombre}
              </h3>
              <p className="mt-2 text-[13.5px] text-slate-500">{s.direccion}</p>
              <p className="mt-1 text-[12.5px] text-slate-400">Horario: por confirmar</p>
              <WhatsAppButton className="mt-4 w-full" />
            </div>
          ))}
        </div>

        <p className="mt-6 text-[12.5px] text-slate-400">
          Los datos de contacto y las características comerciales mostradas están sujetos a
          confirmación de EPSA Motor.
        </p>
      </section>
    </div>
  );
}
