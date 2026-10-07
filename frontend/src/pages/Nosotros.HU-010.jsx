import { Link } from "react-router-dom";
import HUBadge from "../components/HUBadge";
import { IconShield, IconMapArea, IconCreditCard, IconDocument } from "../components/Icons";

// Fotos en /public/images/nosotros/socio-1.jpg ... socio-4.jpg, mismo
// patrón que las fotos de modelos: se reemplaza el archivo con el
// mismo nombre y no hay que tocar el código.
const SOCIO = [
  { imagen: "/images/nosotros/socio-1.jpg", stat: "+12 años", statNota: "EN EL MERCADO", titulo: "Respaldo comercial", texto: "Experiencia acompañando la compra y el financiamiento de tu herramienta de trabajo.", Icono: IconShield },
  { imagen: "/images/nosotros/socio-2.jpg", stat: "3 sedes", statNota: "LIMA Y CALLAO", titulo: "Presencia local", texto: "INVERSIONES EPSA MOTOR S.A.C., empresa formal y distribuidor autorizado de Torito Bajaj.", Icono: IconMapArea },
  { imagen: "/images/nosotros/socio-3.jpg", stat: "A tu medida", statNota: "CON UN ASESOR", titulo: "Crédito Directo Flexible", texto: "Opciones de financiamiento que se coordinan directamente con un asesor.", Icono: IconCreditCard },
  { imagen: "/images/nosotros/socio-4.jpg", stat: "Trámite", statNota: "ACOMPAÑADO", titulo: "Placa y Tarjeta de Propiedad", texto: "Acompañamiento en el trámite de documentos de la unidad.", Icono: IconDocument },
];

/**
 * Nosotros.jsx — HU-010 "Ver información de EPSA Motor y sus sedes"
 * -----------------------------------------------------------------
 * Corrige OBS-002: antes esta pantalla repetía las tarjetas de sede
 * que también estaban en Sedes.jsx, con riesgo de quedar
 * desactualizadas una respecto a la otra. Ahora "Quiénes somos" solo
 * cuenta quién es la empresa y enlaza a /sedes para el detalle
 * completo (dirección, horario, mapa), que vive en un solo lugar.
 * -----------------------------------------------------------------
 */
export default function Nosotros() {
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
          <div className="rounded-xl2 bg-white/60 p-8 shadow-card dark:bg-white/5">
            <img src="/images/torito.svg" alt="EPSA Motor" className="w-full" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-xl font-bold text-marino dark:text-white">Quiénes somos</h2>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
          EPSA Motor es distribuidor autorizado de motocars Bajaj, adquiridos a través de
          Crosland Perú S.A.C. Atendemos en tres sedes de Lima Norte y Callao.
        </p>

        <h2 className="mt-10 text-xl font-bold text-marino dark:text-white">Qué ofrecemos</h2>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-400">
          Venta de motocars Bajaj con distintas configuraciones de techo, y orientación sobre
          modelos, sedes y formas de contacto.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4 rounded-xl2 bg-marino-50 p-6 dark:bg-white/5">
          <p className="text-[14.5px] text-marino dark:text-white/80">
            ¿Buscas la dirección, el horario o cómo llegar a una sede?
          </p>
          <Link to="/sedes" className="btn btn-primary">Ver todas las sedes →</Link>
        </div>
      </section>

      {/* Franja oscura, para romper el blanco y resaltar este bloque */}
      <section className="bg-marino py-16 text-white">
        <div className="mx-auto max-w-6xl px-6">
          <span className="text-[12.5px] font-semibold uppercase tracking-wider text-acento">Por qué EPSA Motor</span>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Tu socio en movilidad de trabajo</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {SOCIO.map(({ imagen, stat, statNota, titulo, texto, Icono }) => (
              <div key={titulo} className="overflow-hidden rounded-xl2 bg-white/5">
                <div className="relative aspect-[4/3]">
                  <img src={imagen} alt={titulo} className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-marino">
                    <Icono className="h-5 w-5" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <p className="text-2xl font-bold leading-none">{stat}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/80">{statNota}</p>
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-[14.5px] font-semibold uppercase tracking-wide">{titulo}</h3>
                  <p className="mt-1.5 text-[13px] text-white/70">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
