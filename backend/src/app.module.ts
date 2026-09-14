import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { databaseConfig } from './config/database.config';
import { ArtistController } from './controllers/artist.controller';
import { ArtworkController } from './controllers/artwork.controller';
import { ExhibitionController } from './controllers/exhibition.controller';
import { InteractionController } from './controllers/interaction.controller';
import { Artist, ArtistSchema } from './models/artist.schema';
import { Artwork, ArtworkSchema } from './models/artwork.schema';
import { AuditLog, AuditLogSchema } from './models/auditLog.schema';
import { Exhibition, ExhibitionSchema } from './models/exhibition.schema';
import { Interaction, InteractionSchema } from './models/interaction.schema';
import { ReviewLog, ReviewLogSchema } from './models/reviewLog.schema';
import { ArtistService } from './services/artist.service';
import { ArtworkService } from './services/artwork.service';
import { ExhibitionService } from './services/exhibition.service';
import { InteractionService } from './services/interaction.service';
import { ReviewService } from './services/review.service';
import { AuthMiddleware } from './middlewares/auth.middleware';
import { AuditLogMiddleware } from './middlewares/auditLog.middleware';
import { ContentReviewMiddleware } from './middlewares/contentReview.middleware';
import { RbacMiddleware } from './middlewares/rbac.middleware';
import { RequestLoggerMiddleware } from './middlewares/requestLogger.middleware';

@Module({
  imports: [
    MongooseModule.forRoot(databaseConfig.uri),
    MongooseModule.forFeature([
      { name: Artwork.name, schema: ArtworkSchema },
      { name: Exhibition.name, schema: ExhibitionSchema },
      { name: Artist.name, schema: ArtistSchema },
      { name: Interaction.name, schema: InteractionSchema },
      { name: ReviewLog.name, schema: ReviewLogSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
  ],
  controllers: [ArtworkController, ExhibitionController, ArtistController, InteractionController],
  providers: [ArtworkService, ExhibitionService, ArtistService, InteractionService, ReviewService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware, AuthMiddleware, RbacMiddleware, ContentReviewMiddleware, AuditLogMiddleware).forRoutes('*');
  }
}
