import { useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { SEDES_ATENCION } from "../../data/mockData";
import { Campo, Card, Modal, PageHeader, Stat, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import { Progreso } from "../../components/charts";

/** Metas mensuales por sede, comparadas con las ventas realmente registradas en EPSA. */
export default function Metas() {
  const { metas, ventas, agregar, actualizar, eliminar } = useApp();
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [modal, setModal] = useState(null);
  const [f, setF] = useState({ sede: SEDES_ATENCION[0], meta: "" });
  const [err, setErr] = useState("");

  const delMes = metas.filter((m) => m.mes === mes);
  const reg = (sede) => ventas.filter((v) => v.sede === sede && v.fecha.startsWith(mes) && v.etapa !== "Cotización").length;
  const totalMeta = delMes.reduce((s, m) => s + m.meta, 0);
  const totalReg = delMes.reduce((s, m) => s + reg(m.sede), 0);
  const puedeEditar = puede("metas.gestionar");

  function abrir(m) { setErr(""); setF(m ? { sede: m.sede, meta: String(m.meta) } : { sede: SEDES_ATENCION.find((s) => !delMes.some((x) => x.sede === s)) || SEDES_ATENCION[0], meta: "" }); setModal({ m }); }
  function guardar(e) {
    e.preventDefault();
    const n = Number(f.meta);
    if (!Number.isInteger(n) || n < 1 || n > 500) return setErr("La meta debe ser un número entero entre 1 y 500.");
    if (!modal.m && delMes.some((x) => x.sede === f.sede)) return setErr("Esa sede ya tiene meta en este mes. Edítala.");
    if (modal.m) actualizar("metas", modal.m.id, { meta: n }, `Meta de ${f.sede} (${mes}): ${n}`);
    else agregar("metas", { mes, sede: f.sede, meta: n, registradas: 0 }, `Meta registrada: ${f.sede} ${mes} = ${n}`);
    toast("Meta guardada"); setModal(null);
  }

  return (
    <div>
      <PageHeader titulo="Metas mensuales" subtitulo="Meta informada por sede frente a las ventas registradas en EPSA.">
        <input type="month" className="field-input !w-auto" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes" />
        {puedeEditar && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Registrar meta</button>}
      </PageHeader>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat etiqueta="Meta informada" valor={totalMeta} nota="unidades del mes" />
        <Stat etiqueta="Ventas registradas" valor={totalReg} nota="en EPSA" tono="verde" />
        <Stat etiqueta="Cumplimiento" valor={totalMeta ? `${Math.round((totalReg / totalMeta) * 100)}%` : "—"} nota={totalMeta ? "" : "Pendiente de validar"} tono={totalReg >= totalMeta && totalMeta ? "verde" : "ambar"} />
      </div>
      {delMes.length === 0 ? <div className="mt-6"><Vacio titulo="Sin metas este mes" texto="Registra la meta de cada sede para medir el cumplimiento." /></div> : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {delMes.map((m) => (
            <Card key={m.id}>
              <div className="flex items-center justify-between"><h3 className="text-[17px] font-bold text-marino dark:text-white">{m.sede}</h3><span className="text-[12.5px] text-slate-400">Meta {m.meta}</span></div>
              <div className="mt-4"><Progreso valor={reg(m.sede)} max={m.meta} /></div>
              {puedeEditar && <div className="mt-4 flex gap-2"><button className={btnMini} onClick={() => abrir(m)}>Editar meta</button>
                {puede("eliminar") && <button className={btnMiniPeligro} onClick={async () => { if (await confirmar({ titulo: "Eliminar meta", texto: `¿Eliminar la meta de ${m.sede}?`, boton: "Eliminar", peligro: true })) { eliminar("metas", m.id, `Meta eliminada: ${m.sede}`); toast("Meta eliminada"); } }}>Eliminar</button>}</div>}
            </Card>
          ))}
        </div>
      )}
      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.m ? "Editar meta" : "Registrar meta"} ancho="max-w-md" pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-meta" className="btn btn-primary !py-2">Guardar</button></>}>
        <form id="f-meta" onSubmit={guardar} className="grid gap-4">
          <Campo etiqueta="Sede"><select className="field-input" disabled={!!modal?.m} value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}>{SEDES_ATENCION.map((s) => <option key={s}>{s}</option>)}</select></Campo>
          <Campo etiqueta={`Meta de ventas (${mes})`} error={err}><input className="field-input" inputMode="numeric" value={f.meta} onChange={(e) => setF({ ...f, meta: e.target.value.replace(/\D/g, "") })} /></Campo>
        </form>
      </Modal>
    </div>
  );
}
