import ImgReal from "../components/ImgReal";
import MotoIllustration from "../components/MotoIllustration";
import { Link } from "react-router-dom";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import { IconWhatsapp, IconPhone, IconMail, IconPin } from "../components/Icons";
import { WHATSAPP_NUMERO } from "../lib/config";
import { IconShield, IconMapArea, IconCreditCard, IconDocument } from "../components/Icons";

// Fotos de la web de EPSA Motor (el polo del asesor se ajustó al azul marino y al logo de esta web).
const SOCIO = [
  { imagen: "/images/nosotros/socio-respaldo.webp", stat: "+12 años", statNota: "EN EL MERCADO", titulo: "Respaldo comercial", texto: "Experiencia acompañando la compra y el financiamiento de tu herramienta de trabajo.", Icono: IconShield },
  { imagen: "/images/nosotros/socio-presencia.webp", stat: "20555595469", statNota: "RUC EPSA MOTOR", titulo: "Presencia local", texto: "INVERSIONES EPSA MOTOR S.A.C., empresa formal y distribuidor autorizado de Torito Bajaj.", Icono: IconMapArea },
  { imagen: "/images/nosotros/socio-credito.webp", stat: "A tu medida", statNota: "CUOTAS FLEXIBLES", titulo: "Crédito directo flexible", texto: "Evaluamos tu historial crediticio con tu DNI y un recibo de servicios. Diseñamos cuotas a tu medida para facilitar el pago progresivo.", Icono: IconCreditCard },
  { imagen: "/images/nosotros/socio-placa.webp", stat: "Gratis", statNota: "PLACA Y TARJETA", titulo: "Placa y tarjeta de propiedad", texto: "Gestionamos ante Sunarp el registro de placa y la tarjeta de propiedad, de manera gratuita y veloz, con la compra de tu mototaxi nuevo.", Icono: IconDocument },
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
  const { sedes, publicos } = useApp();
  const cotizar = useCotizar();
  return (
    <div className="fade-in">

      {/* Hero con el estilo de la web principal de EPSA Motor */}
      <section className="relative overflow-hidden bg-marino text-white">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-48 right-[-6%] h-[520px] w-[520px] rounded-full bg-acento/20" />
        <div className="wrap relative grid items-center gap-10 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="text-[15px] font-medium text-white/60">Quiénes somos</p>
            <h1 className="mt-3 font-display text-[3.4rem] font-bold uppercase leading-[0.9] tracking-tight sm:text-[4.5rem] lg:text-[5.5rem]">
              Rinde más <span className="block text-acento">Gasta menos</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] text-white/75">
              Distribuidor oficial autorizado de motocars Torito Bajaj. Con más de 12 años en el mercado ofreciendo venta y financiamiento en Lima Norte y el Callao.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <button onClick={() => cotizar()} className="btn btn-acento">Evaluar mi crédito en 1 minuto</button>
              <a className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera cotizar un Torito.")}`}><IconWhatsapp /> Cotizar por WhatsApp</a>
            </div>
          </div>
          <div className="rounded-3xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <ImgReal src="https://epsamotor.com.pe/assets/media/images/RE_torito.png" local="/images/nosotros/torito.png" alt="Torito Bajaj" className="mx-auto w-full max-w-md" alternativa={<MotoIllustration className="mx-auto w-full max-w-sm opacity-80" />} />
            <p className="mt-3 text-center text-[13.5px] font-medium text-white/60">Bajaj, la favorita en 100 países</p>
          </div>
        </div>
      </section>

      {/* Cifras */}
      <section className="wrap -mt-8 relative z-10">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 shadow-cardHover dark:bg-white/10 md:grid-cols-4">
          {[["+12", "años en el mercado"], [String(sedes.length), "sedes en Lima y Callao"], [String(publicos.length), "modelos Torito"], ["100", "países con Bajaj"]].map(([n, l]) => (
            <div key={l} className="bg-white p-6 text-center dark:bg-[#101c33]"><p className="cifra font-display text-[2.6rem] font-bold leading-none text-marino dark:text-white">{n}</p><p className="mt-2 text-[13px] text-slate-500">{l}</p></div>
          ))}
        </div>
      </section>

      <section className="wrap grid gap-10 py-14 lg:grid-cols-2">
        <div>
          <h2 className="titulo">Quiénes somos</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">INVERSIONES EPSA MOTOR S.A.C. es distribuidor autorizado de motocars Bajaj, adquiridos a través de Crosland Perú S.A.C. Atendemos en tres sedes de Lima Norte y Callao.</p>
          <h2 className="titulo mt-10">Qué ofrecemos</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">Venta de motocars Torito con distintas configuraciones de techo, financiamiento directo, acompañamiento en placa y tarjeta de propiedad, y orientación sobre modelos, sedes y formas de contacto.</p>
          <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
            <Link to="/modelos" className="btn btn-primary">Ver modelos</Link>
            <Link to="/sedes" className="btn btn-secondary">Ver todas las sedes</Link>
          </div>
        </div>
        <div className="grid gap-3">
          {sedes.map((s) => (
            <div key={s.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101c33]">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marino text-white"><IconPin /></span>
              <div><p className="font-bold text-marino dark:text-white">{s.nombre}</p><p className="text-[13px] text-slate-500">{s.direccion}</p><p className="text-[12.5px] text-slate-400">{s.horario}</p></div>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-[13px] text-slate-500">
            <span className="flex items-center gap-2"><IconPhone className="h-4 w-4" /> +51 907 721 481</span>
            <span className="flex items-center gap-2"><IconMail className="h-4 w-4" /> inversionesepsamotor@gmail.com</span>
          </div>
        </div>
      </section>

      {/* Por qué EPSA Motor */}
      <section className="bg-marino py-16 text-white lg:py-20">
        <div className="wrap">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-white/50">Por qué EPSA Motor</p>
          <h2 className="mt-2 font-display text-[2.4rem] font-bold uppercase leading-none tracking-tight sm:text-[3rem]">Tu socio en movilidad de trabajo</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-white/65">Confianza que se demuestra: más de una década acompañando a quienes trabajan con su Torito.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {SOCIO.map(({ imagen, stat, statNota, titulo, texto, Icono }) => (
              <article key={titulo} className="group flex flex-col overflow-hidden rounded-2xl bg-white text-marino shadow-xl shadow-black/20 ring-1 ring-white/10 dark:bg-[#101c33] dark:text-white">
                <div className="relative overflow-hidden">
                  <img src={imagen} alt={titulo} loading="lazy" className="aspect-[16/9] w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-marino/90 via-marino/10 to-transparent" />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-marino/80 text-white ring-1 ring-white/20 backdrop-blur"><Icono className="h-[18px] w-[18px]" /></span>
                  <p className="absolute bottom-3 left-4 flex flex-wrap items-baseline gap-x-2 text-white">
                    <span className="font-display text-[2rem] font-bold leading-none sm:text-[2.3rem]">{stat}</span>
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/80">{statNota}</span>
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-[15px] font-bold uppercase tracking-[0.06em]">{titulo}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-slate-600 dark:text-white/65">{texto}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
