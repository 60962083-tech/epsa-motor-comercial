import type { PreparacionUnidadActual } from './preparacion.unidad.types';

export interface ConsultaInventarioInput {
  p_codubi: string | null;
  p_codmod: string | null;
  p_estado: string | null;
  p_color: string | null;
  p_codtte: string | null;
  p_codepr: string | null;
  p_limite: number;
  p_offset: number;
}

export interface InventarioUnidad {
  coduni: string;
  modelo: { codmod: string; nommod: string };
  nummotuni: string | null;
  chauni: string | null;
  color: string | null;
  ubicacionConfirmada: { codubi: string; nomubi: string; tipubi: string } | null;
  movimientoActivo: {
    codmub: string;
    estado: string;
    destino: { codubi: string; nomubi: string };
  } | null;
  techo: { codtte: string; nomtte: string } | null;
  /** Preparación legacy basada en unidad.codepr; se conserva para compatibilidad histórica. */
  preparacion: { codepr: string; nomepr: string } | null;
  /** Estado actual HU-033 derivado de preparacionunidad; fuente operativa de preparación. */
  preparacionOperativa: PreparacionUnidadActual;
  situacionComercial: string;
}

export interface InventarioResultado {
  items: InventarioUnidad[];
  total: number;
  limite: number;
  offset: number;
  resumen: {
    unidadesIdentificadas: number;
    cantidadPendienteIdentificacion: number;
  };
}

export interface ErrorInventarioBD {
  code?: string;
}
