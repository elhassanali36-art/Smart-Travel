import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({ imports: [CommonModule, NotificationsModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
