import { useState } from "react";
import { NavLink } from "react-router-dom";
import { IconSun, IconMoon, IconMenu, IconClose } from "./Icons";
import { useTheme } from "../ThemeContext";

const LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/modelos", label: "Modelos" },
  { to: "/nosotros", label: "Quiénes somos" },
  { to: "/sedes", label: "Sedes y sucursales" },
];

const linkClass = ({ isActive }) =>
  `relative py-1 text-[14.5px] font-medium transition-colors ${
    isActive ? "text-white" : "text-white/70 hover:text-white"
  } after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:bg-white after:transition-all ${
    isActive ? "after:w-full" : "after:w-0"
  }`;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-marino/95 backdrop-blur supports-[backdrop-filter]:bg-marino/90">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <NavLink to="/" className="flex items-center">
          <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="h-16 w-auto" />
        </NavLink>

        <nav className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === "/"}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* Acceso al dashboard interno (solo personal de EPSA Motor) */}
          <NavLink
            to="/dashboard/login"
            className="hidden rounded-md border border-white/25 px-3 py-1.5 text-[13px] font-medium text-white/85 transition hover:bg-white/10 sm:block"
          >
            Ingresar
          </NavLink>
          <button
            onClick={toggle}
            aria-label="Cambiar tema"
            className="grid h-9 w-9 place-items-center rounded-full border border-white/25 text-white transition hover:bg-white/10"
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center text-white md:hidden"
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <nav
        className={`md:hidden overflow-hidden bg-marino transition-[max-height] duration-200 ${
          open ? "max-h-72" : "max-h-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-6 pb-4">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className="py-2 text-[15px] font-medium text-white/85"
              end={l.to === "/"}
            >
              {l.label}
            </NavLink>
          ))}
          <NavLink to="/dashboard/login" onClick={() => setOpen(false)} className="py-2 text-[15px] font-medium text-white/85">
            Ingresar (personal EPSA Motor)
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
