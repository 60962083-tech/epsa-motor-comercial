// HU-009 · Ficha técnica por pestañas
import { useState } from "react";
import { TABS_TECNICOS } from "../data/mockData";
import { IconBateria, IconChasis, IconLlanta, IconMotor, IconRegla, IconTanque } from "./Icons";

export const numero = (t) => { const m = String(t ?? "").replace(/(\d),(\d{3})/g, "$1$2").match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
const fila = (m, tab, re) => (m.specs?.[tab] || []).find(([k]) => re.test(k))?.[1];

export function cifras(m) {
  return {
    potencia: numero(m.resumen?.Potencia), torque: numero(m.resumen?.Torque), cilindrada: numero(m.resumen?.Cilindrada),
    velocidad: numero(fila(m, "consumo", /velocidad/i)), tanque: numero(fila(m, "consumo", /tanque/i)),
    largo: numero(fila(m, "dimensiones", /^largo/i)), ancho: numero(fila(m, "dimensiones", /^ancho/i)), alto: numero(fila(m, "dimensiones", /^alto/i)),
    peso: numero(fila(m, "dimensiones", /peso en vac|^peso$/i)),
  };
}

const ICONO_TAB = { motor: IconMotor, chasis: IconChasis, consumo: IconTanque, dimensiones: IconRegla, electrico: IconBateria };

// Barra comparativa
function Barra({ etiqueta, valor, unidad, max, nota }) {
  if (valor == null) return null;
  const pct = Math.max(6, Math.round((valor / Math.max(valor, max || valor)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13.5px] text-slate-500 dark:text-slate-400">{etiqueta}</span>
        <span className="cifra font-display text-[28px] font-bold leading-none text-marino dark:text-white">{valor.toLocaleString("es-PE")}<span className="ml-1 text-[15px] font-semibold text-slate-400">{unidad}</span></span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200/80 dark:bg-white/10"><div className="h-2 rounded-full bg-acento transition-all duration-700" style={{ width: `${pct}%` }} /></div>
      {nota && <p className="mt-1 text-[12px] text-slate-400">{nota}</p>}
    </div>
  );
}

// Medidas
function Cotas({ c }) {
  const f = (v) => (v ? `${v.toLocaleString("es-PE")} mm` : "—");
  return (
    <figure>
      <svg viewBox="0 0 330 210" className="w-full text-marino dark:text-white" role="img" aria-label={`Largo ${f(c.largo)}, alto ${f(c.alto)}, ancho ${f(c.ancho)}`}>
        <path d="M40 150 L52 112 Q60 84 92 70 L96 60 H250 Q262 60 266 72 L272 150 Z" fill="currentColor" opacity=".08" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M104 72 H176 V128 H104 Z M186 72 H254 V128 H186 Z" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".45" />
        <path d="M58 112 L92 74" stroke="currentColor" strokeWidth="1.5" opacity=".45" />
        {[70, 236].map((x) => <g key={x}><circle cx={x} cy="156" r="17" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx={x} cy="156" r="6" fill="currentColor" opacity=".5" /></g>)}
        <line x1="20" y1="174" x2="300" y2="174" stroke="currentColor" opacity=".25" />
        <g stroke="#c62828" strokeWidth="1.6" fill="#c62828">
          <line x1="40" y1="192" x2="272" y2="192" /><path d="M40 192 l7 -4 v8 Z M272 192 l-7 -4 v8 Z" />
          <line x1="300" y1="60" x2="300" y2="174" /><path d="M300 60 l-4 7 h8 Z M300 174 l-4 -7 h8 Z" />
        </g>
        <text x="156" y="207" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor">Largo {f(c.largo)}</text>
        <text x="312" y="122" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" transform="rotate(-90 312 122)">Alto {f(c.alto)}</text>
      </svg>
      <figcaption className="mt-1 text-center text-[13px] text-slate-500">Ancho {f(c.ancho)}{c.peso ? ` · peso ${c.peso.toLocaleString("es-PE")} kg` : ""}</figcaption>
    </figure>
  );
}

// Gráfico de cada pestaña
function Visual({ tab, m, maximos }) {
  const c = cifras(m);
  if (tab === "motor") {
    return (
      <div className="space-y-5">
        <Barra etiqueta="Potencia" valor={c.potencia} unidad="HP" max={maximos.potencia} nota={`Máximo de la línea: ${maximos.potencia} HP`} />
        <Barra etiqueta="Torque" valor={c.torque} unidad="Nm" max={maximos.torque} nota={`Máximo de la línea: ${maximos.torque} Nm`} />
        <Barra etiqueta="Cilindrada" valor={c.cilindrada} unidad="cc" max={maximos.cilindrada} />
      </div>
    );
  }
  if (tab === "consumo") {
    if (c.velocidad == null && c.tanque == null) return <p className="text-[14px] text-slate-500">Consulta el rendimiento con tu asesor.</p>;
    return (
      <div className="space-y-5">
        <Barra etiqueta="Velocidad máxima" valor={c.velocidad} unidad="km/h" max={maximos.velocidad} />
        <Barra etiqueta="Tanque principal" valor={c.tanque} unidad="L" max={maximos.tanque} nota="Capacidad declarada por el fabricante" />
      </div>
    );
  }
  if (tab === "dimensiones") return <Cotas c={c} />;
  if (tab === "chasis") {
    const neum = fila(m, "chasis", /neum/i);
    return (
      <div className="flex items-center gap-5">
        <IconLlanta className="h-20 w-20 shrink-0 text-marino/80 dark:text-white/80" />
        <div><p className="text-[13.5px] text-slate-500">Neumáticos</p><p className="font-display text-[26px] font-bold leading-tight text-marino dark:text-white">{neum?.split(",")[0] || "—"}</p><p className="text-[13px] text-slate-500">{m.resumen?.Llantas}</p></div>
      </div>
    );
  }
  const bat = fila(m, "electrico", /bater/i);
  return (
    <div className="flex items-center gap-5">
      <IconBateria className="h-20 w-20 shrink-0 text-marino/80 dark:text-white/80" />
      <div><p className="text-[13.5px] text-slate-500">Batería</p><p className="font-display text-[26px] font-bold leading-tight text-marino dark:text-white">{bat?.split("(")[0] || "12 V"}</p><p className="text-[13px] text-slate-500">{fila(m, "electrico", /sistema/i) || "Sistema de 12 V"}</p></div>
    </div>
  );
}

// Ficha técnica
export default function FichaTecnica({ modelo, todos }) {
  const [tab, setTab] = useState("motor");
  const maximos = todos.reduce((acc, x) => {
    const c = cifras(x);
    for (const k of ["potencia", "torque", "cilindrada", "velocidad", "tanque"]) if (c[k] != null) acc[k] = Math.max(acc[k] || 0, c[k]);
    return acc;
  }, {});
  const filas = modelo.specs?.[tab] || [];
  return (
    <div>
      <div role="tablist" aria-label="Detalles técnicos" className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 dark:border-white/10 sm:mx-0 sm:px-0">
        {TABS_TECNICOS.map((x) => {
          const Icono = ICONO_TAB[x.id];
          return (
            <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)}
              className={`flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-3 text-[14.5px] font-semibold transition ${tab === x.id ? "border-acento text-marino dark:text-white" : "border-transparent text-slate-500 hover:text-marino dark:hover:text-white"}`}>
              <Icono className="h-5 w-5" />{x.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-14">
        <div className="rounded-2xl bg-escenario p-6 dark:bg-escenario-oscuro"><Visual tab={tab} m={modelo} maximos={maximos} /></div>
        <dl className="min-w-0 self-start">
          {filas.length === 0 && <p className="py-4 text-[14.5px] text-slate-500">Información por confirmar con tu asesor.</p>}
          {filas.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,180px)_1fr] gap-4 border-b border-slate-200 py-3 text-[14.5px] dark:border-white/10">
              <dt className="font-semibold text-marino dark:text-white">{k}</dt><dd className="text-slate-600 dark:text-slate-300">{v}</dd>
            </div>
          ))}
          <p className="mt-3 text-[12px] text-slate-400">{modelo.soloBackend ? "Fuente: catálogo de EPSA Motor." : "Fuente: ficha oficial de torito.pe."}</p>
        </dl>
      </div>
    </div>
  );
}
