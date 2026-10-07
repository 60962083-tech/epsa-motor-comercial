import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import HUBadge from "../../components/HUBadge";

/**
 * Login.jsx — HU-007 "Acceder con permisos por rol"
 * -----------------------------------------------------------------
 * Mientras no exista Supabase Auth, el "inicio de sesión" simula el
 * rol. Para que la demo sea rápida (pedido explícito: "admin / admin
 * me manda como administrador"), hay un atajo: si se escribe admin
 * en ambos campos, entra directo como administradora. Cualquier otro
 * correo/contraseña no vacíos también entra, pero usando el rol que
 * se elija a mano en el selector de abajo (para poder probar el
 * caso "vendedor", por ejemplo).
 *
 * TODO (Michelle): reemplazar TODO este método de login por
 * supabase.auth.signInWithPassword(...) + una consulta a la tabla de
 * usuarios para leer su rol real. Cuando eso exista, el atajo
 * admin/admin y el selector de rol se eliminan de aquí.
 * -----------------------------------------------------------------
 */
const ATAJOS = {
  admin: { nombre: "Administrador", rol: "administradora" },
  gerente: { nombre: "Flavio", rol: "gerente" },
  vendedor: { nombre: "César", rol: "vendedor" },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [rol, setRol] = useState("administradora");
  const [error, setError] = useState("");

  function onSubmit(e) {
    e.preventDefault();
    if (!correo.trim() || !clave.trim()) {
      setError("Completa correo y contraseña.");
      return;
    }

    // Atajo de demo: admin/admin, gerente/gerente, vendedor/vendedor
    const clave_normalizada = correo.trim().toLowerCase();
    const atajo = ATAJOS[clave_normalizada];
    if (atajo && clave_normalizada === clave.trim().toLowerCase()) {
      login(atajo.nombre, atajo.rol);
      navigate("/dashboard");
      return;
    }

    // Cualquier otro correo/contraseña: entra con el rol elegido a mano
    const nombre = correo.split("@")[0];
    login(nombre, rol);
    navigate("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0b1220]">
      <HUBadge code="HU-007" titulo="Acceder con permisos por rol (login)" />

      {/* Volver a la web pública: el login no es parte del sitio de clientes */}
      <Link
        to="/"
        className="group absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[13.5px] font-medium text-marino shadow-sm transition-all hover:gap-3 hover:border-marino-700 hover:bg-marino-50 dark:border-white/10 dark:bg-[#121a2b] dark:text-white dark:hover:bg-white/5 sm:left-8 sm:top-8"
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-1">←</span>
        Volver a la web
      </Link>

      <form onSubmit={onSubmit} className="fade-in w-full max-w-sm overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card dark:border-white/10 dark:bg-[#121a2b]">
        <div className="flex flex-col items-center bg-marino py-9">
          <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="h-20 w-auto" />
          <p className="mt-4 text-[16px] font-semibold tracking-wide text-white/85">Gestión comercial</p>
        </div>

        <div className="p-8">
        <div className="mt-6">
          <label className="field-label">Correo</label>
          <input className="field-input" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="admin" />
        </div>
        <div className="mt-4">
          <label className="field-label">Contraseña</label>
          <input className="field-input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="admin" />
        </div>

        <div className="mt-4">
          <label className="field-label">Rol (solo si no usas un atajo de arriba)</label>
          <select className="field-input" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="gerente">Gerente</option>
            <option value="administradora">Administradora</option>
            <option value="vendedor">Vendedor</option>
          </select>
        </div>

        {error && <p className="mt-3 text-[13px] text-acento">{error}</p>}

        <button className="btn btn-primary mt-6 w-full" type="submit">Ingresar</button>

        <div className="mt-4 rounded-lg bg-marino-50 p-3 text-[12px] text-marino dark:bg-white/5 dark:text-white/70">
          Para la demo: escribe <strong>admin</strong> en los dos campos y entras como
          administradora. También funcionan <strong>gerente</strong> y <strong>vendedor</strong>.
        </div>
        </div>
      </form>
    </div>
  );
}
