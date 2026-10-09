import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal, Campo, Aviso } from "./ui";
import { useApp } from "../store/appStore.jsx";
import { WHATSAPP_NUMERO } from "../lib/config";
import { IconWhatsapp } from "./Icons";
import ModeloImg from "./ModeloImg";
import { OPCIONES_TECHO, SIN_TECHO, formatoSoles } from "../data/mockData";
import { soloDigitos, soloLetras, esNombre, esCelular, MSJ } from "../lib/validar";

/**
 * Cotizar: el botón «Cotizar» de la web abre este formulario.
 * - Muestra siempre la moto que se está cotizando (foto, color y precio) para que no haya confusión.
 * - El techo es un adicional obligatorio de elegir (o «Sin techo») y su precio se suma al total.
 * - Guarda el interesado como lead, crea la solicitud en Ventas y arma el mensaje de WhatsApp con la misma moto.
 * - Si el celular ya existe en un lead abierto, no se duplica: se actualiza ese cliente con la nueva consulta.
 */
const Ctx = createContext(() => {});
export const useCotizar = () => useContext(Ctx);

const TECHOS = [SIN_TECHO, ...OPCIONES_TECHO];
const VACIO = { nombre: "", telefono: "", modelo: "", color: "", sede: "", techo: "", pago: "Financiamiento", acepta: false };
const ABIERTO = (l) => !["Cerrado ganado", "Perdido"].includes(l.estado);

export function CotizarProvider({ children }) {
  const { publicos, sedes, equipo, leads, ventas, config, agregar, actualizar } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState({});
  const [hecho, setHecho] = useState(null);
  const [pausaClic, setPausaClic] = useState(false); // evita que el 2.º clic de un doble clic cierre la confirmación
  const enviando = useRef(false);

  const abrir = useCallback((pre = {}) => {
    const m = publicos.find((x) => x.id === pre.modeloId) || publicos[0];
    const color = m?.colores?.includes(pre.color) ? pre.color : m?.colores?.[0] || "";
    setF({ ...VACIO, modelo: m?.id || "", color, techo: TECHOS.some((t) => t.id === pre.techo) ? pre.techo : "", sede: sedes[0]?.nombre || "" });
    setErr({}); setHecho(null); enviando.current = false; setAbierto(true);
  }, [publicos, sedes]);

  const modelo = publicos.find((m) => m.id === f.modelo);
  const techo = TECHOS.find((t) => t.id === f.techo);
  const total = (modelo?.precioDesde || 0) + (techo?.precio || 0);
  const set = (k, v) => setF((p) => {
    const n = { ...p, [k]: v };
    if (k === "modelo") { const m = publicos.find((x) => x.id === v); n.color = m?.colores?.[0] || ""; }
    return n;
  });

  function validar() {
    const e = {};
    if (!esNombre(f.nombre)) e.nombre = MSJ.nombre;
    if (!esCelular(f.telefono)) e.telefono = MSJ.celular;
    if (!modelo) e.modelo = "Elige un modelo.";
    if (!f.techo) e.techo = "Elige un techo o «Sin techo».";
    if (!f.sede) e.sede = "Elige una sede.";
    if (!f.acepta) e.acepta = "Debes aceptar que te contactemos.";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  // Reparto por turnos: vendedor activo, presente y que recibe leads, de la sede con menos leads asignados.
  function asignar(sede) {
    if (config?.modoAusencia) return "Sin asignar";
    const cand = equipo.filter((p) => p.rol === "vendedor" && p.activo && !p.ausente && p.recibeLeads !== false);
    const lista = cand.filter((p) => p.sede === sede).length ? cand.filter((p) => p.sede === sede) : cand;
    if (!lista.length) return "Sin asignar";
    return lista.map((p) => ({ n: p.nombre, c: leads.filter((l) => l.responsable === p.nombre).length })).sort((a, b) => a.c - b.c)[0].n;
  }

  function enviar(e) {
    e.preventDefault();
    if (enviando.current || !validar()) return;
    enviando.current = true;
    const hoy = new Date().toISOString().slice(0, 10);
    const nombre = f.nombre.trim().replace(/\s+/g, " ");
    const tel = f.telefono;
    const techoTxt = techo.precio ? techo.nombre : "";
    const detalle = `${modelo.nombre}${f.color ? ` (${f.color})` : ""}${techoTxt ? ` · techo ${techoTxt}` : " · sin techo"} · ${f.pago} · total ${formatoSoles(total)}`;
    const solicitud = { cliente: nombre, celular: tel, modelo: modelo.id, color: f.color, techo: techoTxt, techoPrecio: techo.precio, pago: f.pago, sede: f.sede, total };

    // Mismo celular con un lead abierto: es el mismo cliente, no se crea otro.
    const existente = leads.find((l) => l.telefono === tel && ABIERTO(l));
    if (existente) {
      actualizar("leads", existente.id, { modelo: modelo.id, color: f.color, fecha: hoy, nota: `${existente.nota ? `${existente.nota} · ` : ""}Volvió a consultar por la web: ${detalle}` }, `Cliente conocido volvió a cotizar: ${existente.contacto}`);
      const pendiente = ventas.find((v) => v.leadId === existente.id && v.etapa === "Solicitud web");
      if (pendiente) actualizar("ventas", pendiente.id, { ...solicitud, fecha: hoy }, `Solicitud web actualizada: ${nombre} · ${modelo.nombre}`);
      else agregar("ventas", { id: ventas.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1, fecha: hoy, documento: "", etapa: "Solicitud web", vendedor: existente.responsable, adelanto: 0, unidad: null, canal: "Formulario web", origen: "Web de EPSA", leadId: existente.id, ...solicitud }, `Solicitud de compra web: ${nombre} · ${modelo.nombre}`);
      if (existente.responsable !== "Sin asignar") agregar("seguimientos", { leadId: existente.id, fecha: hoy, tipo: "Llamada", responsable: existente.responsable, hecho: false, detalle: `Volvió a cotizar: ${detalle}` });
    } else {
      const idLead = leads.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      const responsable = asignar(f.sede);
      agregar("leads", { id: idLead, fecha: hoy, contacto: nombre, telefono: tel, canal: "Formulario web", modelo: modelo.id, color: f.color, sede: f.sede, responsable, estado: "Nuevo", nota: `${techoTxt ? `Techo: ${techoTxt}` : "Sin techo"} · Pago: ${f.pago}` }, `Nuevo lead desde la web: ${nombre} (${modelo.nombre})`);
      if (responsable !== "Sin asignar") agregar("seguimientos", { leadId: idLead, fecha: hoy, tipo: "Llamada", responsable, hecho: false, detalle: `Primer contacto: cotización web del ${detalle}` }, `Seguimiento automático creado para ${nombre}`);
      agregar("ventas", { id: ventas.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1, fecha: hoy, documento: "", etapa: "Solicitud web", vendedor: responsable, adelanto: 0, unidad: null, canal: "Formulario web", origen: "Web de EPSA", leadId: idLead, ...solicitud }, `Solicitud de compra web: ${nombre} · ${modelo.nombre}`);
    }
    const msg = `Hola, soy ${nombre}. Quisiera cotizar el ${modelo.nombre}${f.color ? ` en color ${f.color}` : ""}${techoTxt ? ` con techo ${techoTxt} (+${formatoSoles(techo.precio)})` : " sin techo"}, total referencial ${formatoSoles(total)} (${f.pago.toLowerCase()}). Sede ${f.sede}. Mi celular: ${tel}.`;
    setPausaClic(true); setTimeout(() => setPausaClic(false), 700);
    setHecho({ repetido: !!existente, modelo: modelo.nombre, url: `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}` });
  }

  const valor = useMemo(() => abrir, [abrir]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <Modal abierto={abierto} onClose={() => { if (!pausaClic) setAbierto(false); }} sinAvisoCambios={!!hecho || !publicos.length} titulo={hecho ? "¡Solicitud recibida!" : "Cotizar mi Torito"} ancho="max-w-2xl">
        {!hecho && !publicos.length ? (
          // Catálogo vacío (por ejemplo, mientras Supabase aún no tiene modelos publicados): se cotiza por WhatsApp
          <div className="space-y-4 text-center" data-cotizar-vacio>
            <p className="text-[15px] text-slate-600 dark:text-slate-300">Estamos actualizando nuestro catálogo. Escríbenos por WhatsApp y un asesor te cotiza al momento.</p>
            <a href={`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent("Hola, quisiera cotizar un Torito.")}`} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full"><IconWhatsapp /> Cotizar por WhatsApp</a>
            <button className="btn btn-secondary w-full" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        ) : hecho ? (
          <div className={`space-y-4 text-center ${pausaClic ? "pointer-events-none" : ""}`}>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <p className="text-[15px] text-slate-600 dark:text-slate-300">
              {hecho.repetido ? "Ya teníamos tus datos: actualizamos tu consulta" : "Registramos tu consulta"} por el <strong>{hecho.modelo}</strong>. Un asesor de <strong>{f.sede}</strong> te contactará pronto. Si prefieres, adelanta la conversación por WhatsApp:
            </p>
            <a href={hecho.url} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full"><IconWhatsapp /> Continuar por WhatsApp</a>
            <button className="btn btn-secondary w-full" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
            {modelo && (
              <div className="flex items-center gap-4 rounded-2xl bg-escenario p-3 sm:col-span-2 dark:bg-escenario-oscuro" aria-live="polite">
                <ModeloImg modelo={modelo} color={f.color} className="h-20 w-28 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Estás cotizando</p>
                  <p className="truncate font-display text-[1.45rem] font-bold uppercase leading-tight text-marino dark:text-white" data-cotizando>{modelo.nombre}</p>
                  <p className="text-[13px] text-slate-500">{f.color && `Color ${f.color} · `}moto desde {formatoSoles(modelo.precioDesde)}</p>
                </div>
              </div>
            )}
            <Campo etiqueta="Nombre completo" error={err.nombre} className="sm:col-span-2">
              <input className="field-input" value={f.nombre} maxLength={80} onChange={(e) => set("nombre", soloLetras(e.target.value))} autoComplete="name" />
            </Campo>
            <Campo etiqueta="Celular" error={err.telefono}>
              <input className="field-input" type="tel" inputMode="numeric" pattern="9[0-9]{8}" maxLength={9} value={f.telefono} onChange={(e) => set("telefono", soloDigitos(e.target.value, 9))} placeholder="9XXXXXXXX" autoComplete="tel" />
            </Campo>
            <Campo etiqueta="Sede de atención" error={err.sede}>
              <select className="field-input" value={f.sede} onChange={(e) => set("sede", e.target.value)}>
                {sedes.map((s) => <option key={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Modelo" error={err.modelo}>
              <select className="field-input" value={f.modelo} onChange={(e) => set("modelo", e.target.value)} aria-label="Modelo">
                {publicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Color">
              <select className="field-input" value={f.color} onChange={(e) => set("color", e.target.value)} disabled={(modelo?.colores || []).length < 2} aria-label="Color">
                {(modelo?.colores || []).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Techo de fibra <span className="font-normal text-slate-500">(adicional: se suma al precio de la moto)</span></legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Techo">
                {TECHOS.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={f.techo === t.id} onClick={() => set("techo", t.id)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${f.techo === t.id ? "border-marino-700 bg-marino-50 ring-1 ring-marino-700 dark:border-white/60 dark:bg-white/10 dark:ring-white/60" : "border-slate-200 hover:border-slate-300 dark:border-white/15"}`}>
                    <span className="block text-[13px] font-semibold leading-tight text-marino dark:text-white">{t.precio ? t.nombre : "Sin techo"}</span>
                    <span className="cifra text-[12px] text-slate-500">{t.precio ? `+ ${formatoSoles(t.precio)}` : "Solo la moto"}</span>
                  </button>
                ))}
              </div>
              {err.techo && <p className="mt-1.5 text-[12px] font-medium text-acento">{err.techo}</p>}
            </fieldset>
            <Campo etiqueta="Forma de compra">
              <select className="field-input" value={f.pago} onChange={(e) => set("pago", e.target.value)}>
                <option>Financiamiento</option><option>Pago al contado</option>
              </select>
            </Campo>
            <dl className="grid content-end gap-1 rounded-xl bg-marino-50 px-4 py-3 text-[13px] dark:bg-white/5" data-presupuesto>
              <div className="flex justify-between"><dt className="text-slate-500">Moto</dt><dd className="cifra">{formatoSoles(modelo?.precioDesde || 0)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Techo</dt><dd className="cifra">{techo ? formatoSoles(techo.precio) : "—"}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-1 text-[15px] font-bold text-marino dark:border-white/10 dark:text-white"><dt>Total referencial</dt><dd className="cifra">{formatoSoles(total)}</dd></div>
            </dl>
            <label className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300 sm:col-span-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={f.acepta} onChange={(e) => set("acepta", e.target.checked)} />
              Acepto que EPSA Motor me contacte por teléfono o WhatsApp sobre esta cotización.
            </label>
            {err.acepta && <p className="-mt-2 text-[12px] font-medium text-acento sm:col-span-2">{err.acepta}</p>}
            <div className="sm:col-span-2"><Aviso>Precio referencial sin matrícula ni SOAT. El precio final y la disponibilidad los confirma un asesor.</Aviso></div>
            <button className="btn bg-acento text-white hover:bg-acento-600 sm:col-span-2" type="submit">Enviar solicitud</button>
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
