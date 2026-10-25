// HU-001 · Consultar disponibilidad compartida
// Stock de sedes, fibreras y almacén de Crossland con estado, color y techo. Sin datos de clientes ni boletas.
import { useEffect, useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { COLORES, formatoSoles } from "../../data/mockData";
import { ESTADOS_STOCK, GRUPOS_LUGAR, useDisponibilidad } from "../../servicios/disponibilidad";
import { usePreparacion } from "../../servicios/preparacion";
import { haceCuanto } from "../../lib/validar";
import ModeloImg from "../../components/ModeloImg";
import { Card, PageHeader, Stat, Tabla, btnMini } from "../../components/ui";
import { ColorPunto, EstadoConexion, Pestanas, Pill, TONO_DISPONIBILIDAD, fechaCorta } from "../../components/dashboard/Sprint2";
import SepararModal from "../../components/dashboard/SepararModal";

const FILTRO_VACIO = { lugar: "", modelo: "", estado: "", color: "", techo: "", q: "" };
const cuenta = (lista, clave) => lista.reduce((o, x) => ({ ...o, [x[clave]]: (o[x[clave]] || 0) + 1 }), {});
const PLURAL = { Disponible: ["disponible", "disponibles"], Separada: ["separada", "separadas"], "No disponible": ["no disponible", "no disponibles"] };
const resumenEstados = (us) => ESTADOS_STOCK.map((e) => [e, us.filter((u) => u.estado === e).length]).filter(([, n]) => n);
const tieneTecho = (u) => u.techo && u.techo !== "Sin techo";

export default function Disponibilidad() {
  const { puede } = useAuth();
  const disp = useDisponibilidad();
  const prep = usePreparacion();
  const [f, setF] = useState(FILTRO_VACIO);
  const [vista, setVista] = useState("modelo");
  const [abierto, setAbierto] = useState({});
  const [separar, setSeparar] = useState(null);
  const [, setReloj] = useState(0);
  useEffect(() => { const t = setInterval(() => setReloj((x) => x + 1), 15000); return () => clearInterval(t); }, []);
  const separa = puede("separaciones.registrar");
  const cambiar = (k, v) => setF((x) => ({ ...x, [k]: v }));

  // Filtros: ubicación, modelo, estado, color, techo y búsqueda por código, motor o chasis
  const lista = useMemo(() => disp.stock.filter((u) => {
    const q = f.q.trim().toLowerCase();
    return (!f.lugar || u.lugar === f.lugar) && (!f.modelo || u.modelo === f.modelo) && (!f.estado || u.estado === f.estado)
      && (!f.color || u.color === f.color) && (!f.techo || (f.techo === "sin" ? !tieneTecho(u) : tieneTecho(u)))
      && (!q || `${u.id} ${u.motor} ${u.chasis}`.toLowerCase().includes(q));
  }), [disp.stock, f]);
  const hayFiltro = Object.values(f).some(Boolean);
  const modelo = (id) => disp.catalogo.find((m) => m.id === id);
  const nombreModelo = (u) => modelo(u.modelo)?.nombre || u.nombreModelo || u.modelo;
  const grupos = disp.catalogo.map((m) => ({ m, us: lista.filter((u) => u.modelo === m.id) })).filter((g) => g.us.length)
    .sort((a, b) => b.us.filter((u) => u.estado === "Disponible").length - a.us.filter((u) => u.estado === "Disponible").length || b.us.length - a.us.length);
  const sinStock = !hayFiltro ? disp.catalogo.filter((m) => !disp.stock.some((u) => u.modelo === m.id)) : [];
  const n = (estado) => lista.filter((u) => u.estado === estado).length;
  const conFiltro = hayFiltro ? " con estos filtros" : "";
  const filtrosActivos = [
    f.lugar && `Ubicación: ${f.lugar}`, f.modelo && `Modelo: ${modelo(f.modelo)?.nombre || f.modelo}`, f.estado && `Estado: ${f.estado}`,
    f.color && `Color: ${f.color}`, f.techo && (f.techo === "sin" ? "Sin techo" : "Con techo"), f.q && `Búsqueda: «${f.q.trim()}»`,
  ].filter(Boolean);

  // Una moto: código, color, estado, ubicación y techo
  const filaUnidad = (u) => (
    <li key={u.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5" data-stock={u.id} data-estado={u.estado}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px]">
          <Link to={`/admin/inventario/${u.id}`} className="font-bold text-marino hover:underline dark:text-white">{u.id}</Link>
          <span className="inline-flex items-center gap-1 text-slate-500"><ColorPunto color={u.color} className="h-2.5 w-2.5" />{u.color}</span>
          <Pill tono={TONO_DISPONIBILIDAD[u.estado]}>{u.estado}</Pill>
        </p>
        <p className="mt-0.5 text-[12.5px] text-slate-500">
          <span className={u.transito ? "font-semibold text-sky-700 dark:text-sky-300" : ""}>{u.detalle}</span>
          {!u.transito && `, en ${u.lugar}`}, {tieneTecho(u) ? u.techo.toLowerCase() : "sin techo"}{u.estado === "Disponible" && prep.desdeCuando(u) ? `, lista desde el ${fechaCorta(prep.desdeCuando(u))}` : ""}
        </p>
      </div>
      {separa && u.estado === "Disponible" && <button className={btnMini} onClick={() => setSeparar(u)}>Separar</button>}
    </li>
  );

  return (
    <div>
      <PageHeader titulo="Disponibilidad" subtitulo="Stock compartido de sedes, fibreras y el almacén de Crossland. Cada moto muestra su estado, color y techo. Todos los vendedores ven la misma información.">
        <EstadoConexion hu="HU-001" />
        <span className="self-center text-[12.5px] text-slate-400" data-actualizado>Actualizado {haceCuanto(disp.actualizado)}</span>
        <button className="btn btn-secondary !py-2.5" onClick={disp.refrescar}>Actualizar</button>
      </PageHeader>

      {/* Indicadores (siguen a los filtros) */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4" data-indicadores>
        <Stat etiqueta="Disponibles" valor={n("Disponible")} tono="verde" nota={hayFiltro ? "Con estos filtros" : "Listas para vender"} />
        <Stat etiqueta="Separadas" valor={n("Separada")} tono="ambar" nota={hayFiltro ? "Con estos filtros" : "Reservadas con adelanto"} />
        <Stat etiqueta="No disponibles" valor={n("No disponible")} nota={hayFiltro ? "Con estos filtros" : "En preparación, fibrera o por recibir"} />
        <Stat etiqueta="En camino" valor={lista.filter((u) => u.transito).length} nota={hayFiltro ? "Con estos filtros" : "Trasladándose entre ubicaciones"} />
      </div>

      {/* Filtros */}
      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div><label className="field-label" htmlFor="disp-lugar">Ubicación</label>
            <select id="disp-lugar" className="field-input" value={f.lugar} onChange={(e) => cambiar("lugar", e.target.value)}>
              <option value="">Todas</option>
              {GRUPOS_LUGAR.map((g) => { const ls = disp.lugares.filter((l) => l.tipo === g.tipo); return ls.length ? <optgroup key={g.tipo} label={g.titulo}>{ls.map((l) => <option key={l.id} value={l.nombre}>{l.nombre}</option>)}</optgroup> : null; })}
            </select></div>
          <div><label className="field-label" htmlFor="disp-modelo">Modelo</label><select id="disp-modelo" className="field-input" value={f.modelo} onChange={(e) => cambiar("modelo", e.target.value)}><option value="">Todos</option>{disp.catalogo.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
          <div><label className="field-label" htmlFor="disp-estado">Estado</label><select id="disp-estado" className="field-input" value={f.estado} onChange={(e) => cambiar("estado", e.target.value)}><option value="">Todos los estados</option>{ESTADOS_STOCK.map((e) => <option key={e}>{e}</option>)}</select></div>
          <div><label className="field-label" htmlFor="disp-techo">Techo</label><select id="disp-techo" className="field-input" value={f.techo} onChange={(e) => cambiar("techo", e.target.value)}><option value="">Con o sin techo</option><option value="sin">Sin techo</option><option value="con">Con techo</option></select></div>
          <div><label className="field-label" htmlFor="disp-buscar">Buscar</label><input id="disp-buscar" className="field-input" value={f.q} maxLength={40} onChange={(e) => cambiar("q", e.target.value)} placeholder="Código, motor o chasis" /></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Color">
          <span className="text-[13px] font-semibold">Color</span>
          {["", ...COLORES].map((c) => (
            <button key={c || "todos"} type="button" aria-pressed={f.color === c} onClick={() => cambiar("color", c)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition ${f.color === c ? "border-marino-700 bg-marino-700 text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-white/70"}`}>
              {c && <ColorPunto color={c} className="h-2.5 w-2.5" />}{c || "Todos"}
            </button>
          ))}
          {hayFiltro && <button className="ml-auto text-[13px] font-semibold text-acento hover:underline" onClick={() => setF(FILTRO_VACIO)} data-limpiar>Limpiar filtros</button>}
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Pestanas etiqueta="Ver por" valor={vista} onCambio={setVista} opciones={[{ id: "modelo", label: "Por modelo" }, { id: "lugar", label: "Por ubicación" }, { id: "lista", label: "Lista", n: lista.length }]} />
        <p className="text-[13px] text-slate-500" data-conteo>{lista.length} moto{lista.length === 1 ? "" : "s"}{conFiltro}</p>
      </div>

      {/* Sin coincidencias: se dice claro y no se muestra stock que no existe */}
      {lista.length === 0 && (
        <div className="rounded-xl2 border-2 border-dashed border-slate-200 px-6 py-10 text-center dark:border-white/10" data-sin-coincidencias role="status">
          <p className="text-[17px] font-bold text-marino dark:text-white">{hayFiltro ? "No hay motos que coincidan con estos filtros" : "No hay motos registradas en stock"}</p>
          {filtrosActivos.length > 0 && <p className="mt-1.5 text-[13.5px] text-slate-500">{filtrosActivos.join(" · ")}</p>}
          <p className="mx-auto mt-2 max-w-md text-[13.5px] text-slate-500">{hayFiltro ? "Ninguna unidad de sedes, fibreras o del almacén de Crossland cumple esos filtros. Prueba con otra ubicación o modelo." : "Cuando se identifiquen motos en Compras, aparecerán aquí."}</p>
          {hayFiltro && <button className="btn btn-secondary mt-4 !py-2" onClick={() => setF(FILTRO_VACIO)}>Limpiar filtros</button>}
        </div>
      )}

      {/* Por modelo */}
      {vista === "modelo" && lista.length > 0 && (
        <div className="space-y-3" data-vista="modelo">
          {grupos.map(({ m, us }) => {
            const colores = cuenta(us, "color");
            const lugares = cuenta(us.filter((u) => !u.transito), "lugar");
            const ver = abierto[m.id];
            const libres = us.filter((u) => u.estado === "Disponible");
            return (
              <Card key={m.id} className="!p-0" data-modelo={m.id}>
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="grid h-24 w-full shrink-0 place-items-center overflow-hidden rounded-xl bg-escenario sm:w-36 dark:bg-escenario-oscuro"><ModeloImg modelo={m} color={(libres[0] || us[0]).color} className="h-full w-full object-contain p-2" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="font-display text-[1.6rem] font-bold uppercase leading-none tracking-tight text-marino dark:text-white">{m.nombre}</h2>
                      <p className="text-[13px] text-slate-500"><b className="cifra font-display text-[1.6rem] leading-none text-emerald-600">{libres.length}</b> disponible{libres.length === 1 ? "" : "s"} de {us.length}</p>
                    </div>
                    <p className="mt-0.5 text-[13px] text-slate-500">{m.familia}{m.precioDesde ? `, desde ${formatoSoles(m.precioDesde)}` : ""}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">{resumenEstados(us).map(([e, k]) => <Pill key={e} tono={TONO_DISPONIBILIDAD[e]}>{k} {PLURAL[e][k === 1 ? 0 : 1]}</Pill>)}</div>
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
                      <span className="flex flex-wrap items-center gap-2">{Object.entries(colores).map(([c, k]) => <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 font-semibold dark:bg-white/10"><ColorPunto color={c} className="h-2.5 w-2.5" />{c} <span className="cifra">{k}</span></span>)}</span>
                      <span className="flex flex-wrap items-center gap-2">{Object.entries(lugares).map(([l, k]) => <button key={l} onClick={() => cambiar("lugar", l)} className="rounded-full border border-slate-200 px-2.5 py-1 font-semibold text-marino-700 hover:bg-marino-50 dark:border-white/15 dark:text-white/80" title={`Ver solo ${l}`}>{l} <span className="cifra">{k}</span></button>)}{us.some((u) => u.transito) && <span className="rounded-full bg-sky-100 px-2.5 py-1 font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-200">En camino {us.filter((u) => u.transito).length}</span>}</span>
                    </div>
                  </div>
                  <button className="btn btn-secondary shrink-0 !py-2 text-[13.5px]" aria-expanded={!!ver} onClick={() => setAbierto({ ...abierto, [m.id]: !ver })}>{ver ? "Ocultar motos" : `Ver motos (${us.length})`}</button>
                </div>
                {ver && <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4 sm:px-5 dark:divide-white/10 dark:border-white/10">{us.map(filaUnidad)}</ul>}
              </Card>
            );
          })}
          {sinStock.length > 0 && (
            <p className="rounded-xl2 border-2 border-dashed border-slate-200 px-4 py-3 text-[13px] text-slate-500 dark:border-white/10">Sin motos en stock: <b className="text-marino dark:text-white">{sinStock.map((m) => m.nombre).join(", ")}</b>. Si un cliente lo pide, revisa Compras.</p>
          )}
        </div>
      )}

      {/* Por ubicación: sedes, fibreras y almacenes */}
      {vista === "lugar" && lista.length > 0 && (
        <div className="space-y-6" data-vista="lugar">
          {[...GRUPOS_LUGAR.map((g) => ({ ...g, ls: disp.lugares.filter((l) => l.tipo === g.tipo) })), { tipo: "camino", titulo: "En camino", ls: [{ id: "camino", nombre: "Entre ubicaciones" }] }].map((g) => {
            const tarjetas = g.ls.map((l) => ({ l, us: g.tipo === "camino" ? lista.filter((u) => u.transito) : lista.filter((u) => u.lugar === l.nombre && !u.transito) })).filter((t) => t.us.length);
            if (!tarjetas.length) return null;
            return (
              <section key={g.tipo}>
                <h2 className="mb-2.5 text-[14px] font-bold text-marino dark:text-white">{g.titulo}</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {tarjetas.map(({ l, us }) => (
                    <Card key={l.id} data-lugar={l.nombre}>
                      <div className="flex items-baseline justify-between gap-2">
                        <h3 className="text-[16px] font-bold text-marino dark:text-white">{l.nombre}</h3>
                        <span className="cifra text-[13px] text-slate-500">{us.length} moto{us.length === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">{resumenEstados(us).map(([e, k]) => <Pill key={e} tono={TONO_DISPONIBILIDAD[e]}>{k} {PLURAL[e][k === 1 ? 0 : 1]}</Pill>)}</div>
                      <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
                        {Object.entries(cuenta(us, "modelo")).sort((a, b) => b[1] - a[1]).map(([id, k]) => {
                          const del = us.filter((u) => u.modelo === id);
                          const clave = `${l.nombre}-${id}`;
                          return (
                            <li key={id} className="py-2">
                              <button className="flex w-full items-center justify-between gap-2 text-left" aria-expanded={!!abierto[clave]} onClick={() => setAbierto({ ...abierto, [clave]: !abierto[clave] })}>
                                <span className="min-w-0"><span className="block truncate font-semibold text-marino dark:text-white">{modelo(id)?.nombre || id}</span><span className="flex flex-wrap gap-2 text-[12px] text-slate-500">{Object.entries(cuenta(del, "color")).map(([c, j]) => <span key={c} className="inline-flex items-center gap-1"><ColorPunto color={c} className="h-2 w-2" />{c} {j}</span>)}</span></span>
                                <span className="cifra shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[13px] font-bold text-marino dark:bg-white/10 dark:text-white">{k}</span>
                              </button>
                              {abierto[clave] && <ul className="mt-1 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3 dark:divide-white/10 dark:bg-white/5">{del.map(filaUnidad)}</ul>}
                            </li>
                          );
                        })}
                      </ul>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Lista */}
      {vista === "lista" && lista.length > 0 && (
        <Tabla columnas={["Moto", "Modelo", "Color", "Ubicación", "Techo", "Estado", "Acción"]}>
          {lista.map((u) => (
            <tr key={u.id} data-stock={u.id} data-estado={u.estado}>
              <td className="px-4 py-3"><Link to={`/admin/inventario/${u.id}`} className="font-semibold text-marino hover:underline dark:text-white">{u.id}</Link><span className="block text-[12px] text-slate-400">{u.motor}</span></td>
              <td className="px-4 py-3">{nombreModelo(u)}</td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><ColorPunto color={u.color} />{u.color}</span></td>
              <td className="px-4 py-3">{u.transito ? <span className="font-semibold text-sky-700 dark:text-sky-300">En camino a {u.transito.destino}</span> : <>{u.lugar}<span className="block text-[12px] text-slate-400">{u.tipoLugar === "Proveedor de techo" ? "Fibrera" : u.tipoLugar === "Almacén externo" ? "Almacén" : "Sede"}</span></>}</td>
              <td className="px-4 py-3">{u.techo}</td>
              <td className="px-4 py-3"><Pill tono={TONO_DISPONIBILIDAD[u.estado]}>{u.estado}</Pill><span className="mt-1 block max-w-[220px] text-[12px] text-slate-500">{u.detalle}</span></td>
              <td className="px-4 py-3">{separa && u.estado === "Disponible" ? <button className={btnMini} onClick={() => setSeparar(u)}>Separar</button> : <Link className={btnMini} to={`/admin/inventario/${u.id}`}>Ficha</Link>}</td>
            </tr>
          ))}
        </Tabla>
      )}

      <SepararModal abierto={!!separar} unidad={separar} onClose={() => setSeparar(null)} />
    </div>
  );
}
