import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { DestinationsModule } from './destinations/destinations.module';
import { ExperiencesModule } from './experiences/experiences.module';
import { MatchingModule } from './matching/matching.module';
import { TripsModule } from './trips/trips.module';
import { BookingsModule } from './bookings/bookings.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ReportsModule } from './reports/reports.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [CommonModule, AuthModule, ProfilesModule, DestinationsModule, ExperiencesModule, MatchingModule, TripsModule, BookingsModule, MessagingModule, NotificationsModule, AdminModule, AnalyticsModule, AiModule, ReviewsModule, ReportsModule],
  controllers: [HealthController],
})
export class AppModule {}
