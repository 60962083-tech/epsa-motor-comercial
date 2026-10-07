import { Link } from "react-router-dom";
import { IconPin, IconPhone, IconMail, IconFacebook, IconInstagram } from "./Icons";

const REDES = [
  { nombre: "Facebook", href: "https://www.facebook.com/epsamotorperu/", Icono: IconFacebook },
  { nombre: "Instagram", href: "https://www.instagram.com/toritobajajepsamotor/", Icono: IconInstagram },
];

/**
 * Footer.jsx
 * -----------------------------------------------------------------
 * Pie de página de la web pública. "Ver direcciones completas" ahora
 * sí lleva a algo real (/sedes, ver Sedes.jsx) — antes llevaba a una
 * pantalla en blanco (DEF-001).
 * -----------------------------------------------------------------
 */
export default function Footer() {
  return (
    <footer className="mt-20 bg-marino text-white/70">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="h-14 w-auto" />
            <p className="mt-3 max-w-xs text-[13.5px] leading-relaxed">
              Distribuidor autorizado de motocars Bajaj. Autorizado oficial por Crosland Perú S.A.C.
            </p>
            <p className="mt-3 text-[12px] text-white/45">
              INVERSIONES EPSA MOTOR S.A.C. · RUC 20555595469
            </p>
            {/* Insignias de marca, como en el sitio oficial */}
            <div className="mt-4 flex gap-2">
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide">BAJAJ</span>
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide">RE · TORITO</span>
            </div>
            <div className="mt-5 flex gap-3">
              {REDES.map(({ nombre, href, Icono }) => (
                <a
                  key={nombre}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={nombre}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                >
                  <Icono />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-white">Navegación</h3>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li><Link to="/" className="hover:text-white">Inicio</Link></li>
              <li><Link to="/modelos" className="hover:text-white">Modelos</Link></li>
              <li><Link to="/nosotros" className="hover:text-white">Quiénes somos</Link></li>
              <li><Link to="/sedes" className="hover:text-white">Sedes y sucursales</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-white">Sedes</h3>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li className="flex items-center gap-2"><IconPin /> Comas</li>
              <li className="flex items-center gap-2"><IconPin /> Ventanilla</li>
              <li className="flex items-center gap-2"><IconPin /> Puente Piedra</li>
            </ul>
            <Link to="/sedes" className="mt-3 inline-block text-[13px] font-medium text-white/80 underline-offset-4 hover:underline">
              Ver direcciones completas →
            </Link>
          </div>

          <div>
            <h3 className="text-[13px] font-semibold text-white">Contacto</h3>
            <ul className="mt-3 space-y-2 text-[13.5px]">
              <li className="flex items-center gap-2"><IconPhone /> +51 907 721 481</li>
              <li className="flex items-center gap-2"><IconMail /> inversionesepsamotor@gmail.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-6 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 EPSA Motor. Todos los derechos reservados.</span>
          <span>Datos de ejemplo del Sprint 1 · se validan con EPSA Motor antes del MVP.</span>
        </div>
      </div>
    </footer>
  );
}
