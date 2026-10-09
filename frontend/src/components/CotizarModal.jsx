import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal, Campo, Aviso } from "./ui";
import { useApp } from "../store/appStore.jsx";
import { WHATSAPP_NUMERO } from "../lib/config";
import { IconWhatsapp } from "./Icons";
import { OPCIONES_TECHO } from "../data/mockData";

/**
 * Cotizar (HU-013 / HU-014): el botón "Cotizar" de la web abre este formulario.
 * Valida, guarda el interesado como Lead (aparece en el panel > Leads con su
 * modelo consultado) y ofrece continuar por WhatsApp con el mensaje ya armado.
 */
const Ctx = createContext(() => {});
export const useCotizar = () => useContext(Ctx);

const VACIO = { nombre: "", telefono: "", modelo: "", color: "", sede: "", techo: "", pago: "Financiamiento", acepta: false };

export function CotizarProvider({ children }) {
  const { publicos, sedes, equipo, leads, ventas, config, agregar, actualizar } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState(VACIO);
  const [err, setErr] = useState({});
  const [hecho, setHecho] = useState(null);

  const abrir = useCallback((pre = {}) => {
    setF({ ...VACIO, modelo: pre.modeloId || publicos[0]?.id || "", color: pre.color || "", techo: pre.techo || "", sede: sedes[0]?.nombre || "" });
    setErr({}); setHecho(null); setAbierto(true);
  }, [publicos, sedes]);

  const modelo = publicos.find((m) => m.id === f.modelo);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v, ...(k === "modelo" ? { color: "" } : {}) }));

  function validar() {
    const e = {};
    if (f.nombre.trim().length < 3) e.nombre = "Ingresa tu nombre completo.";
    if (!/^9\d{8}$/.test(f.telefono.replace(/\s/g, ""))) e.telefono = "Celular de 9 dígitos que empiece con 9.";
    if (!f.modelo) e.modelo = "Elige un modelo.";
    if (!f.sede) e.sede = "Elige una sede.";
    if (!f.acepta) e.acepta = "Debes aceptar que te contactemos.";
    setErr(e);
    return Object.keys(e).length === 0;
  }

  // Reparto por turnos: vendedor activo, presente y que recibe leads, de la sede con menos leads asignados.
  // Con el modo ausencia activo (HU-014) el lead queda «Sin asignar» y sin próximo contacto.
  function asignar(sede) {
    if (config?.modoAusencia) return "Sin asignar";
    const cand = equipo.filter((p) => p.rol === "vendedor" && p.activo && !p.ausente && p.recibeLeads !== false);
    const deSede = cand.filter((p) => p.sede === sede);
    const lista = deSede.length ? deSede : cand;
    if (!lista.length) return "Sin asignar";
    return lista.map((p) => ({ n: p.nombre, c: leads.filter((l) => l.responsable === p.nombre).length })).sort((a, b) => a.c - b.c)[0].n;
  }

  function enviar(e) {
    e.preventDefault();
    if (!validar()) return;
    const tel = f.telefono.replace(/\s/g, "");
    const techoTxt = OPCIONES_TECHO.find((t) => t.id === f.techo)?.nombre;
    const duplicado = leads.find((l) => l.telefono === tel && l.modelo === f.modelo && !["Cerrado ganado", "Perdido"].includes(l.estado));
    if (duplicado) {
      actualizar("leads", duplicado.id, { nota: `${duplicado.nota ? duplicado.nota + " · " : ""}Volvió a consultar por la web`, fecha: new Date().toISOString().slice(0, 10) }, `Lead repetido: ${duplicado.contacto} volvió a consultar`);
    } else {
      const hoy = new Date().toISOString().slice(0, 10);
      const idLead = leads.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      const responsable = asignar(f.sede);
      agregar("leads", {
        id: idLead, fecha: hoy, contacto: f.nombre.trim(), telefono: tel, canal: "Formulario web",
        modelo: f.modelo, color: f.color, sede: f.sede, responsable, estado: "Nuevo",
        nota: [techoTxt && `Techo: ${techoTxt}`, `Pago: ${f.pago}`].filter(Boolean).join(" · "),
      }, `Nuevo lead desde la web: ${f.nombre.trim()} (${modelo?.nombre})`);
      // Tarea automática en Seguimiento: el asesor asignado debe llamar hoy mismo
      if (responsable !== "Sin asignar") {
        agregar("seguimientos", {
          leadId: idLead, fecha: hoy, tipo: "Llamada", responsable, hecho: false,
          detalle: `Primer contacto: cotización web del ${modelo?.nombre}${f.color ? ` (${f.color})` : ""} · ${f.pago}`,
        }, `Seguimiento automático creado para ${f.nombre.trim()}`);
      }
      // Pendiente de compra en Ventas: la solicitud web queda a la espera de que un vendedor la atienda
      const techoPrecio = OPCIONES_TECHO.find((t) => t.id === f.techo)?.precio || 0;
      agregar("ventas", {
        id: ventas.reduce((m, v) => Math.max(m, Number(v.id) || 0), 0) + 1, fecha: hoy, cliente: f.nombre.trim(), celular: tel, documento: "",
        modelo: f.modelo, color: f.color, techo: techoTxt || "", pago: f.pago, etapa: "Solicitud web", vendedor: responsable, sede: f.sede,
        adelanto: 0, total: (modelo?.precioDesde || 0) + techoPrecio, unidad: null, canal: "Formulario web", origen: "Web de EPSA", leadId: idLead,
      }, `Solicitud de compra web: ${f.nombre.trim()} · ${modelo?.nombre}`);
    }
    const msg = `Hola, soy ${f.nombre.trim()}. Quisiera cotizar el ${modelo?.nombre}${f.color ? ` en color ${f.color}` : ""}${techoTxt ? ` con techo ${techoTxt}` : ""} (${f.pago.toLowerCase()}). Sede ${f.sede}. Mi celular: ${tel}.`;
    setHecho({ repetido: !!duplicado, url: `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(msg)}` });
  }

  const valor = useMemo(() => abrir, [abrir]);
  return (
    <Ctx.Provider value={valor}>
      {children}
      <Modal abierto={abierto} onClose={() => setAbierto(false)} sinAvisoCambios={!!hecho} titulo={hecho ? "¡Solicitud recibida!" : "Cotizar mi Torito"} ancho="max-w-xl">
        {hecho ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div>
            <p className="text-[15px] text-slate-600 dark:text-slate-300">
              {hecho.repetido ? "Ya teníamos tu consulta; la actualizamos." : "Registramos tu consulta."} Un asesor de <strong>{f.sede}</strong> te contactará pronto. Si prefieres, adelanta la conversación por WhatsApp:
            </p>
            <a href={hecho.url} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp w-full"><IconWhatsapp /> Continuar por WhatsApp</a>
            <button className="btn btn-secondary w-full" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
            <Campo etiqueta="Nombre completo" error={err.nombre} className="sm:col-span-2">
              <input className="field-input" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} autoComplete="name" />
            </Campo>
            <Campo etiqueta="Celular" error={err.telefono}>
              <input className="field-input" inputMode="numeric" maxLength={11} value={f.telefono} onChange={(e) => set("telefono", e.target.value.replace(/[^\d ]/g, ""))} placeholder="9XX XXX XXX" autoComplete="tel" />
            </Campo>
            <Campo etiqueta="Sede de atención" error={err.sede}>
              <select className="field-input" value={f.sede} onChange={(e) => set("sede", e.target.value)}>
                {sedes.map((s) => <option key={s.id}>{s.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Modelo" error={err.modelo}>
              <select className="field-input" value={f.modelo} onChange={(e) => set("modelo", e.target.value)}>
                {publicos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Color">
              <select className="field-input" value={f.color} onChange={(e) => set("color", e.target.value)}>
                <option value="">Sin preferencia</option>
                {(modelo?.colores || []).map((c) => <option key={c}>{c}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Techo (opcional)">
              <select className="field-input" value={f.techo} onChange={(e) => set("techo", e.target.value)}>
                <option value="">Sin techo / por definir</option>
                {OPCIONES_TECHO.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Forma de compra">
              <select className="field-input" value={f.pago} onChange={(e) => set("pago", e.target.value)}>
                <option>Financiamiento</option><option>Pago al contado</option>
              </select>
            </Campo>
            <label className="flex items-start gap-2 text-[13px] text-slate-600 dark:text-slate-300 sm:col-span-2">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={f.acepta} onChange={(e) => set("acepta", e.target.checked)} />
              Acepto que EPSA Motor me contacte por teléfono o WhatsApp sobre esta cotización.
            </label>
            {err.acepta && <p className="-mt-2 text-[12px] font-medium text-acento sm:col-span-2">{err.acepta}</p>}
            <div className="sm:col-span-2"><Aviso>El precio final y la disponibilidad los confirma un asesor.</Aviso></div>
            <button className="btn bg-acento text-white hover:bg-acento-600 sm:col-span-2" type="submit">Enviar solicitud</button>
          </form>
        )}
      </Modal>
    </Ctx.Provider>
  );
}
