import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCatalog } from "../../store/catalogStore.jsx";
import { IconCheck } from "../../components/Icons";
import HUBadge from "../../components/HUBadge";

/**
 * RegistrarCompra.jsx — HU-034 "Registrar una compra pendiente de factura"
 * No pide número de motor ni chasis todavía: esos datos llegan recién
 * con la factura y se completan después en HU-002 (VincularUnidad).
 */
export default function RegistrarCompra() {
  const navigate = useNavigate();
  const { modelos: MODELOS } = useCatalog();
  const [form, setForm] = useState({ modelo: MODELOS[0]?.id ?? "", color: "", cantidad: 1 });
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!form.color.trim() || Number(form.cantidad) < 1) {
      setError("Completa el color y una cantidad válida (mínimo 1).");
      return;
    }
    setError("");
    // TODO (Michelle): INSERT real en la tabla de compras pendientes,
    // con fecha y autor automáticos y estado inicial fijo en
    // "Pendiente de factura".
    setGuardado(true);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <HUBadge code="HU-034" titulo="Registrar compra pendiente de factura" />
      <h1 className="text-2xl font-bold text-marino dark:text-white">Registrar compra pendiente de factura</h1>
      <p className="mt-1 text-slate-500">
        Permite registrar la compra a Crosland antes de recibir la factura, para no perder la información.
      </p>

      {guardado ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl2 border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <IconCheck className="mt-0.5 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Compra registrada</p>
            <p className="text-[13.5px] text-emerald-700/80 dark:text-emerald-300/70">
              Queda como "Pendiente de factura". Cuando llegue la factura, se completa en "Identificar unidad" (HU-002).
            </p>
            <button onClick={() => navigate("/dashboard/unidades")} className="btn btn-secondary mt-4">
              Volver a unidades
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label">Modelo</label>
            <select className="field-input" value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)}>
              {MODELOS.filter((m) => m.estado === "Publicado").map((m) => (
                <option key={m.id} value={m.id}>{m.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Color</label>
            <input className="field-input" value={form.color} onChange={(e) => actualizar("color", e.target.value)} placeholder="Ej. Rojo" />
          </div>
          <div>
            <label className="field-label">Cantidad</label>
            <input className="field-input" type="number" min={1} value={form.cantidad} onChange={(e) => actualizar("cantidad", e.target.value)} />
          </div>

          <div>
            <label className="field-label">Estado</label>
            <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-[12.5px] font-semibold text-slate-600 dark:bg-white/10 dark:text-white/70">
              Pendiente de factura
            </span>
            <span className="ml-2 text-[12px] text-slate-400">(fijo al crear el registro)</span>
          </div>

          {error && <p className="text-[13.5px] text-acento">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button className="btn btn-primary" type="submit">Registrar compra</button>
            <button type="button" onClick={() => navigate("/dashboard/unidades")} className="btn btn-secondary">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
