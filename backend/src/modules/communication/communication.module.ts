import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NewsletterModule } from '../newsletter/newsletter.module';
import { NotificationModule } from '../notification/notification.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [MailModule, NewsletterModule, NotificationModule, WebhookModule],
  exports: [MailModule, NewsletterModule, NotificationModule, WebhookModule],
})
export class CommunicationModule {}
