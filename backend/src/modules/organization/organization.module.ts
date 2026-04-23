import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { OrganizationContextService } from './organization-context.service'
import { OrganizationController } from './organization.controller'
import { OrganizationService } from './organization.service'

@Module({
  imports: [AuthModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationContextService],
  exports: [OrganizationService, OrganizationContextService],
})
export class OrganizationModule {}
