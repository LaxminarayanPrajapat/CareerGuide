import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  search: z.string().trim().max(120).optional(),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export interface PaginationOptions {
  page: number;
  limit: number;
  skip: number;
}

export function toPaginationOptions(query: PaginationQuery): PaginationOptions {
  return { page: query.page, limit: query.limit, skip: (query.page - 1) * query.limit };
}

/** Escapes a user supplied string so it can be used inside a RegExp safely. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
