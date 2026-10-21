import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({ imports: [CommonModule, NotificationsModule], controllers: [MessagingController], providers: [MessagingService] })
export class MessagingModule {}
