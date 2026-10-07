import { ErrorHttp } from './errores';
import { validarIdCompra } from './compra.validacion';
import type {
  ConsultaUnidadesInput, FacturaCompraInput, IdentificacionCompraInput,
  UnidadIdentificacionInput
} from '../types/unidad.types';

function objeto(valor: unknown, permitidos: string[]): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorHttp(400, 'Se requiere un objeto JSON');
  const datos = valor as Record<string, unknown>;
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
  return datos;
}

function texto(valor: unknown, campo: string, maximo: number): string {
  if (typeof valor !== 'string' || !valor.trim())
    throw new ErrorHttp(400, `${campo} es obligatorio y debe ser texto`);
  const normalizado = valor.trim().replace(/\s+/g, ' ');
  if ([...normalizado].length > maximo)
    throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
  return normalizado;
}

function cantidad(valor: unknown, campo: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > 2147483647)
    throw new ErrorHttp(400, `${campo} debe ser un entero positivo`);
  return valor;
}

export function validarConsultaUnidades(id: unknown): ConsultaUnidadesInput {
  return { p_codcom: validarIdCompra(id) };
}

export function validarFactura(id: unknown, body: unknown): FacturaCompraInput {
  const datos = objeto(body, ['emisor', 'numero', 'fecha_emision', 'cantidad_motos']);
  const fecha = datos.fecha_emision;
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      fecha < '0001-01-01' || !Number.isFinite(Date.parse(fecha)) ||
      new Date(fecha).toISOString().slice(0, 10) !== fecha)
    throw new ErrorHttp(400, 'fecha_emision debe ser una fecha válida YYYY-MM-DD');
  return {
    p_codcom: validarIdCompra(id),
    p_emisor: texto(datos.emisor, 'emisor', 160),
    p_numero: texto(datos.numero, 'numero', 80),
    p_fecha_emision: fecha,
    p_cantidad_motos: cantidad(datos.cantidad_motos, 'cantidad_motos')
  };
}

export function validarIdentificacion(id: unknown, body: unknown): IdentificacionCompraInput {
  const datos = objeto(body, ['unidades']);
  if (!Array.isArray(datos.unidades) || datos.unidades.length < 1 || datos.unidades.length > 100)
    throw new ErrorHttp(400, 'unidades debe contener de 1 a 100 motos');
  const motores = new Set<string>();
  const chasis = new Set<string>();
  const unidades: UnidadIdentificacionInput[] = datos.unidades.map(valor => {
    const unidad = objeto(valor, ['nummotuni', 'chauni', 'codmod', 'coluni']);
    const motor = texto(unidad.nummotuni, 'nummotuni', 100).toUpperCase();
    const chasisNormalizado = texto(unidad.chauni, 'chauni', 100).toUpperCase();
    if (motores.has(motor) || chasis.has(chasisNormalizado))
      throw new ErrorHttp(409, 'Motor o chasis repetido dentro del lote');
    motores.add(motor);
    chasis.add(chasisNormalizado);
    return {
      nummotuni: motor,
      chauni: chasisNormalizado,
      codmod: validarIdCompra(unidad.codmod, 'codmod'),
      coluni: texto(unidad.coluni, 'coluni', 50)
    };
  });
  return {
    p_codcom: validarIdCompra(id),
    p_unidades: unidades
  };
}

