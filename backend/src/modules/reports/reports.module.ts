import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { OrganizationModule } from '../organization/organization.module'
import { ReportsController } from './reports.controller'
import { ReportsService } from './reports.service'

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
