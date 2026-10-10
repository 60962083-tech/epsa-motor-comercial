import { ErrorHttp } from './errores';
import { validarIdCompra } from './compra.validacion';
import { COLORES_LEAD, ESTADOS_LEAD } from '../types/lead.types';
import type { LeadManualInput } from '../types/lead.types';

export function validarLeadManual(body: unknown): LeadManualInput {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  const datos = body as Record<string, unknown>;
  const permitidos = ['nomlea', 'tellea', 'codmod', 'collea', 'canlea', 'orilea', 'codcwa',
    'codsed', 'codusu', 'estlea', 'fecprosle', 'obslea', 'nueva_oportunidad'];
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);

  function texto(campo: string, maximo: number, obligatorio = false): string | null {
    const valor = datos[campo];
    if (valor === undefined || valor === null) {
      if (obligatorio) throw new ErrorHttp(400, `${campo} es obligatorio`);
      return null;
    }
    if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} debe ser texto`);
    const limpio = valor.trim().replace(/\s+/g, ' ');
    if ([...limpio].length > maximo) throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
    if (!limpio && obligatorio) throw new ErrorHttp(400, `${campo} es obligatorio`);
    return limpio || null;
  }
  function id(campo: string, obligatorio = false): string | null {
    const valor = datos[campo];
    if (valor === undefined || valor === null) {
      if (obligatorio) throw new ErrorHttp(400, `${campo} es obligatorio`);
      return null;
    }
    return validarIdCompra(valor, campo);
  }

  const nomlea = texto('nomlea', 150, true)!;
  // No inferir país: se eliminan separadores y el + inicial; se conservan los dígitos.
  if (typeof datos.tellea !== 'string' || !/^\+?[0-9\s().-]+$/.test(datos.tellea.trim()))
    throw new ErrorHttp(400, 'tellea debe ser un móvil válido de 7 a 15 dígitos');
  const tellea = datos.tellea.replace(/\D/g, '');
  if (!/^\d{7,15}$/.test(tellea)) throw new ErrorHttp(400, 'tellea debe ser un móvil válido de 7 a 15 dígitos');
  const codmod = id('codmod', true)!;
  // La RPC exige responsable salvo ausencia activada por una fuente server-side.
  const codusu = id('codusu');
  const codsed = id('codsed');
  const codcwa = id('codcwa');
  let canlea = texto('canlea', 50, true)!;
  if (canlea.toLowerCase() === 'presencial') canlea = 'Presencial';
  if (canlea.toLowerCase() === 'whatsapp') canlea = 'WhatsApp';
  if (canlea === 'Presencial' && !codsed) throw new ErrorHttp(400, 'codsed es obligatorio para Presencial');
  if (canlea === 'WhatsApp' && !codcwa) throw new ErrorHttp(400, 'codcwa es obligatorio para WhatsApp');
  const orilea = texto('orilea', 30);
  if (orilea?.toLowerCase() === 'manual') throw new ErrorHttp(400, 'Manual es tipo de registro, no origen comercial');
  const color = texto('collea', 50);
  const collea = color ? COLORES_LEAD.find(c => c.toLowerCase() === color.toLowerCase()) : null;
  if (color && !collea) throw new ErrorHttp(400, 'collea debe ser Rojo, Azul, Amarillo, Verde o Negro');
  const estlea = texto('estlea', 50, true)!;
  if (!ESTADOS_LEAD.includes(estlea as typeof ESTADOS_LEAD[number]) || estlea === 'Convertido')
    throw new ErrorHttp(400, 'estlea debe ser Nuevo, Contactado, En seguimiento o Cerrado');
  if (estlea === 'Cerrado' && datos.fecprosle !== undefined && datos.fecprosle !== null)
    throw new ErrorHttp(400, 'Un lead Cerrado no debe tener próximo seguimiento');
  let fecprosle: string | null = null;
  if (datos.fecprosle !== undefined && datos.fecprosle !== null) {
    const fecha = datos.fecprosle;
    // Zona horaria explícita para que el instante no dependa del equipo que envía la petición.
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(fecha))
      throw new ErrorHttp(400, 'fecprosle debe ser una fecha ISO con zona horaria');
    const instante = Date.parse(fecha);
    const dia = fecha.slice(0, 10);
    if (!Number.isFinite(instante) || new Date(`${dia}T00:00:00Z`).toISOString().slice(0, 10) !== dia || instante < Date.now())
      throw new ErrorHttp(400, 'fecprosle debe ser una fecha válida que no esté en el pasado');
    fecprosle = new Date(instante).toISOString();
  }
  // La RPC decide si un activo admite NULL según la fuente server-side de ausencia.
  if (datos.nueva_oportunidad !== undefined && typeof datos.nueva_oportunidad !== 'boolean')
    throw new ErrorHttp(400, 'nueva_oportunidad debe ser boolean');
  return {
    p_nomlea: nomlea, p_tellea: tellea, p_codmod: codmod, p_codusu: codusu, p_canlea: canlea,
    p_estlea: estlea as LeadManualInput['p_estlea'], p_fecprosle: fecprosle,
    p_collea: collea ?? null, p_orilea: orilea, p_codsed: codsed, p_codcwa: codcwa,
    p_obslea: texto('obslea', 10000), p_nueva_oportunidad: datos.nueva_oportunidad ?? false
  };
}
