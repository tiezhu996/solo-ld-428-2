import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

import { jwtConfig } from '../config/jwt.config';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request & { user?: unknown }, _res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        req.user = jwt.verify(token, jwtConfig.secret);
      } catch {
        req.user = { id: 'anonymous', role: 'Viewer' };
      }
    } else {
      req.user = { id: 'anonymous', role: 'Viewer' };
    }
    next();
  }
}
