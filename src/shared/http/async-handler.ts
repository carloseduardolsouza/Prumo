import type { Request, RequestHandler, Response } from 'express';

export type Handler = (req: Request, res: Response) => Promise<void>;

/** O Express 4 não captura rejeições de handlers async: repassa o erro ao error handler global. */
export const asyncHandler = (fn: Handler): RequestHandler => (req, res, next) => {
  fn(req, res).catch(next);
};
