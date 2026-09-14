import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const writeRoles = new Set(['Admin', 'Curator', 'Artist']);

@Injectable()
export class RbacMiddleware implements NestMiddleware {
  use(req: Request & { user?: { role?: string } }, _res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.path.includes('/interactions')) return next();
    if (!writeRoles.has(req.user?.role ?? 'Viewer')) {
      throw new ForbiddenException('Viewer 只能浏览和互动。');
    }
    next();
  }
}
