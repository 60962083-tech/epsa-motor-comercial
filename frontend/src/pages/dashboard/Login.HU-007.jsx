import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../store/appStore.jsx";
import { cambiarClaveApi, cerrarSesionApi, iniciarSesion } from "../../lib/api";
import { resumenClave, validarClaveNueva, MIN_CLAVE } from "../../lib/clave";
import { mensajeError } from "../../lib/errores";
import { MODO_REAL } from "../../lib/config";
import { IconOjo, IconOjoTachado, IconVolver } from "../../components/Icons";

/**
 * Login: acceder con permisos por rol. Ruta: /admin
 * Se entra con el correo (o el usuario) y la contraseña. El rol lo define la cuenta, no la pantalla.
 * Conectado: Supabase Auth (correo y contraseña) + rol desde la base de datos (rpc hu007_usuario_actual).
 * Demostración: valida contra el equipo registrado en el panel (Equipo), comparando el resumen de la contraseña.
 * Si la contraseña es temporal, antes de entrar se pide crear una nueva.
 */
export default function Login() {
  const { login } = useAuth();
  const { equipo, actualizar } = useApp();
  const [cambio, setCambio] = useState(null); // { persona | real, temporal } → pantalla «Crea tu contraseña»
  const [nueva, setNueva] = useState({ clave: "", confirmar: "" });
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    const u = usuario.trim();
    if (!u || !clave) return setError("Escribe tu correo y tu contraseña.");

    if (MODO_REAL) {
      setCargando(true);
      try {
        // Supabase Auth trabaja con el correo: si escribió su usuario (p. ej. «harold»), se usa el correo de su ficha
        const correo = u.includes("@") ? u.toLowerCase() : equipo.find((x) => x.usuario?.toLowerCase() === u.toLowerCase())?.correo || u;
        const r = await iniciarSesion(correo, clave);
        if (!["gerente", "administradora", "vendedor"].includes(r.rol)) { cerrarSesionApi(); throw new Error("Tu usuario no tiene un rol válido en EPSA Motor."); }
        const local = equipo.find((x) => x.correo?.toLowerCase() === correo);
        const datos = { nombre: local?.nombre || r.nombre, rol: r.rol, extra: { codusu: r.codusu, correo, cargo: local?.cargo, sede: local?.sede, idEquipo: local?.id } };
        if (r.claveTemporal) { setCambio({ real: true, datos, temporal: clave }); setNueva({ clave: "", confirmar: "" }); return; }
        login(datos.nombre, datos.rol, datos.extra);
        navigate("/admin");
      } catch (err) { setError(mensajeError(err)); } finally { setCargando(false); }
      return;
    }

    const k = u.toLowerCase();
    const p = equipo.find((x) => (x.correo?.toLowerCase() === k || x.usuario?.toLowerCase() === k) && x.claveHash === resumenClave(x.correo, clave));
    if (!p) return setError("Correo o contraseña incorrectos.");
    if (!p.activo) return setError("Tu acceso está desactivado. Consulta con la gerencia.");
    if (p.claveTemporal) { setCambio({ persona: p, temporal: clave }); setNueva({ clave: "", confirmar: "" }); return; }
    entrar(p);
  }

  function entrar(p) {
    login(p.nombre, p.rol, { correo: p.correo, sede: p.sede, idEquipo: p.id, cargo: p.cargo });
    navigate("/admin");
  }

  async function guardarNueva(e) {
    e.preventDefault(); setError("");
    const msg = validarClaveNueva(nueva.clave, nueva.confirmar, cambio.temporal);
    if (msg) return setError(msg);
    if (cambio.real) {
      setCargando(true);
      try { await cambiarClaveApi(nueva.clave); login(cambio.datos.nombre, cambio.datos.rol, cambio.datos.extra); navigate("/admin"); }
      catch (err) { setError(mensajeError(err)); } finally { setCargando(false); }
      return;
    }
    const p = cambio.persona;
    actualizar("equipo", p.id, { claveHash: resumenClave(p.correo, nueva.clave), claveTemporal: false }, `${p.nombre} creó su contraseña personal`);
    entrar(p);
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-marino px-4 py-16">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-3xl" aria-hidden="true" />

      <div className="fade-in relative w-full max-w-[400px]">
        <img src="/images/logo-epsa.svg" alt="EPSA Motor" className="mx-auto h-16 w-auto" />

        {cambio ? (
          <form onSubmit={guardarNueva} noValidate className="mt-8 rounded-2xl bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,.28)] dark:bg-[#101c33] sm:p-9" data-cambio-clave>
            <h1 className="text-[22px] font-bold text-marino dark:text-white">Crea tu contraseña</h1>
            <p className="mt-2 text-[14px] text-slate-500 dark:text-white/60">Hola, {String(cambio.persona?.nombre || cambio.datos?.nombre).split(" ")[0]}. Entraste con una contraseña temporal: crea una nueva para continuar.</p>
            <label htmlFor="nueva-clave" className="field-label mt-6">Nueva contraseña</label>
            <input id="nueva-clave" type={ver ? "text" : "password"} className="field-input !py-3" value={nueva.clave} onChange={(e) => setNueva({ ...nueva, clave: e.target.value })} autoComplete="new-password" autoFocus />
            <label htmlFor="nueva-confirmar" className="field-label mt-4">Repite la contraseña</label>
            <input id="nueva-confirmar" type={ver ? "text" : "password"} className="field-input !py-3" value={nueva.confirmar} onChange={(e) => setNueva({ ...nueva, confirmar: e.target.value })} autoComplete="new-password" />
            <p className="mt-2 text-[12.5px] text-slate-500 dark:text-white/50">Mínimo {MIN_CLAVE} caracteres, con letras y números.</p>
            <label className="mt-3 flex items-center gap-2 text-[13px] text-slate-600 dark:text-white/70"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={ver} onChange={(e) => setVer(e.target.checked)} />Mostrar contraseñas</label>
            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] font-medium text-acento dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}
            <button className="btn btn-primary mt-6 w-full !py-3.5 dark:bg-white dark:text-marino dark:hover:bg-slate-200" type="submit" disabled={cargando}>{cargando ? "Guardando…" : "Guardar y entrar"}</button>
            <button type="button" className="mt-3 w-full text-[13.5px] font-medium text-slate-500 hover:text-marino dark:text-white/60" onClick={() => { setCambio(null); setClave(""); setError(""); if (cambio.real) cerrarSesionApi(); }}>Cancelar</button>
          </form>
        ) : (
        <form onSubmit={onSubmit} noValidate className="mt-8 rounded-2xl bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,.28)] dark:bg-[#101c33] sm:p-9">
          <h1 className="text-[22px] font-bold text-marino dark:text-white">Iniciar sesión</h1>

          <label htmlFor="login-correo" className="field-label mt-7">Correo</label>
          <input id="login-correo" type="email" inputMode="email" className="field-input !py-3" value={usuario} onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus placeholder="nombre@mail.isil.pe" />

          <label htmlFor="login-clave" className="field-label mt-5">Contraseña</label>
          <div className="relative">
            <input id="login-clave" className="field-input !py-3 !pr-12" type={ver ? "text" : "password"} value={clave}
              onChange={(e) => setClave(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute inset-y-0 right-0 grid w-12 place-items-center text-slate-400 transition hover:text-marino dark:hover:text-white">
              {ver ? <IconOjoTachado className="h-5 w-5" /> : <IconOjo className="h-5 w-5" />}
            </button>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13.5px] font-medium text-acento dark:bg-red-500/10 dark:text-red-300" role="alert">{error}</p>}

          <button className="btn btn-primary mt-7 w-full !py-3.5 dark:bg-white dark:text-marino dark:hover:bg-slate-200" type="submit" disabled={cargando}>{cargando ? "Ingresando…" : "Ingresar"}</button>
        </form>
        )}

        <Link to="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-[13.5px] text-white/60 transition hover:text-white">
          <IconVolver className="h-4 w-4" /> Volver a la web
        </Link>
      </div>
    </div>
  );
}
