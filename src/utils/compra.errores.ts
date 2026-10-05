import { Response } from 'express';

import { ErrorHttp } from './errores';

export function responderErrorCompra(
  res: Response,
  error: unknown
) {
  if (error instanceof ErrorHttp) {
    return res.status(error.status).json({
      ok: false,
      message: error.message
    });
  }

  const codigo = (error as { code?: string })?.code ?? '';

  const errores: Record<string, [number, string]> = {
    '42501': [
      403,
      'No tienes permisos para realizar esta operación de compras'
    ],
    PT400: [
      400,
      'Revisa modelo, color, cantidad y clave del intento'
    ],
    PT404: [
      404,
      'La compra no existe'
    ],
    PT422: [
      400,
      'El modelo seleccionado no existe'
    ],
    PT409: [
      409,
      'La clave del intento ya fue utilizada con otros datos o por otro usuario'
    ],
    '23514': [
      400,
      'Los datos no cumplen las restricciones de la compra'
    ],
    '23503': [
      400,
      'El modelo o usuario relacionado no existe'
    ],
    '23505': [
      409,
      'La compra entra en conflicto con un registro existente'
    ]
  };

  const [status, message] = errores[codigo] ?? [
    500,
    'Error interno al procesar la compra'
  ];

  return res.status(status).json({
    ok: false,
    message
  });
}