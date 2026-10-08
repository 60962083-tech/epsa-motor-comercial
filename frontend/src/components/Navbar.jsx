import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IconSun, IconMoon, IconMenu, IconClose } from "./Icons";
import { useTheme } from "../ThemeContext";
import { useCotizar } from "./CotizarModal";

const LINKS = [
  { to: "/", label: "Inicio" },
  { to: "/modelos", label: "Modelos" },
  { to: "/nosotros", label: "Quiénes somos" },
  { to: "/sedes", label: "Sedes y sucursales" },
];

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white"}`;

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const cotizar = useCotizar();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-marino">
      <div className="wrap flex h-16 items-center gap-3 sm:h-[72px] sm:gap-4">
        <NavLink to="/" className="shrink-0" aria-label="EPSA Motor, inicio">
          <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="h-10 w-auto sm:h-12" />
        </NavLink>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} end={l.to === "/"}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 md:ml-3">
          <button onClick={toggle} aria-label={dark ? "Usar tema claro" : "Usar tema oscuro"}
            className="grid h-10 w-10 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white">
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button onClick={() => cotizar()} className="btn btn-acento hidden !px-4 !py-2.5 sm:inline-flex">Cotizar</button>
          <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full text-white md:hidden">
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <nav className={`overflow-hidden border-t border-white/10 bg-marino transition-[max-height] duration-200 md:hidden ${open ? "max-h-96" : "max-h-0 border-t-0"}`} aria-label="Menú móvil">
        <div className="wrap flex flex-col gap-1 py-3">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => `rounded-lg px-3 py-3 text-[16px] font-medium ${isActive ? "bg-white/10 text-white" : "text-white/80"}`}>{l.label}</NavLink>
          ))}
          <button onClick={() => { setOpen(false); cotizar(); }} className="btn btn-acento mt-2 w-full">Cotizar mi Torito</button>
        </div>
      </nav>
    </header>
  );
}
