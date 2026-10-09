import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { TIPOS_UBICACION, TIPO_A_API, TIPO_DE_API } from "../../data/mockData";
import { Aviso, Campo, Modal, PageHeader, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import HUBadge from "../../components/HUBadge";

const norm = (t) => String(t).trim().replace(/\s+/g, " ").toLowerCase();
const VACIO = { nombre: "", tipo: "Sede propia", direccion: "", horario: "Lunes a Sábado de 9:00 AM a 5:00 PM", horarioNota: "Domingos: consultar por WhatsApp o en sede", telefono: "51907721481", correo: "inversionesepsamotor@gmail.com" };

/**
 * Ubicaciones — HU-026. Con backend: GET/POST/PUT/PATCH /api/ubicaciones (baja lógica, sin DELETE).
 * Sin backend (demostración): mismas reglas en local. Los datos de contacto y horario de las
 * sedes (no existen en la tabla `ubicacion`) viven en la web y se publican en /sedes.
 */
export default function Ubicaciones() {
  const { ubicaciones, unidades, agregar, actualizar, eliminar, reemplazar } = useApp();
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [q, setQ] = useState(""); const [tipo, setTipo] = useState(""); const [est, setEst] = useState("");
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO); const [err, setErr] = useState({});
  const [cargando, setCargando] = useState(MODO_REAL); const [errorApi, setErrorApi] = useState("");
  const [guardando, setGuardando] = useState(false);
  const gestiona = puede("ubicaciones.gestionar");
  const navigate = useNavigate();

  // Modo real: cargar catálogo desde la API y mezclarlo con los datos de contacto locales
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

  function abrir(u) { setErr({}); setF(u ? { ...VACIO, ...u } : VACIO); setModal({ u }); }

  async function guardar(e) {
    e.preventDefault(); const x = {};
    const nombre = f.nombre.trim().replace(/\s+/g, " ");
    if (!nombre || nombre.length > 120) x.nombre = "El nombre es obligatorio (máx. 120 caracteres).";
    if (ubicaciones.some((u) => norm(u.nombre) === norm(nombre) && u.id !== modal.u?.id)) x.nombre = "Ya existe una ubicación con ese nombre.";
    if (f.direccion.length > 250) x.direccion = "La dirección admite hasta 250 caracteres.";
    if (f.tipo === "Sede propia" && f.telefono && !/^\d{9,12}$/.test(f.telefono.replace(/\s/g, ""))) x.telefono = "Teléfono: solo números (9 a 12 dígitos).";
    setErr(x); if (Object.keys(x).length) return;
    const datos = { ...f, nombre, direccion: f.direccion.trim(), telefono: f.telefono.replace(/\s/g, "") };
    setGuardando(true);
    try {
      let id = modal.u?.id;
      if (MODO_REAL) {
        const cuerpo = { nomubi: nombre, tipubi: TIPO_A_API[f.tipo] || "Sede", dirubi: datos.direccion || null };
        const r = modal.u ? await api.editarUbicacion(modal.u.id, cuerpo) : await api.crearUbicacion(cuerpo);
        id = Number(r.data?.codubi ?? id);
      }
      if (modal.u) actualizar("ubicaciones", modal.u.id, { ...datos, id }, `Ubicación editada: ${nombre}`);
      else agregar("ubicaciones", { ...datos, id: id ?? undefined, activo: true }, `Ubicación creada: ${nombre}`);
      toast(modal.u ? "Ubicación actualizada. Los cambios ya se ven en la web." : "Ubicación creada");
      setModal(null);
    } catch (e2) { toast(mensajeError(e2), "error"); } finally { setGuardando(false); }
  }

  async function alternar(u) {
    const nuevo = !u.activo;
    if (!nuevo) {
      const n = unidadesEn(u.nombre);
      if (n) {
        if (await confirmar({ titulo: `No se puede desactivar ${u.nombre}`, texto: `Tiene ${n} unidad(es) asignadas (regla de HU-026). Trasládalas a otra ubicación activa y luego vuelve a intentarlo.`, boton: "Ver esas unidades" })) navigate("/admin/inventario", { state: { ubic: u.nombre } });
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
      <HUBadge code="HU-026" titulo="Administrar ubicaciones" />
      <PageHeader titulo="Ubicaciones" subtitulo="Sedes propias, almacenes externos y proveedores de techo. Las sedes activas se publican en la web.">
        {MODO_REAL && <button className="btn btn-secondary !py-2.5" onClick={cargar}>Actualizar</button>}
        {gestiona && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Nueva ubicación</button>}
      </PageHeader>
      {errorApi && <div className="mb-4"><Aviso tipo="error">{errorApi}</Aviso></div>}
      {!MODO_REAL && <div className="mb-4"><Aviso tipo="aviso">Modo demostración: las ubicaciones se guardan en este navegador. Con el backend de Michelle configurado, se usa <b>/api/ubicaciones</b> (HU-026).</Aviso></div>}
      <div className="mb-5 grid gap-3 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#121a2b] sm:grid-cols-3">
        <div><label className="field-label">Buscar</label><input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre" /></div>
        <div><label className="field-label">Tipo</label><select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{TIPOS_UBICACION.map((t) => <option key={t}>{t}</option>)}</select></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option><option value="activa">Activas</option><option value="inactiva">Inactivas</option></select></div>
      </div>
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
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Solo la gerencia crea, edita, desactiva o elimina sedes y ubicaciones. Tu rol puede consultarlas.</p>}
      {MODO_REAL && <p className="mt-3 text-[12.5px] text-slate-400">En el backend la baja es lógica: las ubicaciones no se eliminan, se desactivan.</p>}

      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.u ? `Editar ${modal.u.nombre}` : "Nueva ubicación"} ancho="max-w-2xl"
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-ub" className="btn btn-primary !py-2" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button></>}>
        <form id="f-ub" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre" error={err.nombre}><input className="field-input" value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Tipo"><select className="field-input" value={f.tipo} onChange={set("tipo")}>{TIPOS_UBICACION.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo etiqueta="Dirección (opcional)" error={err.direccion} className="sm:col-span-2"><input className="field-input" value={f.direccion} onChange={set("direccion")} /></Campo>
          {f.tipo === "Sede propia" && <>
            <Campo etiqueta="Horario de atención"><input className="field-input" value={f.horario} onChange={set("horario")} /></Campo>
            <Campo etiqueta="Nota de horario"><input className="field-input" value={f.horarioNota} onChange={set("horarioNota")} /></Campo>
            <Campo etiqueta="Teléfono / WhatsApp" error={err.telefono}><input className="field-input" value={f.telefono} onChange={set("telefono")} /></Campo>
            <Campo etiqueta="Correo"><input type="email" className="field-input" value={f.correo} onChange={set("correo")} /></Campo>
            <div className="sm:col-span-2"><Aviso>Horario, teléfono y correo se publican en la página <b>Sedes y sucursales</b>. En Supabase existen en la tabla <b>sede</b> (horsed, telsed), pero la API de HU-026 aún no los expone: mientras tanto se guardan en la web.</Aviso></div>
          </>}
        </form>
      </Modal>
    </div>
  );
}
