import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { ESTADOS_PREPARACION, PROVEEDORES_TECHO, TECHO_REQUIERE_PROVEEDOR, TIPOS_TECHO } from "../../data/mockData";
import { Aviso, Campo, Card, PageHeader, useConfirm, useToast } from "../../components/ui";
import HUBadge from "../../components/HUBadge";

const DESCRIPCION_TECHO = {
  "Sin techo": "La unidad no lleva techo instalado.",
  Lona: "Techo de lona de fábrica. No necesita proveedor externo.",
  "Fibra Básico": "Techo de fibra instalado por un proveedor externo.",
  "Fibra Superlujo": "Fibra con acabado superlujo, instalada por un proveedor externo.",
  "Fibra Superlujo Deportivo": "Fibra deportiva superlujo, instalada por un proveedor externo.",
};
const DISP = { "No disponible": "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70", Disponible: "bg-emerald-100 text-emerald-700", Separada: "bg-amber-100 text-amber-700", Vendida: "bg-slate-200 text-slate-600" };
const hoy = () => new Date().toISOString().slice(0, 10);

/** Ícono simple de techo para las opciones (perfil lateral de la cabina). */
function SiluetaTecho({ tipo }) {
  const fibra = TECHO_REQUIERE_PROVEEDOR(tipo);
  return (
    <svg viewBox="0 0 64 36" className="h-10 w-[72px] shrink-0" aria-hidden="true">
      <path d="M8 28h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".4" />
      <circle cx="16" cy="29" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" opacity=".8" />
      <circle cx="48" cy="29" r="4" fill="none" stroke="currentColor" strokeWidth="2.2" opacity=".8" />
      <path d="M12 24V16l6-4h26l8 6v6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" opacity=".8" />
      {tipo === "Lona" && <path d="M14 12c6-6 30-6 36 0" fill="none" stroke="#c62828" strokeWidth="2.5" strokeDasharray="3 3" />}
      {fibra && <path d={tipo === "Fibra Superlujo Deportivo" ? "M12 12l8-7h26l10 8" : "M13 12l7-6h25l8 6"} fill="none" stroke="#c62828" strokeWidth="3.5" strokeLinejoin="round" />}
    </svg>
  );
}

/**
 * Ficha de la unidad — HU-004 "Actualizar la configuración del techo".
 * Escenario 3: fibra externa → se guarda el tipo y el proveedor (FIVESA, JAVICAR o FIBRAT), sin precios no confirmados.
 * Escenario 4: el techo queda «Pendiente de instalación» hasta que un usuario autorizado confirma la instalación.
 * Escenario 5: el vendedor solo consulta y puede dejar una observación comercial sin alterar la configuración técnica.
 */
export default function FichaUnidadRuta() {
  const { id } = useParams();
  return <FichaUnidad key={id} id={id} />;
}

function FichaUnidad({ id }) {
  const { unidades, modelos, compras, actualizar } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const u = unidades.find((x) => x.id === id);
  const gestiona = puede("unidades.gestionar");
  const observa = gestiona || puede("unidades.observar");
  const [f, setF] = useState(() => ({ techo: u?.techo || "Sin techo", proveedor: u?.proveedorTecho || "", detalle: u?.detalleTecho || "", preparacion: u?.preparacion || "Sin preparar" }));
  const [err, setErr] = useState({});
  const [obs, setObs] = useState("");

  if (!u) return <div className="space-y-3"><Aviso tipo="error">No encontramos la unidad {id}. Puede que se haya eliminado.</Aviso><Link className="btn btn-secondary" to="/admin/inventario">Volver al inventario</Link></div>;

  const m = modelos.find((x) => x.id === u.modelo);
  const compra = compras.find((c) => c.codcom === u.codcom);
  const requiere = TECHO_REQUIERE_PROVEEDOR(f.techo);
  const log = (detalle) => [...(u.historial || []), { fecha: hoy(), detalle: `${detalle} · ${user.nombre}` }];
  const cambio = f.techo !== u.techo || (requiere && f.proveedor !== (u.proveedorTecho || "")) || f.detalle !== (u.detalleTecho || "") || f.preparacion !== u.preparacion;

  async function guardar(e) {
    e.preventDefault();
    const x = {};
    if (requiere && !f.proveedor) x.proveedor = "Elige el proveedor que instalará la fibra.";
    if (u.disponibilidad === "Vendida") x.general = "La unidad ya se vendió: su configuración no se modifica.";
    setErr(x); if (Object.keys(x).length) return;
    const techoCambia = f.techo !== u.techo || (requiere && f.proveedor !== u.proveedorTecho);
    const estado = f.techo === "Sin techo" ? "" : techoCambia ? "Pendiente de instalación" : u.estadoTecho;
    const prep = estado === "Pendiente de instalación" && f.preparacion === "Lista para entrega" ? "Pendiente de techo" : f.preparacion;
    const texto = `Techo: ${f.techo}${requiere ? ` (${f.proveedor})` : ""}${estado ? ` · ${estado.toLowerCase()}` : ""}${f.detalle ? ` · ${f.detalle}` : ""}${prep !== u.preparacion ? ` · preparación: ${prep}` : ""}`;
    if (!(await confirmar({ titulo: "¿Guardar la configuración?", texto: `${u.id}: ${texto}.${techoCambia && u.estadoTecho === "Instalado" ? " El techo anterior figuraba instalado; el nuevo quedará pendiente de instalación." : ""}`, boton: "Guardar configuración" }))) return;
    actualizar("unidades", u.id, { techo: f.techo, proveedorTecho: requiere ? f.proveedor : "", detalleTecho: f.detalle.trim(), estadoTecho: estado, preparacion: prep, historial: log(texto) }, `Techo actualizado en ${u.id}`);
    if (prep !== f.preparacion) setF((p) => ({ ...p, preparacion: prep }));
    toast("Configuración de techo guardada");
  }

  async function confirmarInstalacion() {
    if (!(await confirmar({ titulo: "Confirmar instalación", texto: `¿${u.proveedorTecho || "El proveedor"} ya instaló el techo ${u.techo} en ${u.id}? Se mostrará como instalado en la consulta de stock.`, boton: "Confirmar instalación" }))) return;
    const prep = u.preparacion === "Pendiente de techo" ? "En preparación" : u.preparacion;
    actualizar("unidades", u.id, { estadoTecho: "Instalado", fechaInstalacion: hoy(), preparacion: prep, historial: log(`Techo instalado: ${u.techo}${u.proveedorTecho ? ` por ${u.proveedorTecho}` : ""}`) }, `Techo instalado en ${u.id}`);
    setF((p) => ({ ...p, preparacion: prep }));
    toast("Instalación confirmada");
  }

  function agregarObservacion(e) {
    e.preventDefault();
    const t = obs.trim();
    if (t.length < 3) return toast("Escribe la observación.", "error");
    actualizar("unidades", u.id, { observaciones: [...(u.observaciones || []), { fecha: hoy(), autor: user.nombre, texto: t }], historial: log(`Observación comercial: ${t}`) }, `Observación en ${u.id}`);
    setObs(""); toast("Observación agregada. La configuración técnica no cambió.");
  }

  return (
    <div>
      <HUBadge code="HU-004" titulo="Actualizar la configuración del techo" />
      <PageHeader titulo={`${u.id} · ${m?.nombre || u.modelo}`} subtitulo={`${u.color} · motor ${u.motor} · chasis ${u.chasis}`}>
        <Link to="/admin/inventario" className="btn btn-secondary !py-2.5">← Inventario</Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2 text-[12.5px]">
        <span className={`rounded-full px-3 py-1 font-semibold ${DISP[u.disponibilidad]}`}>{u.disponibilidad}</span>
        <span className="rounded-full bg-marino-50 px-3 py-1 font-semibold text-marino dark:bg-white/10 dark:text-white">{u.ubicacion || "Sin recepción"}</span>
        <span className="rounded-full bg-marino-50 px-3 py-1 font-semibold text-marino dark:bg-white/10 dark:text-white">{u.preparacion}</span>
        {u.estadoTecho && <span className={`rounded-full px-3 py-1 font-semibold ${u.estadoTecho === "Instalado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>Techo {u.estadoTecho.toLowerCase()}</span>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-marino dark:text-white">Configuración de techo</h2>
                <p className="text-[13px] text-slate-500">Tipo de techo y proveedor de esta unidad. No se registran precios ni modelos de fibra no confirmados.</p>
              </div>
              {u.estadoTecho === "Pendiente de instalación" && gestiona && <button className="btn btn-primary !py-2" onClick={confirmarInstalacion}>Confirmar instalación</button>}
            </div>

            {u.estadoTecho === "Pendiente de instalación" && <div className="mt-4"><Aviso tipo="aviso">El techo {u.techo}{u.proveedorTecho ? ` de ${u.proveedorTecho}` : ""} figura pendiente de instalación.</Aviso></div>}
            {u.estadoTecho === "Instalado" && <div className="mt-4"><Aviso tipo="ok">Techo {u.techo}{u.proveedorTecho ? ` de ${u.proveedorTecho}` : ""} instalado{u.fechaInstalacion ? ` el ${u.fechaInstalacion}` : ""}.</Aviso></div>}

            {gestiona ? (
              <form onSubmit={guardar} className="mt-5 space-y-5" noValidate>
                <fieldset>
                  <legend className="field-label">Tipo de techo</legend>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {TIPOS_TECHO.map((t) => (
                      <label key={t} className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition ${f.techo === t ? "border-marino-700 bg-marino-50 text-marino dark:border-white/50 dark:bg-white/10 dark:text-white" : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-white/10"}`}>
                        <input type="radio" name="techo" className="sr-only" checked={f.techo === t} onChange={() => setF({ ...f, techo: t, proveedor: TECHO_REQUIERE_PROVEEDOR(t) ? f.proveedor : "" })} />
                        <SiluetaTecho tipo={t} />
                        <span className="min-w-0"><span className="block text-[14px] font-semibold text-marino dark:text-white">{t}</span><span className="block text-[12px] leading-snug text-slate-500">{DESCRIPCION_TECHO[t]}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo etiqueta={requiere ? "Proveedor de la fibra (obligatorio)" : "Proveedor"} error={err.proveedor}>
                    <select id="ficha-proveedor" className="field-input" value={f.proveedor} disabled={!requiere} onChange={(e) => setF({ ...f, proveedor: e.target.value })}>
                      <option value="">{requiere ? "Elige el proveedor" : "No aplica"}</option>
                      {PROVEEDORES_TECHO.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </Campo>
                  <Campo etiqueta="Preparación de la unidad">
                    <select id="ficha-preparacion" className="field-input" value={f.preparacion} onChange={(e) => setF({ ...f, preparacion: e.target.value })}>{ESTADOS_PREPARACION.map((p) => <option key={p}>{p}</option>)}</select>
                  </Campo>
                  <Campo etiqueta="Detalle técnico (opcional)" className="sm:col-span-2">
                    <input id="ficha-detalle" className="field-input" value={f.detalle} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Ej: con portaequipaje, color de la fibra" />
                  </Campo>
                </div>
                {err.general && <Aviso tipo="error">{err.general}</Aviso>}
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn btn-primary" disabled={!cambio}>Guardar configuración</button>
                  {!cambio && <span className="text-[12.5px] text-slate-400">Sin cambios por guardar.</span>}
                </div>
              </form>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[["Tipo de techo", u.techo], ["Proveedor", u.proveedorTecho || "No aplica"], ["Preparación", u.preparacion]].map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-marino-50 p-4 dark:bg-white/5"><p className="text-[12px] text-slate-500">{k}</p><p className="font-semibold text-marino dark:text-white">{v}</p></div>
                ))}
                <p className="text-[12.5px] text-slate-500 sm:col-span-3">Tu rol puede consultar la configuración técnica, pero no cambiarla. Si el cliente pide otro techo, déjalo como observación comercial.</p>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="text-lg font-bold text-marino dark:text-white">Observaciones comerciales</h2>
            <p className="text-[13px] text-slate-500">Notas de venta sobre esta unidad. No modifican la configuración técnica.</p>
            {(u.observaciones || []).length === 0 ? <p className="mt-4 text-[13.5px] text-slate-400">Aún no hay observaciones.</p> : (
              <ul className="mt-4 space-y-2">{[...u.observaciones].reverse().map((o, i) => <li key={i} className="rounded-lg bg-slate-50 px-4 py-3 text-[14px] dark:bg-white/5"><p>{o.texto}</p><p className="mt-1 text-[12px] text-slate-400">{o.autor} · {o.fecha}</p></li>)}</ul>
            )}
            {observa && (
              <form onSubmit={agregarObservacion} className="mt-4 flex flex-col gap-2 sm:flex-row" noValidate>
                <input id="ficha-observacion" className="field-input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ej: cliente interesado en fibra deportiva roja" />
                <button className="btn btn-secondary shrink-0 !py-2.5">Agregar observación</button>
              </form>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-bold text-marino dark:text-white">Datos de la unidad</h2>
            <dl className="divide-y divide-slate-100 text-[13.5px] dark:divide-white/10">
              {[["Modelo", m?.nombre || u.modelo], ["Color", u.color], ["N° de motor", u.motor], ["N° de chasis", u.chasis], ["Ubicación", u.ubicacion || "Sin recepción"], ["Disponibilidad", u.disponibilidad]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold text-marino dark:text-white">{v}</dd></div>
              ))}
              <div className="flex justify-between gap-4 py-2"><dt className="text-slate-500">Compra</dt><dd className="text-right font-semibold">{compra ? <Link className="text-marino-700 underline-offset-2 hover:underline dark:text-white" to={`/admin/compras/${compra.codcom}`}>#{compra.codcom} · {compra.estcom}</Link> : "Registro anterior"}</dd></div>
            </dl>
          </Card>
          <Card>
            <h2 className="mb-3 font-bold text-marino dark:text-white">Historial</h2>
            <ol className="space-y-3 border-l-2 border-slate-200 pl-4 dark:border-white/15">
              {[...(u.historial || [])].reverse().map((h, i) => <li key={i} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marino dark:bg-white" /><p className="text-[12px] text-slate-400">{h.fecha}</p><p className="text-[13.5px]">{h.detalle}</p></li>)}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
