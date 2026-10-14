export interface CanalWhatsapp {
  codcwa: string;
  nomcwa: string;
  numcwa: string;
  enlcwa: string;
  estcwa: boolean;
}

export type CambiosCanalWhatsapp = Partial<Pick<CanalWhatsapp, 'nomcwa' | 'numcwa' | 'enlcwa' | 'estcwa'>>;
