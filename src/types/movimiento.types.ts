export interface IniciarMovimientoRequest {
  codubiori: string;
  codubides: string;
  obsmub?: string | null;
}

export interface IniciarMovimientoInput {
  p_coduni: string;
  p_codubiori: string;
  p_codubides: string;
  p_obsmub: string | null;
}

export interface MovimientoUbicacion {
  codmub: string;
  coduni: string;
  origen: { codubi: string; nomubi: string };
  destino: { codubi: string; nomubi: string };
  estado: 'Pendiente' | 'En transito' | 'Finalizado' | 'Cancelado';
  fechaSalida: string;
  horaSalida: string;
  autorSalida: { nombre: string } | null;
  fechaRecepcion: string | null;
  horaRecepcion: string | null;
  autorRecepcion: { nombre: string } | null;
  observacion: string | null;
}

export interface EstadoMovimientosUnidad {
  coduni: string;
  ubicacionConfirmada: { codubi: string; nomubi: string } | null;
  movimientoActivo: MovimientoUbicacion | null;
  movimientos: MovimientoUbicacion[];
}

export interface ErrorMovimientoBD {
  code?: string;
}
