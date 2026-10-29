// HU-030 · Copia para el navegador del código de la API (Michelle). Mantener igual al original.
import type { GrupoCompraImportada, LineaFacturaClasificada } from './tipos';

function normalizeColor(color: string): string {
  return color.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-PE');
}

/** Agrupa solo vehículos candidatos por modelo y color físico; los pedidos siguen por vehículo. */
export function agruparComprasFactura(lines: readonly LineaFacturaClasificada[]): GrupoCompraImportada[] {
  const groups = new Map<string, GrupoCompraImportada>();
  for (const line of lines) {
    if (line.estado !== 'Candidato') continue;
    for (const vehicle of line.vehiculos) {
      const colorKey = normalizeColor(vehicle.color);
      const key = `${vehicle.codmod}\u0000${colorKey}`;
      let group = groups.get(key);
      if (!group) {
        group = { codmod: vehicle.codmod, color: vehicle.color.trim().replace(/\s+/g, ' '), cantidad: 0, pedidos: [], vehiculos: [] };
        groups.set(key, group);
      }
      group.cantidad += 1;
      group.vehiculos.push(vehicle);
      if (vehicle.pedido && !group.pedidos.includes(vehicle.pedido)) group.pedidos.push(vehicle.pedido);
    }
  }
  return [...groups.values()];
}
