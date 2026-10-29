export type EtapaPreparacion = 'Armado' | 'Techo';
export type EstadoArmadoPreparacion = 'Pendiente' | 'Terminado';
export type EstadoTechoPreparacion = 'Pendiente' | 'En proceso' | 'Instalado' | 'No requiere';
export type EstadoPreparacion = 'Pendiente' | 'Terminado' | 'En proceso' | 'Instalado' | 'No requiere';
export type FuentePreparacion = 'Interno' | 'Aviso proveedor' | 'Configuración techo';

interface ActualizarPreparacionUnidadBase {
  version: number;
  observacion?: string | null;
  fuente: 'Interno' | 'Aviso proveedor';
}

export interface AutorPreparacion {
  codusu: string;
  nombre: string;
}

export interface ProveedorPreparacion {
  codpro: string;
  nombre: string;
}

export interface TechoPreparacion {
  estado: EstadoTechoPreparacion;
  codtte: string | null;
  configuracion: string | null;
  requiereInstalacion: boolean | null;
}

export interface PreparacionUnidadActual {
  coduni: string;
  armado: 'Pendiente' | 'Terminado';
  techo: TechoPreparacion;
  version: string;
  preparacionCompleta: boolean;
  condicionesFaltantes: string[];
  ultimaActualizacion: string;
  actualizadoPor: AutorPreparacion | null;
}

export interface EventoHistorialPreparacion {
  codhprep: string;
  etapa: EtapaPreparacion;
  estadoAnterior: EstadoPreparacion | null;
  estadoNuevo: EstadoPreparacion;
  fecha: string;
  observacion: string | null;
  fuente: FuentePreparacion;
  proveedor: ProveedorPreparacion | null;
  autor: AutorPreparacion;
}

export interface ConsultaPreparacionUnidad {
  actual: PreparacionUnidadActual;
  historial: EventoHistorialPreparacion[];
}

export type ActualizarPreparacionUnidadRequest = ActualizarPreparacionUnidadBase & (
  | { etapa: 'Armado'; estado: EstadoArmadoPreparacion }
  | { etapa: 'Techo'; estado: Exclude<EstadoTechoPreparacion, 'No requiere'> }
);

export interface ActualizarPreparacionUnidadInputBase {
  p_coduni: string;
  p_version_esperada: number;
  p_observacion: string | null;
  p_fuente: 'Interno' | 'Aviso proveedor';
  p_idempotencia: string;
}

export type ActualizarPreparacionUnidadInput = ActualizarPreparacionUnidadInputBase & (
  | { p_etapa: 'Armado'; p_estado: EstadoArmadoPreparacion }
  | { p_etapa: 'Techo'; p_estado: Exclude<EstadoTechoPreparacion, 'No requiere'> }
);

export interface ErrorPreparacionBD {
  code?: string;
}
