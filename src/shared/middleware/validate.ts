import type { RequestHandler } from 'express';
import type { ZodTypeAny, z } from 'zod';

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

/** Valida e substitui body/params pelo resultado do Zod (com coerção e defaults). A query validada vai em `req.validatedQuery`. */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) (req as { validatedQuery?: unknown }).validatedQuery = schemas.query.parse(req.query);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
