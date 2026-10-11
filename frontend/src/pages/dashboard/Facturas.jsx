// Facturas y clientes
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { formatoSoles } from "../../data/mockData";
import { Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, useToast } from "../../components/ui";
import { descargarComprobante, numeroComprobante } from "../../lib/voucher";

const soles2 = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Facturas() {
  const { ventas, modelos, publicos = [] } = useApp();
  const { puede } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState("emitidos");
  const [q, setQ] = useState("");
  const [ver, setVer] = useState(null);
  const nombreModelo = (id) => (modelos.find((m) => m.id === id) || publicos.find((m) => m.id === id))?.nombre || "—";
  const coincide = (v) => !q || `${v.cliente} ${v.documento} ${v.celular} ${v.comprobante ? numeroComprobante(v.comprobante) : ""}`.toLowerCase().includes(q.toLowerCase().trim());

  const emitidos = useMemo(() => ventas.filter((v) => v.comprobante).sort((a, b) => (b.comprobante.fecha || "").localeCompare(a.comprobante.fecha || "")), [ventas]);
  const porFacturar = useMemo(() => ventas.filter((v) => !v.comprobante && ["Pedido registrado", "Entregado"].includes(v.etapa)), [ventas]);
  const clientes = useMemo(() => {
    const mapa = new Map();
    ventas.filter((v) => ["Pedido registrado", "Entregado"].includes(v.etapa)).forEach((v) => {
      const k = v.documento || v.celular;
      const c = mapa.get(k) || { cliente: v.cliente, documento: v.documento, celular: v.celular, compras: 0, total: 0, ultima: "", motos: [] };
      c.compras += 1; c.total += Number(v.total || 0); c.ultima = c.ultima > v.fecha ? c.ultima : v.fecha;
      c.motos.push(`${nombreModelo(v.modelo)}${v.color ? ` ${v.color}` : ""}`);
      mapa.set(k, c);
    });
    return [...mapa.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [ventas, modelos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function descargar(v) {
    try { await descargarComprobante({ comprobante: v.comprobante, venta: v, modelo: nombreModelo(v.modelo) }); toast(`Descargando ${numeroComprobante(v.comprobante)}`); }
    catch { toast("No se pudo generar el PDF. Inténtalo de nuevo.", "error"); }
  }

  const TABS = [["emitidos", `Comprobantes emitidos (${emitidos.length})`], ["pendientes", `Por facturar (${porFacturar.length})`], ["clientes", `Clientes (${clientes.length})`]];
  return (
    <div>
      <PageHeader titulo="Facturas y clientes" subtitulo="Comprobantes de venta emitidos, ventas por facturar y clientes que ya compraron. Cada comprobante se descarga en PDF.">
        <button className="btn btn-primary !py-2.5" onClick={() => navigate("/admin/ventas", { state: { nueva: true } })}>+ Registrar venta</button>
      </PageHeader>
      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Comprobantes emitidos" valor={emitidos.length} />
        <Stat etiqueta="Monto facturado" valor={formatoSoles(Math.round(emitidos.reduce((s, v) => s + Number(v.comprobante.total || 0), 0)))} tono="verde" />
        <Stat etiqueta="Por facturar" valor={porFacturar.length} tono={porFacturar.length ? "ambar" : "marino"} nota="Pedidos y entregas sin comprobante" />
        <Stat etiqueta="Clientes" valor={clientes.length} nota="Con pedido o entrega" />
      </div>
      <Card className="mb-5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Vista" className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
          {TABS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-lg px-3.5 py-2 text-[13.5px] font-semibold transition ${tab === k ? "bg-white text-marino shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500 hover:text-marino dark:hover:text-white"}`}>{t}</button>)}
        </div>
        <div className="ml-auto min-w-[220px] flex-1 sm:max-w-sm"><label className="field-label" htmlFor="fac-q">Buscar</label><input id="fac-q" className="field-input" placeholder="Cliente, DNI, celular o N° de comprobante" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </Card>

      {/* Comprobantes emitidos */}
      {tab === "emitidos" && (emitidos.filter(coincide).length === 0 ? <Vacio titulo="Sin comprobantes" texto="Cuando emitas una boleta o factura desde Ventas aparecerá aquí." /> : (
        <Tabla columnas={["Comprobante", "Fecha", "Cliente", "Moto", "Total", "Emitido por", "Acciones"]}>
          {emitidos.filter(coincide).map((v) => (
            <tr key={v.id}>
              <td className="px-4 py-3"><p className="font-mono font-semibold text-marino dark:text-white">{numeroComprobante(v.comprobante)}</p><p className="text-[12px] text-slate-400">{v.comprobante.tipo}</p></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{v.comprobante.fecha}</td>
              <td className="px-4 py-3"><p className="font-semibold">{v.comprobante.cliente}</p><p className="text-[12px] text-slate-400">{v.comprobante.tipoDoc} {v.comprobante.doc} · {v.celular}</p></td>
              <td className="px-4 py-3">{nombreModelo(v.modelo)}<span className="block text-[12px] text-slate-400">{[v.color, v.techo ? `techo ${v.techo}` : "sin techo"].filter(Boolean).join(" · ")}</span></td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{soles2(v.comprobante.total)}</td>
              <td className="px-4 py-3">{v.comprobante.emitidoPor}</td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5"><button className={btnMini} onClick={() => setVer(v)}>Ver</button><button className={btnMini} onClick={() => descargar(v)}>Descargar PDF</button></div></td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Por facturar */}
      {tab === "pendientes" && (porFacturar.filter(coincide).length === 0 ? <Vacio titulo="Todo facturado" texto="No hay pedidos ni entregas pendientes de comprobante." /> : (
        <Tabla columnas={["Fecha", "Cliente", "Moto", "Total", "Etapa", "Acción"]}>
          {porFacturar.filter(coincide).map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{v.fecha}</td>
              <td className="px-4 py-3"><p className="font-semibold">{v.cliente}</p><p className="text-[12px] text-slate-400">{v.documento || "Sin documento"} · {v.celular}</p></td>
              <td className="px-4 py-3">{nombreModelo(v.modelo)}<span className="block text-[12px] text-slate-400">{[v.color, v.techo ? `techo ${v.techo}` : "sin techo"].filter(Boolean).join(" · ")}</span></td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatoSoles(v.total)}</td>
              <td className="px-4 py-3">{v.etapa}</td>
              <td className="px-4 py-3">{puede("comprobantes.emitir") ? <button className={btnMini} onClick={() => navigate("/admin/ventas", { state: { emitir: v.id } })}>Emitir comprobante</button> : <span className="text-[12.5px] text-slate-400">Lo emite la gerencia</span>}</td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Clientes */}
      {tab === "clientes" && (clientes.filter(coincide).length === 0 ? <Vacio titulo="Sin clientes" texto="Los clientes aparecen al registrar su pedido o entrega." /> : (
        <Tabla columnas={["Cliente", "Documento", "Celular", "Compras", "Total comprado", "Última compra"]}>
          {clientes.filter(coincide).map((c) => (
            <tr key={`${c.documento}-${c.celular}`}>
              <td className="px-4 py-3"><p className="font-semibold">{c.cliente}</p><p className="text-[12px] text-slate-400">{c.motos.join(", ")}</p></td>
              <td className="px-4 py-3">{c.documento || "—"}</td>
              <td className="px-4 py-3"><a className="underline-offset-2 hover:underline" href={`https://wa.me/51${c.celular}`} target="_blank" rel="noopener noreferrer">{c.celular}</a></td>
              <td className="px-4 py-3">{c.compras}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatoSoles(c.total)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{c.ultima}</td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Ver comprobante */}
      <Modal abierto={!!ver} onClose={() => setVer(null)} titulo={ver ? `${ver.comprobante.tipo} ${numeroComprobante(ver.comprobante)}` : ""} ancho="max-w-lg"
        pie={<><Link to="/admin/ventas" className="btn btn-secondary !py-2">Ir a Ventas</Link>{ver && <button className="btn btn-primary !py-2" onClick={() => descargar(ver)}>Descargar PDF</button>}</>}>
        {ver && (() => { const c = ver.comprobante; return (
          <dl className="grid grid-cols-2 gap-3 text-[13.5px]">
            <div><dt className="text-slate-500">Cliente</dt><dd className="font-semibold">{c.cliente}</dd></div>
            <div><dt className="text-slate-500">{c.tipoDoc}</dt><dd className="font-semibold">{c.doc}</dd></div>
            <div><dt className="text-slate-500">Fecha</dt><dd className="font-semibold">{c.fecha}</dd></div>
            <div><dt className="text-slate-500">Medio de pago</dt><dd className="font-semibold">{c.medio}</dd></div>
            <div className="col-span-2"><dt className="text-slate-500">Detalle</dt><dd>{c.descripcion}{ver.techo ? ` · techo adicional ${ver.techo} (${formatoSoles(ver.techoPrecio)})` : ""}</dd></div>
            <div><dt className="text-slate-500">Op. gravada</dt><dd>{soles2(c.gravada)}</dd></div>
            <div><dt className="text-slate-500">IGV 18%</dt><dd>{soles2(c.igv)}</dd></div>
            <div className="col-span-2 flex justify-between border-t border-slate-200 pt-2 text-[15px] font-bold text-marino dark:border-white/10 dark:text-white"><dt>Total</dt><dd>{soles2(c.total)}</dd></div>
          </dl>
        ); })()}
      </Modal>
    </div>
  );
}
