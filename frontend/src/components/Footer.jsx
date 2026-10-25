// Pie de página de la web
// Arriba, el llamado a cotizar con una vitrina que va mostrando los modelos publicados; abajo, empresa,
// navegación, sedes (vienen de la API) y contacto.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IconPin, IconPhone, IconMail, IconFacebook, IconInstagram, IconWhatsapp } from "./Icons";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "./CotizarModal";
import VideoFondo from "./VideoFondo";
import ModeloImg, { motosConFotoDistinta } from "./ModeloImg";
import { COLOR_HEX, formatoSoles } from "../data/mockData";
import { WHATSAPP_NUMERO } from "../lib/config";

// ---------------------------------------------------------------------------------------------
// Datos de contacto de la empresa
// ---------------------------------------------------------------------------------------------
const REDES = [
  { nombre: "Facebook", href: "https://www.facebook.com/epsamotorperu/", Icono: IconFacebook },
  { nombre: "Instagram", href: "https://www.instagram.com/toritobajajepsamotor/", Icono: IconInstagram },
];
const CORREO = "inversionesepsamotor@gmail.com";
// 51907721481 → +51 907 721 481
const TELEFONO = `+${WHATSAPP_NUMERO.slice(0, 2)} ${WHATSAPP_NUMERO.slice(2).replace(/(\d{3})(?=\d)/g, "$1 ")}`;
const CADA_MS = 4200; // tiempo de cada moto en la vitrina

// ---------------------------------------------------------------------------------------------
// Vitrina del llamado: cambia de moto sola (se detiene al pasar el mouse o con movimiento reducido)
// ---------------------------------------------------------------------------------------------
function VitrinaCta({ motos, onCotizar }) {
  const [i, setI] = useState(0);
  const [pausa, setPausa] = useState(false);
  const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  useEffect(() => {
    if (quieto || pausa || motos.length < 2) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % motos.length), CADA_MS);
    return () => clearInterval(t);
  }, [quieto, pausa, motos.length]);
  const actual = motos[i % motos.length];
  const brillo = COLOR_HEX[actual.colorPortada || actual.colores?.[0]] || "#c62828";

  return (
    <div className="relative" onMouseEnter={() => setPausa(true)} onMouseLeave={() => setPausa(false)} onFocus={() => setPausa(true)} onBlur={() => setPausa(false)} data-vitrina-cta>
      {/* Escenario: luz del color de la moto, piso y la moto */}
      <div className="relative h-56 sm:h-64 lg:h-72">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[85%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-1000" style={{ background: brillo }} aria-hidden="true" />
        <div className="pointer-events-none absolute inset-x-[18%] bottom-3 h-7 rounded-[50%] bg-black/55 blur-xl" aria-hidden="true" />
        {motos.map((m, n) => (
          <div key={m.id} className={`absolute inset-0 transition-all duration-700 ease-out ${n === i % motos.length ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-8 opacity-0"}`}>
            <ModeloImg modelo={m} alt={n === i % motos.length ? m.nombre : ""} className="h-full w-full object-contain drop-shadow-[0_26px_30px_rgba(0,0,0,.5)]" />
          </div>
        ))}
      </div>

      {/* Nombre, precio y botón de la moto que se ve */}
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0" aria-live="polite">
          <p className="truncate font-display text-[1.5rem] font-bold uppercase leading-none text-white">{actual.nombre}</p>
          {actual.precioDesde ? <p className="mt-1 text-[13.5px] text-white/60">Desde <span className="cifra font-semibold text-white">{formatoSoles(actual.precioDesde)}</span></p> : null}
        </div>
        <button type="button" onClick={() => onCotizar(actual.id)} className="rounded-full bg-white/10 px-4 py-2 text-[13.5px] font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20">Cotizar este modelo</button>
      </div>

      {/* Elegir moto */}
      {motos.length > 1 && (
        <div className="mt-2 flex gap-1.5" role="tablist" aria-label="Modelos de la vitrina">
          {motos.map((m, n) => (
            <button key={m.id} type="button" role="tab" aria-selected={n === i % motos.length} aria-label={m.nombre} onClick={() => setI(n)} className="group flex-1 py-2.5">
              <span className={`block h-1.5 rounded-full transition-colors ${n === i % motos.length ? "bg-white" : "bg-white/20 group-hover:bg-white/40"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Footer() {
  const { sedes, publicos = [] } = useApp();
  const cotizar = useCotizar();
  // Hasta 5 modelos con foto distinta (sin repetir la misma imagen)
  const motos = useMemo(() => motosConFotoDistinta(publicos, 5), [publicos]);
  const horarios = [...new Set(sedes.map((s) => s.horario).filter(Boolean))];

  return (
    <footer className="relative overflow-hidden bg-marino text-white/70">
      <VideoFondo opacidad="opacity-35" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-marino via-marino/85 to-marino/95" aria-hidden="true" />

      <div className="relative">
        {/* ----------------------------------------------------------------------------------- */}
        {/* Llamado a cotizar                                                                   */}
        {/* ----------------------------------------------------------------------------------- */}
        <div className="border-b border-white/10">
          <div className={`wrap grid items-center gap-10 py-14 lg:py-16 ${motos.length ? "lg:grid-cols-[1.05fr_1fr] xl:gap-20" : ""}`}>
            <div className="order-2 lg:order-1">
              <p className="font-display text-[2.6rem] font-bold uppercase leading-[0.92] tracking-tight text-white sm:text-[3.4rem] xl:text-[4rem]">Tu Torito<br className="hidden sm:block" /> te espera</p>
              <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-white/70">Arma tu cotización en línea y envíala por WhatsApp a tu sede. ¿Tienes una duda? <button type="button" onClick={() => cotizar({ tipo: "consulta" })} className="font-semibold text-white underline underline-offset-4 hover:text-white/90" data-abrir-consulta>Envíanos tu consulta</button>.</p>
              <div className="mt-7 grid gap-3 sm:flex sm:flex-wrap">
                <button onClick={() => cotizar()} className="btn btn-acento shadow-lg shadow-acento/25">Cotizar mi Torito</button>
                <a className="btn btn-whatsapp" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera cotizar un Torito.")}`}><IconWhatsapp /> WhatsApp</a>
              </div>
            </div>
            {motos.length > 0 && (
              <div className="order-1 lg:order-2">
                <VitrinaCta motos={motos} onCotizar={(modeloId) => cotizar({ modeloId })} />
              </div>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------------------- */}
        {/* Empresa, navegación, sedes y contacto                                               */}
        {/* ----------------------------------------------------------------------------------- */}
        <div className="wrap grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.7fr_1.3fr_auto] lg:gap-12">
          <div className="min-w-0">
            <img src="/images/logo-epsa-marcas.svg" alt="EPSA Motor, Torito y Bajaj" className="h-auto w-full max-w-[380px]" />
            <p className="mt-5 max-w-xs text-[14px] leading-relaxed">Distribuidor autorizado de motocars Torito Bajaj, autorizado por Crosland Perú S.A.C.</p>
            <p className="mt-2 text-[12.5px] text-white/45">INVERSIONES EPSA MOTOR S.A.C., RUC 20555595469</p>
            <div className="mt-5 flex gap-2">
              {REDES.map(({ nombre, href, Icono }) => (
                <a key={nombre} href={href} target="_blank" rel="noopener noreferrer" aria-label={nombre} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/10 transition hover:bg-white/20 hover:text-white"><Icono /></a>
              ))}
            </div>
          </div>

          {/* Navegación */}
          <nav aria-label="Pie de página">
            <h3 className="text-[15px] font-semibold text-white">Navegación</h3>
            <ul className="mt-4 space-y-2.5 text-[14.5px]">
              <li><Link to="/" className="transition hover:text-white">Inicio</Link></li>
              <li><Link to="/modelos" className="transition hover:text-white">Modelos</Link></li>
              <li><Link to="/nosotros" className="transition hover:text-white">Quiénes somos</Link></li>
              <li><Link to="/sedes" className="transition hover:text-white">Sedes y sucursales</Link></li>
            </ul>
          </nav>

          {/* Sedes */}
          {sedes.length > 0 && (
            <div>
              <h3 className="text-[15px] font-semibold text-white">Sedes</h3>
              <ul className="mt-4 space-y-3 text-[14px]">
                {sedes.map((s) => <li key={s.id} className="flex gap-2"><IconPin className="mt-0.5 h-4 w-4 shrink-0 text-acento" /><span><span className="text-white/90">{s.nombre}</span>{s.direccion && <span className="block text-[12.5px] text-white/50">{s.direccion}</span>}</span></li>)}
              </ul>
              <Link to="/sedes" className="mt-3 inline-block text-[13.5px] font-medium text-white/85 underline-offset-4 hover:underline">Cómo llegar a cada sede</Link>
            </div>
          )}

          {/* Contacto */}
          <div>
            <h3 className="text-[15px] font-semibold text-white">Contacto</h3>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li className="flex items-center gap-2"><IconPhone className="h-4 w-4 shrink-0 text-acento" /><span className="select-all">{TELEFONO}</span></li>
              <li className="flex items-center gap-2"><IconMail className="h-4 w-4 shrink-0 text-acento" /><span className="select-all break-all lg:whitespace-nowrap lg:break-normal">{CORREO}</span></li>
            </ul>
            {horarios.length === 1 && <p className="mt-4 text-[13px] text-white/50">{horarios[0]}</p>}
          </div>
        </div>

        {/* Derechos */}
        <div className="border-t border-white/10">
          <div className="wrap py-5 text-[12.5px] text-white/45">© {new Date().getFullYear()} EPSA Motor.</div>
        </div>
      </div>
    </footer>
  );
}
