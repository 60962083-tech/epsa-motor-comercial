import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { UNIDADES } from "../../data/mockData";
import { IconAlert, IconCheck } from "../../components/Icons";
import HUBadge from "../../components/HUBadge";

/**
 * VincularUnidad.jsx — HU-002
 * "Completar la identificación de motos compradas"
 * -----------------------------------------------------------------
 * Toma una compra pendiente (una unidad sin motor/chasis todavía) y
 * le agrega el número de motor y de chasis que vienen en la factura.
 *
 * La regla de negocio más importante: NUNCA puede guardarse un
 * motor o un chasis que ya existe en otra unidad. Por eso esta
 * pantalla sí valida de verdad contra los datos de ejemplo
 * (UNIDADES en mockData.js), no es solo un dibujo: si escribes un
 * número que ya está en la lista, te lo va a rechazar ahora mismo.
 *
 * TODO (Michelle): cuando exista la tabla real, este mismo chequeo
 * lo hace también la base de datos con una restricción UNIQUE, para
 * que quede protegido aunque alguien se salte el frontend. Aquí
 * replicamos la validación solo para que la pantalla se sienta
 * completa mientras tanto.
 * -----------------------------------------------------------------
 */
export default function VincularUnidad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const unidad = UNIDADES.find((u) => u.id === id);

  const [motor, setMotor] = useState("");
  const [chasis, setChasis] = useState("");
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  if (!unidad) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-bold">Unidad no encontrada</h1>
        <Link to="/dashboard/unidades" className="btn btn-secondary mt-4">Volver a unidades</Link>
      </div>
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!motor.trim() || !chasis.trim()) {
      setError("El número de motor y el número de chasis son obligatorios.");
      return;
    }

    // ---------- Validación de duplicados (el corazón de HU-002) ----------
    const motorRepetido = UNIDADES.some((u) => u.id !== unidad.id && u.motor === motor.trim());
    const chasisRepetido = UNIDADES.some((u) => u.id !== unidad.id && u.chasis === chasis.trim());

    if (motorRepetido) {
      setError(`El número de motor ${motor} ya está registrado en otra unidad. Revisa la factura antes de continuar.`);
      return;
    }
    if (chasisRepetido) {
      setError(`El número de chasis ${chasis} ya está registrado en otra unidad. Revisa la factura antes de continuar.`);
      return;
    }

    // Si no hay conflicto, se "guarda" (en esta demo, solo se marca como éxito;
    // Michelle reemplaza esto por un UPDATE real en Supabase).
    setGuardado(true);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <HUBadge code="HU-002" titulo="Completar identificación de motos" />
      <h1 className="text-2xl font-bold text-marino dark:text-white">Completar identificación · {unidad.id}</h1>
      <p className="mt-1 text-slate-500">
        Completa el motor y el chasis que llegaron en la factura de Crosland. Esto NO confirma que la
        unidad llegó físicamente ni que está disponible para la venta, solo identifica cuál es.
      </p>

      {guardado ? (
        // ---------- Confirmación de éxito ----------
        <div className="mt-6 flex items-start gap-3 rounded-xl2 border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <IconCheck className="mt-0.5 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">Identificación completada</p>
            <p className="text-[13.5px] text-emerald-700/80 dark:text-emerald-300/70">
              Motor {motor} y chasis {chasis} quedaron asociados a {unidad.id}.
            </p>
            <Link to="/dashboard/unidades" className="btn btn-secondary mt-4">Volver a unidades</Link>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label">Número de motor</label>
            <input className="field-input" value={motor} onChange={(e) => setMotor(e.target.value)} placeholder="Ej. BJM-10512" />
          </div>
          <div>
            <label className="field-label">Número de chasis</label>
            <input className="field-input" value={chasis} onChange={(e) => setChasis(e.target.value)} placeholder="Ej. BJC-88450" />
          </div>

          {/* ---------- Aviso de duplicado ---------- */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[13.5px] text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
              <IconAlert className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button className="btn btn-primary" type="submit">Guardar identificación</button>
            <button type="button" onClick={() => navigate("/dashboard/unidades")} className="btn btn-secondary">
              Cancelar
            </button>
          </div>

          {/* Pista para quien haga la demo: estos valores ya existen y disparan el aviso */}
          <p className="text-[12px] text-slate-400">
            Para probar el aviso de duplicado, usa el motor <code>BJM-10234</code> o el chasis <code>BJC-88339</code>.
          </p>
        </form>
      )}
    </div>
  );
}
