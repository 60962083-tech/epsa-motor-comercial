// Pie de página de la web
import { Link } from "react-router-dom";
import { IconPin, IconPhone, IconMail, IconFacebook, IconInstagram, IconWhatsapp } from "./Icons";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "./CotizarModal";
import VideoFondo from "./VideoFondo";
import { WHATSAPP_NUMERO } from "../lib/config";

const REDES = [
  { nombre: "Facebook", href: "https://www.facebook.com/epsamotorperu/", Icono: IconFacebook },
  { nombre: "Instagram", href: "https://www.instagram.com/toritobajajepsamotor/", Icono: IconInstagram },
];

export default function Footer() {
  const { sedes } = useApp();
  const cotizar = useCotizar();
  return (
    <footer className="relative overflow-hidden bg-marino text-white/70">
      <VideoFondo opacidad="opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-marino via-marino/85 to-marino/95" aria-hidden="true" />

      <div className="relative">
        {/* Llamado a cotizar */}
        <div className="wrap flex flex-col items-start justify-between gap-6 border-b border-white/10 py-12 md:flex-row md:items-center">
          <div>
            <p className="font-display text-[2.2rem] font-bold uppercase leading-none tracking-tight text-white sm:text-[2.8rem]">Tu Torito te espera</p>
            <p className="mt-2 max-w-md text-[15px] text-white/65">Cotiza en línea y un asesor te llama el mismo día.</p>
          </div>
          <div className="grid w-full gap-3 sm:flex sm:w-auto">
            <button onClick={() => cotizar()} className="btn btn-acento shadow-lg shadow-acento/25">Cotizar mi Torito</button>
            <a className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera cotizar un Torito.")}`}><IconWhatsapp /> WhatsApp</a>
          </div>
        </div>

        {/* Empresa y redes */}
        <div className="wrap grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1.3fr_1.2fr]">
          <div className="min-w-0">
            <img src="/images/logo-epsa-marcas.svg" alt="EPSA Motor · Torito · Bajaj, favorita en 100 países" className="h-auto w-full max-w-[380px]" />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed">Distribuidor autorizado de motocars Torito Bajaj, autorizado por Crosland Perú S.A.C.</p>
            <p className="mt-2 text-[12.5px] text-white/45">INVERSIONES EPSA MOTOR S.A.C. · RUC 20555595469</p>
            <div className="mt-5 flex gap-2">
              {REDES.map(({ nombre, href, Icono }) => (
                <a key={nombre} href={href} target="_blank" rel="noopener noreferrer" aria-label={nombre} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"><Icono /></a>
              ))}
            </div>
          </div>

          <div>
            {/* Navegación */}
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white">Navegación</h3>
            <ul className="mt-4 space-y-2.5 text-[14.5px]">
              <li><Link to="/" className="transition hover:text-white">Inicio</Link></li>
              <li><Link to="/modelos" className="transition hover:text-white">Modelos</Link></li>
              <li><Link to="/nosotros" className="transition hover:text-white">Quiénes somos</Link></li>
              <li><Link to="/sedes" className="transition hover:text-white">Sedes y sucursales</Link></li>
            </ul>
          </div>

          <div>
            {/* Sedes */}
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white">Sedes</h3>
            <ul className="mt-4 space-y-3 text-[14px]">
              {sedes.map((s) => <li key={s.id} className="flex gap-2"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-acento" /><span><span className="text-white/90">{s.nombre}</span><span className="block text-[12.5px] text-white/50">{s.direccion}</span></span></li>)}
            </ul>
            <Link to="/sedes" className="mt-3 inline-block text-[13.5px] font-medium text-white/85 underline-offset-4 hover:underline">Cómo llegar a cada sede</Link>
          </div>

          <div>
            {/* Contacto */}
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white">Contacto</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li className="flex items-center gap-2"><IconPhone className="h-4 w-4 text-acento" /><span className="select-all">+51 907 721 481</span></li>
              <li className="flex items-center gap-2"><IconMail className="h-4 w-4 shrink-0 text-acento" /><span className="select-all break-all">inversionesepsamotor@gmail.com</span></li>
            </ul>
            <p className="mt-4 text-[13px] text-white/50">Lunes a sábado de 9:00 a. m. a 5:00 p. m.</p>
          </div>
        </div>

        {/* Derechos */}
        <div className="border-t border-white/10">
          <div className="wrap py-5 text-[12.5px] text-white/45">© 2026 EPSA Motor.</div>
        </div>
      </div>

    </footer>
  );
}
