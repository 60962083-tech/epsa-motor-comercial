import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { UNIDADES, TIPOS_TECHO, PROVEEDORES_TECHO } from "../../data/mockData";
import HUBadge from "../../components/HUBadge";

/**
 * Techo.jsx — HU-004 "Actualizar la configuración del techo"
 * -----------------------------------------------------------------
 * El campo "Proveedor" solo tiene sentido (y solo se muestra)
 * cuando el tipo de techo elegido es "Techo de fibra deportiva",
 * que es el que se fabrica fuera de EPSA Motor. Para los demás
 * tipos no hace falta proveedor, así que el campo se oculta solo.
 * -----------------------------------------------------------------
 */
export default function Techo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const unidad = UNIDADES.find((u) => u.id === id) || UNIDADES[0];

  const [tipo, setTipo] = useState(TIPOS_TECHO[2]);
  const [proveedor, setProveedor] = useState(PROVEEDORES_TECHO[0]);
  const [detalle, setDetalle] = useState("");
  const [guardado, setGuardado] = useState(false);

  const necesitaProveedor = tipo === "Techo de fibra deportiva";

  function onSubmit(e) {
    e.preventDefault();
    setGuardado(true);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <HUBadge code="HU-004" titulo="Actualizar la configuración del techo" />
      <div>
        <h1 className="text-2xl font-bold text-marino dark:text-white">Configuración de techo · {unidad.id}</h1>
        <p className="mt-1 text-slate-500">
          Describe la configuración de la unidad; no confirma que el trabajo esté terminado ni que la
          unidad regresó del proveedor (eso se sigue en el movimiento de ubicación).
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label">Tipo de techo</label>
            <select className="field-input" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_TECHO.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          {/* Este campo aparece/desaparece según el tipo elegido arriba */}
          {necesitaProveedor && (
            <div>
              <label className="field-label">Proveedor</label>
              <select className="field-input" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
                {PROVEEDORES_TECHO.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="field-label">Detalle opcional</label>
            <input className="field-input" value={detalle} onChange={(e) => setDetalle(e.target.value)}
                   placeholder="Cámara de retroceso, equipo de sonido u otros accesorios" />
          </div>

          {guardado && (
            <p className="text-[13.5px] font-medium text-emerald-600">Guardado (simulado): {tipo}{necesitaProveedor ? ` · ${proveedor}` : ""}.</p>
          )}

          <div className="flex gap-3 pt-1">
            <button className="btn btn-primary" type="submit">Guardar cambios</button>
            <button type="button" onClick={() => navigate("/dashboard/unidades")} className="btn btn-secondary">
              Volver a unidades
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl2 bg-marino-50 p-5 text-[14px] dark:bg-white/5">
          <h3 className="font-semibold text-marino dark:text-white">Regla de negocio</h3>
          <p className="mt-2 text-slate-600 dark:text-white/70">
            El tipo de techo describe la configuración. El seguimiento de si ya se preparó
            corresponde a otra pantalla (movimiento de ubicación), no a esta.
          </p>
        </div>
        <div className="rounded-xl2 border border-slate-200 p-5 text-[13.5px] text-slate-500 dark:border-white/10">
          Permisos: Gerente y administradora editan. El vendedor solo consulta.
        </div>
      </div>
    </div>
  );
}
