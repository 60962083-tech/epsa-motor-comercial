import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Logo } from "../../components/Icons";
import HUBadge from "../../components/HUBadge";

/**
 * Login.jsx — HU-007 "Acceder con permisos por rol"
 * -----------------------------------------------------------------
 * Mientras no exista Supabase Auth, el "inicio de sesión" simula el
 * rol eligiéndolo en un <select>. Lo importante para la historia es
 * que, apenas entra, el menú lateral y las pantallas respeten ese
 * rol (ver DashboardLayout.jsx y ProtectedRoute.jsx).
 *
 * TODO (Michelle): reemplazar el <select> de rol por el resultado
 * real de supabase.auth.signInWithPassword(...) + una consulta a la
 * tabla de usuarios para saber su rol.
 * -----------------------------------------------------------------
 */
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
    const nombre = correo.split("@")[0];
    login(nombre, rol);
    navigate("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0b1220]">
      <HUBadge code="HU-007" titulo="Acceder con permisos por rol (login)" />
      <form onSubmit={onSubmit} className="fade-in w-full max-w-sm rounded-xl2 border border-slate-100 bg-white p-8 shadow-card dark:border-white/10 dark:bg-[#121a2b]">
        <div className="flex flex-col items-center text-marino dark:text-white">
          <Logo className="h-9 w-9" />
          <h1 className="mt-2 text-lg font-bold">EPSA MOTOR</h1>
          <p className="text-[13px] text-slate-400">Gestión comercial</p>
        </div>

        <div className="mt-6">
          <label className="field-label">Correo</label>
          <input className="field-input" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="Tu correo" />
        </div>
        <div className="mt-4">
          <label className="field-label">Contraseña</label>
          <input className="field-input" type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="••••••••" />
        </div>

        {/* Selector temporal de rol: solo existe porque aún no hay autenticación real */}
        <div className="mt-4">
          <label className="field-label">Rol (demo, hasta tener login real)</label>
          <select className="field-input" value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="gerente">Gerente</option>
            <option value="administradora">Administradora</option>
            <option value="vendedor">Vendedor</option>
          </select>
        </div>

        {error && <p className="mt-3 text-[13px] text-acento">{error}</p>}

        <button className="btn btn-primary mt-6 w-full" type="submit">Ingresar</button>
        <p className="mt-4 text-center text-[12.5px] text-slate-400">
          Lo que ves y puedes registrar depende de tu rol.
        </p>
      </form>
    </div>
  );
}
