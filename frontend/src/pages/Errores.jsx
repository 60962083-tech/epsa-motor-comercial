// Pantallas de error (404, 403, producto no disponible)
import { Link, useParams, useNavigate } from "react-router-dom";
import MotoIllustration from "../components/MotoIllustration";
import { WHATSAPP_NUMERO } from "../lib/config";

export function PantallaError({ codigo, titulo, texto, children }) {
  return (
    <div className="fade-in mx-auto flex max-w-2xl flex-col items-center px-6 py-20 text-center">
      <MotoIllustration className="w-40 opacity-60" />
      {codigo && <p className="mt-6 text-6xl font-extrabold tracking-tight text-marino/15 dark:text-white/15">{codigo}</p>}
      <h1 className="mt-2 text-2xl font-bold text-marino dark:text-white">{titulo}</h1>
      <p className="mt-2 max-w-md text-slate-500">{texto}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>
    </div>
  );
}

export const NotFound = () => (
  <PantallaError codigo="404" titulo="No encontramos esta página" texto="El enlace puede estar mal escrito o la página ya no existe.">
    <Link to="/" className="btn btn-primary">Ir al inicio</Link>
    <Link to="/modelos" className="btn btn-secondary">Ver modelos</Link>
  </PantallaError>
);

export const ProductoNoDisponible = ({ nombre }) => (
  <PantallaError titulo="Producto no disponible" texto={`${nombre ? `El ${nombre}` : "Este modelo"} ya no se encuentra publicado en el catálogo o el enlace no es válido. Mira los modelos que sí tenemos hoy.`}>
    <Link to="/modelos" className="btn btn-primary">Volver al catálogo</Link>
    <a className="btn btn-secondary" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, busqué un modelo que ya no aparece en la web. ¿Me ayudan?")}`}>Consultar a un asesor</a>
  </PantallaError>
);

const ERRORES = {
  401: ["401", "Tu sesión venció", "Por seguridad cerramos tu sesión. Ingresa nuevamente para continuar."],
  403: ["403", "No tienes permiso", "Tu rol no puede realizar esta operación. Si crees que es un error, consulta con el gerente."],
  500: ["500", "Algo salió mal de nuestro lado", "Tuvimos un problema al procesar tu solicitud. Inténtalo otra vez en unos minutos."],
  offline: ["", "Sin conexión", "No pudimos comunicarnos con el servidor. Revisa tu internet e inténtalo de nuevo."],
};

export function ErrorPorCodigo() {
  const { codigo } = useParams();
  const nav = useNavigate();
  const e = ERRORES[codigo];
  if (!e) return <NotFound />;
  return (
    <PantallaError codigo={e[0]} titulo={e[1]} texto={e[2]}>
      <button onClick={() => nav(-1)} className="btn btn-secondary">Volver</button>
      <Link to="/" className="btn btn-primary">Ir al inicio</Link>
    </PantallaError>
  );
}

export function SinStockAviso({ nombre, onAvisar }) {
  return (
    <div className="rounded-xl2 border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/30 dark:bg-amber-500/10">
      <h3 className="font-semibold text-amber-800 dark:text-amber-200">Sin stock por ahora</h3>
      <p className="mt-1 text-[13.5px] text-amber-800/80 dark:text-amber-200/80">No tenemos unidades listas del {nombre}. Déjanos tus datos y te avisamos apenas llegue la próxima compra.</p>
      <button onClick={onAvisar} className="btn btn-primary mt-3 !py-2">Avísame cuando haya stock</button>
    </div>
  );
}
