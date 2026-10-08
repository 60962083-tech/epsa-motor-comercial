import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../store/appStore.jsx";
import { iniciarSesion } from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { MODO_REAL } from "../../lib/config";
import { IconOjo, IconOjoTachado, IconVolver } from "../../components/Icons";

/**
 * Login — HU-007 "Acceder con permisos por rol". Ruta: /admin
 * Solo pide usuario y contraseña; el rol lo define la cuenta, no la pantalla.
 * Conectado: Supabase Auth (correo y contraseña) + rol desde la base de datos (rpc hu007_usuario_actual).
 * Demostración: valida contra el equipo registrado en el panel (src/data/mockData.js → EQUIPO):
 *   admin / admin → Administradora · vend / vend → Vendedor · geren / geren → Gerente.
 *   Los usuarios que el gerente crea en Equipo entran con su correo y su contraseña.
 */
const credenciales = (p) => [[p.usuario, p.clave], [p.correo, p.clave], ...(p.alias || [])];

export default function Login() {
  const { login } = useAuth();
  const { equipo } = useApp();
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
    if (!u || !clave) return setError("Escribe tu usuario y tu contraseña.");

    if (MODO_REAL) {
      setCargando(true);
      try {
        const r = await iniciarSesion(u, clave);
        if (!["gerente", "administradora", "vendedor"].includes(r.rol)) throw new Error("Rol no reconocido");
        login(r.nombre, r.rol, { codusu: r.codusu, correo: u });
        navigate("/admin");
      } catch (err) { setError(mensajeError(err)); } finally { setCargando(false); }
      return;
    }

    const k = u.toLowerCase();
    const p = equipo.find((x) => credenciales(x).some(([a, b]) => a && b && a.toLowerCase() === k && b === clave));
    if (!p) return setError("Usuario o contraseña incorrectos.");
    if (!p.activo) return setError("Tu acceso está desactivado. Consulta con la gerencia.");
    login(p.nombre, p.rol, { correo: p.correo, sede: p.sede, idEquipo: p.id });
    navigate("/admin");
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-marino px-4 py-16">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-3xl" aria-hidden="true" />

      <div className="fade-in relative w-full max-w-[400px]">
        <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="mx-auto h-14 w-auto" />

        <form onSubmit={onSubmit} noValidate className="mt-8 rounded-2xl bg-white p-8 shadow-[0_24px_60px_rgba(0,0,0,.28)] dark:bg-[#101c33] sm:p-9">
          <h1 className="text-[22px] font-bold text-marino dark:text-white">Iniciar sesión</h1>

          <label htmlFor="login-correo" className="field-label mt-7">Usuario</label>
          <input id="login-correo" className="field-input !py-3" value={usuario} onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username" autoCapitalize="none" spellCheck="false" autoFocus />

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

        <Link to="/" className="mx-auto mt-6 flex w-fit items-center gap-2 text-[13.5px] text-white/60 transition hover:text-white">
          <IconVolver className="h-4 w-4" /> Volver a la web
        </Link>
      </div>
    </div>
  );
}
