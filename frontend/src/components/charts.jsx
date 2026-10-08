import { useState } from "react";

/* Gráficos SVG propios (sin librerías): se adaptan al ancho y muestran detalle al pasar el mouse o tocar. */
const PAL = ["#0e2c52", "#c62828", "#2f6db5", "#e0a100", "#13a07a", "#7a4fc9", "#64748b", "#d97706"];
export const paleta = (i) => PAL[i % PAL.length];

export function BarChart({ datos, alto = 220, ancho = 600, formato = (v) => v, series = [{ clave: "v", nombre: "Valor" }] }) {
  // datos: [{ etiqueta, v, v2... }]
  const [h, setH] = useState(null);
  const max = Math.max(1, ...datos.flatMap((d) => series.map((s) => d[s.clave] || 0)));
  const W = ancho, H = alto, pb = 28, pt = 12, pl = 4;
  const gw = (W - pl) / datos.length;
  const bw = Math.min(34, (gw - 12) / series.length);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de barras">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={0} x2={W} y1={pt + (H - pt - pb) * (1 - f)} y2={pt + (H - pt - pb) * (1 - f)} stroke="currentColor" strokeOpacity={f === 0 ? 0.25 : 0.08} />
        ))}
        {datos.map((d, i) => (
          <g key={i} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => setH(h === i ? null : i)} className="cursor-pointer">
            <rect x={pl + i * gw} y={0} width={gw} height={H} fill="transparent" />
            {series.map((s, k) => {
              const v = d[s.clave] || 0; const bh = ((H - pt - pb) * v) / max;
              const x = pl + i * gw + (gw - bw * series.length) / 2 + k * bw;
              return <rect key={s.clave} x={x} y={H - pb - bh} width={bw - 2} height={Math.max(bh, 0)} rx={4} fill={paleta(k === 0 ? 0 : k + 1)} opacity={h === null || h === i ? 1 : 0.35} className="transition-all duration-200" />;
            })}
            <text x={pl + i * gw + gw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity={0.55}>{d.etiqueta}</text>
          </g>
        ))}
      </svg>
      {h !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg bg-marino px-3 py-2 text-[12px] text-white shadow-lg">
          <p className="font-semibold">{datos[h].etiqueta}</p>
          {series.map((s) => <p key={s.clave}>{s.nombre}: <b>{formato(datos[h][s.clave] || 0)}</b></p>)}
        </div>
      )}
      {series.length > 1 && (
        <div className="mt-1 flex justify-center gap-4 text-[12px] text-slate-500">
          {series.map((s, k) => <span key={s.clave} className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: paleta(k === 0 ? 0 : k + 1) }} />{s.nombre}</span>)}
        </div>
      )}
    </div>
  );
}

export function LineChart({ datos, alto = 200, ancho = 600, formato = (v) => v, color = "#c62828" }) {
  const [h, setH] = useState(null);
  const W = ancho, H = alto, p = 24;
  const max = Math.max(1, ...datos.map((d) => d.v));
  const pts = datos.map((d, i) => [p + (i * (W - 2 * p)) / Math.max(1, datos.length - 1), H - 28 - ((H - 48) * d.v) / max]);
  const ruta = pts.map((q, i) => `${i ? "L" : "M"}${q[0]},${q[1]}`).join(" ");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Gráfico de líneas">
        <defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".25" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        <path d={`${ruta} L${pts.at(-1)[0]},${H - 28} L${pts[0][0]},${H - 28} Z`} fill="url(#lg)" />
        <path d={ruta} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((q, i) => (
          <g key={i} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} onClick={() => setH(h === i ? null : i)} className="cursor-pointer">
            <circle cx={q[0]} cy={q[1]} r={14} fill="transparent" />
            <circle cx={q[0]} cy={q[1]} r={h === i ? 6 : 4} fill="#fff" stroke={color} strokeWidth="3" />
            <text x={q[0]} y={H - 8} textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity={0.55}>{datos[i].etiqueta}</text>
          </g>
        ))}
      </svg>
      {h !== null && <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg bg-marino px-3 py-2 text-[12px] text-white shadow-lg" style={{ left: `${(pts[h][0] / W) * 100}%` }}><b>{datos[h].etiqueta}</b>: {formato(datos[h].v)}</div>}
    </div>
  );
}

export function Donut({ datos, tam = 180, centro }) {
  // datos: [{ etiqueta, v }]
  const [h, setH] = useState(null);
  const total = datos.reduce((s, d) => s + d.v, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 200 200" width={tam} height={tam} role="img" aria-label="Gráfico circular">
        <g transform="rotate(-90 100 100)">
          {datos.map((d, i) => {
            const len = (d.v / total) * C; const off = -acc; acc += len;
            return <circle key={d.etiqueta} cx="100" cy="100" r={R} fill="none" stroke={paleta(i)} strokeWidth={h === i ? 30 : 24} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={off}
              onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} className="cursor-pointer transition-all duration-200" opacity={h === null || h === i ? 1 : 0.4} />;
          })}
        </g>
        <text x="100" y="98" textAnchor="middle" fontSize="30" fontWeight="800" fill="currentColor">{h === null ? centro ?? total : datos[h].v}</text>
        <text x="100" y="120" textAnchor="middle" fontSize="12" fill="currentColor" fillOpacity=".55">{h === null ? "total" : `${Math.round((datos[h].v / total) * 100)}%`}</text>
      </svg>
      <ul className="min-w-[140px] space-y-1.5 text-[13px]">
        {datos.map((d, i) => (
          <li key={d.etiqueta} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} className="flex cursor-default items-center gap-2">
            <i className="h-3 w-3 shrink-0 rounded-sm" style={{ background: paleta(i) }} />
            <span className="flex-1 text-slate-600 dark:text-slate-300">{d.etiqueta}</span><b>{d.v}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Barras horizontales clicables (ranking de modelos consultados). */
export function RankingBarras({ datos, onElegir, elegido }) {
  const max = Math.max(1, ...datos.map((d) => d.v));
  return (
    <ul className="space-y-2.5">
      {datos.map((d, i) => (
        <li key={d.id}>
          <button onClick={() => onElegir?.(elegido === d.id ? "" : d.id)} className={`group w-full rounded-lg p-1.5 text-left transition ${elegido === d.id ? "bg-marino-50 dark:bg-white/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}>
            <div className="flex justify-between text-[13px]"><span className="font-medium text-marino dark:text-white">{d.etiqueta}</span><b>{d.v}</b></div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.v / max) * 100}%`, background: paleta(i === 0 ? 1 : 0) }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Progreso({ valor, max, tono }) {
  const pct = Math.min(100, Math.round((valor / Math.max(1, max)) * 100));
  const c = tono || (pct >= 100 ? "#13a07a" : pct >= 50 ? "#e0a100" : "#c62828");
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} /></div>
      <p className="mt-1 text-[12px] text-slate-500">{valor} de {max} · {pct}%</p>
    </div>
  );
}
