import { Module } from '@nestjs/common'
import { OrganizationModule } from '../organization/organization.module'
import { TimeEntriesController } from './time-entries.controller'
import { TimeEntriesService } from './time-entries.service'

@Module({
  imports: [OrganizationModule],
  controllers: [TimeEntriesController],
  providers: [TimeEntriesService],
})
export class TimeEntriesModule {}
