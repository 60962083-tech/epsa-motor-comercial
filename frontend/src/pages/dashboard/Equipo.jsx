import { useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { EQUIPO_PROYECTO, ROLES, SEDES_ATENCION } from "../../data/mockData";
import { MODO_REAL } from "../../lib/config";
import { Aviso, Campo, Card, Modal, PageHeader, Tabla, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";

const VACIO = { nombre: "", correo: "", celular: "", rol: "vendedor", sede: "Comas", recibeLeads: true, clave: "", activo: true };
const TONO_ROL = { gerente: "bg-marino text-white", administradora: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", vendedor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" };

/**
 * Equipo: usuarios del panel, su rol y sede, y el orden de turnos para repartir leads.
 * Solo el gerente agrega, edita, da o quita acceso y elimina personas.
 */
export default function Equipo() {
  const { equipo, agregar, actualizar, eliminar, leads } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const gestiona = puede("accesos");
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO); const [err, setErr] = useState({});
  const turnos = equipo.filter((p) => p.rol === "vendedor" && p.activo && !p.ausente && p.recibeLeads !== false);
  const abiertos = (p) => leads.filter((l) => l.responsable === p.nombre && !["Cerrado ganado", "Perdido"].includes(l.estado)).length;

  function abrir(p) { setErr({}); setF(p ? { ...VACIO, ...p, clave: "" } : VACIO); setModal({ p }); }
  function validar() {
    const x = {};
    const nombre = f.nombre.trim();
    if (nombre.length < 3) x.nombre = "Escribe el nombre completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo.trim())) x.correo = "Escribe un correo válido.";
    else if (equipo.some((p) => p.correo.toLowerCase() === f.correo.trim().toLowerCase() && p.id !== modal?.p?.id)) x.correo = "Ese correo ya tiene una cuenta.";
    if (equipo.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== modal?.p?.id)) x.nombre = "Ya hay una persona con ese nombre; agrega su apellido.";
    if (f.celular && !/^9\d{8}$/.test(f.celular)) x.celular = "Celular de 9 dígitos que empiece con 9.";
    if (!modal?.p && f.clave.length < 6) x.clave = "La contraseña temporal debe tener al menos 6 caracteres.";
    if (modal?.p && f.clave && f.clave.length < 6) x.clave = "Mínimo 6 caracteres (o déjala vacía para no cambiarla).";
    if (modal?.p?.rol === "gerente" && (f.rol !== "gerente" || !f.activo) && equipo.filter((p) => p.rol === "gerente" && p.activo).length === 1) x.rol = "Debe quedar al menos un gerente activo.";
    setErr(x); return Object.keys(x).length === 0;
  }
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const datos = { nombre: f.nombre.trim(), correo: f.correo.trim().toLowerCase(), celular: f.celular, rol: f.rol, sede: f.rol === "vendedor" ? f.sede : f.sede || "Todas", recibeLeads: f.rol === "vendedor" ? f.recibeLeads : false, activo: f.activo };
    if (modal.p) {
      if (modal.p.nombre !== datos.nombre) leads.filter((l) => l.responsable === modal.p.nombre).forEach((l) => actualizar("leads", l.id, { responsable: datos.nombre }));
      actualizar("equipo", modal.p.id, { ...datos, ...(f.clave ? { clave: f.clave } : {}) }, `Usuario actualizado: ${datos.nombre}`);
      toast("Usuario actualizado");
    } else {
      agregar("equipo", { ...datos, usuario: datos.correo, clave: f.clave, ausente: false }, `Usuario creado: ${datos.nombre} (${ROLES[datos.rol].nombre})`);
      toast(`${datos.nombre} ya puede ingresar con su correo y la contraseña temporal`);
    }
    setModal(null);
  }
  async function alternarAcceso(p) {
    if (p.id === user.idEquipo || p.nombre === user.nombre) return toast("No puedes quitarte tu propio acceso.", "error");
    if (p.activo && p.rol === "gerente" && equipo.filter((x) => x.rol === "gerente" && x.activo).length === 1) return toast("Debe quedar al menos un gerente activo.", "error");
    if (p.activo && !(await confirmar({ titulo: `Quitar acceso a ${p.nombre}`, texto: "No podrá ingresar al panel. Sus datos y su historial se conservan; puedes devolverle el acceso cuando quieras.", boton: "Quitar acceso" }))) return;
    actualizar("equipo", p.id, { activo: !p.activo }, `Acceso ${p.activo ? "retirado" : "restituido"}: ${p.nombre}`);
    toast(p.activo ? "Acceso retirado" : "Acceso restituido");
  }
  async function borrar(p) {
    if (p.id === user.idEquipo || p.nombre === user.nombre) return toast("No puedes eliminar tu propio usuario.", "error");
    if (p.rol === "gerente" && equipo.filter((x) => x.rol === "gerente").length === 1) return toast("Debe quedar al menos un gerente.", "error");
    const suyos = leads.filter((l) => l.responsable === p.nombre && !["Cerrado ganado", "Perdido"].includes(l.estado));
    if (!(await confirmar({ titulo: `Eliminar a ${p.nombre}`, texto: `Se eliminará su usuario del panel.${suyos.length ? ` Sus ${suyos.length} lead(s) abiertos quedarán «Sin asignar» para repartirlos.` : ""} Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true }))) return;
    suyos.forEach((l) => actualizar("leads", l.id, { responsable: "Sin asignar" }));
    eliminar("equipo", p.id, `Usuario eliminado: ${p.nombre}`); toast(suyos.length ? `Usuario eliminado. ${suyos.length} lead(s) quedaron sin asignar.` : "Usuario eliminado");
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div>
      <PageHeader titulo="Equipo" subtitulo="Usuarios del panel, su rol y su sede, y el orden de turnos para repartir los leads de la web.">
        {gestiona && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Agregar usuario</button>}
      </PageHeader>
      {!gestiona && <div className="mb-4"><Aviso tipo="aviso">Solo la gerencia agrega usuarios y administra accesos. Aquí puedes consultar el equipo.</Aviso></div>}

      <div>
        <div className="min-w-0">
          <Tabla columnas={["Usuario", "Rol", "Sede", "Leads abiertos", "Turnos", "Acceso", ...(gestiona ? ["Acciones"] : [])]}>
            {equipo.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marino-50 font-bold text-marino dark:bg-white/10 dark:text-white">{p.nombre[0]}</span><div className="min-w-0"><p className="font-semibold text-marino dark:text-white">{p.nombre}</p><p className="truncate text-[12px] text-slate-400">{p.correo}{p.celular && ` · ${p.celular}`}</p></div></div></td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONO_ROL[p.rol]}`}>{ROLES[p.rol]?.nombre}</span></td>
                <td className="px-4 py-3">{p.sede}</td>
                <td className="px-4 py-3 tabular-nums">{abiertos(p)}</td>
                <td className="px-4 py-3">{p.rol !== "vendedor" ? <span className="text-slate-400">—</span> : p.recibeLeads === false ? "No recibe" : p.ausente ? <span className="text-amber-600">Ausente</span> : "Recibe leads"}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${!p.activo ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{p.activo ? "Activo" : "Sin acceso"}</span></td>
                {gestiona && (
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5 xl:flex-nowrap">
                    <button className={btnMini} onClick={() => abrir(p)}>Editar</button>
                    {p.rol === "vendedor" && p.activo && <button className={btnMini} onClick={() => { actualizar("equipo", p.id, { ausente: !p.ausente }, `${p.nombre} ${p.ausente ? "volvió a turnos" : "marcado ausente"}`); toast(p.ausente ? "Vuelve a recibir leads" : "No recibirá leads nuevos mientras esté ausente"); }}>{p.ausente ? "Quitar ausencia" : "Marcar ausente"}</button>}
                    <button className={btnMini} onClick={() => alternarAcceso(p)}>{p.activo ? "Quitar acceso" : "Dar acceso"}</button>
                    <button className={btnMiniPeligro} onClick={() => borrar(p)}>Eliminar</button>
                  </div></td>
                )}
              </tr>
            ))}
          </Tabla>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="font-bold text-marino dark:text-white">Orden de turnos</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">Cada lead nuevo de la web va al vendedor de la sede con menos leads abiertos, saltando ausentes.</p>
            {turnos.length === 0 ? <p className="text-[13.5px] text-slate-400">No hay vendedores disponibles: los leads quedarán «Sin asignar».</p> : (
              <ol className="space-y-2">{[...turnos].sort((a, b) => abiertos(a) - abiertos(b)).map((p, i) => <li key={p.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[14px] dark:bg-white/5"><span className="grid h-6 w-6 place-items-center rounded-full bg-marino text-[12px] font-bold text-white">{i + 1}</span>{p.nombre}<span className="ml-auto text-[12px] text-slate-400">{p.sede} · {abiertos(p)} abiertos</span></li>)}</ol>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-bold text-marino dark:text-white">Qué puede hacer cada rol</h2>
            <ul className="space-y-3 text-[13.5px]">{Object.entries(ROLES).map(([k, r]) => <li key={k}><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${TONO_ROL[k]}`}>{r.nombre}</span><span className="mt-1 block text-slate-500">{r.descripcion}</span></li>)}</ul>
          </Card>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-marino dark:text-white">Equipo del proyecto</h2>
        <p className="mt-1 text-[13.5px] text-slate-500">Proyecto Tecnológico · Grupo 7 · ISIL 2026-2. Frontend: Didier · Backend: Michelle.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {EQUIPO_PROYECTO.map((m) => (
            <div key={m.nombre} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#101c33]">
              <p className="text-[12px] font-semibold text-acento">{m.rol}</p>
              <p className="mt-1 font-semibold leading-snug text-marino dark:text-white">{m.nombre}</p>
              <p className="mt-1 text-[12.5px] text-slate-500">{m.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.p ? `Editar a ${modal.p.nombre}` : "Agregar usuario"} ancho="max-w-xl"
        confirmarGuardar={modal?.p ? { titulo: "¿Guardar los cambios?", texto: `Se actualizarán los datos y el acceso de ${f.nombre || "este usuario"}.`, boton: "Guardar cambios", validar } : { titulo: "¿Crear este usuario?", texto: `${f.nombre || "La persona"} podrá ingresar como ${ROLES[f.rol]?.nombre} con su correo y la contraseña temporal.`, boton: "Crear usuario", validar }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-eq" className="btn btn-primary !py-2">{modal?.p ? "Guardar" : "Crear usuario"}</button></>}>
        <form id="f-eq" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre completo" error={err.nombre} className="sm:col-span-2"><input id="eq-nombre" className="field-input" value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Correo (para ingresar)" error={err.correo}><input id="eq-correo" type="email" className="field-input" value={f.correo} onChange={set("correo")} placeholder="nombre@epsamotor.com.pe" /></Campo>
          <Campo etiqueta="Celular (opcional)" error={err.celular}><input id="eq-celular" inputMode="numeric" maxLength={9} className="field-input" value={f.celular || ""} onChange={(e) => setF({ ...f, celular: e.target.value.replace(/\D/g, "") })} /></Campo>
          <Campo etiqueta="Rol" error={err.rol}><select id="eq-rol" className="field-input" value={f.rol} onChange={set("rol")}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Sede"><select id="eq-sede" className="field-input" value={f.sede} onChange={set("sede")}><option>Todas</option>{SEDES_ATENCION.map((s) => <option key={s}>{s}</option>)}</select></Campo>
          <Campo etiqueta={modal?.p ? "Nueva contraseña (opcional)" : "Contraseña temporal"} error={err.clave} ayuda="Mínimo 6 caracteres. La persona la cambia al ingresar.">
            <input id="eq-clave" type="text" autoComplete="off" className="field-input" value={f.clave} onChange={set("clave")} />
          </Campo>
          <div className="flex flex-col justify-end gap-2 pb-1 text-[13.5px]">
            {f.rol === "vendedor" && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.recibeLeads} onChange={set("recibeLeads")} />Recibe leads de la web (turnos)</label>}
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.activo} onChange={set("activo")} />Acceso activo</label>
          </div>
          <div className="sm:col-span-2"><Aviso>{ROLES[f.rol]?.descripcion}</Aviso></div>
          {MODO_REAL && <div className="sm:col-span-2"><Aviso tipo="aviso">Con el backend conectado, la cuenta se crea en Supabase Auth mediante un servicio del backend (pendiente: POST /api/usuarios). Aquí se definen el rol y la sede.</Aviso></div>}
        </form>
      </Modal>
    </div>
  );
}
