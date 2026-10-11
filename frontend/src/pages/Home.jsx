// Inicio de la web
import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import Carousel from "../components/Carousel";
import { TarjetaModelo } from "./Modelos.HU-008";
import { IconShield, IconMapArea, IconCreditCard, IconDocument, IconFlecha } from "../components/Icons";
import { FAMILIAS, COLOR_HEX, formatoSoles } from "../data/mockData";
import ModeloImg from "../components/ModeloImg";
import Opiniones from "../components/Opiniones";

// Carrusel
const SLIDES = [
  { modeloId: "torito-250-4v-glp", etiqueta: "Nuevo modelo", texto: "Llantas aro 10, suspensión delantera doble y el ahorro del GLP para rendir más y gastar menos." },
  { modeloId: "torito-4v-gnv", etiqueta: "Nueva generación", texto: "Gas natural con encendido instantáneo, retroceso en el manubrio y triple filtrado de aceite." },
  { modeloId: "torito-crom-plus-gsl", etiqueta: "Familia Crom Plus", texto: "10.19 HP y 17.10 Nm: el Crom Plus más potente para el trabajo de todos los días." },
  { modeloId: "torito-2t-ug-gsl", etiqueta: "Para empezar a trabajar", texto: "El Torito más accesible de la línea, con mantenimiento sencillo." },
];

// Cómo comprar
const PASOS = [
  ["Elige tu modelo", "Compara motores, combustible y precios en el catálogo."],
  ["Cotiza en línea", "Déjanos tus datos o escríbenos por WhatsApp; un asesor te llama el mismo día."],
  ["Visita tu sede", "Prueba la unidad, elige color y techo, y evaluamos tu crédito."],
  ["Llévatelo", "Te acompañamos con la placa y la tarjeta de propiedad hasta la entrega."],
];

// Ventajas
const VENTAJAS = [
  { Icono: IconShield, t: "Distribuidor oficial", d: "Autorizados por Bajaj y Crosland Perú S.A.C." },
  { Icono: IconCreditCard, t: "Crédito directo", d: "Financiamos tu Torito con cuotas a tu medida." },
  { Icono: IconDocument, t: "Trámite acompañado", d: "Te ayudamos con la placa y la tarjeta de propiedad." },
  { Icono: IconMapArea, t: "Cerca de ti", d: "Sedes en Comas, Ventanilla y Puente Piedra." },
];

export default function Home() {
  const { publicos, unidades } = useApp();
  const multicolor = publicos.find((m) => (m.colores || []).length > 1);
  const [colorVitrina, setColorVitrina] = useState("");
  const cotizar = useCotizar();
  const [familia, setFamilia] = useState("Todas");
  const stock = (id) => unidades.filter((u) => u.modelo === id && u.disponibilidad === "Disponible").length;
  const slides = SLIDES.map((x) => ({ ...x, modelo: publicos.find((m) => m.id === x.modeloId) })).filter((x) => x.modelo);
  const lista = publicos.filter((m) => familia === "Todas" || m.familia === familia).slice(0, 8);

  return (
    <div className="fade-in">
      {/* Carrusel */}
      {slides.length > 0 && <Carousel slides={slides} onCotizar={(modeloId) => cotizar({ modeloId })} />}

      {/* Ventajas */}
      <section aria-label="Por qué comprar en EPSA Motor" className="border-b border-slate-200 dark:border-white/10">
        <ul className="wrap grid gap-x-10 gap-y-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:py-10">
          {VENTAJAS.map(({ Icono, t, d }) => (
            <li key={t} className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-acento/[0.08] text-acento dark:bg-acento/15 dark:text-red-300"><Icono className="h-[22px] w-[22px]" /></span>
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold text-marino dark:text-white">{t}</span>
                <span className="mt-0.5 block text-[14px] leading-snug text-slate-500 dark:text-slate-400">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Catálogo por familia */}
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
            {lista.map((m) => <TarjetaModelo key={m.id} m={m} stock={stock(m.id)} colores={false} />)}
          </div>
        )}
      </section>

      {/* Vitrina de colores */}
      {multicolor && (() => { const c = colorVitrina || multicolor.colores[0]; return (
        <section className="relative overflow-hidden bg-marino text-white">
          <div className="pointer-events-none absolute -right-32 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full opacity-25 blur-3xl transition-colors duration-700" style={{ background: COLOR_HEX[c] }} aria-hidden="true" />
          <div className="wrap relative grid items-center gap-8 py-16 lg:grid-cols-[1fr_1.15fr] lg:py-20">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-white/60">A tu estilo</p>
              <h2 className="mt-2 font-display text-[2.4rem] font-bold uppercase leading-[0.95] tracking-tight sm:text-[3.2rem]">{multicolor.nombre} en {multicolor.colores.length} colores</h2>
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
                <Link to={`/modelos/${multicolor.id}`} className="text-[15px] font-semibold text-white/85 underline-offset-4 hover:underline">Ver ficha · desde {formatoSoles(multicolor.precioDesde)}</Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-x-[14%] bottom-[6%] h-[12%] rounded-[50%] bg-black/45 blur-2xl" aria-hidden="true" />
              <ModeloImg key={c} modelo={multicolor} color={c} className="relative mx-auto max-h-[380px] w-full animate-[entrar_.6s_ease_both] object-contain drop-shadow-[0_30px_40px_rgba(0,0,0,.4)]" />
            </div>
          </div>
        </section>
      ); })()}

      {/* Cómo comprar */}
      <section className="wrap pb-16 lg:pb-24">
        <div className="rounded-[28px] bg-escenario px-6 py-12 dark:bg-escenario-oscuro sm:px-10 lg:px-14 lg:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[12.5px] font-semibold uppercase tracking-[0.16em] text-acento dark:text-red-300">Cómo comprar</p>
              <h2 className="titulo mt-2">Tu Torito en 4 pasos</h2>
            </div>
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

      {/* Opiniones de clientes */}
      <Opiniones />
    </div>
  );
}
