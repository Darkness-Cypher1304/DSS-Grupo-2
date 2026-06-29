import { Module } from '@nestjs/common';
import { MchatController } from './mchat.controller';
import { MchatService } from './mchat.service';

@Module({
  controllers: [MchatController],
  providers: [MchatService],
})
export class MchatModule {}
