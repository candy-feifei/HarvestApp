import { Module } from '@nestjs/common'
import { OrganizationModule } from '../organization/organization.module'
import { PrismaModule } from '../../prisma/prisma.module'
import {
  ExpenseCategoriesController,
  ExpensesController,
} from './expenses.controller'
import { ExpensesService } from './expenses.service'

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
