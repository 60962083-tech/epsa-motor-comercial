// Sprint 2 · Recorrido de una moto: identificada → recibida → preparada → disponible → separada → vendida
import { ESTADOS_PREPARACION } from "../data/mockData";
import { nombreCliente } from "../lib/sprint2";

const porFecha = (campo) => (a, b) => String(a[campo] || "").localeCompare(String(b[campo] || ""));

export function recorridoDe(u, { movimientos = [], historialPreparacion = [], separaciones = [], clientes = [] } = {}) {
  const h = u.historial || [];
  const enHistorial = (re) => h.find((x) => re.test(x.detalle))?.fecha || "";
  const recepcion = movimientos.filter((m) => m.unidad === u.id && m.tipo === "Recepción" && m.estado === "Finalizado").sort(porFecha("llegada"))[0];
  const transito = movimientos.find((m) => m.unidad === u.id && m.estado === "En tránsito");
  const pasos = historialPreparacion.filter((x) => x.unidad === u.id).sort(porFecha("fecha"));
  const lista = pasos.filter((x) => x.paso === "Lista para entrega").at(-1);
  const sep = separaciones.filter((s) => s.unidad === u.id && !["Cancelada", "Vencida"].includes(s.estado)).sort(porFecha("fecha")).at(-1);
  const vendida = u.disponibilidad === "Vendida";
  const recibida = Boolean(u.ubicacion);
  const lista4 = u.preparacion === "Lista para entrega";
  const n = ESTADOS_PREPARACION.indexOf(u.preparacion) + 1;
  const cliente = sep ? clientes.find((c) => c.id === sep.cliente) : null;

  const estaciones = [
    { nombre: "Identificada", hecho: true, fecha: enHistorial(/Identificada/i) || h[0]?.fecha || "", nota: u.codcom ? `Compra #${u.codcom}` : "Motor y chasis registrados" },
    { nombre: "Recibida", hecho: recibida, fecha: recepcion?.llegada || enHistorial(/Recepci/i), nota: recibida ? (transito ? `En camino a ${transito.destino}` : `En ${u.ubicacion}`) : "Aún en Crosland" },
    { nombre: "Preparada", hecho: lista4 || vendida, fecha: lista?.fecha || "", nota: lista4 || vendida ? "Lista para entrega" : recibida ? `Paso ${Math.max(n, 1)} de 4: ${u.preparacion || "Sin preparar"}` : "Empieza al recibirla" },
    { nombre: "Disponible", hecho: ["Disponible", "Separada", "Vendida"].includes(u.disponibilidad), fecha: enHistorial(/(Liberada|disponible para la venta)/i) || lista?.fecha || "", nota: u.disponibilidad === "Disponible" ? "Se ve en Disponibilidad" : ["Separada", "Vendida"].includes(u.disponibilidad) ? "Estuvo a la venta" : "" },
    { nombre: "Separada", hecho: u.disponibilidad === "Separada" || (vendida && Boolean(sep)), omitido: vendida && !sep, fecha: sep?.fecha || "", nota: cliente ? nombreCliente(cliente) : vendida && !sep ? "Se vendió sin separar" : "" },
    { nombre: "Vendida", hecho: vendida, fecha: enHistorial(/Entregada/i), nota: vendida ? "Entregada al cliente" : "" },
  ];
  // Dónde está la moto ahora: una tarea pendiente (recibir o preparar) o un estado comercial ya alcanzado
  const ahora = !recibida ? "Recibida" : !(lista4 || vendida) ? "Preparada" : vendida ? "Vendida" : u.disponibilidad === "Separada" ? "Separada" : u.disponibilidad === "Disponible" ? "Disponible" : "Preparada";
  return estaciones.map((e) => ({ ...e, actual: e.nombre === ahora }));
}
