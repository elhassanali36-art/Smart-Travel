import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({ imports: [CommonModule, NotificationsModule], controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
