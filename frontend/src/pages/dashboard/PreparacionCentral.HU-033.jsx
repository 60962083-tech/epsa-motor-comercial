// HU-033 · Actualizar la preparación de las motos (base central, funciones de Michelle)
// Armado y avance del techo de cada moto, con fecha, autor y observación. La entrega no se marca a mano: una moto
// está «Lista para entrega» cuando cumple sus etapas según su techo. La configuración del techo es de HU-004,
// la ubicación de HU-003 y la situación comercial no cambia aquí. Vendedores solo consultan.
import { useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { inventarioApi, useConsultaCentral } from "../../servicios/central";
import { etapaOperativa } from "../../servicios/inventarioCentral";
import { Card, PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import { EstadoConexion, Pestanas, Pill } from "../../components/dashboard/Sprint2";
import { AvisoConexion, sinApi, BarraActualizacion, ColorUnidad, PillComercial, TextoUbicacion } from "../../components/dashboard/Central";
import { ModalAvancePreparacion, accionesPreparacion } from "../../components/dashboard/PreparacionUnidad";

const TEXTO_TECHO = { Pendiente: "Falta instalar", "En proceso": "En proceso", Instalado: "Instalado", "No requiere": "No requiere" };
const normal = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const VISTAS = {
  armado: (po) => po.armado !== "Terminado",
  techo: (po) => po.armado === "Terminado" && !po.preparacionCompleta,
  listas: (po) => po.preparacionCompleta,
  todas: () => true,
};

export default function PreparacionCentral() {
  const { puede } = useAuth();
  const gestiona = puede("unidades.gestionar");
  const [vista, setVista] = useState("armado");
  const [conVendidas, setConVendidas] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const consulta = useConsultaCentral(() => inventarioApi(), [], { clave: "inventario::" });
  const todas = useMemo(() => (consulta.data?.unidades || []).filter((u) => u.preparacion?.operativa && (conVendidas || u.comercial !== "Vendida")), [consulta.data, conVendidas]);
  const sinDatos = consulta.data && (consulta.data.unidades || []).length > 0 && !(consulta.data.unidades || []).some((u) => u.preparacion?.operativa);
  const lista = todas.filter((u) => VISTAS[vista](u.preparacion.operativa)).filter((u) => !q.trim() || normal(`${u.nummotuni} ${u.chauni} ${u.nommod} ${u.coduni} ${u.coluni} ${u.ubicacion?.nomubi || ""}`).includes(normal(q.trim())));
  const n = (k) => todas.filter((u) => VISTAS[k](u.preparacion.operativa)).length;
  const sinTecho = todas.filter((u) => !u.preparacion.operativa.techo?.configuracion).length;

  if (sinApi(consulta)) return (
    <div>
      <PageHeader titulo="Preparación de motos" subtitulo="Las motos llegan parcialmente armadas y sin techo. Aquí se registra el armado y el avance del techo." />
      <AvisoConexion consulta={consulta} que="la preparación" />
    </div>
  );

  return (
    <div data-hu033>
      <PageHeader titulo="Preparación de motos" subtitulo="Las motos llegan parcialmente armadas y sin techo. Registra el armado y el avance del techo; la moto queda lista para entrega cuando cumple todas sus etapas.">
        <EstadoConexion hu="HU-033" consulta={consulta} />
        <BarraActualizacion consulta={consulta} />
      </PageHeader>
      <AvisoConexion consulta={consulta} que="la preparación" />
      {sinDatos && <Vacio titulo="La preparación todavía no está habilitada" texto="Falta ejecutar en Supabase el SQL de mejoras finales (docs/supabase-sprint2-final.sql)." />}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Pendientes de armado" valor={n("armado")} tono="ambar" nota="Se terminan en Ventanilla" />
        <Stat etiqueta="Techo pendiente" valor={n("techo")} nota="Armadas, falta su techo" />
        <Stat etiqueta="Sin techo definido" valor={sinTecho} tono={sinTecho ? "ambar" : "marino"} nota="Definir en la ficha de la moto" />
        <Stat etiqueta="Listas para entrega" valor={n("listas")} tono="verde" nota="No significa entregadas" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Pestanas etiqueta="Etapa" valor={vista} onCambio={setVista} opciones={[
          { id: "armado", label: "Armado", n: n("armado"), alerta: true },
          { id: "techo", label: "Techo", n: n("techo") },
          { id: "listas", label: "Listas para entrega", n: n("listas") },
          { id: "todas", label: "Todas", n: todas.length },
        ]} />
        <div className="flex flex-wrap items-center gap-3">
          <input className="field-input !w-60 !py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Modelo, motor, chasis o ubicación" aria-label="Buscar moto" data-buscar-prep />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={conVendidas} onChange={(e) => setConVendidas(e.target.checked)} />Incluir vendidas</label>
        </div>
      </div>

      {consulta.data && !sinDatos && (lista.length === 0 ? <Vacio titulo="No hay motos en esta etapa" texto={q ? "Ninguna coincide con la búsqueda." : "Cambia de pestaña para ver las demás etapas."} /> : (
        <Tabla columnas={["Moto", "Modelo", "Ubicación", "Armado", "Techo", "Preparación", "Situación", "Acciones"]}>
          {lista.map((u) => {
            const po = u.preparacion.operativa; const t = po.techo || {}; const e = etapaOperativa(po);
            return (
              <tr key={u.coduni} className="align-top" data-prep={u.coduni}>
                <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${u.coduni}`}>{u.nummotuni || `N° ${u.coduni}`}</Link>{u.chauni && <span className="block text-[12px] text-slate-400">chasis {u.chauni}</span>}</td>
                <td className="px-4 py-3">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} /></span></td>
                <td className="px-4 py-3"><TextoUbicacion unidad={u} /></td>
                <td className="px-4 py-3">{po.armado === "Terminado" ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">Terminado</span> : <span className="font-semibold text-amber-700 dark:text-amber-300">Pendiente</span>}</td>
                <td className="px-4 py-3">{t.configuracion ? <><span className="block">{t.configuracion}{po.proveedorTecho ? <span className="text-slate-400">, {po.proveedorTecho}</span> : null}</span><span className={`mt-0.5 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.estado === "Instalado" || t.estado === "No requiere" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{TEXTO_TECHO[t.estado] || t.estado}</span></> : <span className="text-slate-400">Por definir</span>}</td>
                <td className="px-4 py-3"><Pill tono={e.tono}>{e.etapa}</Pill>{!po.preparacionCompleta && e.nota && <span className="mt-1 block max-w-[220px] text-[12px] text-slate-500">{e.nota}</span>}</td>
                <td className="px-4 py-3"><PillComercial comercial={u.comercial} /></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  {gestiona && accionesPreparacion(po).map((a) => <button key={`${a.etapa}-${a.estado}`} className={btnMini} onClick={() => setModal({ unidad: u, po, etapa: a.etapa, estado: a.estado })} data-accion-prep={`${a.etapa}:${a.estado}`}>{a.texto}</button>)}
                  {!t.configuracion && <Link className={btnMini} to={`/admin/inventario/${u.coduni}`}>Definir techo</Link>}
                  <Link className={btnMini} to={`/admin/inventario/${u.coduni}`}>Ficha</Link>
                </div></td>
              </tr>
            );
          })}
        </Tabla>
      ))}
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Tu rol consulta la preparación; la registran gerencia y administración.</p>}
      <Card className="mt-5 text-[12.5px] text-slate-500">Las motos que llegan con la factura empiezan con el armado y el techo pendientes. Volver a importar una factura no reinicia los avances. El aviso de FIVESA, JAVICAR o FIBRAT se registra en «Techo instalado» y no mueve la moto: el traslado va en Movimientos.</Card>

      <ModalAvancePreparacion datos={modal} onClose={() => setModal(null)} onHecho={() => consulta.refrescar(true)} />
    </div>
  );
}
