import { useState } from "react";
import { Link } from "react-router-dom";
import { enlaceGoogleMaps, enlaceMapaEmbebido } from "../data/mockData";
import { WHATSAPP_NUMERO } from "../lib/config";
import { useApp } from "../store/appStore.jsx";
import { useCotizar } from "../components/CotizarModal";
import WhatsAppButton from "../components/WhatsAppButton.HU-013";
import { IconPhone, IconMail, IconShield, IconCreditCard, IconDocument, IconMapArea } from "../components/Icons";

const SERVICIOS = ["Venta de unidades", "Crédito directo", "Prueba de manejo", "Trámite de placa", "Entrega de unidades"];
const REQUISITOS = [
  { Icono: IconDocument, t: "DNI vigente", d: "Del titular de la compra y, si aplica, del cónyuge." },
  { Icono: IconShield, t: "Licencia de conducir", d: "Necesaria para la prueba de manejo y la entrega." },
  { Icono: IconCreditCard, t: "Recibo de luz o agua", d: "Para la evaluación del crédito directo." },
  { Icono: IconMapArea, t: "Referencia de trabajo", d: "Paradero o zona donde trabajarás con tu Torito." },
];
const PREGUNTAS = [
  ["¿Necesito separar cita para visitar una sede?", "No es obligatorio. Si nos escribes antes por WhatsApp, un asesor te espera con el modelo que te interesa listo para verlo."],
  ["¿Puedo probar el Torito antes de comprarlo?", "Sí. Coordinamos la prueba de manejo en la sede; solo trae tu licencia de conducir."],
  ["¿Cuánto demora la entrega?", "Depende del modelo, del color y del techo elegido. Tu asesor te confirma la fecha al cerrar la compra."],
  ["¿Atienden domingos o feriados?", "Atendemos de lunes a sábado. Domingos y feriados puedes dejarnos tu consulta por WhatsApp y te respondemos el siguiente día hábil."],
];

/** ¿La sede está abierta ahora? Horario L-S 9:00-17:00, hora de Lima. */
function abiertoAhora() {
  try {
    const p = new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", weekday: "short", hour: "numeric", hour12: false }).formatToParts(new Date());
    const dia = p.find((x) => x.type === "weekday")?.value || "";
    const hora = Number(p.find((x) => x.type === "hour")?.value);
    return !/^dom/i.test(dia) && hora >= 9 && hora < 17;
  } catch { return null; }
}

/**
 * Sedes y sucursales (HU-010). Las sedes salen del panel (Ubicaciones, tipo "Sede propia" y activas):
 * si el gerente desactiva o agrega una sede, esta página cambia sola.
 */
export default function Sedes() {
  const { sedes } = useApp();
  const cotizar = useCotizar();
  const [sel, setSel] = useState(0);
  const [faq, setFaq] = useState(0);
  const abierto = abiertoAhora();
  const s = sedes[Math.min(sel, Math.max(0, sedes.length - 1))];

  return (
    <div className="fade-in">

      {/* Hero */}
      <section className="relative overflow-hidden bg-marino text-white">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-acento/20 blur-2xl" />
        <div className="wrap relative grid gap-8 py-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-[15px] font-medium text-white/60">Visítanos</p>
            <h1 className="mt-2 font-display text-[3.2rem] font-bold uppercase leading-[0.9] tracking-tight sm:text-[4.5rem]">Sedes y sucursales</h1>
            <p className="mt-3 max-w-xl text-[15.5px] text-white/75">Conoce las unidades en persona, haz tu prueba de manejo y sal con tu crédito evaluado. Estamos en Lima Norte y el Callao.</p>
            <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
              <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera coordinar una visita a una sede de EPSA Motor.")}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp">Coordinar visita por WhatsApp</a>
              <Link to="/modelos" className="btn btn-claro">Ver modelos</Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[[String(sedes.length), "sedes activas"], ["L–S", "9:00 a 17:00"], ["+12", "años en el mercado"]].map(([n, t]) => (
              <div key={t} className="rounded-2xl bg-white/5 px-2 py-4 text-center ring-1 ring-white/10 sm:p-4">
                <p className="cifra whitespace-nowrap font-display text-[1.9rem] font-bold leading-none min-[380px]:text-[2.2rem] sm:text-[2.6rem]">{n}</p>
                <p className="mt-1 text-[12px] text-white/60">{t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Selector + mapa */}
      <section className="wrap py-12">
        {sedes.length === 0 ? (
          <p className="rounded-xl2 border-2 border-dashed py-12 text-center text-slate-500">No hay sedes activas por el momento. Escríbenos por WhatsApp y te atendemos.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            <div className="space-y-3">
              {sedes.map((x, i) => (
                <button key={x.id} onClick={() => setSel(i)} aria-pressed={s?.id === x.id}
                  className={`w-full rounded-xl2 border p-4 text-left transition ${s?.id === x.id ? "border-marino-700 bg-white shadow-cardHover ring-2 ring-marino-700/15 dark:border-white/30 dark:bg-[#121a2b]" : "border-slate-100 bg-white shadow-card hover:border-slate-300 dark:border-white/5 dark:bg-[#121a2b]"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[17px] font-bold text-marino dark:text-white">Sede {x.nombre}</h3>
                    {abierto !== null && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${abierto ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{abierto ? "● Abierto ahora" : "Cerrado ahora"}</span>}
                  </div>
                  <p className="mt-1 text-[13.5px] text-slate-500">{x.direccion}</p>
                  <p className="mt-1 text-[12.5px] text-slate-400">{x.horario}</p>
                </button>
              ))}
            </div>

            {s && (
              <div className="overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card dark:border-white/5 dark:bg-[#121a2b]">
                <div className="relative bg-gradient-to-br from-marino-50 to-slate-100 dark:from-white/5 dark:to-white/10">
                  <iframe key={s.id} title={`Mapa de ${s.nombre}`} src={enlaceMapaEmbebido(s.direccion)} className="relative h-72 w-full border-0 sm:h-80" loading="lazy" />
                  <a href={enlaceGoogleMaps(s.direccion)} target="_blank" rel="noopener noreferrer" className="absolute bottom-3 right-3 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-semibold text-marino shadow-card hover:bg-marino-50">Abrir en Google Maps ↗</a>
                </div>
                <div className="grid gap-6 p-6 md:grid-cols-2">
                  <div>
                    <span className="inline-block rounded-full bg-marino-50 px-2.5 py-1 text-[11px] font-semibold text-marino-700 dark:bg-white/10 dark:text-white/70">SEDE OFICIAL</span>
                    <h2 className="mt-2 font-display text-[2rem] font-bold uppercase leading-none tracking-tight text-marino dark:text-white">Sede {s.nombre}</h2>
                    <p className="mt-1 text-[14px] text-slate-500">{s.direccion}</p>
                    <p className="mt-3 text-[13.5px] font-medium text-marino dark:text-white">{s.horario}</p>
                    {s.horarioNota && <p className="text-[12.5px] text-slate-400">{s.horarioNota}</p>}
                    <div className="mt-3 space-y-1.5 text-[13.5px] text-slate-500">
                      {s.telefono && <a href={`tel:+51${String(s.telefono).replace(/^51(?=9\d{8}$)/, "")}`} className="flex items-center gap-2 hover:text-marino dark:hover:text-white"><IconPhone className="h-4 w-4" /> +51 {String(s.telefono).replace(/^51(?=9\d{8}$)/, "").replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")}</a>}
                      {s.correo && <a href={`mailto:${s.correo}`} className="flex items-center gap-2 hover:text-marino dark:hover:text-white"><IconMail className="h-4 w-4" /> {s.correo}</a>}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-slate-400">En esta sede</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {SERVICIOS.map((x) => <span key={x} className="rounded-full bg-marino-50 px-3 py-1 text-[12.5px] font-medium text-marino-700 dark:bg-white/10 dark:text-white/80">{x}</span>)}
                    </div>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <a href={enlaceGoogleMaps(s.direccion)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary !py-2.5">Cómo llegar</a>
                      <button onClick={() => cotizar({})} className="btn btn-acento !py-2.5">Cotizar aquí</button>
                      <WhatsAppButton className="sm:col-span-2" mensaje={`Hola, quisiera visitar la sede de ${s.nombre}.`} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Requisitos */}
      <section className="bg-marino-50 py-12 dark:bg-white/[0.03]">
        <div className="wrap">
          <h2 className="titulo text-center">Qué traer a tu visita</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-slate-500">Con estos documentos podemos evaluar tu crédito y dejar tu compra avanzada el mismo día.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {REQUISITOS.map(({ Icono, t, d }) => (
              <div key={t} className="rounded-xl2 bg-white p-5 shadow-card dark:bg-[#121a2b]">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-acento/10 text-acento"><Icono className="h-5 w-5" /></span>
                <h3 className="mt-3 font-bold text-marino dark:text-white">{t}</h3>
                <p className="mt-1 text-[13.5px] text-slate-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="wrap max-w-4xl py-12">
        <h2 className="titulo text-center">Preguntas frecuentes</h2>
        <div className="mt-6 divide-y divide-slate-100 rounded-xl2 border border-slate-100 bg-white shadow-card dark:divide-white/10 dark:border-white/5 dark:bg-[#121a2b]">
          {PREGUNTAS.map(([p, r], i) => (
            <div key={p}>
              <button onClick={() => setFaq(faq === i ? -1 : i)} aria-expanded={faq === i} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold text-marino dark:text-white">
                {p}<span className={`text-xl text-acento transition ${faq === i ? "rotate-45" : ""}`}>+</span>
              </button>
              {faq === i && <p className="fade-in px-5 pb-4 text-[14px] text-slate-500">{r}</p>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
