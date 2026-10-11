// HU-026 · Ubicaciones
import { useEffect, useMemo, useState } from "react";
import { esCorreo, soloDigitos } from "../../lib/validar";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { TIPOS_UBICACION, TIPO_A_API, TIPO_DE_API } from "../../data/mockData";
import { Aviso, Campo, Modal, PageHeader, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";

const norm = (t) => String(t).trim().replace(/\s+/g, " ").toLowerCase();
const VACIO = { nombre: "", tipo: "Sede propia", direccion: "", horario: "Lunes a Sábado de 9:00 AM a 5:00 PM", horarioNota: "Domingos: consultar por WhatsApp o en sede", telefono: "907721481", correo: "inversionesepsamotor@gmail.com" };

export default function Ubicaciones() {
  const { ubicaciones, unidades, agregar, actualizar, eliminar, reemplazar } = useApp();
  const limpio = (t) => String(t || "").trim().replace(/\s+/g, " ");
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState(""); const [est, setEst] = useState("");
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO); const [err, setErr] = useState({});
  const [cargando, setCargando] = useState(MODO_REAL); const [errorApi, setErrorApi] = useState("");
  const [guardando, setGuardando] = useState(false);
  const gestiona = puede("ubicaciones.gestionar");
  const navigate = useNavigate();

  // Cargar desde la API
  async function cargar() {
    if (!MODO_REAL) return;
    setCargando(true); setErrorApi("");
    try {
      const { data } = await api.listarUbicaciones();
      const mezcla = data.map((r) => {
        const loc = ubicaciones.find((u) => norm(u.nombre) === norm(r.nomubi)) || {};
        return { horario: "", horarioNota: "", telefono: "", correo: "", ...loc, id: Number(r.codubi), nombre: r.nomubi, tipo: TIPO_DE_API[r.tipubi] || r.tipubi, direccion: r.dirubi || "", activo: !!r.estubi };
      });
      reemplazar("ubicaciones", mezcla);
    } catch (e) { setErrorApi(mensajeError(e)); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, []); // eslint-disable-line

  const lista = useMemo(() => ubicaciones.filter((u) => (!q || u.nombre.toLowerCase().includes(q.toLowerCase())) && (!tipo || u.tipo === tipo) && (!est || (est === "activa") === u.activo)), [ubicaciones, q, tipo, est]);
  const unidadesEn = (nombre) => unidades.filter((u) => u.ubicacion === nombre && u.disponibilidad !== "Vendida").length;

  function abrir(u) { setErr({}); setF(u ? { ...VACIO, ...u, telefono: soloDigitos(String(u.telefono || "").replace(/^51(?=9\d{8}$)/, ""), 9) } : VACIO); setModal({ u }); }

  // Guardar
  async function guardar(e) {
    e.preventDefault(); const x = {};
    const nombre = f.nombre.trim().replace(/\s+/g, " ");
    if (!nombre || nombre.length > 120) x.nombre = "El nombre es obligatorio (máx. 120 caracteres).";
    else if ((nombre.match(/\p{L}/gu) || []).length < 2) x.nombre = "Escribe un nombre con letras (por ejemplo, Almacén Ancón).";
    if (ubicaciones.some((u) => norm(u.nombre) === norm(nombre) && u.id !== modal.u?.id)) x.nombre = "Ya existe una ubicación con ese nombre.";
    if (f.direccion.trim().length > 250) x.direccion = "La dirección admite hasta 250 caracteres.";
    else if (f.tipo === "Sede propia" && (limpio(f.direccion).length < 8 || (limpio(f.direccion).match(/\p{L}/gu) || []).length < 3)) x.direccion = "Una sede propia se publica en la web: escribe su dirección.";
    if (f.tipo === "Sede propia") {
      if (limpio(f.horario).length < 5 || !/\d/.test(f.horario)) x.horario = "Escribe el horario de atención (con sus horas)."; else if (limpio(f.horario).length > 150) x.horario = "Máximo 150 caracteres.";
      if (limpio(f.horarioNota).length > 150) x.horarioNota = "Máximo 150 caracteres.";
    }
    if (f.tipo === "Sede propia" && f.telefono && !/^9\d{8}$/.test(f.telefono)) x.telefono = "Celular / WhatsApp de 9 dígitos que empiece con 9.";
    if (f.tipo === "Sede propia" && f.correo && !esCorreo(f.correo)) x.correo = "Escribe un correo válido.";
    setErr(x); if (Object.keys(x).length) return;
    const datos = { ...f, nombre, direccion: limpio(f.direccion), horario: limpio(f.horario), horarioNota: limpio(f.horarioNota), telefono: f.telefono.replace(/\s/g, "") };
    setGuardando(true);
    try {
      let id = modal.u?.id;
      if (MODO_REAL) {
        const cuerpo = { nomubi: nombre, tipubi: TIPO_A_API[f.tipo] || "Sede", dirubi: datos.direccion || null };
        const r = modal.u ? await api.editarUbicacion(modal.u.id, cuerpo) : await api.crearUbicacion(cuerpo);
        id = Number(r.data?.codubi ?? id);
      }
      if (modal.u) {
        actualizar("ubicaciones", modal.u.id, { ...datos, id }, `Ubicación editada: ${nombre}`);
        if (modal.u.nombre !== nombre) unidades.filter((u) => u.ubicacion === modal.u.nombre).forEach((u) => actualizar("unidades", u.id, { ubicacion: nombre }));
      }
      else agregar("ubicaciones", { ...datos, id: id ?? undefined, activo: true }, `Ubicación creada: ${nombre}`);
      toast(modal.u ? "Ubicación actualizada. Los cambios ya se ven en la web." : "Ubicación creada");
      setModal(null);
    } catch (e2) { toast(mensajeError(e2), "error"); } finally { setGuardando(false); }
  }

  // Activar / desactivar y eliminar
  async function alternar(u) {
    const nuevo = !u.activo;
    if (!nuevo) {
      const n = MODO_REAL ? 0 : unidades.filter((x) => x.ubicacion === u.nombre).length;
      if (n) {
        if (await confirmar({ titulo: `No se puede desactivar ${u.nombre}`, texto: `Tiene ${n} unidad(es) asignadas. Trasládalas a otra ubicación activa y luego vuelve a intentarlo.`, boton: "Ver esas unidades" })) navigate("/admin/inventario", { state: { ubic: u.nombre } });
        return;
      }
      if (!(await confirmar({ titulo: "Desactivar ubicación", texto: `${u.nombre} dejará de ofrecerse en nuevos movimientos${u.tipo === "Sede propia" ? " y desaparecerá de la web pública" : ""}. El historial se conserva.`, boton: "Desactivar" }))) return;
    }
    try {
      if (MODO_REAL) await api.estadoUbicacion(u.id, nuevo);
      actualizar("ubicaciones", u.id, { activo: nuevo }, `Ubicación ${nuevo ? "activada" : "desactivada"}: ${u.nombre}`);
      toast(`${u.nombre} ${nuevo ? "activada" : "desactivada"}`);
    } catch (e) { toast(mensajeError(e), "error"); }
  }

  async function borrar(u) {
    const n = unidades.filter((x) => x.ubicacion === u.nombre).length;
    if (n) {
      if (await confirmar({ titulo: `No se puede eliminar ${u.nombre}`, texto: `${n} unidad(es) registran esta ubicación. Trasládalas primero o, si solo quieres dejar de usarla, desactívala (baja lógica).`, boton: "Ver esas unidades" })) navigate("/admin/inventario", { state: { ubic: u.nombre } });
      return;
    }
    if (!(await confirmar({ titulo: "Eliminar ubicación", texto: `¿Eliminar ${u.nombre}? Solo gerencia puede hacerlo y no se puede deshacer.`, boton: "Eliminar", peligro: true }))) return;
    eliminar("ubicaciones", u.id, `Ubicación eliminada: ${u.nombre}`); toast("Ubicación eliminada");
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader titulo="Ubicaciones" subtitulo="Sedes propias, almacenes externos y proveedores de techo. Las sedes activas se publican en la web.">
        {MODO_REAL && <button className="btn btn-secondary !py-2.5" onClick={cargar}>Actualizar</button>}
        {gestiona && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Nueva ubicación</button>}
      </PageHeader>
      {errorApi && <div className="mb-4"><Aviso tipo="error">{errorApi}</Aviso></div>}
      
      <div className="mb-5 grid gap-3 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#121a2b] sm:grid-cols-3">
        <div><label className="field-label">Buscar</label><input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre" /></div>
        <div><label className="field-label">Tipo</label><select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS_UBICACION.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option><option value="activa">Activas</option><option value="inactiva">Inactivas</option></select></div>
      </div>
      {/* Tabla de ubicaciones */}
      {cargando ? <p className="py-10 text-center text-slate-400">Cargando ubicaciones…</p> : lista.length === 0 ? <Vacio titulo="No hay ubicaciones" texto="Cambia los filtros o crea una nueva." /> : (
        <Tabla columnas={["Nombre", "Tipo", "Dirección / horario", "Unidades", "Estado", "Acciones"]}>
          {lista.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-3 font-semibold text-marino dark:text-white">{u.nombre}</td>
              <td className="px-4 py-3">{u.tipo}</td>
              <td className="px-4 py-3">{u.direccion || <span className="text-slate-400">—</span>}{u.tipo === "Sede propia" && u.horario && <span className="block text-[12px] text-slate-400">{u.horario}</span>}</td>
              <td className="px-4 py-3">{unidadesEn(u.nombre) ? <button className="font-semibold text-marino-700 underline-offset-2 hover:underline dark:text-white" onClick={() => navigate("/admin/inventario", { state: { ubic: u.nombre } })}>{unidadesEn(u.nombre)}</button> : 0}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${u.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{u.activo ? "Activa" : "Inactiva"}</span></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                {gestiona && <button className={btnMini} onClick={() => abrir(u)}>Editar</button>}
                {gestiona && <button className={btnMini} onClick={() => alternar(u)}>{u.activo ? "Desactivar" : "Activar"}</button>}
                {puede("eliminar") && !MODO_REAL && <button className={btnMiniPeligro} onClick={() => borrar(u)}>Eliminar</button>}
              </div></td>
            </tr>
          ))}
        </Tabla>
      )}
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Solo gerencia y administración crean, editan o desactivan ubicaciones. Tu rol puede consultarlas.</p>}
      {MODO_REAL && <p className="mt-3 text-[12.5px] text-slate-400">Las ubicaciones no se eliminan: se desactivan.</p>}

      {/* Nueva / editar ubicación */}
      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.u ? `Editar ${modal.u.nombre}` : "Nueva ubicación"} ancho="max-w-2xl"
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-ub" className="btn btn-primary !py-2" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
        <form id="f-ub" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre" error={err.nombre}><input id="ub-nombre" className="field-input" maxLength={120} value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Tipo"><select className="field-input" value={f.tipo} onChange={set("tipo")}>{TIPOS_UBICACION.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo etiqueta={f.tipo === "Sede propia" ? "Dirección" : "Dirección (opcional)"} error={err.direccion} className="sm:col-span-2"><input className="field-input" maxLength={250} value={f.direccion} onChange={set("direccion")} /></Campo>
          {f.tipo === "Sede propia" && <>
            <Campo etiqueta="Horario de atención" error={err.horario}><input className="field-input" maxLength={150} value={f.horario} onChange={set("horario")} /></Campo>
            <Campo etiqueta="Nota de horario" error={err.horarioNota}><input className="field-input" maxLength={150} value={f.horarioNota} onChange={set("horarioNota")} /></Campo>
            <Campo etiqueta="Celular / WhatsApp" error={err.telefono}><input id="ub-telefono" className="field-input" inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" value={f.telefono} onChange={(e) => setF({ ...f, telefono: soloDigitos(e.target.value, 9) })} /></Campo>
            <Campo etiqueta="Correo" error={err.correo}><input type="email" className="field-input" value={f.correo} onChange={set("correo")} /></Campo>
            <div className="sm:col-span-2"><Aviso>Horario, teléfono y correo se publican en la página <b>Sedes y sucursales</b>. Se actualizan al instante.</Aviso></div>
          </>}
        </form>
      </Modal>
    </div>
  );
}
