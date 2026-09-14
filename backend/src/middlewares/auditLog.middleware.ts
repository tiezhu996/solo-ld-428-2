import { InjectModel } from '@nestjs/mongoose';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Model } from 'mongoose';

import { AuditLog, AuditLogDocument } from '../models/auditLog.schema';

@Injectable()
export class AuditLogMiddleware implements NestMiddleware {
  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

  use(req: Request & { user?: { id?: string } }, res: Response, next: NextFunction) {
    res.on('finish', () => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        void this.auditModel.create({
          actorId: req.user?.id ?? 'anonymous',
          action: `${req.method} ${res.statusCode}`,
          path: req.path,
          method: req.method,
        });
      }
    });
    next();
  }
}
