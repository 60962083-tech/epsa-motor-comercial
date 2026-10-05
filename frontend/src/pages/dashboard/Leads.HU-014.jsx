import { useState } from "react";
import { LEADS as INICIAL, MODELOS } from "../../data/mockData";
import { IconAlert } from "../../components/Icons";
import Badge from "../../components/Badge";
import HUBadge from "../../components/HUBadge";

/**
 * Leads.jsx — HU-014
 * "Registrar manualmente un interesado" + aviso de duplicados
 * -----------------------------------------------------------------
 * Antes de guardar, se compara el teléfono escrito contra los
 * teléfonos que ya están en la lista. Si coincide, no se bloquea el
 * registro (puede ser una segunda consulta de la misma persona),
 * pero sí se avisa con claridad para que quien atiende decida si
 * es un caso nuevo o si debe sumarlo al seguimiento que ya existe.
 * -----------------------------------------------------------------
 */
export default function Leads() {
  const [leads, setLeads] = useState(INICIAL);
  const [form, setForm] = useState({ contacto: "", telefono: "", canal: "WhatsApp 1", modelo: MODELOS[0].nombre, responsable: "César" });
  const [avisoDuplicado, setAvisoDuplicado] = useState(null);
  const [mensaje, setMensaje] = useState("");

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    // En cuanto cambia el teléfono, revisamos si ya existe (sin esperar a enviar el formulario)
    if (campo === "telefono") {
      const existente = leads.find((l) => l.telefono === valor.trim() && valor.trim() !== "");
      setAvisoDuplicado(existente || null);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!form.contacto.trim() || !form.telefono.trim()) {
      setMensaje("Completa nombre y teléfono.");
      return;
    }
    const nuevo = { id: Date.now(), ...form, estado: "Nuevo" };
    setLeads((prev) => [nuevo, ...prev]);
    setMensaje("Interesado registrado correctamente.");
    setForm({ contacto: "", telefono: "", canal: "WhatsApp 1", modelo: MODELOS[0].nombre, responsable: "César" });
    setAvisoDuplicado(null);
  }

  return (
    <div>
      <HUBadge code="HU-014" titulo="Registrar manualmente un interesado" />
      <h1 className="text-2xl font-bold text-marino dark:text-white">Leads y seguimientos</h1>
      <p className="mt-1 text-slate-500">Registro manual de los contactos que llegan por los cuatro WhatsApp, las redes y la web.</p>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-slate-200 dark:border-white/10">
        <table className="w-full text-[14px]">
          <thead className="bg-marino-50 text-left text-[13px] text-marino dark:bg-white/5 dark:text-white/70">
            <tr><th className="px-4 py-3">Contacto</th><th className="px-4 py-3">Canal</th><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Responsable</th><th className="px-4 py-3">Estado</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3">{l.contacto}</td>
                <td className="px-4 py-3">{l.canal}</td>
                <td className="px-4 py-3">{l.modelo}</td>
                <td className="px-4 py-3">{l.responsable}</td>
                <td className="px-4 py-3"><Badge estado={l.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="mt-6 max-w-2xl rounded-xl2 border border-slate-200 p-6 dark:border-white/10">
        <h2 className="text-lg font-semibold">Registrar interesado</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><label className="field-label">Nombre o contacto</label>
            <input className="field-input" value={form.contacto} onChange={(e) => actualizar("contacto", e.target.value)} /></div>
          <div><label className="field-label">Teléfono</label>
            <input className="field-input" value={form.telefono} onChange={(e) => actualizar("telefono", e.target.value)} placeholder="900111222" /></div>
          <div><label className="field-label">Canal o número receptor</label>
            <select className="field-input" value={form.canal} onChange={(e) => actualizar("canal", e.target.value)}>
              <option>WhatsApp 1</option><option>WhatsApp 2</option><option>WhatsApp 3</option><option>WhatsApp 4</option>
            </select></div>
          <div><label className="field-label">Motocar de interés</label>
            <select className="field-input" value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)}>
              {MODELOS.map((m) => <option key={m.id}>{m.nombre}</option>)}
            </select></div>
        </div>

        {/* ---------- Aviso de posible duplicado (no bloquea, solo informa) ---------- */}
        {avisoDuplicado && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <IconAlert className="mt-0.5 shrink-0" />
            <span>
              Ese teléfono ya está registrado como <strong>{avisoDuplicado.contacto}</strong>, con estado
              "{avisoDuplicado.estado}". Puede ser la misma persona escribiendo de nuevo.
            </span>
          </div>
        )}

        {mensaje && <p className="mt-3 text-[13.5px] font-medium text-emerald-600">{mensaje}</p>}

        <button className="btn btn-primary mt-5" type="submit">Guardar interesado</button>
        <span className="ml-3 text-[12.5px] text-slate-400">Las etapas del interesado se acuerdan con Deysi.</span>
      </form>
    </div>
  );
}
