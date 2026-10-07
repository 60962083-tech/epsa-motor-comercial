import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ConsultaUnidadesInput, FacturaCompraInput, FacturaCompraResultado,
  IdentificacionCompraInput, IdentificacionCompraResultado
} from '../types/unidad.types';

export async function registrarFactura(
  db: SupabaseClient, datos: FacturaCompraInput
): Promise<FacturaCompraResultado> {
  const { data, error } = await db.rpc('hu002_registrar_factura', datos);
  if (error) throw error;
  return data as FacturaCompraResultado;
}

export async function identificarUnidades(
  db: SupabaseClient, datos: IdentificacionCompraInput
): Promise<IdentificacionCompraResultado> {
  const { data, error } = await db.rpc('hu002_identificar_unidades', datos);
  if (error) throw error;
  return data as IdentificacionCompraResultado;
}

export async function consultarUnidades(
  db: SupabaseClient, datos: ConsultaUnidadesInput
): Promise<IdentificacionCompraResultado> {
  const { data, error } = await db.rpc('hu002_consultar_unidades', datos);
  if (error) throw error;
  return data as IdentificacionCompraResultado;
}

