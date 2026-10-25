// Inicio de la web
// Carrusel de modelos, por qué comprar en EPSA (con fotos reales), catálogo por familia, vitrina de colores,
// combustibles, cómo comprar, sedes y opiniones. Modelos y sedes vienen de la API (se editan en el panel).
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import Carousel from "../components/Carousel";
import { TarjetaModelo } from "./Modelos.HU-008";
import { IconFlecha, IconPin } from "../components/Icons";
import { FAMILIAS, COLOR_HEX, FOTOS_FAMILIA, enlaceGoogleMaps, formatoSoles } from "../data/mockData";
import ModeloImg, { fotoDeColor } from "../components/ModeloImg";
import MotoIllustration from "../components/MotoIllustration";
import ImgReal from "../components/ImgReal";
import Opiniones from "../components/Opiniones";

// ---------------------------------------------------------------------------------------------
// Contenido fijo de la página
// ---------------------------------------------------------------------------------------------
// Carrusel: modelo y frase tomada de su ficha oficial
const SLIDES = [
  { modeloId: "torito-250-4v-glp", etiqueta: "Nuevo modelo", texto: "Llantas aro 10, suspensión delantera doble y el ahorro del GLP para rendir más y gastar menos." },
  { modeloId: "torito-4v-gnv", etiqueta: "Nueva generación", texto: "Gas natural con encendido instantáneo, retroceso en el manubrio y triple filtrado de aceite." },
  { modeloId: "torito-crom-plus-gsl", etiqueta: "Familia Crom Plus", texto: "10.19 HP y 17.10 Nm: el Crom Plus más potente para el trabajo de todos los días." },
  { modeloId: "torito-2t-ug-gsl", etiqueta: "Para empezar a trabajar", texto: "El Torito más accesible de la línea, con mantenimiento sencillo." },
];

// Por qué comprar en EPSA Motor: cada punto con una foto real del equipo y sus clientes
const VENTAJAS = [
  { foto: "/images/nosotros/socio-respaldo.webp", alt: "Asesor de EPSA Motor junto a varios Torito en la sede", t: "Distribuidor oficial", d: "Autorizados por Bajaj y Crosland Perú S.A.C." },
  { foto: "/images/nosotros/socio-credito.webp", alt: "Cliente firmando su crédito directo con una asesora", t: "Crédito directo", d: "Financiamos tu Torito con cuotas a tu medida." },
  { foto: "/images/nosotros/socio-placa.webp", alt: "Placa de un Torito nuevo lista para la entrega", t: "Trámite acompañado", d: "Te ayudamos con la placa y la tarjeta de propiedad." },
  { foto: "/images/nosotros/socio-presencia.webp", alt: "Asesor de EPSA Motor saludando a un cliente", t: "Cerca de ti", d: "Sedes en Lima Norte y el Callao." },
];

// Cómo comprar (es una secuencia real, por eso va numerada)
const PASOS = [
  ["Elige tu modelo", "Compara motores, combustible y precios en el catálogo."],
  ["Cotiza en línea", "Arma tu cotización y envíala por WhatsApp; un asesor de tu sede te responde."],
  ["Visita tu sede", "Mira la unidad, elige color y techo, y evaluamos tu crédito."],
  ["Llévatelo", "Te acompañamos con la placa y la tarjeta de propiedad hasta la entrega."],
];

// Elige por combustible: foto de la familia (torito.pe); si no carga, la del modelo de referencia
const COMBUSTIBLES = [
  { id: "GLP", titulo: "GLP", texto: "El ahorro del GLP para rendir más y gastar menos en cada jornada.", foto: FOTOS_FAMILIA.torito250, modelo: "torito-250-4v-glp" },
  { id: "GNV", titulo: "Gas natural", texto: "GNV con encendido instantáneo, retroceso en el manubrio y triple filtrado de aceite.", foto: FOTOS_FAMILIA.cuatroValvulas, modelo: "torito-4v-gnv" },
  { id: "Gasolina", titulo: "Gasolina", texto: "La opción más accesible de la línea, con un mantenimiento sencillo.", foto: FOTOS_FAMILIA.dosTiempos, modelo: "torito-2t-ug-gsl" },
];

export default function Home() {
  const { publicos, sedes } = useApp();
  const multicolor = publicos.find((m) => (m.colores || []).length > 1);
  const [colorVitrina, setColorVitrina] = useState("");
  const cotizar = useCotizar();
  const [familia, setFamilia] = useState("Todas");
  const slides = SLIDES.map((x) => ({ ...x, modelo: publicos.find((m) => m.id === x.modeloId) })).filter((x) => x.modelo);
  const lista = publicos.filter((m) => familia === "Todas" || m.familia === familia).slice(0, 8);

  return (
    <div className="fade-in">
      {/* ------------------------------------------------------------------------------------- */}
      {/* Carrusel                                                                              */}
      {/* ------------------------------------------------------------------------------------- */}
      {slides.length > 0 && <Carousel slides={slides} onCotizar={(modeloId) => cotizar({ modeloId })} />}

      {/* ------------------------------------------------------------------------------------- */}
      {/* Por qué EPSA Motor: cuatro fotos reales                                               */}
      {/* ------------------------------------------------------------------------------------- */}
      <section aria-label="Por qué comprar en EPSA Motor" className={`wrap relative z-10 ${slides.length ? "-mt-6 sm:-mt-10" : "pt-10"}`}>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {VENTAJAS.map(({ foto, alt, t, d }) => (
            <li key={t} className="group overflow-hidden rounded-2xl bg-white shadow-cardHover ring-1 ring-black/[0.04] dark:bg-[#101c33] dark:ring-white/10" data-ventaja={t}>
              <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/10]">
                <img src={foto} alt={alt} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-marino/90 via-marino/15 to-transparent" aria-hidden="true" />
                <p className="absolute inset-x-3 bottom-2.5 font-display text-[1.2rem] font-bold uppercase leading-[1.05] text-white sm:inset-x-4 sm:bottom-3 sm:text-[1.5rem]">{t}</p>
              </div>
              <p className="px-3 py-3 text-[13px] leading-snug text-slate-600 sm:px-4 sm:text-[14px] dark:text-slate-300">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Catálogo por familia                                                                  */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="wrap py-16 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="titulo">Elige tu Torito</h2>
            <p className="bajada mt-3">{publicos.length ? `${publicos.length} modelos oficiales` : "Modelos oficiales"} con garantía y crédito directo.</p>
          </div>
          <Link to="/modelos" className="text-[15px] font-semibold text-marino underline-offset-4 hover:underline dark:text-white">Ver catálogo completo</Link>
        </div>
        <div className="no-scrollbar -mx-4 mt-8 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Familias">
          {["Todas", ...FAMILIAS].map((f) => (
            <button key={f} role="tab" aria-selected={familia === f} onClick={() => setFamilia(f)}
              className={`shrink-0 rounded-full border px-5 py-2.5 text-[14px] font-semibold transition ${familia === f ? "border-marino bg-marino text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-300 text-slate-600 hover:border-marino-700 hover:text-marino dark:border-white/15 dark:text-white/80"}`}>
              {f === "Todas" ? "Todos" : f}
            </button>
          ))}
        </div>
        {lista.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-slate-300 py-12 text-center text-slate-500 dark:border-white/15">Por ahora no hay modelos publicados en esta familia. Escríbenos por WhatsApp.</p>
        ) : (
          <div className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lista.map((m) => <TarjetaModelo key={m.id} m={m} colores={false} />)}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Vitrina de colores (el primer modelo publicado con más de un color)                    */}
      {/* ------------------------------------------------------------------------------------- */}
      {multicolor && (() => { const c = colorVitrina || multicolor.colores[0]; return (
        <section className="relative overflow-hidden bg-marino text-white">
          <div className="pointer-events-none absolute -right-32 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full opacity-25 blur-3xl transition-colors duration-700" style={{ background: COLOR_HEX[c] }} aria-hidden="true" />
          <div className="wrap relative grid items-center gap-8 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-20">
            <div>
              <h2 className="font-display text-[2.4rem] font-bold uppercase leading-[0.95] tracking-tight sm:text-[3.2rem]">{multicolor.nombre} en {multicolor.colores.length} colores</h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/70">Elige el color que va con tu negocio. Mira cómo queda antes de cotizar.</p>
              <div className="mt-7 flex flex-wrap gap-3" role="radiogroup" aria-label="Color de la vitrina">
                {multicolor.colores.map((x) => (
                  <button key={x} role="radio" aria-checked={c === x} onClick={() => setColorVitrina(x)} className={`group flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-[14px] font-semibold ring-1 transition ${c === x ? "bg-white text-marino ring-white" : "bg-white/5 text-white/80 ring-white/20 hover:bg-white/10"}`}>
                    <span className="h-7 w-7 rounded-full ring-2 ring-white/80" style={{ background: COLOR_HEX[x] }} />{x}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button onClick={() => cotizar({ modeloId: multicolor.id, color: c })} className="btn btn-acento">Cotizar en {c.toLowerCase()}</button>
                <Link to={`/modelos/${multicolor.id}`} className="text-[15px] font-semibold text-white/85 underline-offset-4 hover:underline">Ver ficha, desde {formatoSoles(multicolor.precioDesde)}</Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-x-[14%] bottom-[6%] h-[12%] rounded-[50%] bg-black/45 blur-2xl" aria-hidden="true" />
              <ModeloImg key={c} modelo={multicolor} color={c} className="relative mx-auto max-h-[380px] w-full animate-[entrar_.6s_ease_both] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,.4)]" />
            </div>
          </div>
        </section>
      ); })()}

      {/* ------------------------------------------------------------------------------------- */}
      {/* Elige por combustible                                                                 */}
      {/* ------------------------------------------------------------------------------------- */}
      <PorCombustible publicos={publicos} />

      {/* ------------------------------------------------------------------------------------- */}
      {/* Cómo comprar                                                                          */}
      {/* ------------------------------------------------------------------------------------- */}
      <section className="wrap pb-16 lg:pb-24">
        <div className="rounded-[28px] bg-escenario px-6 py-12 dark:bg-escenario-oscuro sm:px-10 lg:px-14 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="titulo">Tu Torito en 4 pasos</h2>
            <button onClick={() => cotizar()} className="btn btn-acento">Empezar mi cotización <IconFlecha className="h-[18px] w-[18px]" /></button>
          </div>
          <ol className="mt-12 grid gap-9 lg:grid-cols-4 lg:gap-8">
            {PASOS.map(([t, d], i) => (
              <li key={t} className="relative flex gap-5 lg:block">
                {i < PASOS.length - 1 && (
                  <>
                    <span aria-hidden="true" className="absolute -bottom-7 left-5 top-12 w-px bg-slate-300 dark:bg-white/15 lg:hidden" />
                    <span aria-hidden="true" className="absolute -right-5 left-[3.25rem] top-5 hidden h-px bg-slate-300 dark:bg-white/15 lg:block" />
                  </>
                )}
                <span className="cifra grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marino font-display text-[19px] font-bold text-white dark:bg-white dark:text-marino">{i + 1}</span>
                <div className="pt-1.5 lg:pt-0">
                  <h3 className="text-[17px] font-semibold text-marino dark:text-white lg:mt-6">{t}</h3>
                  <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-slate-600 dark:text-slate-300">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------------------------- */}
      {/* Sedes (vienen de la API; se administran en el panel, Ubicaciones)                     */}
      {/* ------------------------------------------------------------------------------------- */}
      {sedes.length > 0 && <NuestrasSedes sedes={sedes} />}

      {/* ------------------------------------------------------------------------------------- */}
      {/* Opiniones de clientes (solo aparece si hay opiniones publicadas)                       */}
      {/* ------------------------------------------------------------------------------------- */}
      <Opiniones />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tres combustibles con la foto de su familia; cada tarjeta lleva al catálogo ya filtrado
// ---------------------------------------------------------------------------------------------
const FOTO_COMBUSTIBLE = "absolute inset-x-6 bottom-3 top-16 h-[calc(100%-4.75rem)] w-[calc(100%-3rem)] object-contain transition duration-500 group-hover:scale-[1.05]";
function PorCombustible({ publicos }) {
  const grupos = COMBUSTIBLES.map((c) => {
    const modelos = publicos.filter((m) => m.combustible === c.id);
    const precios = modelos.map((m) => m.precioDesde).filter(Boolean);
    const referencia = publicos.find((m) => m.id === c.modelo) || modelos[0];
    return { ...c, n: modelos.length, desde: precios.length ? Math.min(...precios) : null, respaldo: referencia ? fotoDeColor(referencia).src : "" };
  }).filter((c) => c.n > 0);
  if (grupos.length < 2) return null;
  return (
    <section className="wrap py-16 lg:py-24" aria-labelledby="home-combustible">
      <div className="max-w-2xl">
        <h2 id="home-combustible" className="titulo">El Torito que conviene a tu ruta</h2>
        <p className="bajada mt-3">GLP, gas natural o gasolina: mira los modelos de cada uno y desde cuánto empiezas.</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {grupos.map((c) => (
          <Link key={c.id} to={`/modelos?combustible=${encodeURIComponent(c.id)}`} className="group relative flex flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white transition hover:-translate-y-1 hover:shadow-cardHover dark:border-white/10 dark:bg-[#101c33]" data-combustible={c.id}>
            <div className="relative h-56 overflow-hidden bg-gradient-to-br from-escenario via-white to-escenario dark:from-escenario-oscuro dark:via-[#132443] dark:to-escenario-oscuro">
              <span className="absolute left-5 top-5 z-10 max-w-[70%] font-display text-[2.2rem] font-bold uppercase leading-none tracking-tight text-marino/90 sm:text-[2.6rem] md:text-[2.2rem] lg:text-[2.6rem] dark:text-white/90">{c.titulo}</span>
              <span className="absolute right-5 top-6 z-10 rounded-full bg-white/90 px-3 py-1 text-[12px] font-semibold text-marino shadow-sm dark:bg-white/10 dark:text-white">{c.n} {c.n === 1 ? "modelo" : "modelos"}</span>
              <div className="absolute inset-x-[16%] bottom-5 h-5 rounded-[50%] bg-marino/15 blur-md dark:bg-black/40" aria-hidden="true" />
              <ImgReal src={c.foto} local={c.respaldo} alt={`Torito a ${c.titulo.toLowerCase()}`} className={FOTO_COMBUSTIBLE} alternativa={<MotoIllustration className={`${FOTO_COMBUSTIBLE} p-6 opacity-30`} />} />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-300">{c.texto}</p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
                {c.desde ? <span><span className="block text-[12px] text-slate-500">Desde</span><span className="cifra font-display text-[1.6rem] font-bold leading-none text-marino dark:text-white">{formatoSoles(c.desde)}</span></span> : <span />}
                <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-acento dark:text-red-300">Ver modelos <IconFlecha className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Sedes: dirección, horario y cómo llegar
// ---------------------------------------------------------------------------------------------
function NuestrasSedes({ sedes }) {
  return (
    <section className="relative overflow-hidden bg-marino py-16 text-white lg:py-20" aria-labelledby="home-sedes">
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-acento/20 blur-3xl" aria-hidden="true" />
      <div className="wrap relative">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <h2 id="home-sedes" className="max-w-2xl font-display text-[2.4rem] font-bold uppercase leading-[0.95] tracking-tight sm:text-[3rem]">Te acompañamos hasta que sales a trabajar</h2>
          <Link to="/sedes" className="btn bg-white text-marino hover:bg-white/90">Ver sedes y horarios</Link>
        </div>
        <ul className={`mt-10 grid gap-4 ${sedes.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {sedes.map((s) => (
            <li key={s.id} className="flex flex-col rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10" data-sede-inicio={s.nombre}>
              <h3 className="font-display text-[1.7rem] font-bold uppercase leading-none">Sede {s.nombre}</h3>
              {s.direccion && <p className="mt-3 flex gap-2 text-[14px] text-white/75"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />{s.direccion}</p>}
              {s.horario && <p className="mt-1.5 pl-6 text-[13.5px] text-white/55">{s.horario}</p>}
              {s.direccion && <a href={enlaceGoogleMaps(s.direccion)} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-[14px] font-semibold text-white underline-offset-4 hover:underline">Cómo llegar <IconFlecha className="h-4 w-4" /></a>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
