import { Link } from "react-router-dom";
import { IconPin, IconPhone, IconMail, IconFacebook, IconInstagram, IconLock } from "./Icons";
import { useApp } from "../store/appStore.jsx";
import { useVerHU } from "./HUBadge";
import ImgReal from "./ImgReal";
import { LOGO_TORITO, SELLO_BAJAJ } from "../data/mockData";

const REDES = [
  { nombre: "Facebook", href: "https://www.facebook.com/epsamotorperu/", Icono: IconFacebook },
  { nombre: "Instagram", href: "https://www.instagram.com/toritobajajepsamotor/", Icono: IconInstagram },
];

/** Pie de página de la web pública. Las sedes salen del panel (Ubicaciones activas tipo Sede). */
export default function Footer() {
  const { sedes } = useApp();
  const [verHU, setVerHU] = useVerHU();
  return (
    <footer className="border-t border-white/10 bg-marino text-white/70">
      <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1.2fr_1.2fr]">
        <div>
          <img src="/images/logo-epsa-transparente.png" alt="EPSA Motor" className="h-14 w-auto" />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed">Distribuidor autorizado de motocars Torito Bajaj, autorizado por Crosland Perú S.A.C.</p>
          <p className="mt-3 text-[12.5px] text-white/45">INVERSIONES EPSA MOTOR S.A.C. · RUC 20555595469</p>
          <div className="mt-5 flex items-center gap-4">
            <ImgReal src={LOGO_TORITO} local="/images/marcas/torito.png" alt="Torito" className="h-6 w-auto brightness-0 invert opacity-80" alternativa={<span className="text-[12px] font-semibold tracking-wide text-white/60">TORITO</span>} />
            <ImgReal src={SELLO_BAJAJ} local="/images/marcas/bajaj-100-paises.png" alt="Bajaj, favorita en 100 países" className="h-7 w-auto brightness-0 invert opacity-80" alternativa={<span className="text-[12px] font-semibold tracking-wide text-white/60">BAJAJ</span>} />
          </div>
          <div className="mt-5 flex gap-2">
            {REDES.map(({ nombre, href, Icono }) => (
              <a key={nombre} href={href} target="_blank" rel="noopener noreferrer" aria-label={nombre} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"><Icono /></a>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[14px] font-semibold text-white">Navegación</h3>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li><Link to="/" className="hover:text-white">Inicio</Link></li>
            <li><Link to="/modelos" className="hover:text-white">Modelos</Link></li>
            <li><Link to="/nosotros" className="hover:text-white">Quiénes somos</Link></li>
            <li><Link to="/sedes" className="hover:text-white">Sedes y sucursales</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-[14px] font-semibold text-white">Sedes</h3>
          <ul className="mt-3 space-y-2.5 text-[14px]">
            {sedes.map((s) => <li key={s.id} className="flex gap-2"><IconPin className="mt-0.5 h-4 w-4 shrink-0" /><span><span className="text-white/90">{s.nombre}</span><span className="block text-[12.5px] text-white/50">{s.direccion}</span></span></li>)}
          </ul>
          <Link to="/sedes" className="mt-3 inline-block text-[13.5px] font-medium text-white/85 underline-offset-4 hover:underline">Cómo llegar a cada sede</Link>
        </div>

        <div>
          <h3 className="text-[14px] font-semibold text-white">Contacto</h3>
          <ul className="mt-3 space-y-2.5 text-[14px]">
            <li className="flex items-center gap-2"><IconPhone className="h-4 w-4" /><span className="select-all">+51 907 721 481</span></li>
            <li className="flex items-center gap-2"><IconMail className="h-4 w-4" /><span className="select-all break-all">inversionesepsamotor@gmail.com</span></li>
          </ul>
          <p className="mt-4 text-[13px] text-white/50">Lunes a sábado de 9:00 a. m. a 5:00 p. m.</p>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-3 py-5 text-[12.5px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 EPSA Motor. Precios referenciales; no incluyen matrícula ni SOAT.</span>
          <div className="flex flex-wrap items-center gap-4">
            <span>Desarrollado por el Grupo 7 · ISIL</span>
            <button type="button" onClick={() => setVerHU(!verHU)} aria-pressed={verHU} className="rounded-full border border-white/15 px-3 py-1 text-white/60 hover:bg-white/10 hover:text-white">
              {verHU ? "Ocultar historias de usuario" : "Mostrar historias de usuario"}
            </button>
          </div>
        </div>
      </div>

      {import.meta.env.VITE_ROUTER === "memory" && (
        <Link to="/admin" title="Solo en la vista previa: abre el login del panel" className="fixed bottom-5 left-5 z-50 inline-flex items-center gap-2 rounded-full bg-marino/95 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg ring-1 ring-white/15 backdrop-blur transition hover:bg-marino-700">
          <IconLock className="h-4 w-4" /> Panel admin
        </Link>
      )}
    </footer>
  );
}
