import { Module } from '@nestjs/common'
import { OrganizationModule } from '../organization/organization.module'
import { ClientsController } from './clients.controller'
import { ClientsService } from './clients.service'

@Module({
  imports: [OrganizationModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
