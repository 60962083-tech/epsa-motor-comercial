// HU-030 · Copia para el navegador del código de la API (Michelle). Mantener igual al original.
import type {
  FacturaUblParseada,
  EquivalenciaProductoExterno,
  LineaFacturaClasificada,
  LineaFacturaUbl,
  VehiculoImportacionCandidato
} from './tipos';
import { CODIGOS_PROPIEDAD_CROSLAND as CODIGOS } from './config';

function property(line: LineaFacturaUbl, code: string): string | null {
  const value = line.propiedadesPorCodigo[code]?.find((entry) => entry.trim() !== '');
  return value?.trim() || null;
}

function normalizeExternalCode(code: string | null): string | null {
  const normalized = code?.trim().toLocaleUpperCase('en-US');
  return normalized || null;
}

function quantityIsOne(value: string | null): boolean {
  return value !== null && /^1(?:\.0+)?$/.test(value.trim());
}

function review(line: LineaFacturaUbl, classification: 'Vehiculo' | 'Accesorio' | 'Desconocido', reason: string, equivalence: EquivalenciaProductoExterno | null): LineaFacturaClasificada {
  return {
    numeroLinea: line.numeroLinea,
    codigoExterno: line.codigoExterno,
    clasificacion: classification,
    estado: 'Revision',
    motivo: reason,
    motivos: [reason],
    equivalencia: equivalence,
    vehiculos: []
  };
}

function classifyVehicle(line: LineaFacturaUbl, equivalence: EquivalenciaProductoExterno): LineaFacturaClasificada {
  if (!quantityIsOne(line.cantidad)) return review(line, 'Vehiculo', 'CANTIDAD_VEHICULO_NO_UNO', equivalence);
  const modelo = property(line, CODIGOS.modelo);
  const motor = property(line, CODIGOS.motor);
  const chasis = property(line, CODIGOS.chasis);
  const color = property(line, CODIGOS.color);
  if (!modelo) return review(line, 'Vehiculo', 'MODELO_DOCUMENTAL_AUSENTE', equivalence);
  if (!motor) return review(line, 'Vehiculo', 'MOTOR_AUSENTE', equivalence);
  if (!chasis) return review(line, 'Vehiculo', 'CHASIS_AUSENTE', equivalence);
  if (!color) return review(line, 'Vehiculo', 'COLOR_AUSENTE', equivalence);

  const candidate: VehiculoImportacionCandidato = {
    codmod: equivalence.codmod!,
    modeloOrigen: modelo,
    motor,
    vin: property(line, CODIGOS.vin),
    chasis,
    color,
    anioFabricacion: property(line, CODIGOS.anioFabricacion),
    anioModelo: property(line, CODIGOS.anioModelo),
    pedido: line.pedidoLinea,
    linea: line.numeroLinea,
    codigoExterno: line.codigoExterno!
  };
  return {
    numeroLinea: line.numeroLinea,
    codigoExterno: line.codigoExterno,
    clasificacion: 'Vehiculo',
    estado: 'Candidato',
    motivo: null,
    motivos: [],
    equivalencia: equivalence,
    vehiculos: [candidate]
  };
}

/** Homologa exclusivamente códigos aprobados; no infiere por descripción ni UNSPSC. */
export function clasificarLineasFactura(
  document: FacturaUblParseada,
  equivalences: readonly EquivalenciaProductoExterno[]
): LineaFacturaClasificada[] {
  const classified: LineaFacturaClasificada[] = document.lineas.map((line) => {
    const code = normalizeExternalCode(line.codigoExterno);
    if (code === null) return review(line, 'Desconocido', 'CODIGO_SIN_EQUIVALENCIA', null);
    const matches = equivalences.filter((item) => item.activa !== false
      && normalizeExternalCode(item.codigoExterno) === code);
    if (matches.length === 0) return review(line, 'Desconocido', 'CODIGO_SIN_EQUIVALENCIA', null);
    if (matches.length > 1) return review(line, 'Desconocido', 'EQUIVALENCIA_AMBIGUA', null);
    const equivalence = matches[0]!;
    if (equivalence.clasificacion === 'Accesorio') {
      if (equivalence.codmod !== null) return review(line, 'Accesorio', 'EQUIVALENCIA_ACCESORIO_INVALIDA', equivalence);
      return {
        numeroLinea: line.numeroLinea,
        codigoExterno: line.codigoExterno,
        clasificacion: 'Accesorio',
        estado: 'Procesada',
        motivo: null,
        motivos: [],
        equivalencia: equivalence,
        vehiculos: []
      };
    }
    if (!equivalence.codmod) return review(line, 'Vehiculo', 'EQUIVALENCIA_MODELO_AUSENTE', equivalence);
    return classifyVehicle(line, equivalence);
  });

  const motorLocations = new Map<string, Array<{ lineIndex: number; vehicleIndex: number }>>();
  const chassisLocations = new Map<string, Array<{ lineIndex: number; vehicleIndex: number }>>();
  const addLocation = (locations: Map<string, Array<{ lineIndex: number; vehicleIndex: number }>>, serial: string, lineIndex: number, vehicleIndex: number) => {
    const normalized = serial.normalize('NFKC').trim().toLocaleUpperCase('en-US');
    if (!normalized) return;
    const entries = locations.get(normalized) ?? [];
    entries.push({ lineIndex, vehicleIndex });
    locations.set(normalized, entries);
  };

  classified.forEach((line, lineIndex) => line.vehiculos.forEach((vehicle, vehicleIndex) => {
    addLocation(motorLocations, vehicle.motor, lineIndex, vehicleIndex);
    addLocation(chassisLocations, vehicle.chasis, lineIndex, vehicleIndex);
  }));

  const markDuplicate = (locations: Map<string, Array<{ lineIndex: number; vehicleIndex: number }>>, code: string) => {
    for (const entries of locations.values()) {
      if (entries.length < 2) continue;
      for (const { lineIndex } of entries) {
        const line = classified[lineIndex]!;
        if (!line.motivos.includes(code)) line.motivos.push(code);
        line.estado = 'Revision';
        line.motivo = line.motivos[0] ?? code;
      }
    }
  };

  markDuplicate(motorLocations, 'MOTOR_DUPLICADO_EN_DOCUMENTO');
  markDuplicate(chassisLocations, 'CHASIS_DUPLICADO_EN_DOCUMENTO');
  return classified;
}
