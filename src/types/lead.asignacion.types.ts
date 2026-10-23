export interface AsignarResponsableLeadInput {
  p_codlea: string;
  p_codusunuevo: string;
  p_codusuesperado: string | null;
  p_motivo: string | null;
}

export interface AsignarResponsableLeadResultado {
  codlea: string;
  responsableAnterior: string | null;
  responsableActual: string | null;
  cambioRealizado: boolean;
}

export interface ResponsableLead {
  codusu: string;
  nomusu: string;
  apepatusu: string;
  apematusu: string | null;
  rol: 'Gerente' | 'Administradora' | 'Vendedor';
}

export interface LeadGestion {
  codlea: string;
  nomlea: string;
  tellea: string | null;
  codmod: string | null;
  nommod: string | null;
  collea: string | null;
  canlea: string;
  orilea: string | null;
  codcwa: string | null;
  receptorWhatsapp: string | null;
  codsed: string | null;
  nomsed: string | null;
  estlea: string;
  obslea: string | null;
  fecreglea: string;
  codusu: string | null;
  responsable: ResponsableLead | null;
}

export interface PaginacionLeads {
  p_limite: number;
  p_offset: number;
}
