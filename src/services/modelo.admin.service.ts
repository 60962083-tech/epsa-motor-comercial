import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModeloAdministrativo } from '../types/modelo.types';
import type { ActualizarImagenModeloInput, CambiosModeloInput, CrearImagenModeloInput, CrearModeloInput, EstadoImagenModeloInput, EstadoModeloInput } from '../types/modelo.admin.types';
import type { ImagenModeloAdministrativa } from '../types/modelo.types';

export async function listarModelosAdmin(db: SupabaseClient): Promise<ModeloAdministrativo[]> {
  const { data, error } = await db.rpc('hu012_modelos_admin');
  if (error) throw error;
  return data ?? [];
}

export async function crearModelo(db: SupabaseClient, modelo: CrearModeloInput): Promise<ModeloAdministrativo> {
  const { data, error } = await db.rpc('hu012_crear_modelo', {
    p_codtmo: modelo.codtmo,
    p_nommod: modelo.nommod,
    p_marmod: modelo.marmod,
    p_desmod: modelo.desmod,
    p_carmod: modelo.carmod,
    p_premod: modelo.premod,
    p_colores: modelo.colores,
    p_estmod: modelo.estmod
  });
  if (error) throw error;
  return data as ModeloAdministrativo;
}

export async function actualizarModelo(db: SupabaseClient, codmod: string, cambios: CambiosModeloInput): Promise<ModeloAdministrativo> {
  const { data, error } = await db.rpc('hu012_actualizar_modelo', { p_codmod: codmod, p_cambios: cambios });
  if (error) throw error;
  return data as ModeloAdministrativo;
}

export async function cambiarEstadoModelo(db: SupabaseClient, codmod: string, body: EstadoModeloInput): Promise<ModeloAdministrativo> {
  const { data, error } = await db.rpc('hu012_cambiar_estado_modelo', { p_codmod: codmod, p_estmod: body.estmod });
  if (error) throw error;
  return data as ModeloAdministrativo;
}

export async function agregarImagenModelo(db: SupabaseClient, codmod: string, imagen: CrearImagenModeloInput): Promise<ImagenModeloAdministrativa> {
  const { data, error } = await db.rpc('hu012_agregar_imagen_modelo', {
    p_codmod: codmod,
    p_urlimo: imagen.urlimo,
    p_ordimo: imagen.ordimo
  });
  if (error) throw error;
  return data as ImagenModeloAdministrativa;
}

export async function actualizarImagenModelo(db: SupabaseClient, codmod: string, codimo: string, imagen: ActualizarImagenModeloInput): Promise<ImagenModeloAdministrativa> {
  const { data, error } = await db.rpc('hu012_actualizar_imagen_modelo', {
    p_codmod: codmod,
    p_codimo: codimo,
    p_urlimo: imagen.urlimo,
    p_ordimo: imagen.ordimo
  });
  if (error) throw error;
  return data as ImagenModeloAdministrativa;
}

export async function cambiarEstadoImagenModelo(db: SupabaseClient, codmod: string, codimo: string, body: EstadoImagenModeloInput): Promise<ImagenModeloAdministrativa> {
  const { data, error } = await db.rpc('hu012_cambiar_estado_imagen_modelo', {
    p_codmod: codmod,
    p_codimo: codimo,
    p_estimo: body.estimo
  });
  if (error) throw error;
  return data as ImagenModeloAdministrativa;
}
