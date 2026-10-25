// HU-004 · Inventario de unidades (base central) · HU-001 lectura compartida, HU-003 movimientos
// Lista operativa de todas las unidades identificadas: ubicación, preparación, techo y situación comercial.
// No hay copias por navegador: lo que se ve aquí es lo mismo que ven las demás cuentas.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { inventarioApi, useConsultaCentral } from "../../servicios/central";
import { ETAPAS_FILTRO, FILTRO_INICIAL, GRUPOS_LUGAR_API, filtrarUnidades } from "../../servicios/inventarioCentral";
import { Card, PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import { EstadoConexion } from "../../components/dashboard/Sprint2";
import { AbrirPorNumero, AvisoConexion, sinApi, BarraActualizacion, ColorUnidad, PillComercial, PillPreparacion, TextoTecho, TextoUbicacion } from "../../components/dashboard/Central";
import { ModalTrasladoCentral, ModalUbicacionInicial } from "../../components/dashboard/ModalesCentral";

const POR_PAGINA = 20;

export default function InventarioCentral() {
  const { puede } = useAuth();
  const gestiona = puede("unidades.gestionar");
  const { state } = useLocation();
  const [servidor, setServidor] = useState({ codubi: state?.codubi || "", codmod: "" });
  const [f, setF] = useState({ ...FILTRO_INICIAL, comercial: "" });
  const [sinUbicacion, setSinUbicacion] = useState(false);
  const [pag, setPag] = useState(1);
  const [modal, setModal] = useState(null);
  const consulta = useConsultaCentral(() => inventarioApi(servidor), [servidor.codubi, servidor.codmod]);
  const datos = consulta.data;
  const unidades = datos?.unidades || [];
  const ubicaciones = datos?.ubicaciones || [];
  const modelos = datos?.modelos || [];
  const lista = useMemo(() => filtrarUnidades(unidades, f).filter((u) => !sinUbicacion || !u.ubicacion), [unidades, f, sinUbicacion]);
  useEffect(() => { setPag(1); }, [servidor.codubi, servidor.codmod, f, sinUbicacion]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const cambiar = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const limpiar = () => { setServidor({ codubi: "", codmod: "" }); setF({ ...FILTRO_INICIAL, comercial: "" }); setSinUbicacion(false); };
  const cuenta = (fn) => unidades.filter(fn).length;
  const recargar = () => consulta.refrescar(true);

  // Libres por modelo y ubicación (sin contar las que van en camino)
  const columnas = ubicaciones.filter((l) => l.tipubi !== "Proveedor" && unidades.some((u) => u.ubicacion?.codubi === l.codubi));
  const libre = (u) => u.comercial === "Libre" && u.movimiento_activo?.estado !== "En transito";

  // Si el servidor todavía no tiene esta consulta, se muestra solo el aviso (sin cifras en cero ni filtros vacíos)
  if (sinApi(consulta)) return (
    <div>
      <PageHeader titulo="Inventario" subtitulo="Todas las motos identificadas, con su ubicación, preparación, techo y situación comercial." />
      <AvisoConexion consulta={consulta} que="el inventario central" />
      <div className="mt-5"><AbrirPorNumero texto="Mientras tanto, abre una compra para ver sus motos, o una moto por su número, para consultar su ubicación, sus movimientos y su techo." /></div>
    </div>
  );

  return (
    <div>
      <PageHeader titulo="Inventario" subtitulo="Todas las motos identificadas, con su ubicación, preparación, techo y situación comercial.">
        <EstadoConexion hu="HU-001" consulta={consulta} />
        <BarraActualizacion consulta={consulta} />
        {puede("compras.registrar") && <Link className="btn btn-primary !py-2.5" to="/admin/compras">Compras e identificación</Link>}
      </PageHeader>
      <AvisoConexion consulta={consulta} que="el inventario central" />

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat etiqueta="Unidades" valor={unidades.length} nota={servidor.codubi || servidor.codmod ? "Con el filtro de ubicación o modelo" : "Identificadas en total"} />
        <Stat etiqueta="Libres" valor={cuenta((u) => u.comercial === "Libre")} tono="verde" nota="Sin separación ni venta" />
        <Stat etiqueta="Listas para entrega" valor={cuenta((u) => u.preparacion?.lista_para_entrega)} tono="verde" />
        <Stat etiqueta="En tránsito" valor={cuenta((u) => u.movimiento_activo)} tono="ambar" nota="Salieron y falta confirmar la llegada" />
        <Stat etiqueta="Sin ubicación" valor={cuenta((u) => !u.ubicacion)} tono="rojo" nota="Falta registrar dónde están" />
      </div>

      {columnas.length > 0 && modelos.length > 0 && (
        <Card className="mb-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-bold text-marino dark:text-white">Libres por modelo y ubicación</h2>
            <Link to="/admin/disponibilidad" className="text-[13px] font-semibold text-marino-700 hover:underline dark:text-white">Ver disponibilidad compartida</Link>
          </div>
          <p className="mb-3 text-[12.5px] text-slate-400">Unidades sin separación ni venta, en sedes y almacenes. Toca una celda para filtrar.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead><tr className="text-left text-slate-400"><th className="py-2 pr-3 font-semibold">Modelo</th>{columnas.map((l) => <th key={l.codubi} className="px-2 py-2 text-center font-semibold">{l.nomubi}</th>)}<th className="px-2 py-2 text-center font-semibold">Total</th></tr></thead>
              <tbody>
                {modelos.filter((m) => unidades.some((u) => u.codmod === m.codmod)).map((m) => (
                  <tr key={m.codmod} className="border-t border-slate-100 dark:border-white/10">
                    <td className="py-2 pr-3 font-semibold text-marino dark:text-white">{m.nommod}</td>
                    {columnas.map((l) => {
                      const n = unidades.filter((u) => u.codmod === m.codmod && u.ubicacion?.codubi === l.codubi && libre(u)).length;
                      return <td key={l.codubi} className="px-2 py-2 text-center"><button onClick={() => { setServidor({ codubi: l.codubi, codmod: m.codmod }); setF({ ...FILTRO_INICIAL, comercial: "Libre" }); }} className={`min-w-[2rem] rounded-md px-2 py-0.5 font-bold ${n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "text-slate-300"}`}>{n}</button></td>;
                    })}
                    <td className="px-2 py-2 text-center font-bold text-marino dark:text-white">{unidades.filter((u) => u.codmod === m.codmod && libre(u)).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Filtros */}
      <Card className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2"><label className="field-label" htmlFor="inv-buscar">Buscar</label><input id="inv-buscar" className="field-input" value={f.q} maxLength={40} onChange={(e) => cambiar("q", e.target.value)} placeholder="Motor, chasis, modelo o N°" /></div>
        <div><label className="field-label" htmlFor="inv-lugar">Ubicación</label>
          <select id="inv-lugar" className="field-input" value={servidor.codubi} onChange={(e) => setServidor((s) => ({ ...s, codubi: e.target.value }))}>
            <option value="">Todas</option>
            {GRUPOS_LUGAR_API.map((g) => { const ls = ubicaciones.filter((l) => l.tipubi === g.tipo); return ls.length ? <optgroup key={g.tipo} label={g.titulo}>{ls.map((l) => <option key={l.codubi} value={l.codubi}>{l.nomubi}</option>)}</optgroup> : null; })}
          </select></div>
        <div><label className="field-label" htmlFor="inv-modelo">Modelo</label><select id="inv-modelo" className="field-input" value={servidor.codmod} onChange={(e) => setServidor((s) => ({ ...s, codmod: e.target.value }))}><option value="">Todos</option>{modelos.map((m) => <option key={m.codmod} value={m.codmod}>{m.nommod}</option>)}</select></div>
        <div><label className="field-label" htmlFor="inv-prep">Preparación</label><select id="inv-prep" className="field-input" value={f.prep} onChange={(e) => cambiar("prep", e.target.value)}><option value="">Todas</option>{ETAPAS_FILTRO.map((e) => <option key={e}>{e}</option>)}</select></div>
        <div><label className="field-label" htmlFor="inv-comercial">Situación comercial</label><select id="inv-comercial" className="field-input" value={f.comercial} onChange={(e) => cambiar("comercial", e.target.value)}><option value="">Todas</option><option value="Libre">Libres</option><option value="Separada">Separadas</option><option value="Vendida">Vendidas</option></select></div>
        <label className="flex items-center gap-2 text-[13.5px] font-medium sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={sinUbicacion} onChange={(e) => setSinUbicacion(e.target.checked)} />Solo las que no tienen ubicación registrada</label>
        <div className="flex items-end lg:col-span-4 lg:justify-end"><button className="pb-2 text-[13px] font-semibold text-acento hover:underline" onClick={limpiar}>Limpiar filtros</button></div>
      </Card>

      {datos && lista.length === 0 ? <Vacio titulo="Sin unidades con esos filtros" texto={unidades.length ? "Cambia o limpia los filtros." : "Aún no hay unidades identificadas. Aparecen al identificar una compra o al importar una factura."} /> : (
        <>
          <Tabla columnas={["Unidad", "Modelo", "Ubicación", "Preparación", "Techo", "Situación comercial", "Acciones"]}>
            {visibles.map((u) => (
              <tr key={u.coduni} className="align-top" data-unidad={u.coduni}>
                <td className="px-4 py-3"><Link to={`/admin/inventario/${u.coduni}`} className="font-semibold text-marino hover:underline dark:text-white">{u.nummotuni}</Link><p className="text-[11.5px] text-slate-400">chasis {u.chauni}, N° {u.coduni}</p></td>
                <td className="px-4 py-3">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} /></span></td>
                <td className="px-4 py-3"><TextoUbicacion unidad={u} /></td>
                <td className="px-4 py-3"><PillPreparacion preparacion={u.preparacion} /></td>
                <td className="px-4 py-3"><TextoTecho preparacion={u.preparacion} /></td>
                <td className="px-4 py-3"><PillComercial comercial={u.comercial} /><span className="mt-1 block text-[11.5px] text-slate-400">{u.origen}</span></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  <Link className={btnMini} to={`/admin/inventario/${u.coduni}`}>Ficha</Link>
                  {gestiona && !u.ubicacion && <button className={btnMini} onClick={() => setModal({ tipo: "inicial", u })}>Ubicación inicial</button>}
                  {gestiona && u.ubicacion && !u.movimiento_activo && <button className={btnMini} onClick={() => setModal({ tipo: "traslado", u })}>Trasladar</button>}
                </div></td>
              </tr>
            ))}
          </Tabla>
          {lista.length > POR_PAGINA && (
            <div className="mt-4 flex items-center justify-between text-[13px] text-slate-500">
              <span>{lista.length} unidades, página {pag} de {paginas}</span>
              <div className="flex gap-2"><button disabled={pag === 1} className={btnMini} onClick={() => setPag(pag - 1)}>Anterior</button><button disabled={pag === paginas} className={btnMini} onClick={() => setPag(pag + 1)}>Siguiente</button></div>
            </div>
          )}
        </>
      )}
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Tu rol consulta el inventario. Los movimientos y la preparación los registran gerencia y administración.</p>}

      <ModalTrasladoCentral abierto={modal?.tipo === "traslado"} unidad={modal?.u} ubicaciones={ubicaciones} onClose={() => setModal(null)} onHecho={recargar} onConflicto={recargar} />
      <ModalUbicacionInicial unidad={modal?.tipo === "inicial" ? modal.u : null} ubicaciones={ubicaciones} onClose={() => setModal(null)} onHecho={recargar} onConflicto={recargar} />
    </div>
  );
}
