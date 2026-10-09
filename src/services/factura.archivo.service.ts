import type { SupabaseClient } from '@supabase/supabase-js';
import { consultarUnidades } from './unidad.service';
import { ErrorHttp } from '../utils/errores';

const BUCKET = 'facturas-compra';
const EXPIRA_EN = 60;
const ruta = (codcom: string) => `compras/${codcom}/factura.pdf`;

async function comprobarFactura(db: SupabaseClient, codcom: string) {
  // HU-002 ya comprueba la compra y proyecta la factura sin acceso directo a tablas.
  const compra = await consultarUnidades(db, { p_codcom: codcom });
  if (!compra) throw new ErrorHttp(404, 'La compra no existe');
  if (!compra.factura) throw new ErrorHttp(404, 'La compra no tiene factura registrada');
}

function errorStorage(error: unknown, subida = false): never {
  const detalle = error as { status?: number; statusCode?: string; code?: string; error?: string };
  const codigos = [detalle?.code, detalle?.error, detalle?.statusCode];
  if (subida && (detalle?.status === 409 || codigos.some(c =>
    ['409', 'Duplicate', 'ResourceAlreadyExists', 'KeyAlreadyExists'].includes(c ?? '')))) {
    throw new ErrorHttp(409, 'La factura ya tiene un archivo');
  }
  if (detalle?.status === 403 || codigos.some(c => ['403', 'AccessDenied', 'Unauthorized'].includes(c ?? ''))) {
    throw new ErrorHttp(403, 'No tienes permisos para acceder al archivo de factura');
  }
  if (!subida && codigos.some(c => ['NoSuchKey', 'ObjectNotFound'].includes(c ?? ''))) {
    throw new ErrorHttp(404, 'La factura no tiene un archivo PDF');
  }
  throw new ErrorHttp(500, 'Error al procesar el archivo de factura');
}

async function existeArchivo(db: SupabaseClient, codcom: string) {
  try {
    const { data, error } = await db.storage.from(BUCKET).list(`compras/${codcom}`, {
      search: 'factura.pdf', limit: 1
    });
    if (error) errorStorage(error);
    return (data ?? []).some(archivo => archivo.name === 'factura.pdf');
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    errorStorage(error);
  }
}

export async function adjuntarPdfFactura(db: SupabaseClient, codcom: string, buffer: Buffer) {
  await comprobarFactura(db, codcom);
  if (await existeArchivo(db, codcom)) throw new ErrorHttp(409, 'La factura ya tiene un archivo');
  try {
    const { error } = await db.storage.from(BUCKET).upload(ruta(codcom), buffer, {
      contentType: 'application/pdf', upsert: false
    });
    // También cubre dos subidas simultáneas: Storage decide cuál es la primera.
    if (error) errorStorage(error, true);
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    errorStorage(error, true);
  }
  return { codcom, archivo_adjuntado: true, nombre: 'factura.pdf' };
}

export async function consultarPdfFactura(db: SupabaseClient, codcom: string) {
  await comprobarFactura(db, codcom);
  return { codcom, archivo_adjuntado: await existeArchivo(db, codcom) };
}

export async function obtenerUrlPdfFactura(db: SupabaseClient, codcom: string) {
  await comprobarFactura(db, codcom);
  if (!await existeArchivo(db, codcom)) throw new ErrorHttp(404, 'La factura no tiene un archivo PDF');
  try {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(ruta(codcom), EXPIRA_EN);
    if (error) errorStorage(error);
    if (!data?.signedUrl) throw new ErrorHttp(500, 'Error al procesar el archivo de factura');
    return { url: data.signedUrl, expira_en: EXPIRA_EN };
  } catch (error) {
    if (error instanceof ErrorHttp) throw error;
    errorStorage(error);
  }
}
