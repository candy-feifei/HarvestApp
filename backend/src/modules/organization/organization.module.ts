import { Module } from '@nestjs/common'
import { OrganizationContextService } from './organization-context.service'
import { OrganizationController } from './organization.controller'
import { OrganizationService } from './organization.service'

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationContextService],
  exports: [OrganizationService, OrganizationContextService],
})
export class OrganizationModule {}
