import { useState } from "react";
import { NavLink, Navigate, Outlet, useNavigate } from "react-router-dom";
import { Logo, IconMenu, IconClose, IconSun, IconMoon } from "../Icons";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../ThemeContext";

// Cada ítem declara qué "sección" representa; AuthContext.puedeVer()
// decide si el rol actual puede verlo (ver ROLES en mockData.js).
const ITEMS = [
  { to: "/dashboard", label: "Resumen", seccion: "resumen", end: true },
  { to: "/dashboard/unidades", label: "Unidades", seccion: "unidades" },
  { to: "/dashboard/modelos", label: "Modelos", seccion: "modelos" },
  { to: "/dashboard/ubicaciones", label: "Ubicaciones", seccion: "ubicaciones" },
  { to: "/dashboard/leads", label: "Leads", seccion: "leads" },
];

/**
 * DashboardLayout
 * -----------------------------------------------------------------
 * Envuelve TODAS las pantallas internas. Si no hay nadie "logueado"
 * (AuthContext.user es null) manda al login. El menú lateral solo
 * muestra lo que el rol actual tiene permitido ver (HU-007).
 * -----------------------------------------------------------------
 */
export default function DashboardLayout() {
  const { user, logout, puedeVer } = useAuth();
  const { dark, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return <Navigate to="/dashboard/login" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Barra superior */}
      <header className="flex h-14 items-center justify-between bg-marino px-5 text-white">
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Abrir menú">
            {open ? <IconClose /> : <IconMenu />}
          </button>
          <Logo />
          <span className="font-bold">EPSA MOTOR</span>
          <span className="hidden text-white/50 sm:inline">| Gestión comercial</span>
        </div>
        <div className="flex items-center gap-3 text-[14px]">
          <button onClick={toggle} aria-label="Cambiar tema" className="grid h-8 w-8 place-items-center rounded-full border border-white/25 hover:bg-white/10">
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <span className="hidden sm:inline">{user.nombre} · {user.rol}</span>
          <button
            onClick={() => { logout(); navigate("/dashboard/login"); }}
            className="rounded-md border border-white/25 px-3 py-1.5 text-[13px] hover:bg-white/10"
          >
            Salir
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Menú lateral: filtrado por rol con puedeVer() */}
        <aside
          className={`${open ? "block" : "hidden"} md:block fixed md:static top-14 bottom-0 z-20 w-56 border-r
                      border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#0f1830]`}
        >
          <nav className="flex flex-col py-3">
            {ITEMS.filter((it) => puedeVer(it.seccion)).map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `border-l-[3px] px-5 py-3 text-[14.5px] font-medium transition-colors ${
                    isActive
                      ? "border-marino-700 bg-white text-marino dark:bg-white/5 dark:text-white"
                      : "border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
                  }`
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="fade-in flex-1 p-6 md:p-8">
          {/* Aquí se dibuja la pantalla actual (Resumen, Unidades, etc.) */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
