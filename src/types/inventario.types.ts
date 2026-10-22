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
  color: string | null;
  ubicacionConfirmada: { codubi: string; nomubi: string; tipubi: string } | null;
  movimientoActivo: {
    codmub: string;
    estado: string;
    destino: { codubi: string; nomubi: string };
  } | null;
  techo: { codtte: string; nomtte: string } | null;
  preparacion: { codepr: string; nomepr: string } | null;
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
