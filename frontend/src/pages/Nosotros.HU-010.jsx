// HU-010 · Quiénes somos
// La empresa: quién es EPSA Motor (datos legales y autorización), cifras, qué ofrece, sus sedes (vienen de
// la API), por qué elegirla y la marca que representa. Sin datos inventados: todo sale de la empresa o de la base.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import ModeloImg from "../components/ModeloImg";
import ImgReal from "../components/ImgReal";
import { IconWhatsapp, IconPhone, IconMail, IconPin, IconShield, IconCreditCard, IconDocument, IconMapArea, IconFlecha } from "../components/Icons";
import { WHATSAPP_NUMERO } from "../lib/config";
import { EVENTOS_TORITO, enlaceGoogleMaps } from "../data/mockData";

// ---------------------------------------------------------------------------------------------
// Datos de la empresa
// ---------------------------------------------------------------------------------------------
const EMPRESA = [
  ["Razón social", "INVERSIONES EPSA MOTOR S.A.C."],
  ["RUC", "20555595469"],
  ["Autorización", "Distribuidor autorizado de motocars Bajaj, a través de Crosland Perú S.A.C."],
  ["Atendemos en", "Lima Norte y el Callao"],
];
const CORREO = "inversionesepsamotor@gmail.com";
const TELEFONO = `+${WHATSAPP_NUMERO.slice(0, 2)} ${WHATSAPP_NUMERO.slice(2).replace(/(\d{3})(?=\d)/g, "$1 ")}`;

// Qué ofrecemos
const OFRECEMOS = [
  ["Venta de motocars Torito", "Toda la línea a gasolina, GLP y GNV, con distintas configuraciones de techo."],
  ["Crédito directo", "Evaluamos tu crédito con tu DNI y un recibo de servicios, con cuotas a tu medida."],
  ["Placa y tarjeta de propiedad", "Hacemos el trámite ante Sunarp con la compra de tu Torito nuevo."],
  ["Orientación", "Te ayudamos a elegir modelo, techo y sede, y resolvemos tus dudas por WhatsApp."],
];

// Tu socio en movilidad de trabajo: las cuatro razones, cada una con su foto
const SOCIO = [
  { imagen: "/images/nosotros/socio-respaldo.webp", stat: "+12 años", statNota: "en el mercado", titulo: "Respaldo comercial", texto: "Experiencia acompañando la compra y el financiamiento de tu herramienta de trabajo.", Icono: IconShield },
  { imagen: "/images/nosotros/socio-presencia.webp", stat: "20555595469", statNota: "RUC EPSA Motor", titulo: "Presencia local", texto: "INVERSIONES EPSA MOTOR S.A.C., empresa formal y distribuidor autorizado de Torito Bajaj.", Icono: IconMapArea },
  { imagen: "/images/nosotros/socio-credito.webp", stat: "A tu medida", statNota: "cuotas flexibles", titulo: "Crédito directo flexible", texto: "Evaluamos tu historial crediticio con tu DNI y un recibo de servicios. Diseñamos cuotas a tu medida para facilitar el pago progresivo.", Icono: IconCreditCard },
  { imagen: "/images/nosotros/socio-placa.webp", stat: "Gratis", statNota: "placa y tarjeta", titulo: "Placa y tarjeta de propiedad", texto: "Gestionamos ante Sunarp el registro de placa y la tarjeta de propiedad, de manera gratuita y veloz, con la compra de tu mototaxi nuevo.", Icono: IconDocument },
];

export default function Nosotros() {
  const { sedes, publicos } = useApp();
  const cotizar = useCotizar();
  // Moto de la credencial: la más nueva de la línea o la primera publicada
  const destacado = publicos.find((m) => (m.badges || []).some((b) => b.startsWith("NUEVO"))) || publicos[0];
  const cifras = [
    ["+12", "años en el mercado"],
    sedes.length ? [String(sedes.length), sedes.length === 1 ? "sede en Lima y Callao" : "sedes en Lima y Callao"] : null,
    publicos.length ? [String(publicos.length), "modelos Torito"] : null,
    ["100", "países con Bajaj"],
  ].filter(Boolean);

  return (
    <div className="fade-in">
      {/* ------------------------------------------------------------------------------------- */}
      {/* Presentación: lema y credencial de la empresa                                         */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-marino text-white">
        <div className="pointer-events-none absolute -left-32 -top-40 h-[480px] w-[480px] rounded-full bg-white/5" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-48 right-[-6%] h-[520px] w-[520px] rounded-full bg-acento/20 blur-2xl" aria-hidden="true" />
        <div className="wrap relative grid items-center gap-12 pb-24 pt-14 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-20">
          <div>
            <p className="text-[15px] font-medium text-white/60">Quiénes somos</p>
            <h1 className="mt-3 font-display text-[3.4rem] font-bold uppercase leading-[0.9] tracking-tight sm:text-[4.5rem] lg:text-[5.5rem]">
              Rinde más <span className="block text-acento">Gasta menos</span>
            </h1>
            <p className="mt-5 max-w-lg text-[16px] leading-relaxed text-white/75">
              Distribuidor oficial autorizado de motocars Torito Bajaj. Con más de 12 años en el mercado ofreciendo venta y financiamiento en Lima Norte y el Callao.
            </p>
            <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
              <button onClick={() => cotizar()} className="btn btn-acento">Cotizar mi Torito</button>
              <a className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera información de EPSA Motor.")}`}><IconWhatsapp /> Escríbenos</a>
            </div>
          </div>

          {/* Credencial: datos legales y la moto más nueva */}
          <div className="relative lg:pr-6" data-credencial>
            <div className="relative rounded-[26px] bg-white/[0.06] p-6 ring-1 ring-white/15 backdrop-blur-sm sm:p-8">
              <img src="/images/logo-epsa-marcas.svg" alt="EPSA Motor, distribuidor autorizado Torito Bajaj" className="h-auto w-full max-w-[340px]" />
              <dl className="mt-7 divide-y divide-white/10 border-t border-white/10">
                {EMPRESA.map(([k, v]) => (
                  <div key={k} className="grid gap-1 py-3 sm:grid-cols-[8.5rem_1fr] sm:gap-4">
                    <dt className="text-[13px] text-white/50">{k}</dt>
                    <dd className={`text-[14.5px] font-medium text-white ${k === "RUC" ? "cifra tracking-wide" : ""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              {destacado && <div className="h-20 sm:h-24" aria-hidden="true" />}
            </div>
            {destacado && (
              <Link to={`/modelos/${destacado.id}`} className="group absolute -bottom-12 right-0 block w-[62%] max-w-[340px] sm:-bottom-14" aria-label={`Ver ${destacado.nombre}`} data-destacado>
                <span className="absolute inset-x-[12%] bottom-2 h-6 rounded-[50%] bg-black/45 blur-xl" aria-hidden="true" />
                <ModeloImg modelo={destacado} className="relative h-auto w-full object-contain drop-shadow-[0_24px_30px_rgba(0,0,0,.45)] transition duration-500 group-hover:-translate-y-1" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Cifras                                                                                */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="wrap relative z-10 -mt-10">
        <div className={`grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-slate-200 shadow-cardHover dark:bg-white/10 ${cifras.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
          {cifras.map(([n, l]) => (
            <div key={l} className="bg-white p-6 text-center dark:bg-[#101c33]"><p className="cifra font-display text-[2.6rem] font-bold leading-none text-marino dark:text-white">{n}</p><p className="mt-2 text-[13px] text-slate-500">{l}</p></div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Quiénes somos y qué ofrecemos, con las sedes y el contacto                            */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="wrap grid gap-12 py-16 lg:grid-cols-[1.2fr_1fr] lg:gap-16 lg:py-20">
        <div>
          <h2 className="titulo">Una empresa formal, cerca de tu ruta</h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">INVERSIONES EPSA MOTOR S.A.C. es distribuidor autorizado de motocars Bajaj, adquiridos a través de Crosland Perú S.A.C. Acompañamos a quienes trabajan con su Torito desde que eligen el modelo hasta que salen a la calle con su placa.</p>
          <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {OFRECEMOS.map(([t, d]) => (
              <li key={t} className="border-l-2 border-acento pl-4">
                <h3 className="text-[16px] font-semibold text-marino dark:text-white">{t}</h3>
                <p className="mt-1 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">{d}</p>
              </li>
            ))}
          </ul>
          <div className="mt-9 grid gap-3 sm:flex sm:flex-wrap">
            <Link to="/modelos" className="btn btn-primary">Ver modelos</Link>
            <Link to="/sedes" className="btn btn-secondary">Ver sedes y horarios</Link>
          </div>
        </div>

        <div className="lg:pt-2">
          {sedes.length > 0 && (
            <>
              <h3 className="text-[15px] font-semibold text-marino dark:text-white">Nuestras sedes</h3>
              <ul className="mt-4 grid gap-3">
                {sedes.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101c33]">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marino text-white"><IconPin className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-marino dark:text-white">Sede {s.nombre}</p>
                      {s.direccion && <p className="text-[13.5px] text-slate-500">{s.direccion}</p>}
                      {s.horario && <p className="text-[12.5px] text-slate-400">{s.horario}</p>}
                    </div>
                    {s.direccion && <a href={enlaceGoogleMaps(s.direccion)} target="_blank" rel="noopener noreferrer" className="shrink-0 self-center rounded-full px-3 py-1.5 text-[13px] font-semibold text-marino ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-white dark:ring-white/15 dark:hover:bg-white/5">Mapa</a>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className={`flex flex-wrap gap-x-6 gap-y-2 px-1 text-[13.5px] text-slate-500 ${sedes.length ? "mt-4" : ""}`}>
            <span className="flex items-center gap-2"><IconPhone className="h-4 w-4" /> {TELEFONO}</span>
            <span className="flex items-center gap-2 break-all"><IconMail className="h-4 w-4 shrink-0" /> {CORREO}</span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Tu socio en movilidad de trabajo: cuatro razones con foto                             */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="bg-marino py-16 text-white lg:py-20">
        <div className="wrap">
          <h2 className="font-display text-[2.4rem] font-bold uppercase leading-none tracking-tight sm:text-[3rem]">Tu socio en movilidad de trabajo</h2>
          <p className="mt-3 max-w-2xl text-[15px] text-white/65">Confianza que se demuestra: más de una década acompañando a quienes trabajan con su Torito.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2" data-socio>
            {SOCIO.map(({ imagen, stat, statNota, titulo, texto, Icono }) => (
              <article key={titulo} className="group flex flex-col overflow-hidden rounded-2xl bg-white text-marino shadow-xl shadow-black/20 ring-1 ring-white/10 dark:bg-[#101c33] dark:text-white">
                <div className="relative overflow-hidden">
                  <img src={imagen} alt={titulo} loading="lazy" className="aspect-[16/9] w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-marino/90 via-marino/10 to-transparent" aria-hidden="true" />
                  <span className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-marino/80 text-white ring-1 ring-white/20 backdrop-blur"><Icono className="h-[18px] w-[18px]" /></span>
                  <p className="absolute bottom-3 left-4 flex flex-wrap items-baseline gap-x-2 text-white">
                    <span className="cifra font-display text-[2rem] font-bold leading-none sm:text-[2.3rem]">{stat}</span>
                    <span className="text-[13px] font-medium text-white/80">{statNota}</span>
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <h3 className="text-[17px] font-bold">{titulo}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-slate-600 dark:text-white/65">{texto}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* La marca que representamos (fotos de eventos publicadas en torito.pe)                 */}
      {/* ------------------------------------------------------------------------------------- */}
      <MarcaTorito />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Torito Bajaj en el Perú: galería de eventos de la marca. Si una foto no carga se quita de la galería,
// y si quedan menos de tres, la sección no se muestra.
// ---------------------------------------------------------------------------------------------
function AvisarFallo({ alFallar }) {
  useEffect(() => { alFallar(); }, [alFallar]);
  return null;
}

function Evento({ e, grande, alFallar }) {
  return (
    <li className={`group relative overflow-hidden rounded-2xl bg-escenario dark:bg-escenario-oscuro ${grande ? "col-span-2 aspect-[16/10] lg:row-span-2 lg:aspect-auto" : "aspect-[4/3] lg:aspect-auto"}`}>
      <ImgReal src={e.foto} alt={e.titulo} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]" alternativa={<AvisarFallo alFallar={alFallar} />} />
      <p className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-marino/90 to-transparent font-semibold leading-snug text-white ${grande ? "px-4 pb-3 pt-12 text-[14.5px]" : "px-3 pb-2.5 pt-10 text-[12.5px] sm:text-[13.5px]"}`}>{e.titulo}</p>
    </li>
  );
}

function MarcaTorito() {
  const [fallidas, setFallidas] = useState([]);
  const quitar = useCallback((foto) => setFallidas((f) => (f.includes(foto) ? f : [...f, foto])), []);
  const visibles = EVENTOS_TORITO.filter((e) => !fallidas.includes(e.foto)).slice(0, 5);
  if (visibles.length < 3) return null;
  const [principal, ...resto] = visibles;
  return (
    <section className="wrap py-16 lg:py-24" aria-labelledby="nosotros-marca">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr] lg:gap-14">
        <div className="lg:self-center">
          <h2 id="nosotros-marca" className="titulo">La marca que representamos</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">Torito Bajaj llega al Perú a través de Crosland, y EPSA Motor es parte de su red de distribuidores autorizados. Estas son actividades de la marca con conductores y vendedores de todo el país.</p>
          <a href="https://torito.pe/" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1.5 text-[15px] font-semibold text-marino underline-offset-4 hover:underline dark:text-white">Conoce Torito Bajaj <IconFlecha className="h-4 w-4" /></a>
          <p className="mt-6 text-[12.5px] text-slate-400">Fotos: torito.pe</p>
        </div>
        <ul className={`grid grid-cols-2 gap-3 sm:gap-4 lg:h-[520px] lg:grid-rows-2 ${resto.length > 2 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`} data-eventos>
          <Evento e={principal} grande alFallar={() => quitar(principal.foto)} />
          {resto.map((e) => <Evento key={e.foto} e={e} alFallar={() => quitar(e.foto)} />)}
        </ul>
      </div>
    </section>
  );
}
