export interface ConfiguracionTechoRequest {
  codtte: string;
  codpro?: string | null;
  detalle?: string | null;
}

export interface ActualizarConfiguracionTechoInput {
  p_coduni: string;
  p_codtte: string;
  p_codpro: string | null;
  p_detalle: string | null;
}

export interface TipoTechoCatalogo {
  codtte: string;
  nomtte: string;
  reqprotte: boolean;
}

export interface ProveedorTechoCatalogo {
  codpro: string;
  nompro: string;
}

export interface ReferenciaTipoTecho {
  codtte: string;
  nombre: string;
}

export interface ReferenciaProveedorTecho {
  codpro: string;
  nombre: string;
}

export interface ConfiguracionTecho {
  coduni: string;
  tipoTecho: ReferenciaTipoTecho | null;
  proveedor: ReferenciaProveedorTecho | null;
  detalle: string | null;
}

export interface ErrorTechoBD {
  code?: string;
}
