import { NextFunction, Request, Response } from 'express';

export function parseJson(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body.data) {
    try {
      const parsed = JSON.parse(req.body.data);
      req.body = { ...req.body, ...parsed };
      delete req.body.data;
    } catch {
      res.status(400).json({ error: 'Invalid JSON in data field' });
      return;
    }
  }
  next();
}
