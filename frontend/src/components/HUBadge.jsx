import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Etiqueta de Historia de Usuario (para auditar qué HU implementa cada pantalla).
 * - En el panel (/admin) se muestra siempre, como una línea discreta sobre el título.
 * - En la web pública se oculta para que se vea como un sitio real; se activa desde el pie
 *   de página con «Mostrar historias de usuario» (útil en la Sprint Review).
 */
const CLAVE = "epsa-ver-hu";
let mostrar = (() => { try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; } })();

export function useVerHU() {
  const [v, setV] = useState(mostrar);
  useEffect(() => {
    const f = () => setV(mostrar);
    window.addEventListener("epsa-ver-hu", f);
    return () => window.removeEventListener("epsa-ver-hu", f);
  }, []);
  const cambiar = (x) => {
    mostrar = x;
    try { localStorage.setItem(CLAVE, x ? "1" : "0"); } catch { /* sin storage */ }
    window.dispatchEvent(new Event("epsa-ver-hu"));
  };
  return [v, cambiar];
}

export default function HUBadge({ code, titulo }) {
  const { pathname } = useLocation();
  const [ver] = useVerHU();
  if (pathname.startsWith("/admin")) {
    return (
      <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-marino-50 px-2.5 py-1 text-[11.5px] font-semibold text-marino-700 dark:bg-white/10 dark:text-white/70">
        <span className="rounded-full bg-marino px-1.5 py-px text-[10.5px] text-white">{code}</span>{titulo}
      </p>
    );
  }
  if (!ver) return null;
  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-full bg-marino px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-lg print:hidden" title={titulo}>
      {code}{titulo ? ` · ${titulo}` : ""}
    </div>
  );
}
