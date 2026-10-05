import { ErrorHttp } from './errores';

import type {
  CompraPendienteInput,
  PaginacionCompra
} from '../types/compra.types';

export function validarIdCompra(
  valor: unknown,
  campo = 'codcom'
): string {
  const texto =
    typeof valor === 'number' && Number.isSafeInteger(valor)
      ? String(valor)
      : valor;

  if (
    typeof texto !== 'string' ||
    !/^[1-9]\d*$/.test(texto) ||
    BigInt(texto) > 9223372036854775807n
  ) {
    throw new ErrorHttp(
      400,
      `${campo} debe ser un identificador entero positivo válido`
    );
  }

  return texto;
}

export function validarCompra(
  body: unknown,
  clave: unknown
): CompraPendienteInput {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body)
  ) {
    throw new ErrorHttp(
      400,
      'El cuerpo debe ser un objeto JSON'
    );
  }

  const datos = body as Record<string, unknown>;

  const camposPermitidos = [
    'codmod',
    'colcom',
    'cancom'
  ];

  const extra = Object.keys(datos).find(
    campo => !camposPermitidos.includes(campo)
  );

  if (extra) {
    throw new ErrorHttp(
      400,
      `Campo no permitido: ${extra}. El autor, fecha, hora y estado son automáticos`
    );
  }

  const codmod = validarIdCompra(
    datos.codmod,
    'codmod'
  );

  if (
    typeof datos.colcom !== 'string' ||
    !datos.colcom.trim()
  ) {
    throw new ErrorHttp(
      400,
      'colcom es obligatorio y debe ser texto'
    );
  }

  const colcom = datos.colcom
    .trim()
    .replace(/\s+/g, ' ');

  if ([...colcom].length > 50) {
    throw new ErrorHttp(
      400,
      'colcom admite hasta 50 caracteres'
    );
  }

  if (
    typeof datos.cancom !== 'number' ||
    !Number.isInteger(datos.cancom) ||
    datos.cancom < 1 ||
    datos.cancom > 2147483647
  ) {
    throw new ErrorHttp(
      400,
      'cancom debe ser un entero positivo hasta 2147483647'
    );
  }

  if (
    typeof clave !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      clave
    )
  ) {
    throw new ErrorHttp(
      400,
      'Idempotency-Key es obligatorio y debe ser un UUID'
    );
  }

  return {
    p_codmod: codmod,
    p_colcom: colcom,
    p_cancom: datos.cancom,
    p_idempotencia: clave.toLowerCase()
  };
}

export function validarPaginacion(
  query: Record<string, unknown>
): PaginacionCompra {
  function entero(
    valor: unknown,
    defecto: number,
    minimo: number,
    maximo: number,
    campo: string
  ): number {
    if (valor === undefined) {
      return defecto;
    }

    if (
      typeof valor !== 'string' ||
      !/^\d+$/.test(valor) ||
      !Number.isSafeInteger(Number(valor)) ||
      Number(valor) < minimo ||
      Number(valor) > maximo
    ) {
      throw new ErrorHttp(
        400,
        `${campo} fuera de rango`
      );
    }

    return Number(valor);
  }

  return {
    p_limite: entero(
      query.limite,
      50,
      1,
      100,
      'limite'
    ),
    p_offset: entero(
      query.offset,
      0,
      0,
      2147483647,
      'offset'
    )
  };
}