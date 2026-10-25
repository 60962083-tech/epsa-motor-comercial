// HU-033 · Ventana para cambiar el paso de preparación de una moto
import { useEffect, useState } from "react";
import { PASO_PREPARACION } from "../../data/mockData";
import { usePreparacion } from "../../servicios/preparacion";
import { Aviso, Campo, Modal, useToast } from "../ui";
import { PasosPreparacion } from "./Sprint2";

export default function PreparacionModal({ unidad: u, destinoInicial, onClose, onHecho }) {
  const prep = usePreparacion();
  const toast = useToast();
  const [destino, setDestino] = useState("");
  const [obs, setObs] = useState("");
  const [err, setErr] = useState({});
  useEffect(() => { if (u) { setDestino(destinoInicial || prep.siguiente(u) || ""); setObs(""); setErr({}); } }, [u?.id]); // eslint-disable-line
  if (!u) return <Modal abierto={false} onClose={onClose} />;
  const libera = destino === "Lista para entrega" && u.disponibilidad === "No disponible";
  const retira = u.preparacion === "Lista para entrega" && destino && destino !== "Lista para entrega" && u.disponibilidad === "Disponible";
  const atras = destino && prep.retrocede(u, destino);
  const validar = () => { const x = destino ? prep.validarCambio(u, destino, obs) : { general: "Elige el paso." }; setErr(x); return Object.keys(x).length === 0; };
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    toast(prep.cambiarPaso(u, destino, obs));
    onHecho?.(); onClose();
  }
  return (
    <Modal abierto={!!u} onClose={onClose} titulo={`Preparación de ${u.id}`} ancho="max-w-lg"
      confirmarGuardar={{ titulo: `¿Pasar a «${destino}»?`, texto: libera ? `${u.id} quedará lista y aparecerá en Disponibilidad para todos los vendedores.` : retira ? `${u.id} saldrá de la venta hasta que vuelva a estar lista.` : `${u.id} pasará de «${u.preparacion}» a «${destino}».`, boton: "Guardar paso", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-prep" className="btn btn-primary !py-2">Guardar paso</button></>}>
      <form id="f-prep" onSubmit={guardar} className="grid gap-4" noValidate>
        <PasosPreparacion pasos={prep.PASOS} actual={u.preparacion} />
        <fieldset>
          <legend className="field-label">Nuevo paso</legend>
          <div className="space-y-2">
            {prep.PASOS.map((p, i) => {
              const motivo = p === u.preparacion ? "Es su paso actual." : prep.bloqueo(u, p);
              const bloqueado = Boolean(motivo);
              return (
                <label key={p} className={`flex gap-3 rounded-xl border-2 p-3 transition ${destino === p ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : bloqueado ? "cursor-not-allowed border-slate-100 opacity-60 dark:border-white/5" : "cursor-pointer border-slate-200 hover:border-slate-300 dark:border-white/10"}`} data-paso={p}>
                  <input type="radio" name="prep-paso" className="mt-1 accent-[#0e2c52]" disabled={bloqueado} checked={destino === p} onChange={() => { setDestino(p); setErr({}); }} />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-marino dark:text-white">{i + 1}. {p}</span>
                    <span className="block text-[12.5px] text-slate-500">{bloqueado ? motivo : PASO_PREPARACION[p]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
        {libera && <Aviso tipo="ok">Al guardar, {u.id} pasa a «Disponible» y todos los vendedores la verán en Disponibilidad.</Aviso>}
        {retira && <Aviso tipo="aviso">{u.id} está a la venta: al volver a este paso sale de Disponibilidad.</Aviso>}
        <Campo etiqueta={atras ? "Motivo (obligatorio al retroceder)" : "Observación (opcional)"} error={err.obs}>
          <textarea id="prep-obs" rows={2} maxLength={320} className="field-input" value={obs} onChange={(e) => { setObs(e.target.value); if (err.obs) setErr({}); }} placeholder={atras ? "Ej: se detectó un detalle en la pintura" : "Ej: revisión de frenos y luces completa"} />
        </Campo>
      </form>
    </Modal>
  );
}
