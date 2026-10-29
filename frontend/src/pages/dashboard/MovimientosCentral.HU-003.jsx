// HU-003 · Registrar movimientos de ubicación (base central)
// Gerente (responsable habitual) y administradora (respaldo) registran la salida de una moto y confirman su llegada.
// El tránsito se distingue de la llegada: la ubicación cambia recién al confirmar la recepción. Un aviso del taller
// por WhatsApp no mueve la moto. La importación de facturas (HU-030) deja las motos en Ancón y no cuenta como traslado.
import { useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { historialMovimientosApi, inventarioApi, momentoMov, useConsultaCentral } from "../../servicios/central";
import { Card, PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import { EstadoConexion, Pestanas, Pill } from "../../components/dashboard/Sprint2";
import { AbrirPorNumero, AvisoConexion, nombreUnidad, sinApi, BarraActualizacion, ColorUnidad, Paginador, PillComercial, PillPreparacion, fechaCompleta } from "../../components/dashboard/Central";
import { ModalLlegadaCentral, ModalTrasladoCentral, ModalUbicacionInicial } from "../../components/dashboard/ModalesCentral";
import { ESTADO_MOV, MotivoMov, RutaMov, TONO_MOV, cuandoMov } from "../../components/dashboard/MovimientosUnidad";
import { MOTIVOS_TRASLADO, leerMotivo } from "../../lib/motivos";
import { haceCuanto } from "../../lib/validar";

const LIMITE = 50;

export default function MovimientosCentral() {
  const { puede } = useAuth();
  const gestiona = puede("unidades.trasladar");
  const [vista, setVista] = useState("curso");
  const [offset, setOffset] = useState(0);
  const [filtroHist, setFiltroHist] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState("");
  const [modal, setModal] = useState(null);
  const inventario = useConsultaCentral(() => inventarioApi(), [], { clave: "inventario::" });
  const enCurso = useConsultaCentral(() => historialMovimientosApi({ estado: "En transito", limite: 200 }), [], { clave: "movimientos:curso" });
  const historial = useConsultaCentral(() => historialMovimientosApi({ estado: filtroHist || undefined, limite: LIMITE, offset }), [filtroHist, offset], { activo: vista === "historial" });
  const unidades = useMemo(() => inventario.data?.unidades || [], [inventario.data]);
  const ubicaciones = inventario.data?.ubicaciones || [];
  const activos = (enCurso.data?.movimientos || []).filter((m) => m.estado === "En transito");
  const enAlmacen = unidades.filter((u) => u.ubicacion?.tipubi === "Almacen" && !u.movimiento_activo);
  const sinUbicacion = unidades.filter((u) => !u.ubicacion);
  const recargar = () => { inventario.refrescar(true); enCurso.refrescar(true); historial.refrescar(true); };
  // La moto completa para las ventanas (si el inventario ya cargó)
  const unidadDe = (m) => unidades.find((u) => String(u.coduni) === String(m.coduni)) || { ...m.unidad, coduni: m.coduni };

  // Si el servidor todavía no tiene esta consulta, se muestra solo el aviso (sin cifras en cero ni filtros vacíos)
  if (sinApi(enCurso)) return (
    <div>
      <PageHeader titulo="Movimientos de motos" subtitulo="Traslados entre almacenes, talleres de techo y sedes. Cada movimiento guarda origen, destino, quién lo registró, fecha y hora, y quién confirmó la llegada." />
      <AvisoConexion consulta={enCurso} que="los movimientos" />
      <div className="mt-5"><AbrirPorNumero texto="Mientras tanto, cada moto registra y muestra sus movimientos en su ficha. Ábrela desde su compra." /></div>
    </div>
  );

  return (
    <div>
      <PageHeader titulo="Movimientos de motos" subtitulo="Traslados entre almacenes, talleres de techo y sedes. Cada movimiento guarda origen, destino, quién lo registró, fecha y hora, y quién confirmó la llegada.">
        <EstadoConexion hu="HU-003" consulta={enCurso} />
        <BarraActualizacion consulta={enCurso} />
        {gestiona && <button id="btn-nuevo-traslado" className="btn btn-primary !py-2.5" onClick={() => setModal({ tipo: "traslado" })} disabled={!inventario.data}>Registrar traslado</button>}
      </PageHeader>
      <AvisoConexion consulta={enCurso} que="los movimientos" />
      {!enCurso.fallo && <AvisoConexion consulta={inventario} que="el inventario" />}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="En tránsito" valor={activos.length} tono={activos.length ? "ambar" : "marino"} nota="Salieron y aún no se confirma la llegada" />
        <Stat etiqueta="En almacén" valor={enAlmacen.length} nota="En Ancón u otro almacén" />
        <Stat etiqueta="En sedes" valor={unidades.filter((u) => u.ubicacion?.tipubi === "Sede" && !u.movimiento_activo).length} tono="verde" nota="Listas para mostrarse en tienda" />
        <Stat etiqueta="Sin ubicación" valor={sinUbicacion.length} tono={sinUbicacion.length ? "rojo" : "marino"} nota="Identificadas a mano, sin ubicación" />
      </div>

      <div className="mb-4">
        <Pestanas etiqueta="Movimientos" valor={vista} onCambio={(v) => { setVista(v); setOffset(0); }} opciones={[
          { id: "curso", label: "En tránsito", n: activos.length },
          { id: "almacen", label: "En almacén", n: enAlmacen.length },
          { id: "sin", label: "Sin ubicación", n: sinUbicacion.length, alerta: true },
          { id: "historial", label: "Historial" },
        ]} />
      </div>

      {/* En tránsito: salieron y falta confirmar la llegada */}
      {vista === "curso" && enCurso.data && (activos.length === 0 ? <Vacio titulo="Ninguna moto en tránsito" texto="Cuando registres la salida de una moto, aparecerá aquí hasta que confirmes su llegada." /> : (
        <div className="space-y-3" data-lista="en-curso">
          {activos.map((m) => {
            const salida = momentoMov(m.fechaSalida, m.horaSalida);
            const horas = (Date.now() - new Date(salida).getTime()) / 3600000;
            return (
              <Card key={m.codmub} className="flex flex-wrap items-center justify-between gap-4" data-movimiento={m.codmub} data-estado={m.estado}>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold text-marino dark:text-white"><Link className="hover:underline" to={`/admin/inventario/${m.coduni}`}>{m.unidad?.nommod} · {m.unidad?.nummotuni ? `motor ${m.unidad.nummotuni}` : `N° ${m.coduni}`}</Link><span className="text-[12.5px] font-medium text-slate-400"><ColorUnidad color={m.unidad?.coluni} /></span><Pill tono={TONO_MOV[m.estado]}>{ESTADO_MOV[m.estado]}</Pill></p>
                  <div className="mt-1.5"><RutaMov m={m} /></div>
                  <p className="mt-1.5 text-[12.5px] text-slate-500">Salió el {cuandoMov(m.fechaSalida, m.horaSalida)} ({haceCuanto(salida)}). Registró {m.autorSalida?.nombre || "—"}.</p>
                  <MotivoMov observacion={m.observacion} className="mt-1" />
                  {horas > 24 && <p className="mt-1 text-[12.5px] font-semibold text-amber-700 dark:text-amber-300">Lleva más de un día en tránsito. Confirma su llegada cuando la reciban.</p>}
                </div>
                {gestiona && <button className="btn btn-primary !px-4 !py-2 text-[13.5px]" onClick={() => setModal({ tipo: "llegada", m })}>Confirmar llegada</button>}
              </Card>
            );
          })}
        </div>
      ))}

      {/* En almacén: las motos que llegan con la factura empiezan en Ancón */}
      {vista === "almacen" && inventario.data && (enAlmacen.length === 0 ? <Vacio titulo="No hay motos en almacén" texto="Las motos importadas desde una factura empiezan en el almacén de Crossland (Ancón) hasta que registres su traslado." /> : (
        <Tabla columnas={["Moto", "Modelo", "Almacén", "Preparación", "Situación comercial", "Acción"]}>
          {enAlmacen.map((u) => (
            <tr key={u.coduni} data-en-almacen={u.coduni}>
              <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${u.coduni}`}>{nombreUnidad(u)}</Link>{u.chauni && <span className="block text-[12px] text-slate-400">chasis {u.chauni}</span>}</td>
              <td className="px-4 py-3">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} /></span></td>
              <td className="px-4 py-3">{u.ubicacion.nomubi}<span className="block text-[12px] text-slate-400">{u.origen}{u.ingreso ? `, ${fechaCompleta(u.ingreso)}` : ""}</span></td>
              <td className="px-4 py-3"><PillPreparacion preparacion={u.preparacion} /></td>
              <td className="px-4 py-3"><PillComercial comercial={u.comercial} /></td>
              <td className="px-4 py-3">{gestiona ? <button className={btnMini} onClick={() => setModal({ tipo: "traslado", u })}>Trasladar</button> : <span className="text-[12.5px] text-slate-400">Solo gestión</span>}</td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Sin ubicación: identificadas a mano en HU-002 */}
      {vista === "sin" && inventario.data && (sinUbicacion.length === 0 ? <Vacio titulo="Todas las motos tienen ubicación" texto="Las que se identifican a mano en Compras aparecen aquí hasta registrar dónde están." /> : (
        <Tabla columnas={["Moto", "Modelo", "Compra", "Identificada", "Acción"]}>
          {sinUbicacion.map((u) => (
            <tr key={u.coduni} data-sin-ubicacion={u.coduni}>
              <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${u.coduni}`}>{nombreUnidad(u)}</Link>{u.chauni && <span className="block text-[12px] text-slate-400">chasis {u.chauni}</span>}</td>
              <td className="px-4 py-3">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} /></span></td>
              <td className="px-4 py-3 text-slate-500">{u.origen}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCompleta(u.ingreso)}</td>
              <td className="px-4 py-3">{gestiona ? <button className={btnMini} onClick={() => setModal({ tipo: "inicial", u })}>Registrar ubicación inicial</button> : <span className="text-[12.5px] text-slate-400">Solo gestión</span>}</td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* Historial central */}
      {vista === "historial" && <>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="text-[13px] font-semibold" htmlFor="hist-estado">Estado</label>
          <select id="hist-estado" className="field-input !w-auto !py-2" value={filtroHist} onChange={(e) => { setFiltroHist(e.target.value); setOffset(0); }}>
            <option value="">Todos</option><option value="En transito">En tránsito</option><option value="Finalizado">Recibidas</option>
          </select>
          <label className="text-[13px] font-semibold" htmlFor="hist-motivo">Motivo</label>
          <select id="hist-motivo" className="field-input !w-auto !py-2" value={filtroMotivo} onChange={(e) => setFiltroMotivo(e.target.value)}>
            <option value="">Todos</option>
            {MOTIVOS_TRASLADO.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
            <option value="__sin">Sin motivo (anteriores)</option>
          </select>
          {historial.data && <span className="text-[13px] text-slate-500">{historial.data.total} movimiento{Number(historial.data.total) === 1 ? "" : "s"}</span>}
        </div>
        <AvisoConexion consulta={historial} que="el historial" />
        {historial.data && historial.data.movimientos.length === 0 ? <Vacio titulo="Sin movimientos registrados" /> : historial.data && (
          <>
            <Tabla columnas={["Salida", "Moto", "Ruta", "Estado", "Registró", "Llegada", "Motivo"]}>
              {historial.data.movimientos.filter((m) => { const mo = leerMotivo(m.observacion).motivo; return !filtroMotivo || (filtroMotivo === "__sin" ? !mo : mo === filtroMotivo); }).map((m) => (
                <tr key={m.codmub} className="align-top" data-historial={m.codmub}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{cuandoMov(m.fechaSalida, m.horaSalida)}</td>
                  <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${m.coduni}`}>{m.unidad?.nummotuni || `N° ${m.coduni}`}</Link><span className="block text-[12px] text-slate-400">{m.unidad?.nommod}</span></td>
                  <td className="px-4 py-3"><RutaMov m={m} /></td>
                  <td className="px-4 py-3"><Pill tono={TONO_MOV[m.estado] || "gris"}>{ESTADO_MOV[m.estado] || m.estado}</Pill></td>
                  <td className="px-4 py-3 text-slate-500">{m.autorSalida?.nombre || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{m.fechaRecepcion ? <>{cuandoMov(m.fechaRecepcion, m.horaRecepcion)}<span className="block text-[12px]">{m.autorRecepcion?.nombre}</span></> : "—"}</td>
                  <td className="max-w-[280px] px-4 py-3">{m.observacion ? <MotivoMov observacion={m.observacion} /> : <span className="text-slate-400">—</span>}</td>
                </tr>
              ))}
            </Tabla>
            <Paginador total={Number(historial.data.total)} limite={LIMITE} offset={offset} onCambio={setOffset} />
          </>
        )}
      </>}
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Tu rol consulta los movimientos; los registran gerencia y administración.</p>}

      <ModalTrasladoCentral abierto={modal?.tipo === "traslado"} unidad={modal?.u} unidades={unidades} ubicaciones={ubicaciones} onClose={() => setModal(null)} onHecho={recargar} onConflicto={recargar} />
      <ModalLlegadaCentral datos={modal?.tipo === "llegada" ? { unidad: unidadDe(modal.m), movimiento: modal.m } : null} onClose={() => setModal(null)} onHecho={recargar} onConflicto={recargar} />
      <ModalUbicacionInicial unidad={modal?.tipo === "inicial" ? modal.u : null} ubicaciones={ubicaciones} onClose={() => setModal(null)} onHecho={recargar} onConflicto={recargar} />
    </div>
  );
}
