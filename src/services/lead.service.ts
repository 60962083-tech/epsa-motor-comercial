import type { SupabaseClient } from '@supabase/supabase-js';
import type { LeadManualInput, LeadManualResultado } from '../types/lead.types';

export async function registrarLeadManual(db: SupabaseClient, datos: LeadManualInput): Promise<LeadManualResultado> {
  const { data, error } = await db.rpc('hu014_registrar_lead_manual', datos);
  if (error) throw error;
  return data as LeadManualResultado;
}
