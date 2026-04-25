import { Module } from '@nestjs/common'
import { OrganizationModule } from '../organization/organization.module'
import { ProjectsController } from './projects.controller'
import { ProjectsService } from './projects.service'

@Module({
  imports: [OrganizationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
