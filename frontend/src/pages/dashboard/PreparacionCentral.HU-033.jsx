// HU-033 · Actualizar la preparación de una unidad (base central)
// Armado, avance del techo y condición de entrega, cada uno con fecha, autor y observación.
// La configuración del techo es de HU-004; la ubicación es de HU-003; la venta no cambia aquí.
import { useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { inventarioApi, useConsultaCentral } from "../../servicios/central";
import { techoDe } from "../../servicios/inventarioCentral";
import { PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import { EstadoConexion, Pestanas } from "../../components/dashboard/Sprint2";
import { AvisoConexion, sinApi, BarraActualizacion, ColorUnidad, PillComercial, PillPreparacion, TextoTecho, TextoUbicacion } from "../../components/dashboard/Central";
import { ModalPreparacionCentral } from "../../components/dashboard/ModalesCentral";

const VISTAS = {
  armado: (u) => u.preparacion?.armado !== "Armado terminado",
  techo: (u) => ["Por definir", "Pendiente", "En proceso"].includes(techoDe(u.preparacion).avance),
  confirmar: (u) => u.preparacion?.condiciones_cumplidas && !u.preparacion?.lista_para_entrega,
  listas: (u) => u.preparacion?.lista_para_entrega,
  todas: () => true,
};

export default function PreparacionCentral() {
  const { puede } = useAuth();
  const gestiona = puede("unidades.gestionar");
  const [vista, setVista] = useState("armado");
  const [conVendidas, setConVendidas] = useState(false);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const consulta = useConsultaCentral(() => inventarioApi(), []);
  const todas = useMemo(() => (consulta.data?.unidades || []).filter((u) => conVendidas || u.comercial !== "Vendida"), [consulta.data, conVendidas]);
  const lista = todas.filter(VISTAS[vista]).filter((u) => !q.trim() || `${u.nummotuni} ${u.chauni} ${u.nommod} ${u.coduni}`.toLowerCase().includes(q.trim().toLowerCase()));
  const n = (k) => todas.filter(VISTAS[k]).length;
  const abrir = (u, etapa, estado) => setModal({ unidad: u, preparacion: u.preparacion, etapa, estado });

  // Si el servidor todavía no tiene esta consulta, se muestra solo el aviso (sin cifras en cero ni filtros vacíos)
  if (sinApi(consulta)) return (
    <div>
      <PageHeader titulo="Preparación de motos" subtitulo="Las motos llegan parcialmente armadas y sin techo. Aquí se registra el armado, el avance del techo y cuándo cumplen las condiciones de entrega." />
      <AvisoConexion consulta={consulta} que="la preparación" />
    </div>
  );

  return (
    <div>
      <PageHeader titulo="Preparación de motos" subtitulo="Las motos llegan parcialmente armadas y sin techo. Aquí se registra el armado, el avance del techo y cuándo cumplen las condiciones de entrega.">
        <EstadoConexion hu="HU-033" consulta={consulta} />
        <BarraActualizacion consulta={consulta} />
      </PageHeader>
      <AvisoConexion consulta={consulta} que="la preparación" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Pendientes de armado" valor={n("armado")} tono="ambar" nota="Se terminan en Ventanilla" />
        <Stat etiqueta="Techo pendiente" valor={n("techo")} nota="Por definir, por instalar o en proceso" />
        <Stat etiqueta="Por confirmar entrega" valor={n("confirmar")} tono="ambar" nota="Ya cumplen las condiciones" />
        <Stat etiqueta="Listas para entrega" valor={n("listas")} tono="verde" nota="No significa entregadas" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Pestanas etiqueta="Etapa" valor={vista} onCambio={setVista} opciones={[
          { id: "armado", label: "Armado", n: n("armado"), alerta: true },
          { id: "techo", label: "Techo", n: n("techo") },
          { id: "confirmar", label: "Por confirmar", n: n("confirmar"), alerta: true },
          { id: "listas", label: "Listas", n: n("listas") },
          { id: "todas", label: "Todas", n: todas.length },
        ]} />
        <div className="flex flex-wrap items-center gap-3">
          <input className="field-input !w-56 !py-2" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Motor, chasis o modelo" aria-label="Buscar moto" />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={conVendidas} onChange={(e) => setConVendidas(e.target.checked)} />Incluir vendidas</label>
        </div>
      </div>

      {consulta.data && lista.length === 0 ? <Vacio titulo="No hay motos en esta etapa" texto={q ? "Ninguna coincide con la búsqueda." : "Cambia de pestaña para ver las demás etapas."} /> : consulta.data && (
        <Tabla columnas={["Moto", "Modelo", "Ubicación", "Armado", "Techo", "Preparación", "Situación", "Acciones"]}>
          {lista.map((u) => {
            const p = u.preparacion; const t = techoDe(p);
            return (
              <tr key={u.coduni} className="align-top" data-prep={u.coduni}>
                <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${u.coduni}`}>{u.nummotuni}</Link><span className="block text-[12px] text-slate-400">chasis {u.chauni}</span></td>
                <td className="px-4 py-3">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} /></span></td>
                <td className="px-4 py-3"><TextoUbicacion unidad={u} /></td>
                <td className="px-4 py-3">{p.armado === "Armado terminado" ? <span className="font-semibold text-emerald-700 dark:text-emerald-300">Terminado</span> : <span className="font-semibold text-amber-700 dark:text-amber-300">Pendiente</span>}</td>
                <td className="px-4 py-3"><TextoTecho preparacion={p} /></td>
                <td className="px-4 py-3"><PillPreparacion preparacion={p} />{!p.condiciones_cumplidas && p.pendientes?.length > 0 && <span className="mt-1 block max-w-[220px] text-[12px] text-slate-500">{p.pendientes.join(". ")}</span>}</td>
                <td className="px-4 py-3"><PillComercial comercial={u.comercial} /></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  {gestiona && p.armado !== "Armado terminado" && <button className={btnMini} onClick={() => abrir(u, "Armado", "Armado terminado")}>Armado terminado</button>}
                  {gestiona && t.requiereInstalacion && t.avance !== "Instalado" && <button className={btnMini} onClick={() => abrir(u, "Techo")}>Avance del techo</button>}
                  {gestiona && p.condiciones_cumplidas && !p.lista_para_entrega && <button className={btnMini} onClick={() => abrir(u, "Entrega", "Lista para entrega")}>Lista para entrega</button>}
                  {t.avance === "Por definir" && <Link className={btnMini} to={`/admin/inventario/${u.coduni}`}>Definir techo</Link>}
                  <Link className={btnMini} to={`/admin/inventario/${u.coduni}`}>Ficha</Link>
                </div></td>
              </tr>
            );
          })}
        </Tabla>
      )}
      {!gestiona && <p className="mt-3 text-[12.5px] text-slate-400">Tu rol consulta la preparación; la registran gerencia y administración.</p>}

      <ModalPreparacionCentral datos={modal} onClose={() => setModal(null)} onHecho={() => consulta.refrescar(true)} onConflicto={() => consulta.refrescar(true)} />
    </div>
  );
}
