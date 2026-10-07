import { SupabaseClient } from '@supabase/supabase-js';

import type {
  CompraPendienteInput,
  CompraPendienteResultado,
  PaginacionCompra
} from '../types/compra.types';

export async function registrarCompra(
  db: SupabaseClient,
  datos: CompraPendienteInput
): Promise<CompraPendienteResultado> {
  const { data, error } = await db.rpc(
    'hu034_registrar_compra',
    datos
  );

  if (error) {
    throw error;
  }

  return data as CompraPendienteResultado;
}

export async function listarComprasPendientes(
  db: SupabaseClient,
  paginacion: PaginacionCompra
) {
  const { data, error } = await db.rpc(
    'hu034_listar_pendientes',
    paginacion
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function obtenerCompra(
  db: SupabaseClient,
  codcom: string
) {
  const { data, error } = await db.rpc(
    'hu034_obtener_compra',
    {
      p_codcom: codcom
    }
  );

  if (error) {
    throw error;
  }

  return data;
}