import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FILTROS_CATALOGO, FAMILIAS, formatoSoles } from "../data/mockData";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import ModeloImg from "../components/ModeloImg";
import MotoIllustration from "../components/MotoIllustration";
import HUBadge from "../components/HUBadge";
import { numero } from "../components/FichaTecnica";
import { IconBuscar, IconClose, IconFiltros } from "../components/Icons";

const HEX = { Rojo: "#c62828", Blanco: "#f4f4f5", Azul: "#1e4896", Negro: "#111827", Plateado: "#c0c4cc", Verde: "#15803d" };

/**
 * Tarjeta de modelo: foto sobre escenario, nombre en estilo Torito, precio y colores. Se usa en Inicio, catálogo y ficha.
 * colores={false} oculta los círculos de color (Inicio); colorInicial elige con qué foto aparece (por ejemplo, "Azul").
 */
export function TarjetaModelo({ m, stock, colores = true, colorInicial }) {
  const cotizar = useCotizar();
  const [color, setColor] = useState(colorInicial || m.colores?.[0]);
  const badge = (m.badges || [])[0];
  const potencia = m.resumen?.Potencia && !/ver/i.test(m.resumen.Potencia) ? m.resumen.Potencia : null;
  return (
    <article className="group flex flex-col">
      <Link to={`/modelos/${m.id}`} className="relative block overflow-hidden rounded-2xl bg-escenario dark:bg-escenario-oscuro" aria-label={`Ver ${m.nombre}`}>
        {badge && <span className={`absolute left-3 top-3 z-10 rounded-md px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-white ${badge.startsWith("NUEVO") ? "bg-acento" : "bg-marino-700"}`}>{badge}</span>}
        {m.angulos360?.length > 1 && <span className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-marino dark:bg-[#101c33] dark:text-white">360°</span>}
        <ModeloImg modelo={m} color={color} className="aspect-[4/3] w-full object-contain p-6 transition duration-300 group-hover:scale-[1.03]" />
        {stock === 0 && <span className="absolute bottom-3 left-3 rounded-md bg-amber-500 px-2 py-0.5 text-[10.5px] font-bold text-white">SIN STOCK</span>}
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-[12.5px] font-medium text-slate-500">{m.familia}</p>
          {colores && (m.colores || []).length > 1 && (
            <div className="flex shrink-0 gap-1.5">
              {m.colores.map((c) => (
                <button key={c} type="button" title={c} aria-label={`Ver en color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} onMouseEnter={() => setColor(c)}
                  className={`h-4 w-4 rounded-full border ${color === c ? "ring-2 ring-marino-700/40 ring-offset-1 dark:ring-white/60 dark:ring-offset-[#0a1426]" : "border-slate-300 dark:border-white/20"}`} style={{ background: HEX[c] || "#94a3b8" }} />
              ))}
            </div>
          )}
        </div>
        <h3 className="mt-1 font-display text-[1.7rem] font-bold uppercase leading-[1.02] tracking-tight text-marino dark:text-white">
          <Link to={`/modelos/${m.id}`} className="hover:text-acento">{m.nombre}</Link>
        </h3>
        <p className="mt-1.5 text-[13px] text-slate-500">{m.tipoMotor} · {m.combustible}{potencia ? ` · ${potencia}` : ""}</p>
        <div className="mt-auto pt-4">
          <p className="flex items-baseline gap-2">
            <span className="text-[12.5px] text-slate-500">Desde</span>
            <span className="cifra font-display text-[1.75rem] font-bold leading-none text-marino dark:text-white">{formatoSoles(m.precioDesde)}</span>
          </p>
          <div className="mt-4 flex gap-2">
            <Link to={`/modelos/${m.id}`} className="btn btn-primary flex-1 !px-3 !py-2.5 !text-[14px] dark:bg-white/10 dark:hover:bg-white/20">Ver modelo</Link>
            <button onClick={() => cotizar({ modeloId: m.id, color })} className="btn btn-secondary !px-4 !py-2.5 !text-[14px]">Cotizar</button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Filtro único del catálogo                                           */
/* ------------------------------------------------------------------ */

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const corto = (familia) => familia.replace(/^Motores\s+/i, "");
const potenciaDe = (m) => numero(m.resumen?.Potencia) ?? 0;

// Grupos del filtro. Cada grupo solo muestra opciones presentes en los modelos publicados
// y se oculta si todos los modelos comparten el mismo valor (por ejemplo, Uso = Pasajeros).
const GRUPOS = [
  { k: "familia", titulo: "Motor", orden: FAMILIAS, etiqueta: corto },
  { k: "combustible", titulo: "Combustible", orden: FILTROS_CATALOGO.combustible },
  { k: "tipoTecho", titulo: "Techo", orden: FILTROS_CATALOGO.tipoTecho },
  { k: "uso", titulo: "Uso", orden: FILTROS_CATALOGO.uso },
];
const ORDENES = [
  ["precio-asc", "Menor precio"],
  ["precio-desc", "Mayor precio"],
  ["potencia", "Más potencia"],
  ["nombre", "Nombre (A-Z)"],
];
const VACIO = { familia: [], combustible: [], tipoTecho: [], uso: [] };

function Casilla({ etiqueta, n, activo, onChange }) {
  const deshabilitado = !activo && n === 0;
  return (
    <label className={`-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-[14.5px] transition ${deshabilitado ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-slate-100/70 dark:hover:bg-white/5"}`}>
      <input type="checkbox" className="peer sr-only" checked={activo} disabled={deshabilitado} onChange={onChange} />
      <span aria-hidden="true" className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-acento peer-focus-visible:ring-offset-2 ${activo ? "border-marino bg-marino text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-300 bg-white dark:border-white/25 dark:bg-transparent"}`}>
        {activo && <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg>}
      </span>
      <span className="flex-1 text-slate-700 dark:text-slate-200">{etiqueta}</span>
      <span className="cifra text-[13px] text-slate-400">{n}</span>
    </label>
  );
}

function PanelFiltros({ grupos, sel, alternar, conteo, precio, setPrecio, rango }) {
  return (
    <div className="divide-y divide-slate-200 dark:divide-white/10">
      {grupos.map((g) => (
        <div key={g.k} role="group" aria-label={g.titulo} className="py-5 first:pt-0">
          <p className="mb-2 text-[12.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{g.titulo}</p>
          {g.opciones.map((v) => (
            <Casilla key={v} etiqueta={g.etiqueta ? g.etiqueta(v) : v} n={conteo(g.k, v)} activo={sel[g.k].includes(v)} onChange={() => alternar(g.k, v)} />
          ))}
        </div>
      ))}
      {rango.max > rango.min && (
        <div role="group" aria-label="Precio" className="py-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <p className="text-[12.5px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Precio</p>
            <p className="cifra text-[14px] font-semibold text-marino dark:text-white">{precio == null ? "Todos" : `Hasta ${formatoSoles(precio)}`}</p>
          </div>
          <input type="range" min={rango.min} max={rango.max} step={100} value={precio ?? rango.max} aria-label="Precio máximo"
            onChange={(e) => { const v = Number(e.target.value); setPrecio(v >= rango.max ? null : v); }}
            className="w-full cursor-pointer accent-marino-700 dark:accent-white" />
          <div className="cifra mt-1 flex justify-between text-[12.5px] text-slate-400"><span>{formatoSoles(rango.min)}</span><span>{formatoSoles(rango.max)}</span></div>
        </div>
      )}
    </div>
  );
}

/** Catálogo — HU-008 "Explorar modelos en un catálogo": un solo filtro (motor, combustible, techo, precio), búsqueda y orden. */
export default function Modelos() {
  const { publicos, unidades } = useApp();
  const [sel, setSel] = useState(VACIO);
  const [q, setQ] = useState("");
  const [precio, setPrecio] = useState(null); // null = sin tope
  const [orden, setOrden] = useState("precio-asc");
  const [panel, setPanel] = useState(false); // cajón de filtros en móvil

  const stockDe = (id) => unidades.filter((u) => u.modelo === id && u.disponibilidad === "Disponible").length;

  const rango = useMemo(() => {
    const precios = publicos.map((m) => m.precioDesde).filter(Boolean);
    return precios.length ? { min: Math.floor(Math.min(...precios) / 100) * 100, max: Math.ceil(Math.max(...precios) / 100) * 100 } : { min: 0, max: 0 };
  }, [publicos]);

  const grupos = useMemo(() => GRUPOS.map((g) => {
    const presentes = [...new Set(publicos.map((m) => m[g.k]).filter(Boolean))];
    const opciones = [...g.orden.filter((v) => presentes.includes(v)), ...presentes.filter((v) => !g.orden.includes(v)).sort()];
    return { ...g, opciones };
  }).filter((g) => g.opciones.length > 1), [publicos]);

  const qn = sinTildes(q.trim());
  // Un modelo pasa si cumple todo; "excepto" ignora un grupo para calcular cuántos quedarían al marcar otra opción.
  const pasa = (m, excepto) => (!qn || sinTildes(`${m.nombre} ${m.familia} ${m.combustible} ${m.tipoMotor}`).includes(qn))
    && (precio == null || m.precioDesde <= precio)
    && GRUPOS.every(({ k }) => k === excepto || !sel[k].length || sel[k].includes(m[k]));

  const lista = publicos.filter((m) => pasa(m)).sort((a, b) => (
    orden === "precio-asc" ? a.precioDesde - b.precioDesde
      : orden === "precio-desc" ? b.precioDesde - a.precioDesde
        : orden === "potencia" ? potenciaDe(b) - potenciaDe(a)
          : a.nombre.localeCompare(b.nombre)));
  const conteo = (k, v) => publicos.filter((m) => pasa(m, k) && m[k] === v).length;

  const alternar = (k, v) => setSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const activos = [
    ...GRUPOS.flatMap((g) => sel[g.k].map((v) => ({ id: `${g.k}-${v}`, texto: g.etiqueta ? g.etiqueta(v) : v, quitar: () => alternar(g.k, v) }))),
    ...(precio != null ? [{ id: "precio", texto: `Hasta ${formatoSoles(precio)}`, quitar: () => setPrecio(null) }] : []),
    ...(q.trim() ? [{ id: "q", texto: `“${q.trim()}”`, quitar: () => setQ("") }] : []),
  ];
  const nFiltros = activos.filter((a) => a.id !== "q").length;
  const limpiar = () => { setSel(VACIO); setPrecio(null); setQ(""); };

  // Cajón móvil: Escape lo cierra y el fondo no se desplaza mientras está abierto
  useEffect(() => {
    if (!panel) return;
    const esc = (e) => e.key === "Escape" && setPanel(false);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = antes; window.removeEventListener("keydown", esc); };
  }, [panel]);

  const panelProps = { grupos, sel, alternar, conteo, precio, setPrecio, rango };
  const nModelos = (n) => `${n} ${n === 1 ? "modelo" : "modelos"}`;

  return (
    <div className="fade-in">
      <HUBadge code="HU-008" titulo="Explorar modelos en un catálogo" />
      <section className="wrap pb-8 pt-10 lg:pb-10 lg:pt-14">
        <h1 className="font-display text-[3rem] font-bold uppercase leading-[0.9] tracking-tight text-marino sm:text-[4rem] dark:text-white">Modelos Torito</h1>
        <p className="bajada mt-4">Compara motores, combustible y precios de la línea oficial Torito Bajaj. Todos se pueden financiar con crédito directo.</p>
      </section>

      <div className="wrap grid gap-10 pb-16 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-14 lg:pb-24">
        {/* Filtro (escritorio) */}
        <aside className="hidden lg:block" aria-label="Filtros del catálogo">
          <div className="sticky top-24">
            <div className="mb-5 flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-marino dark:text-white"><IconFiltros className="h-[18px] w-[18px]" /> Filtrar</p>
              {nFiltros > 0 && <button onClick={limpiar} className="text-[13.5px] font-semibold text-acento hover:underline">Limpiar</button>}
            </div>
            <PanelFiltros {...panelProps} />
          </div>
        </aside>

        <div className="min-w-0">
          {/* Búsqueda, filtros en móvil y orden */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-[1_1_100%] sm:flex-[1_1_280px] sm:max-w-md">
              <IconBuscar className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" />
              <input type="search" aria-label="Buscar modelo" className="field-input !pl-10 !pr-10" placeholder="Buscar: Crom Plus, GNV, 250…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-marino dark:hover:bg-white/10"><IconClose className="h-4 w-4" /></button>}
            </div>
            <button type="button" onClick={() => setPanel(true)} className="btn btn-secondary !px-4 !py-2.5 !text-[14px] lg:hidden" aria-haspopup="dialog">
              <IconFiltros className="h-[18px] w-[18px]" /> Filtros{nFiltros > 0 && <span className="cifra grid h-5 min-w-5 place-items-center rounded-full bg-marino px-1.5 text-[11.5px] text-white dark:bg-white dark:text-marino">{nFiltros}</span>}
            </button>
            <label className="ml-auto flex items-center gap-2 text-[14px]">
              <span className="hidden text-slate-500 sm:inline">Ordenar por</span>
              <select aria-label="Ordenar modelos" className="field-input !w-auto !py-2.5 !pr-9" value={orden} onChange={(e) => setOrden(e.target.value)}>
                {ORDENES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
          </div>

          {/* Resultado y filtros activos */}
          <div className="mt-5 flex min-h-[32px] flex-wrap items-center gap-2" aria-live="polite">
            <p className="mr-2 text-[14.5px] font-semibold text-marino dark:text-white">{nModelos(lista.length)}</p>
            {activos.map((a) => (
              <button key={a.id} type="button" onClick={a.quitar} aria-label={`Quitar filtro ${a.texto}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-marino-50 py-1 pl-3 pr-2 text-[13px] font-medium text-marino transition hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15">
                {a.texto}<IconClose className="h-3.5 w-3.5 opacity-60" />
              </button>
            ))}
            {activos.length > 1 && <button type="button" onClick={limpiar} className="ml-1 text-[13px] font-semibold text-acento hover:underline">Limpiar todo</button>}
          </div>

          {lista.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-16 text-center dark:border-white/15">
              <MotoIllustration className="mx-auto w-28 opacity-40" />
              <h2 className="mt-4 text-lg font-semibold">{publicos.length === 0 ? "Por ahora no hay modelos publicados" : "Ningún modelo coincide con estos filtros"}</h2>
              <p className="mt-1 text-slate-500">{publicos.length === 0 ? "Vuelve pronto o escríbenos por WhatsApp." : "Quita algún filtro o prueba con otra búsqueda."}</p>
              {activos.length > 0 && <button onClick={limpiar} className="btn btn-secondary mt-5">Limpiar filtros</button>}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((m) => <TarjetaModelo key={m.id} m={m} stock={stockDe(m.id)} />)}
            </div>
          )}
          <p className="mt-14 text-[12.5px] text-slate-400">Precio referencial de la versión estándar sin techo de fibra; no incluye matrícula ni SOAT y puede variar por zona o accesorios. Fotos referenciales de torito.pe.</p>
        </div>
      </div>

      {/* Filtro (móvil): cajón inferior */}
      {panel && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-marino/60 backdrop-blur-sm" onClick={() => setPanel(false)} />
          <div className="fade-in absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-[#0f1830]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <p className="text-[16px] font-semibold text-marino dark:text-white">Filtrar modelos</p>
              <button type="button" onClick={() => setPanel(false)} aria-label="Cerrar filtros" className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/10"><IconClose /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pt-5"><PanelFiltros {...panelProps} /></div>
            <div className="flex gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/10">
              <button type="button" onClick={limpiar} className="btn btn-secondary !py-3" disabled={nFiltros === 0 && !q}>Limpiar</button>
              <button type="button" onClick={() => setPanel(false)} className="btn btn-primary flex-1 !py-3 dark:bg-white dark:text-marino">Ver {nModelos(lista.length)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
