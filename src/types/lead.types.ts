export const COLORES_LEAD = ['Rojo', 'Azul', 'Amarillo', 'Verde', 'Negro'] as const;
export const ESTADOS_LEAD = ['Nuevo', 'Contactado', 'En seguimiento', 'Cerrado', 'Convertido'] as const;
export type EstadoLead = typeof ESTADOS_LEAD[number];
export type ColorLead = typeof COLORES_LEAD[number];

export interface LeadManualInput {
  p_nomlea: string;
  p_tellea: string;
  p_codmod: string;
  p_canlea: string;
  p_estlea: Exclude<EstadoLead, 'Convertido'>;
  p_codusu: string | null;
  p_fecprosle: string | null;
  p_collea: ColorLead | null;
  p_orilea: string | null;
  p_codsed: string | null;
  p_codcwa: string | null;
  p_obslea: string | null;
  p_nueva_oportunidad: boolean;
}

export interface LeadManualResultado {
  codlea: string;
  nomlea: string;
  tellea: string;
  codmod: string;
  codusu: string | null;
  codcrelea: string;
  codcwa: string | null;
  codsed: string | null;
  codcli: null;
  collea: ColorLead | null;
  canlea: string;
  orilea: string | null;
  tipreglea: 'Manual';
  estlea: EstadoLead;
  obslea: string | null;
  fecreglea: string;
  fecprosle: string | null;
}

export interface CoincidenciaLead {
  codlea: string;
  codmod: string | null;
  estlea: EstadoLead;
}
