import type { Response } from 'express';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface ApiResponseBody<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: ApiMeta;
}

export function ok<T>(res: Response, data: T, message = 'OK', meta?: ApiMeta): Response {
  const body: ApiResponseBody<T> = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T, message = 'Created'): Response {
  return res.status(201).json({ success: true, message, data });
}

export function accepted<T>(res: Response, data: T, message = 'Accepted'): Response {
  return res.status(202).json({ success: true, message, data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginationMeta(page: number, limit: number, total: number): ApiMeta {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
