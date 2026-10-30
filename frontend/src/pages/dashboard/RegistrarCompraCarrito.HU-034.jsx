// HU-034 · Registrar compra a proveedor (base central), como una tienda:
// se elige el proveedor, se agregan los modelos con su color y cantidad, y al registrar se crea una compra
// «Pendiente de factura» por cada modelo y color, todas juntas (si una falla no se guarda ninguna).
// Luego cada compra sigue igual que siempre: su factura (con la cantidad ya puesta) y la identificación de sus motos.
import { useEffect, useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, Card, PageHeader, useConfirm, useToast } from "../../components/ui";
import ModeloImg from "../../components/ModeloImg";
import { ColorPunto } from "../../components/dashboard/Sprint2";
import { REFRESCO_MS, useIntento } from "../../servicios/central";
import useAutoRefresco from "../../hooks/useAutoRefresco";
import { modeloDesdeApi } from "../../lib/modelos";
import { aplicarFotosCentrales } from "../../lib/galeria";
import { ESTADO_COMPRA } from "./Compras.HU-034";
import { COLOR_HEX } from "../../data/mockData";

const COMBUSTIBLES = ["GLP", "GNV", "Gasolina"];
const MAX_CANTIDAD = 999;
const clave = (codmod, color) => `${codmod}|${color}`;
const motos = (n) => `${n} moto${Number(n) === 1 ? "" : "s"}`;

export default function RegistrarCompraCarrito() {
  const { publicos } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const intento = useIntento();
  const [proveedores, setProveedores] = useState(null); const [faltaSql, setFaltaSql] = useState(false);
  const [codpro, setCodpro] = useState("");
  const [pendientes, setPendientes] = useState([]);
  const [filtro, setFiltro] = useState({ comb: "", q: "" });
  const [elegido, setElegido] = useState({}); // por modelo: { color, cantidad }
  const [lineas, setLineas] = useState([]);   // { codmod, color, cantidad, pedido }
  const [reviso, setReviso] = useState(false);
  const [err, setErr] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(null);

  // Todos los modelos de la base (publicados o no), con sus colores y fotos: un modelo nuevo aparece solo
  const [base, setBase] = useState(null);
  const leerModelos = () => api.modelosAdminApi().then((r) => setBase(Array.isArray(r.data) ? r.data : [])).catch(() => setBase((x) => x ?? []));
  useEffect(() => { leerModelos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresco(leerModelos, REFRESCO_MS * 6, true);

  useEffect(() => {
    api.proveedoresCompraApi().then((p) => { setProveedores(p || []); setCodpro((x) => x || p?.[0]?.codpro || ""); })
      .catch((e) => { if (e?.detalle?.faltaSql) setFaltaSql(true); setProveedores([]); setErr(e?.detalle?.faltaSql ? "" : mensajeError(e)); });
    api.comprasListarApi().then((l) => setPendientes((l || []).filter((c) => c.estcom !== "Identificada")))
      .catch(() => api.listarCompras(100, 0).then((r) => setPendientes(r.data || [])).catch(() => {}));
  }, []);

  const modelos = useMemo(() => {
    if (!base?.length) return (publicos || []).filter((m) => m.codmod);
    const ocupados = new Set();
    return base.map((a) => {
      const m = modeloDesdeApi(a, ocupados); ocupados.add(m.id);
      return { ...aplicarFotosCentrales(m, a.imagenes), colores: a.colores || [], publicado: a.estmod === "Publicado" };
    }).sort((x, y) => Number(y.publicado) - Number(x.publicado) || x.nombre.localeCompare(y.nombre, "es"));
  }, [base, publicos]);
  const porCodigo = useMemo(() => new Map(modelos.map((m) => [String(m.codmod), m])), [modelos]);
  const visibles = modelos.filter((m) => (!filtro.comb || m.combustible === filtro.comb) && (!filtro.q.trim() || m.nombre.toLowerCase().includes(filtro.q.trim().toLowerCase())));
  const total = lineas.reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const enCompra = (codmod) => lineas.filter((l) => l.codmod === codmod).reduce((a, l) => a + Number(l.cantidad || 0), 0);
  const similares = (l) => pendientes.filter((c) => String(c.codmod) === l.codmod && String(c.colcom).toLowerCase() === l.color.toLowerCase());
  const conSimilares = lineas.filter((l) => similares(l).length > 0);

  if (!puede("compras.registrar")) {
    return <div className="space-y-3"><Aviso tipo="aviso">Solo gerencia y administración registran compras a proveedor. Tu rol puede consultarlas.</Aviso><Link className="btn btn-secondary" to="/admin/compras">Ver compras</Link></div>;
  }

  const eleccion = (m) => elegido[m.codmod] || { color: m.colores?.length === 1 ? m.colores[0] : "", cantidad: 1 };
  const cambiarEleccion = (m, cambios) => setElegido((x) => ({ ...x, [m.codmod]: { ...eleccion(m), ...cambios } }));

  function agregar(m) {
    const e = eleccion(m);
    if (!e.color) return;
    const n = Math.min(MAX_CANTIDAD, Math.max(1, Number(e.cantidad) || 1));
    setLineas((ls) => {
      const i = ls.findIndex((l) => clave(l.codmod, l.color) === clave(m.codmod, e.color));
      if (i < 0) return [...ls, { codmod: m.codmod, color: e.color, cantidad: n, pedido: "" }];
      return ls.map((l, j) => (j === i ? { ...l, cantidad: Math.min(MAX_CANTIDAD, Number(l.cantidad) + n) } : l));
    });
    cambiarEleccion(m, { cantidad: 1 });
    setErr("");
  }
  const cambiarLinea = (i, cambios) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  const quitarLinea = (i) => setLineas((ls) => ls.filter((_, j) => j !== i));

  async function registrar() {
    if (enviando) return;
    if (!codpro) return setErr("Elige el proveedor.");
    if (!lineas.length) return setErr("Agrega al menos un modelo a la compra.");
    const mal = lineas.findIndex((l) => !Number.isInteger(Number(l.cantidad)) || Number(l.cantidad) < 1 || Number(l.cantidad) > MAX_CANTIDAD);
    if (mal >= 0) return setErr(`Revisa la cantidad de ${porCodigo.get(lineas[mal].codmod)?.nombre || "la línea"} (de 1 a ${MAX_CANTIDAD}).`);
    const pedidoMal = lineas.find((l) => l.pedido && !/^[A-Za-z0-9-]{1,40}$/.test(l.pedido));
    if (pedidoMal) return setErr("El N° de pedido lleva solo letras, números o guiones (máximo 40), tal como figura en Asiri.");
    const pedidos = lineas.map((l) => l.pedido.toUpperCase()).filter(Boolean);
    if (new Set(pedidos).size !== pedidos.length) return setErr("Cada pedido de Asiri va en una sola línea: dos líneas no pueden tener el mismo N° de pedido.");
    if (!reviso) return setErr("Confirma que revisaste las compras pendientes.");
    setErr("");
    const prov = proveedores.find((p) => p.codpro === codpro);
    const ok = await confirmar({
      titulo: `¿Registrar la compra de ${motos(total)}?`,
      texto: `${prov?.nompro || "Proveedor"}: ${lineas.map((l) => `${porCodigo.get(l.codmod)?.nombre} ${l.color} x${l.cantidad}`).join(", ")}. Se crea una compra «Pendiente de factura» por cada modelo y color, con tu usuario, fecha y hora.`,
      boton: "Registrar compra",
    });
    if (!ok) return;
    setEnviando(true);
    try {
      const firma = JSON.stringify([codpro, lineas]);
      const r = await api.registrarCarritoApi(codpro, lineas, intento(firma));
      setHecho({ compras: r || [], proveedor: prov?.nompro || "" });
      toast(`Compra registrada: ${(r || []).length} compra${(r || []).length === 1 ? "" : "s"}, ${motos(total)}`);
    } catch (e) {
      setErr(e.status === 0 || e.status >= 500 ? "No recibimos la confirmación. Vuelve a presionar «Registrar»: la compra no se registrará dos veces." : mensajeError(e));
    } finally { setEnviando(false); }
  }

  // Compra registrada: cada compra sigue con su factura y sus motos
  if (hecho) {
    const n = hecho.compras.reduce((a, c) => a + Number(c.cancom || 0), 0);
    return (
      <div data-compra-registrada>
        <PageHeader titulo="Compra registrada" subtitulo={`${hecho.proveedor}: ${motos(n)} en ${hecho.compras.length} compra${hecho.compras.length === 1 ? "" : "s"}, una por modelo y color. Ahora registra su factura e identifica sus motos.`}>
          <Link to="/admin/compras" className="btn btn-secondary !py-2.5">Ir a Compras</Link>
          <button className="btn btn-secondary !py-2.5" onClick={() => { setHecho(null); setLineas([]); setReviso(false); }}>Registrar otra compra</button>
        </PageHeader>
        <Aviso>Si la factura llega por correo con el N° de pedido de una compra, esa compra se completa sola. Si la registras a mano, la cantidad de motos de cada factura se llena con lo que elegiste aquí.</Aviso>
        <div className="mt-5 grid gap-3">
          {hecho.compras.map((c) => {
            const m = porCodigo.get(String(c.codmod));
            return (
              <Card key={c.codcom} className="flex flex-wrap items-center gap-4" data-compra-creada={c.codcom}>
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-escenario dark:bg-escenario-oscuro">{m && <ModeloImg modelo={m} color={c.colcom} className="h-full w-full object-contain p-1" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-marino dark:text-white">Compra N° {c.codcom} · {c.nommod}</p>
                  <p className="flex items-center gap-1.5 text-[13px] text-slate-500"><ColorPunto color={c.colcom} />{c.colcom}, {motos(c.cancom)}{c.pedido ? `, pedido ${c.pedido}` : ""}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ESTADO_COMPRA[c.estcom] || "bg-slate-200"}`}>{c.estcom}</span>
                <Link className="btn btn-primary !py-2" to={`/admin/compras/${c.codcom}`}>Registrar factura y motos</Link>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div data-carrito>
      <PageHeader titulo="Registrar compra a proveedor" subtitulo="Elige el proveedor y agrega cada modelo con su color y cantidad. Al registrar, cada modelo y color queda como una compra «Pendiente de factura».">
        <Link to="/admin/compras" className="btn btn-secondary !py-2.5">← Compras</Link>
      </PageHeader>
      {faltaSql && <div className="mb-5"><Aviso tipo="aviso">Para registrar compras así falta ejecutar en Supabase el SQL de mejoras finales (docs/supabase-sprint2-final.sql).</Aviso></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <section className="min-w-0">
          <Card className="mb-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="carrito-proveedor">Proveedor</label>
              <select id="carrito-proveedor" className="field-input" value={codpro} onChange={(e) => setCodpro(e.target.value)} disabled={!proveedores?.length}>
                {proveedores === null && <option value="">Cargando proveedores…</option>}
                {proveedores?.length === 0 && <option value="">Sin proveedores de motos</option>}
                {(proveedores || []).map((p) => <option key={p.codpro} value={p.codpro}>{p.nompro}</option>)}
              </select>
              <p className="mt-1 text-[12px] text-slate-400">Proveedores de motos activos{proveedores?.[0]?.rucpro ? `, RUC ${proveedores.find((p) => p.codpro === codpro)?.rucpro || ""}` : ""}.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="carrito-buscar">Buscar modelo</label>
              <input id="carrito-buscar" className="field-input" value={filtro.q} onChange={(e) => setFiltro({ ...filtro, q: e.target.value })} placeholder="Por ejemplo, 250 4V" />
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Combustible">
                {["", ...COMBUSTIBLES].map((c) => (
                  <button key={c || "todos"} type="button" aria-pressed={filtro.comb === c} onClick={() => setFiltro({ ...filtro, comb: c })}
                    className={`rounded-full border px-3 py-1 text-[12.5px] font-semibold ${filtro.comb === c ? "border-marino-700 bg-marino-700 text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-200 text-slate-600 dark:border-white/15 dark:text-white/70"}`}>{c || "Todos"}</button>
                ))}
              </div>
            </div>
          </Card>

          {base === null && <p className="py-10 text-center text-slate-400">Cargando modelos…</p>}
          {base !== null && visibles.length === 0 && <p className="py-10 text-center text-slate-400">{modelos.length ? "Ningún modelo coincide con la búsqueda." : "Todavía no hay modelos registrados."}</p>}
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {visibles.map((m) => {
              const e = eleccion(m); const ya = enCompra(m.codmod);
              // Si el modelo aún no tiene colores registrados, se elige el que figura en la compra
              const colores = m.colores?.length ? m.colores : Object.keys(COLOR_HEX);
              return (
                <Card key={m.codmod} className="relative !p-0 overflow-hidden" data-modelo-carrito={m.codmod}>
                  {ya > 0 && <span className="absolute right-3 top-3 z-10 rounded-full bg-emerald-600 px-2.5 py-1 text-[12px] font-bold text-white">En la compra: {ya}</span>}
                  <div className="h-36 overflow-hidden bg-escenario dark:bg-escenario-oscuro"><ModeloImg modelo={m} color={e.color || undefined} className="h-full w-full object-contain p-3" /></div>
                  <div className="p-4">
                    <h3 className="font-bold leading-tight text-marino dark:text-white">{m.nombre}</h3>
                    {m.publicado === false && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-white/70">No publicado en la web</span>}
                    <p className="text-[12.5px] text-slate-400">{m.combustible}{m.colores?.length ? ` · ${colores.length === 1 ? `solo en ${colores[0]}` : `${colores.length} colores`}` : " · elige el color de la compra"}</p>
                    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={`Color del ${m.nombre}`}>
                      {colores.map((c) => (
                        <button key={c} type="button" role="radio" aria-checked={e.color === c} title={c} data-color={c} onClick={() => cambiarEleccion(m, { color: c })}
                          className={`h-7 w-7 rounded-full ring-1 ring-black/15 transition ${e.color === c ? "outline outline-2 outline-offset-2 outline-marino-700 dark:outline-white" : ""}`} style={{ background: COLOR_HEX[c] || "#94a3b8" }}>
                          <span className="sr-only">{c}</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 h-4 text-[12px] text-slate-500">{e.color}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button type="button" aria-label="Restar una" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-lg dark:border-white/15" onClick={() => cambiarEleccion(m, { cantidad: Math.max(1, Number(e.cantidad) - 1) })}>−</button>
                      <input aria-label={`Cantidad del ${m.nombre}`} inputMode="numeric" className="field-input !w-16 !py-1.5 text-center font-bold tabular-nums" value={e.cantidad} maxLength={3}
                        onChange={(ev) => cambiarEleccion(m, { cantidad: ev.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 3) })} />
                      <button type="button" aria-label="Sumar una" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-300 text-lg dark:border-white/15" onClick={() => cambiarEleccion(m, { cantidad: Math.min(MAX_CANTIDAD, Number(e.cantidad || 0) + 1) })}>+</button>
                    </div>
                    <button type="button" disabled={!e.color || !Number(e.cantidad)} onClick={() => agregar(m)} data-agregar={m.codmod}
                      className="btn btn-primary mt-3 w-full !py-2.5 disabled:cursor-not-allowed disabled:opacity-50">{e.color ? "Agregar a la compra" : "Elige un color"}</button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card data-tu-compra id="tu-compra">
            <h2 className="text-lg font-bold text-marino dark:text-white">Tu compra</h2>
            <p className="text-[12.5px] text-slate-400">{proveedores?.find((p) => p.codpro === codpro)?.nompro || "Elige el proveedor"}</p>
            {lineas.length === 0 ? <p className="mt-4 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center text-[13.5px] text-slate-400 dark:border-white/10">Agrega modelos desde la lista: elige el color, la cantidad y presiona «Agregar a la compra».</p> : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                {lineas.map((l, i) => {
                  const m = porCodigo.get(l.codmod);
                  return (
                    <li key={clave(l.codmod, l.color)} className="py-3" data-linea-carrito={clave(l.codmod, l.color)}>
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-escenario dark:bg-escenario-oscuro">{m && <ModeloImg modelo={m} color={l.color} className="h-full w-full object-contain p-0.5" />}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-semibold text-marino dark:text-white">{m?.nombre || `Modelo ${l.codmod}`}</p>
                          <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500"><ColorPunto color={l.color} className="h-2.5 w-2.5" />{l.color}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" aria-label="Restar una" className="grid h-7 w-7 place-items-center rounded-md border border-slate-300 dark:border-white/15" onClick={() => cambiarLinea(i, { cantidad: Math.max(1, Number(l.cantidad) - 1) })}>−</button>
                          <input aria-label={`Cantidad de ${m?.nombre} ${l.color}`} inputMode="numeric" className="w-10 rounded-md border border-transparent bg-transparent text-center font-bold tabular-nums focus:border-slate-300" value={l.cantidad} maxLength={3}
                            onChange={(ev) => cambiarLinea(i, { cantidad: ev.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 3) })} />
                          <button type="button" aria-label="Sumar una" className="grid h-7 w-7 place-items-center rounded-md border border-slate-300 dark:border-white/15" onClick={() => cambiarLinea(i, { cantidad: Math.min(MAX_CANTIDAD, Number(l.cantidad || 0) + 1) })}>+</button>
                        </div>
                        <button type="button" aria-label={`Quitar ${m?.nombre} ${l.color}`} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-acento dark:hover:bg-white/10" onClick={() => quitarLinea(i)}>✕</button>
                      </div>
                      <input aria-label={`N° de pedido de Asiri de ${m?.nombre} ${l.color}`} className="field-input mt-2 !py-1.5 text-[13px]" maxLength={40} value={l.pedido} placeholder="N° de pedido de Asiri (opcional)"
                        onChange={(ev) => cambiarLinea(i, { pedido: ev.target.value.replace(/\s/g, "") })} />
                    </li>
                  );
                })}
              </ul>
            )}
            <dl className="mt-3 space-y-1 rounded-xl bg-marino-50 px-4 py-3 text-[14px] dark:bg-white/5">
              <div className="flex justify-between"><dt className="text-slate-500">Modelos</dt><dd className="font-semibold">{new Set(lineas.map((l) => l.codmod)).size}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Compras que se crean (modelo y color)</dt><dd className="font-semibold">{lineas.length}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-[17px] font-bold text-marino dark:border-white/10 dark:text-white"><dt>Total de motos</dt><dd data-total-motos>{total}</dd></div>
            </dl>

            {conSimilares.length > 0 && <div className="mt-3"><Aviso tipo="aviso">Ya hay compras pendientes de {conSimilares.map((l) => `${porCodigo.get(l.codmod)?.nombre} ${l.color} (#${similares(l).map((c) => c.codcom).join(", #")})`).join("; ")}. Confirma que no sea la misma antes de registrar otra.</Aviso></div>}
            <details className="mt-3 text-[13px]">
              <summary className="cursor-pointer font-semibold text-marino-700 dark:text-white">Compras pendientes ({pendientes.length})</summary>
              {pendientes.length === 0 ? <p className="mt-2 text-slate-400">No hay compras pendientes.</p> : (
                <ul className="mt-2 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 dark:divide-white/10 dark:border-white/10">
                  {pendientes.map((c) => <li key={c.codcom} className="flex justify-between gap-2 px-3 py-1.5"><span>#{c.codcom} · {c.nommod} · {c.colcom} · {c.cancom}</span><span className="shrink-0 text-slate-400">{c.estcom}</span></li>)}
                </ul>
              )}
            </details>
            <label className="mt-3 flex items-start gap-2 text-[13.5px] font-medium"><input id="carrito-reviso" type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={reviso} onChange={(e) => setReviso(e.target.checked)} />Revisé las compras pendientes y esta compra no está registrada.</label>
            {err && <div className="mt-3"><Aviso tipo="error">{err}</Aviso></div>}
            <button id="carrito-registrar" type="button" className="btn btn-acento mt-4 w-full !py-3.5 text-[15px] shadow-lg shadow-acento/25" disabled={enviando || faltaSql} onClick={registrar}>
              {enviando ? "Registrando…" : `Registrar compra${total ? ` · ${motos(total)}` : ""}`}
            </button>
            <p className="mt-3 text-[12px] text-slate-500">Cada compra queda «Pendiente de factura» a nombre de {user?.nombre || "tu usuario"}, con fecha y hora automáticas. Al registrar su factura, la cantidad de motos ya viene puesta.</p>
          </Card>
        </aside>
      </div>
      {/* En pantallas angostas la compra queda al final: una barra fija lleva hasta ella */}
      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-[#121a2b]/95 xl:hidden" data-barra-compra>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-[14px] font-semibold text-marino dark:text-white">Tu compra: {motos(total)}<span className="block text-[12px] font-normal text-slate-500">{lineas.length} modelo{lineas.length === 1 ? "" : "s"} y color{lineas.length === 1 ? "" : "es"}</span></p>
            <button type="button" className="btn btn-acento !py-2.5" onClick={() => document.getElementById("tu-compra")?.scrollIntoView({ behavior: "smooth", block: "start" })}>Ver y registrar</button>
          </div>
        </div>
      )}
      {lineas.length > 0 && <div className="h-20 xl:hidden" aria-hidden="true" />}
    </div>
  );
}
