// Enlace entre secciones del panel
// Si la sección de destino está desactivada para el rol (Roles y permisos), el enlace se muestra como texto
// y los botones de acceso no aparecen: así nadie llega a una pantalla bloqueada desde otra.
import { Link as LinkRouter } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { GRUPOS_PANEL } from "../../data/secciones";

const RUTAS = GRUPOS_PANEL.flatMap((g) => g.items).filter((i) => i.to !== "/admin").sort((a, b) => b.to.length - a.to.length);

// Sección a la que lleva una dirección del panel (por ejemplo /admin/inventario/7 → inventario)
export function seccionDeRuta(to) {
  const ruta = typeof to === "string" ? to : to?.pathname || "";
  return RUTAS.find((i) => ruta === i.to || ruta.startsWith(`${i.to}/`))?.seccion;
}

export function Link({ to, children, className = "", ...resto }) {
  const { puedeVer } = useAuth();
  const seccion = seccionDeRuta(to);
  if (seccion && !puedeVer(seccion)) return /\bbtn\b/.test(className) ? null : <span className={className.replace(/hover:\S+/g, "")} data-sin-acceso>{children}</span>;
  return <LinkRouter to={to} className={className} {...resto}>{children}</LinkRouter>;
}
