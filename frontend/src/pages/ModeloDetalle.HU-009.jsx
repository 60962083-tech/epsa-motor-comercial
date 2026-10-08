import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import { OPCIONES_TECHO, CUOTAS_INICIAL, PLAZOS, formatoSoles } from "../data/mockData";
import ModeloImg from "../components/ModeloImg";
import Viewer360 from "../components/Viewer360";
import FichaTecnica from "../components/FichaTecnica";
import WhatsAppButton from "../components/WhatsAppButton.HU-013";
import HUBadge from "../components/HUBadge";
import { IconCheck, IconLlanta, IconMedidor, IconMotor, IconPiston, IconRayo } from "../components/Icons";
import { ProductoNoDisponible, SinStockAviso } from "./Errores";
import { TarjetaModelo } from "./Modelos.HU-008";

const HEX = { Rojo: "#c62828", Blanco: "#f4f4f5", Azul: "#1e4896", Negro: "#111827", Plateado: "#c0c4cc", Verde: "#15803d" };
const INCLUYE = [
  ["Garantía oficial", "Respaldo de Bajaj y Crosland en motor y componentes."],
  ["Trámite de placa", "Te acompañamos con la placa y la tarjeta de propiedad."],
  ["Crédito directo", "Cuotas a tu medida, con evaluación rápida en sede."],
  ["Asesoría postventa", "Te orientamos en el primer mantenimiento en taller autorizado."],
];
const CLAVES = [["Motor", IconMotor], ["Cilindrada", IconPiston], ["Llantas", IconLlanta], ["Potencia", IconRayo], ["Torque", IconMedidor]];

/**
 * Ficha del modelo — HU-009 "Consultar la ficha de un modelo" (estilo torito.pe).
 * Foto real por color, vista 360° con fotos reales cuando el fabricante las publica (Torito 250),
 * cifras clave, detalles técnicos en 5 pestañas con lectura visual, calculadora de techo/inicial y cotización.
 * Errores: modelo inexistente o no publicado → «Producto no disponible»; sin unidades → aviso de stock.
 */
export default function ModeloDetalleRuta() {
  const { id } = useParams();
  return <ModeloDetalle key={id} id={id} />;
}

function ModeloDetalle({ id }) {
  const { modelo: buscar, publicos, unidades } = useApp();
  const cotizar = useCotizar();
  const m = buscar(id);
  const [color, setColor] = useState("");
  const [vista, setVista] = useState(m?.angulos360?.length ? "360" : "foto");
  const [techo, setTecho] = useState("basico");
  const [inicial, setInicial] = useState(30);
  const [plazo, setPlazo] = useState(24);
  const stock = useMemo(() => unidades.filter((u) => u.modelo === id && u.disponibilidad === "Disponible").length, [unidades, id]);

  if (!m || m.estado !== "Publicado") return <ProductoNoDisponible nombre={m?.nombre} />;

  const colores = m.colores?.length ? m.colores : ["Rojo"];
  const colorSel = color || colores[0];
  const fotoDelColor = !!m.fotosColor?.[colorSel];
  const tiene360 = (m.angulos360?.length || 0) > 1;
  const t = OPCIONES_TECHO.find((o) => o.id === techo);
  const total = m.precioDesde + (t?.precio || 0);
  const montoInicial = Math.round((total * inicial) / 100);
  const cuota = Math.round((total - montoInicial) / plazo);
  const relacionados = publicos.filter((x) => x.id !== m.id && x.familia === m.familia).concat(publicos.filter((x) => x.id !== m.id && x.familia !== m.familia)).slice(0, 4);
  const pedir = () => cotizar({ modeloId: m.id, color: colorSel, techo });

  return (
    <div className="fade-in">
      <HUBadge code="HU-009" titulo="Consultar la ficha de un modelo" />

      {/* ---------- Producto ---------- */}
      <section className="border-b border-slate-200 dark:border-white/10">
        <div className="wrap py-6 lg:py-10">
          <nav aria-label="Ruta de navegación" className="text-[13.5px] text-slate-500">
            <Link to="/modelos" className="hover:text-marino hover:underline dark:hover:text-white">Modelos</Link> <span aria-hidden="true">/</span> {m.familia} <span aria-hidden="true">/</span> <span className="text-slate-700 dark:text-slate-300">{m.nombre}</span>
          </nav>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start lg:gap-14">
            <div className="min-w-0">
              <div className="relative rounded-3xl bg-escenario p-4 sm:p-8 dark:bg-escenario-oscuro">
                {tiene360 && (
                  <div role="tablist" aria-label="Tipo de vista" className="absolute right-4 top-4 z-10 flex rounded-full bg-white p-1 text-[13px] font-semibold shadow-sm dark:bg-[#101c33]">
                    {[["foto", "Foto"], ["360", "360°"]].map(([k, l]) => (
                      <button key={k} role="tab" aria-selected={vista === k} onClick={() => setVista(k)} className={`rounded-full px-3.5 py-1.5 ${vista === k ? "bg-marino text-white" : "text-slate-500 hover:text-marino dark:hover:text-white"}`}>{l}</button>
                    ))}
                  </div>
                )}
                {vista === "360" && tiene360
                  ? <Viewer360 frames={m.angulos360} locales={m.angulos360.map((_, k) => `/images/360/${m.id}/${String(k + 1).padStart(2, "0")}.png`)} alt={m.nombre} onNoDisponible={() => setVista("foto")} />
                  : <ModeloImg modelo={m} color={colorSel} className="mx-auto aspect-[4/3] w-full object-contain" />}
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <p className="text-[14px] text-slate-500">Color <span className="font-semibold text-marino dark:text-white">{colorSel}</span></p>
                <div className="flex gap-2.5">
                  {colores.map((c) => (
                    <button key={c} onClick={() => { setColor(c); setVista("foto"); }} aria-label={`Color ${c}`} aria-pressed={colorSel === c} title={c}
                      className={`h-9 w-9 rounded-full border-2 transition ${colorSel === c ? "scale-110 border-marino-700 ring-4 ring-marino-700/15 dark:border-white" : "border-slate-300 dark:border-white/20"}`} style={{ background: HEX[c] || "#94a3b8" }} />
                  ))}
                </div>
              </div>
              {!fotoDelColor && colores.length > 1 && <p className="mt-2 text-[12.5px] text-slate-400">Foto referencial. El acabado del color {colorSel.toLowerCase()} lo confirma tu asesor.</p>}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {(m.badges || []).slice(0, 1).map((b) => <span key={b} className={`rounded-md px-2.5 py-1 text-[11.5px] font-bold tracking-wide text-white ${b.startsWith("NUEVO") ? "bg-acento" : "bg-marino-700"}`}>{b}</span>)}
              </div>
              <p className="mt-4 text-[15px] font-medium text-slate-500">{m.familia}</p>
              <h1 className="font-display text-[3rem] font-bold uppercase leading-[0.9] tracking-tight text-marino sm:text-[4.25rem] dark:text-white">{m.nombre}</h1>
              <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-slate-600 dark:text-slate-300">{m.descripcion}</p>

              <div className="mt-7 flex flex-wrap items-end gap-x-5 gap-y-2">
                <div>
                  <p className="text-[13px] font-medium text-slate-500">Desde</p>
                  <p className="cifra font-display text-[3.25rem] font-bold leading-none text-marino dark:text-white">{formatoSoles(m.precioDesde)}</p>
                </div>
                <p className="max-w-[16rem] pb-1 text-[12px] leading-snug text-slate-400">Precio estándar sin techo de fibra. No incluye matrícula ni SOAT; puede variar por zona o accesorios.</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button onClick={pedir} className="btn btn-acento">Quiero que me contacten</button>
                <WhatsAppButton mensaje={`Hola, quisiera información sobre el ${m.nombre} en color ${colorSel}.`} />
              </div>
              <p className="mt-4 text-[13.5px]">
                {stock > 0
                  ? <span className="inline-flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><span className="h-2 w-2 rounded-full bg-emerald-500" />{stock} {stock === 1 ? "unidad disponible" : "unidades disponibles"} en nuestras sedes</span>
                  : <span className="inline-flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-400"><span className="h-2 w-2 rounded-full bg-amber-500" />Sin stock por ahora</span>}
              </p>

              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-slate-200 pt-6 sm:grid-cols-4 dark:border-white/10">
                {CLAVES.filter(([k]) => k !== "Motor").map(([k, Icono]) => (
                  <div key={k}>
                    <dt className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500"><Icono className="h-4 w-4" />{k}</dt>
                    <dd className="mt-1 font-display text-[21px] font-bold leading-tight text-marino dark:text-white">{m.resumen?.[k] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Detalles técnicos (con los destacados del modelo) ---------- */}
      <section className="wrap py-14 lg:py-20">
        <h2 className="titulo">Detalles técnicos</h2>
        <p className="bajada mt-3">Las barras comparan este modelo con el resto de la línea Torito que ofrecemos.</p>
        {(m.destacados || []).length > 0 && (
          <ul className="mt-7 grid gap-x-8 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {m.destacados.map((d) => <li key={d} className="flex gap-2.5 text-[14.5px] leading-snug text-slate-600 dark:text-slate-300"><IconCheck className="mt-0.5 h-[18px] w-[18px] shrink-0 text-acento" />{d}</li>)}
          </ul>
        )}
        <div className="mt-8"><FichaTecnica modelo={m} todos={publicos} /></div>
      </section>

      {/* ---------- Inversión ---------- */}
      <section className="wrap grid gap-12 py-14 lg:grid-cols-[1fr_1.1fr] lg:py-20">
        <div>
          <h2 className="titulo">Tu {m.nombre} incluye</h2>
          <ul className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-white/10 dark:border-white/10">
            {INCLUYE.map(([titulo, d]) => (
              <li key={titulo} className="flex gap-4 py-4">
                <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-acento" />
                <div><p className="font-semibold text-marino dark:text-white">{titulo}</p><p className="text-[14px] text-slate-500">{d}</p></div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-slate-200 p-6 sm:p-8 dark:border-white/10">
          <h2 className="titulo-sm">Calcula tu inversión</h2>
          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className="field-label">Tipo de techo</legend>
              <div className="grid grid-cols-2 gap-2">
                {OPCIONES_TECHO.map((o) => (
                  <button key={o.id} type="button" onClick={() => setTecho(o.id)} aria-pressed={techo === o.id}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${techo === o.id ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>
                    <span className="block text-[14px] font-semibold text-marino dark:text-white">{o.nombre}</span>
                    <span className="cifra text-[12.5px] text-slate-500">+ {formatoSoles(o.precio)}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">Cuota inicial</legend>
              <div className="grid grid-cols-4 gap-2">
                {CUOTAS_INICIAL.map((p) => (
                  <button key={p} type="button" onClick={() => setInicial(p)} aria-pressed={inicial === p} className={`rounded-xl border py-2.5 text-[14px] font-semibold transition ${inicial === p ? "border-marino-700 bg-marino-700 text-white" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>{p}%</button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="calc-plazo" className="field-label">Plazo</label>
              <select id="calc-plazo" className="field-input" value={plazo} onChange={(e) => setPlazo(Number(e.target.value))}>{PLAZOS.map((p) => <option key={p} value={p}>{p} meses</option>)}</select>
            </div>
          </div>
          <dl className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-[14.5px] dark:border-white/10">
            <div className="flex justify-between"><dt className="text-slate-500">Precio con techo</dt><dd className="cifra font-semibold">{formatoSoles(total)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Inicial ({inicial}%)</dt><dd className="cifra font-semibold">{formatoSoles(montoInicial)}</dd></div>
            <div className="flex items-baseline justify-between pt-2"><dt className="font-semibold">Cuota mensual aprox.</dt><dd className="cifra font-display text-[2.2rem] font-bold leading-none text-acento">{formatoSoles(cuota)}</dd></div>
          </dl>
          <p className="mt-2 text-[12px] text-slate-400">Cálculo referencial sin intereses ni gastos. La cuota real la confirma un asesor.</p>
          <button onClick={pedir} className="btn btn-primary mt-6 w-full">Cotizar con estos datos</button>
        </div>
      </section>

      {stock === 0 && <section className="wrap pb-14"><SinStockAviso nombre={m.nombre} onAvisar={pedir} /></section>}

      {relacionados.length > 0 && (
        <section className="border-t border-slate-200 bg-escenario/60 py-14 dark:border-white/10 dark:bg-transparent">
          <div className="wrap">
            <h2 className="titulo">También te puede interesar</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {relacionados.map((r) => <TarjetaModelo key={r.id} m={r} stock={unidades.filter((u) => u.modelo === r.id && u.disponibilidad === "Disponible").length} />)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
