import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AsignarResponsableLeadInput,
  AsignarResponsableLeadResultado,
  LeadGestion,
  PaginacionLeads,
  ResponsableLead
} from '../types/lead.asignacion.types';

export async function listarLeadsGestion(db: SupabaseClient, paginacion: PaginacionLeads): Promise<LeadGestion[]> {
  const { data, error } = await db.rpc('hu015_listar_leads', paginacion);
  if (error) throw error;
  return data as LeadGestion[];
}

export async function listarResponsablesLead(db: SupabaseClient): Promise<ResponsableLead[]> {
  const { data, error } = await db.rpc('hu015_listar_responsables');
  if (error) throw error;
  return data as ResponsableLead[];
}

export async function asignarResponsableLead(
  db: SupabaseClient,
  datos: AsignarResponsableLeadInput
): Promise<AsignarResponsableLeadResultado> {
  const { data, error } = await db.rpc('hu015_asignar_responsable_lead', datos);
  if (error) throw error;
  return data as AsignarResponsableLeadResultado;
}
