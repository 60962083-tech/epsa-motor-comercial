// Equipo del panel
import { useCallback, useEffect, useState } from "react";
import { cambiarClaveApi, equipoActualizarApi, equipoCrearApi, equipoListarApi, equipoReiniciarClaveApi, listarUsuariosSupabase } from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { esCorreo, esNombreCompleto, esNombrePersona, haceCuanto, limpiarTexto, MSJ, soloDigitos, soloLetras, soloLetrasNombre } from "../../lib/validar";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { ROLES, SEDES_ATENCION } from "../../data/mockData";
import { MIN_CLAVE, resumenClave, validarClaveNueva } from "../../lib/clave";
import { MODO_REAL } from "../../lib/config";
import { Aviso, Campo, Card, Modal, PageHeader, Tabla, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";

const VACIO = { nombre: "", usuario: "", correo: "", celular: "", rol: "vendedor", cargo: "Vendedor", sede: "Comas", recibeLeads: true, clave: "", activo: true };
const CARGOS = { gerente: ["Gerente"], administradora: ["Administradora", "Administrador"], vendedor: ["Vendedor", "Vendedora"] };
const cargoDe = (p) => p.cargo || ROLES[p.rol]?.nombre;
const TONO_ROL = { gerente: "bg-marino text-white", administradora: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200", vendedor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" };

// Con la base conectada, las cuentas son las de Supabase; sin conexión, las del navegador
export default function Equipo() {
  return MODO_REAL ? <EquipoConectado /> : <EquipoLocal />;
}

// ---------------------------------------------------------------------
// Cuentas reales (Supabase): funciones de docs/supabase-login-equipo.sql
// ---------------------------------------------------------------------
const ROL_BASE = { gerente: "Gerente", administradora: "Administradora", vendedor: "Vendedor" };
const ROL_PANEL = { Gerente: "gerente", Administradora: "administradora", Vendedor: "vendedor" };
const VACIO_REAL = { nombres: "", paterno: "", materno: "", correo: "", rol: "vendedor", activo: true, clave: "" };
const nombreVisible = (nombres, paterno, materno) => [String(nombres || "").trim().split(/\s+/)[0], paterno, materno].filter(Boolean).join(" ");
const claveEquipo = (c) => validarClaveNueva(c, undefined, "") || (/\s/.test(c) ? "La contraseña no lleva espacios." : "");

function EquipoConectado() {
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const gestiona = puede("accesos");
  const [cuentas, setCuentas] = useState(null);
  const [falla, setFalla] = useState(null);
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO_REAL); const [err, setErr] = useState({});
  const [guardando, setGuardando] = useState(false);

  // Cuentas de la base (se vuelven a leer después de cada cambio)
  const cargar = useCallback(() => equipoListarApi()
    .then((l) => { setCuentas(Array.isArray(l) ? l : []); setFalla(null); })
    .catch((e) => setFalla({ texto: mensajeError(e), faltaSql: Boolean(e.detalle?.faltaSql) })), []);
  useEffect(() => { cargar(); }, [cargar]);

  const filas = (cuentas || []).map((c) => {
    const rol = ROL_PANEL[c.rol] || "vendedor";
    return { ...c, rolPanel: rol, nombre: nombreVisible(c.nombres, c.apellido_paterno, c.apellido_materno) };
  });
  const esYo = (fila) => fila.correo?.toLowerCase() === String(user.correo || "").toLowerCase();

  // ---------------------------------------------------------------------------------------------
  // Formulario: agregar o editar una cuenta
  // ---------------------------------------------------------------------------------------------
  function abrir(fila) {
    setErr({});
    if (!fila) { setF(VACIO_REAL); setModal({}); return; }
    setF({ nombres: fila.nombres || "", paterno: fila.apellido_paterno || "", materno: fila.apellido_materno || "", correo: fila.correo, rol: fila.rolPanel, activo: fila.activo, clave: "" });
    setModal({ fila });
  }
  const set = (k) => (e) => { const v = e.target.type === "checkbox" ? e.target.checked : e.target.value; setF((x) => ({ ...x, [k]: v })); setErr((x) => ({ ...x, [k]: undefined, general: undefined })); };
  const setNombre = (k) => (e) => { setF((x) => ({ ...x, [k]: soloLetrasNombre(e.target.value) })); setErr((x) => ({ ...x, [k]: undefined, general: undefined })); };

  function validar() {
    const x = {};
    const fila = modal?.fila;
    if (!esNombrePersona(f.nombres)) x.nombres = "Escribe sus nombres (solo letras y espacios).";
    if (!esNombrePersona(f.paterno)) x.paterno = "Escribe el apellido paterno (solo letras).";
    if (f.materno.trim() && !esNombrePersona(f.materno)) x.materno = "Solo letras, o déjalo vacío.";
    if (!fila) {
      const correo = f.correo.trim().toLowerCase();
      if (!esCorreo(correo)) x.correo = MSJ.correo;
      else if ((cuentas || []).some((c) => c.correo?.toLowerCase() === correo)) x.correo = "Ese correo ya tiene una cuenta.";
    }
    if (!fila || f.clave) { const m = claveEquipo(f.clave); if (m) x.clave = fila ? `${m} O déjala vacía para no cambiarla.` : m; }
    if (fila && esYo(fila) && (f.rol !== fila.rolPanel || !f.activo)) x.rol = "No puedes cambiar tu propio rol ni quitarte el acceso.";
    if (fila?.rolPanel === "gerente" && fila.activo && (f.rol !== "gerente" || !f.activo) && filas.filter((c) => c.rolPanel === "gerente" && c.activo).length === 1) x.rol = "Debe quedar al menos un gerente con acceso.";
    setErr(x); return Object.keys(x).length === 0;
  }

  async function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const fila = modal.fila;
    const correo = fila ? fila.correo.toLowerCase() : f.correo.trim().toLowerCase();
    const base = { nombres: limpiarTexto(f.nombres), paterno: limpiarTexto(f.paterno), materno: limpiarTexto(f.materno), rol: ROL_BASE[f.rol], activo: fila ? f.activo : true };
    const nombre = nombreVisible(base.nombres, base.paterno, base.materno);
    setGuardando(true);
    try {
      if (fila) {
        await equipoActualizarApi({ codusu: fila.codusu, ...base });
        // La contraseña propia se cambia con la sesión; la de otra persona queda como temporal
        if (f.clave && esYo(fila)) await cambiarClaveApi(f.clave);
        else if (f.clave) await equipoReiniciarClaveApi(fila.codusu, f.clave);
        toast(`Cuenta actualizada${f.clave && !esYo(fila) ? `. ${nombre.split(" ")[0]} entrará con la contraseña temporal y creará la suya` : f.clave ? ". Tu contraseña cambió" : ""}.`);
      } else {
        await equipoCrearApi({ correo, ...base, clave: f.clave });
        toast(`${nombre} ya puede ingresar con ${correo} y la contraseña temporal.`);
      }
      setModal(null);
      cargar();
    } catch (er) { setErr({ general: mensajeError(er) }); } finally { setGuardando(false); }
  }

  // Quitar o devolver el acceso (las cuentas no se eliminan)
  async function alternarAcceso(fila) {
    if (esYo(fila)) return toast("No puedes quitarte tu propio acceso.", "error");
    if (fila.activo && fila.rolPanel === "gerente" && filas.filter((c) => c.rolPanel === "gerente" && c.activo).length === 1) return toast("Debe quedar al menos un gerente con acceso.", "error");
    if (fila.activo && !(await confirmar({ titulo: `Quitar acceso a ${fila.nombre}`, texto: "No podrá ingresar al panel. Su cuenta y su historial se conservan; puedes devolverle el acceso cuando quieras.", boton: "Quitar acceso" }))) return;
    try {
      await equipoActualizarApi({ codusu: fila.codusu, nombres: fila.nombres, paterno: fila.apellido_paterno, materno: fila.apellido_materno, rol: fila.rol, activo: !fila.activo });
      toast(fila.activo ? "Acceso retirado." : "Acceso restituido.");
      cargar();
    } catch (er) { toast(mensajeError(er), "error"); }
  }

  const propia = modal?.fila && esYo(modal.fila);
  return (
    <div>
      <PageHeader titulo="Equipo" subtitulo="Cuentas que ingresan al panel y el rol de cada persona.">
        {gestiona && !falla && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Agregar usuario</button>}
      </PageHeader>
      {!gestiona && <div className="mb-4"><Aviso tipo="aviso">Solo la gerencia agrega usuarios y administra accesos. Aquí puedes consultar el equipo.</Aviso></div>}

      {falla ? (
        <div className="space-y-4" data-equipo-falla>
          <Aviso tipo={falla.faltaSql ? "aviso" : "error"}>{falla.faltaSql ? "La administración de cuentas todavía no está habilitada en el sistema. Mientras tanto, cada persona entra con su correo y su contraseña si su cuenta ya existe." : falla.texto}</Aviso>
          {!falla.faltaSql && <button className="btn btn-secondary !py-2" onClick={cargar}>Reintentar</button>}
        </div>
      ) : !cuentas ? <p className="py-10 text-center text-[14px] text-slate-400">Cargando cuentas…</p> : (
        <Tabla columnas={["Usuario", "Rol", "Acceso", ...(gestiona ? ["Acciones"] : [])]} vacio={filas.length ? null : <p className="px-4 py-8 text-center text-[14px] text-slate-400">Aún no hay cuentas.</p>}>
          {filas.map((c) => (
            <tr key={c.codusu} data-cuenta={c.correo}>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marino-50 font-bold text-marino dark:bg-white/10 dark:text-white">{c.nombre[0]}</span><div className="min-w-0"><p className="whitespace-nowrap font-semibold text-marino dark:text-white">{c.nombre}{esYo(c) && <span className="ml-1.5 text-[12px] font-normal text-slate-400">(tú)</span>}</p><p className="whitespace-nowrap text-[12px] text-slate-500 dark:text-white/50" data-correo>{c.correo}</p></div></div></td>
              <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONO_ROL[c.rolPanel]}`}>{ROLES[c.rolPanel]?.nombre}</span></td>
              <td className="px-4 py-3"><div className="flex flex-col items-start gap-1.5">
                <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.activo ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`} data-acceso>{c.activo ? "Activo" : "Sin acceso"}</span>
                <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-slate-500 dark:text-white/50">Contraseña {c.clave_temporal ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800">Temporal</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">Personal</span>}</span>
                <span className="whitespace-nowrap text-[11.5px] text-slate-400">{c.ultimo_ingreso ? `Entró ${haceCuanto(c.ultimo_ingreso)}` : "Aún no ingresa"}</span>
              </div></td>
              {gestiona && (
                <td className="min-w-[200px] px-4 py-3"><div className="flex flex-wrap gap-1.5 [&>button]:whitespace-nowrap">
                  <button className={btnMini} onClick={() => abrir(c)}>Editar</button>
                  {!esYo(c) && <button className={c.activo ? btnMiniPeligro : btnMini} onClick={() => alternarAcceso(c)}>{c.activo ? "Quitar acceso" : "Dar acceso"}</button>}
                </div></td>
              )}
            </tr>
          ))}
        </Tabla>
      )}
      <p className="mt-3 text-[12.5px] text-slate-400">Las cuentas no se eliminan: se les quita el acceso y su historial se conserva.</p>

      {/* Agregar / editar cuenta */}
      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.fila ? `Editar a ${modal.fila.nombre}` : "Agregar usuario"} ancho="max-w-xl"
        confirmarGuardar={modal?.fila ? { titulo: "¿Guardar los cambios?", texto: `Se actualizará la cuenta de ${modal.fila.nombre}.${f.clave && !propia ? " Entrará con la nueva contraseña temporal." : ""}`, boton: "Guardar cambios", validar } : { titulo: "¿Crear esta cuenta?", texto: `${limpiarTexto(f.nombres).split(" ")[0] || "La persona"} podrá ingresar como ${ROLES[f.rol]?.nombre} con su correo y la contraseña temporal. Al entrar, creará la suya.`, boton: "Crear cuenta", validar }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-eq-real" className="btn btn-primary !py-2" disabled={guardando}>{guardando ? "Guardando…" : modal?.fila ? "Guardar" : "Crear cuenta"}</button></>}>
        <form id="f-eq-real" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombres" error={err.nombres} className="sm:col-span-2"><input id="eqr-nombres" className="field-input" value={f.nombres} maxLength={60} onChange={setNombre("nombres")} autoComplete="off" /></Campo>
          <Campo etiqueta="Apellido paterno" error={err.paterno}><input id="eqr-paterno" className="field-input" value={f.paterno} maxLength={60} onChange={setNombre("paterno")} autoComplete="off" /></Campo>
          <Campo etiqueta="Apellido materno (opcional)" error={err.materno}><input id="eqr-materno" className="field-input" value={f.materno} maxLength={60} onChange={setNombre("materno")} autoComplete="off" /></Campo>
          <Campo etiqueta="Correo (para ingresar)" error={err.correo} ayuda={modal?.fila ? "El correo de una cuenta no se cambia." : undefined}><input id="eqr-correo" type="email" maxLength={254} className="field-input" value={f.correo} onChange={set("correo")} disabled={!!modal?.fila} placeholder="nombre@empresa.com" autoComplete="off" /></Campo>
          <Campo etiqueta="Rol" error={err.rol}><select id="eqr-rol" className="field-input" value={f.rol} onChange={set("rol")} disabled={propia}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}</select></Campo>
          <Campo etiqueta={propia ? "Nueva contraseña (opcional)" : modal?.fila ? "Nueva contraseña temporal (opcional)" : "Contraseña temporal"} error={err.clave} className="sm:col-span-2"
            ayuda={`Mínimo ${MIN_CLAVE} caracteres, con letras y números, sin espacios.${propia ? " Es tu contraseña para entrar." : " Al ingresar, la persona crea la suya."}`}>
            <input id="eqr-clave" type="text" autoComplete="off" className="field-input" value={f.clave} onChange={set("clave")} />
          </Campo>
          {modal?.fila && !propia && <label className="flex items-center gap-2 text-[13.5px] sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.activo} onChange={set("activo")} />Acceso activo</label>}
          {err.general && <div className="sm:col-span-2"><Aviso tipo="error">{err.general}</Aviso></div>}
        </form>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sin conexión: equipo guardado en este navegador (modo demostración)
// ---------------------------------------------------------------------
function EquipoLocal() {
  const { equipo, agregar, actualizar, eliminar, leads, ventas, seguimientos } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const gestiona = puede("accesos");
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO); const [err, setErr] = useState({});
  const [cuentas, setCuentas] = useState(null); const [errCuentas, setErrCuentas] = useState("");
  useEffect(() => { if (MODO_REAL) listarUsuariosSupabase().then(setCuentas).catch((e) => setErrCuentas(mensajeError(e))); }, []);
  const turnos = equipo.filter((p) => p.rol === "vendedor" && p.activo && !p.ausente && p.recibeLeads !== false);
  const abiertos = (p) => leads.filter((l) => l.responsable === p.nombre && !["Cerrado ganado", "Perdido"].includes(l.estado)).length;

  function abrir(p) { setErr({}); setF(p ? { ...VACIO, ...p, clave: "" } : VACIO); setModal({ p }); }
  // Validación y guardado
  function validar() {
    const x = {};
    const nombre = limpiarTexto(f.nombre);
    const correo = f.correo.trim().toLowerCase();
    if (!esNombreCompleto(nombre)) x.nombre = MSJ.nombreCompleto;
    if (!esCorreo(correo)) x.correo = MSJ.correo;
    else if (equipo.some((p) => p.correo.toLowerCase() === correo && p.id !== modal?.p?.id)) x.correo = "Ese correo ya tiene una cuenta.";
    if (!x.nombre && equipo.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase() && p.id !== modal?.p?.id)) x.nombre = "Ya hay una persona con ese nombre; agrega su segundo apellido.";
    if (f.celular && !/^9\d{8}$/.test(f.celular)) x.celular = "Celular de 9 dígitos que empiece con 9.";
    const usuario = f.usuario || correo.split("@")[0];
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) x.usuario = f.usuario ? "Usuario de 3 a 30 letras minúsculas o números, sin espacios." : "Escribe un usuario (el que sale del correo no es válido).";
    else if (equipo.some((p) => p.usuario?.toLowerCase() === usuario && p.id !== modal?.p?.id)) x.usuario = f.usuario ? "Ese usuario ya existe." : `El usuario «${usuario}» ya existe: escribe otro.`;
    if (!modal?.p || f.clave) {
      const c = f.clave || "";
      const malo = c.length < MIN_CLAVE ? `Mínimo ${MIN_CLAVE} caracteres.` : c.length > 72 ? "Máximo 72 caracteres." : /\s/.test(c) ? "Sin espacios." : /^(.)\1+$/.test(c) ? "No uses un mismo carácter repetido." : "";
      if (malo) x.clave = modal?.p ? `${malo} O déjala vacía para no cambiarla.` : malo;
    }
    if (modal?.p && !f.clave && modal.p.correo.toLowerCase() !== correo) x.clave = "Cambiaste el correo: asigna una nueva contraseña temporal.";
    if (modal?.p?.rol === "gerente" && (f.rol !== "gerente" || !f.activo) && equipo.filter((p) => p.rol === "gerente" && p.activo).length === 1) x.rol = "Debe quedar al menos un gerente activo.";
    if (modal?.p && (modal.p.id === user.idEquipo || modal.p.nombre === user.nombre) && (f.rol !== modal.p.rol || !f.activo)) x.rol = "No puedes cambiar tu propio rol ni quitarte el acceso.";
    if (f.rol === "vendedor" && !SEDES_ATENCION.includes(f.sede)) x.sede = "Un vendedor necesita una sede para recibir leads por turnos.";
    setErr(x); return Object.keys(x).length === 0;
  }
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const datos = { nombre: limpiarTexto(f.nombre), usuario: f.usuario || f.correo.trim().toLowerCase().split("@")[0], correo: f.correo.trim().toLowerCase(), celular: f.celular, rol: f.rol, cargo: CARGOS[f.rol].includes(f.cargo) ? f.cargo : CARGOS[f.rol][0], sede: f.rol === "vendedor" ? f.sede : f.sede || "Todas", recibeLeads: f.rol === "vendedor" ? f.recibeLeads : false, activo: f.activo };
    if (modal.p) {
      if (modal.p.nombre !== datos.nombre) {
        leads.filter((l) => l.responsable === modal.p.nombre).forEach((l) => actualizar("leads", l.id, { responsable: datos.nombre }));
        seguimientos.filter((x) => x.responsable === modal.p.nombre).forEach((x) => actualizar("seguimientos", x.id, { responsable: datos.nombre }));
        ventas.filter((v) => v.vendedor === modal.p.nombre).forEach((v) => actualizar("ventas", v.id, { vendedor: datos.nombre }));
      }
      const deja = (modal.p.activo && !datos.activo) || (modal.p.rol === "vendedor" && datos.rol !== "vendedor");
      const suyos = deja ? leads.filter((l) => l.responsable === modal.p.nombre && !["Cerrado ganado", "Perdido"].includes(l.estado)) : [];
      suyos.forEach((l) => actualizar("leads", l.id, { responsable: "Sin asignar" }));
      actualizar("equipo", modal.p.id, { ...datos, ...(f.clave ? { claveHash: resumenClave(datos.correo, f.clave), claveTemporal: true } : {}) }, `Usuario actualizado: ${datos.nombre}`);
      toast(`${f.clave ? "Usuario actualizado. Deberá crear su contraseña al ingresar." : "Usuario actualizado"}${suyos.length ? ` ${suyos.length} lead(s) quedaron sin asignar.` : ""}`);
    } else {
      agregar("equipo", { ...datos, claveHash: resumenClave(datos.correo, f.clave), claveTemporal: true, ausente: false }, `Usuario creado: ${datos.nombre} (${datos.cargo})`);
      toast(`${datos.nombre} ya puede ingresar con su correo y la contraseña temporal`);
    }
    setModal(null);
  }
  // Acceso y eliminación
  async function alternarAcceso(p) {
    if (p.id === user.idEquipo || p.nombre === user.nombre) return toast("No puedes quitarte tu propio acceso.", "error");
    if (p.activo && p.rol === "gerente" && equipo.filter((x) => x.rol === "gerente" && x.activo).length === 1) return toast("Debe quedar al menos un gerente activo.", "error");
    if (p.activo && !(await confirmar({ titulo: `Quitar acceso a ${p.nombre}`, texto: "No podrá ingresar al panel. Sus datos y su historial se conservan; puedes devolverle el acceso cuando quieras.", boton: "Quitar acceso" }))) return;
    const suyos = p.activo ? leads.filter((l) => l.responsable === p.nombre && !["Cerrado ganado", "Perdido"].includes(l.estado)) : [];
    suyos.forEach((l) => actualizar("leads", l.id, { responsable: "Sin asignar" }));
    actualizar("equipo", p.id, { activo: !p.activo }, `Acceso ${p.activo ? "retirado" : "restituido"}: ${p.nombre}`);
    toast(p.activo ? `Acceso retirado${suyos.length ? `. ${suyos.length} lead(s) quedaron sin asignar.` : ""}` : "Acceso restituido");
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
          <Tabla columnas={["Usuario", "Rol", "Sede y turnos", "Acceso", ...(gestiona ? ["Acciones"] : [])]}>
            {equipo.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marino-50 font-bold text-marino dark:bg-white/10 dark:text-white">{p.nombre[0]}</span><div className="min-w-0"><p className="whitespace-nowrap font-semibold text-marino dark:text-white">{p.nombre}</p><p className="whitespace-nowrap text-[12px] text-slate-500 dark:text-white/50"><span data-usuario>{p.usuario || "—"}</span> · <span data-correo>{p.correo}</span>{p.celular && ` · ${p.celular}`}</p></div></div></td>
                <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONO_ROL[p.rol]}`}>{cargoDe(p)}</span></td>
                <td className="px-4 py-3"><p className="whitespace-nowrap">{p.sede}</p>{p.rol === "vendedor" && <p className="whitespace-nowrap text-[12px] text-slate-500 dark:text-white/50">{p.recibeLeads === false ? "No recibe leads" : p.ausente ? <span className="text-amber-600">Ausente</span> : "Recibe leads"} · {abiertos(p)} abiertos</p>}</td>
                <td className="px-4 py-3"><div className="flex flex-col items-start gap-1.5">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${!p.activo ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{p.activo ? "Activo" : "Sin acceso"}</span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] text-slate-500 dark:text-white/50">Contraseña {p.claveTemporal ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800">Temporal</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700">Personal</span>}</span>
                </div></td>
                {gestiona && (
                  <td className="min-w-[250px] px-4 py-3"><div className="flex flex-wrap gap-1.5 [&>button]:whitespace-nowrap">
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
        {/* Cuentas con acceso */}
        {MODO_REAL && (
          <Card className="mt-6">
            <h2 className="font-bold text-marino dark:text-white">Cuentas con acceso al panel</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">Usuarios que pueden iniciar sesión y su rol.</p>
            {errCuentas ? <Aviso tipo="aviso">{errCuentas}</Aviso> : !cuentas ? <p className="text-[13.5px] text-slate-400">Cargando…</p> : cuentas.length === 0 ? <p className="text-[13.5px] text-slate-400">No hay cuentas para mostrar.</p> : (
              <ul className="divide-y divide-slate-100 text-[13.5px] dark:divide-white/10">
                {cuentas.map((c) => (
                  <li key={c.codusu} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><b className="text-marino dark:text-white">{[c.nomusu, c.apepatusu, c.apematusu].filter(Boolean).join(" ")}</b> <span className="text-slate-500">· {c.corusu}</span></span>
                    <span className="flex gap-2"><span className="rounded-full bg-marino-50 px-2.5 py-0.5 text-[12px] font-semibold text-marino dark:bg-white/10 dark:text-white">{c.rol?.nomrol || "—"}</span><span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${c.estusu ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{c.estusu ? "Activa" : "Inactiva"}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        <div className="mt-6 grid gap-6">
          <Card>
            <h2 className="font-bold text-marino dark:text-white">Orden de turnos</h2>
            <p className="mb-3 text-[12.5px] text-slate-500">Cada lead nuevo de la web va al vendedor de la sede con menos leads abiertos, saltando ausentes.</p>
            {turnos.length === 0 ? <p className="text-[13.5px] text-slate-400">No hay vendedores disponibles: los leads quedarán «Sin asignar».</p> : (
              <ol className="space-y-2">{[...turnos].sort((a, b) => abiertos(a) - abiertos(b)).map((p, i) => <li key={p.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-[14px] dark:bg-white/5"><span className="grid h-6 w-6 place-items-center rounded-full bg-marino text-[12px] font-bold text-white">{i + 1}</span>{p.nombre}<span className="ml-auto text-[12px] text-slate-400">{p.sede} · {abiertos(p)} abiertos</span></li>)}</ol>
            )}
          </Card>
        </div>
      </div>

      {/* Agregar / editar usuario */}
      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.p ? `Editar a ${modal.p.nombre}` : "Agregar usuario"} ancho="max-w-xl"
        confirmarGuardar={modal?.p ? { titulo: "¿Guardar los cambios?", texto: `Se actualizarán los datos y el acceso de ${f.nombre || "este usuario"}.`, boton: "Guardar cambios", validar } : { titulo: "¿Crear este usuario?", texto: `${f.nombre || "La persona"} podrá ingresar como ${CARGOS[f.rol].includes(f.cargo) ? f.cargo : ROLES[f.rol]?.nombre} con su correo y la contraseña temporal.`, boton: "Crear usuario", validar }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-eq" className="btn btn-primary !py-2">{modal?.p ? "Guardar" : "Crear usuario"}</button></>}>
        <form id="f-eq" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre completo" error={err.nombre} className="sm:col-span-2"><input id="eq-nombre" className="field-input" value={f.nombre} maxLength={80} onChange={(e) => setF({ ...f, nombre: soloLetras(e.target.value) })} /></Campo>
          <Campo etiqueta="Correo (para ingresar)" error={err.correo}><input id="eq-correo" type="email" maxLength={254} className="field-input" value={f.correo} onChange={set("correo")} placeholder="nombre@epsamotor.com.pe" /></Campo>
          <Campo etiqueta="Celular (opcional)" error={err.celular}><input id="eq-celular" inputMode="numeric" maxLength={9} className="field-input" value={f.celular || ""} placeholder="9XXXXXXXX" onChange={(e) => setF({ ...f, celular: soloDigitos(e.target.value, 9) })} /></Campo>
          <Campo etiqueta="Usuario (opcional)" error={err.usuario} ayuda="También sirve para ingresar. Si lo dejas vacío se usa el inicio del correo."><input id="eq-usuario" className="field-input" maxLength={30} value={f.usuario || ""} onChange={(e) => setF({ ...f, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, "") })} placeholder="nombre" /></Campo>
          <Campo etiqueta="Rol" error={err.rol}><select id="eq-rol" className="field-input" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value, cargo: CARGOS[e.target.value][0] })}>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.nombre}</option>)}</select></Campo>
          {CARGOS[f.rol].length > 1 && <Campo etiqueta="Cómo se muestra el cargo"><select id="eq-cargo" className="field-input" value={CARGOS[f.rol].includes(f.cargo) ? f.cargo : CARGOS[f.rol][0]} onChange={set("cargo")}>{CARGOS[f.rol].map((c) => <option key={c}>{c}</option>)}</select></Campo>}
          <Campo etiqueta="Sede" error={err.sede}><select id="eq-sede" className="field-input" value={f.sede} onChange={set("sede")}><option>Todas</option>{SEDES_ATENCION.map((s) => <option key={s}>{s}</option>)}</select></Campo>
          <Campo etiqueta={modal?.p ? "Nueva contraseña temporal (opcional)" : "Contraseña temporal"} error={err.clave} ayuda={`Mínimo ${MIN_CLAVE} caracteres, sin espacios. Al ingresar, la persona crea su propia contraseña.`}>
            <input id="eq-clave" type="text" autoComplete="off" className="field-input" value={f.clave} onChange={set("clave")} />
          </Campo>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px] sm:col-span-2">
            {f.rol === "vendedor" && <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.recibeLeads} onChange={set("recibeLeads")} />Recibe leads de la web (turnos)</label>}
            <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.activo} onChange={set("activo")} />Acceso activo</label>
          </div>
          {MODO_REAL && <div className="sm:col-span-2"><Aviso tipo="aviso">La cuenta para iniciar sesión se crea aparte, en el sistema. Aquí se guarda la ficha del integrante del equipo.</Aviso></div>}
        </form>
      </Modal>
    </div>
  );
}
