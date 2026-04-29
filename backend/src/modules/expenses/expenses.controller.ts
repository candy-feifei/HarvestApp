import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator'
import { OrganizationContextService } from '../organization/organization-context.service'
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ListExpenseQueryDto } from './dto/list-expense-query.dto'
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto'
import { UpdateExpenseDto } from './dto/update-expense.dto'
import { SubmitWeekDto } from '../time-entries/dto/submit-week.dto'
import { ExpensesService } from './expenses.service'

@ApiTags('expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Get('form-options')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Project/category options and default currency' })
  async formOptions(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.getFormOptions(m)
  }

  @Get()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'List expenses (filter by member and date)' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Query() query: ListExpenseQueryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.list(m, user, query)
  }

  @Post('submit-week')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Submit unsubmitted expenses in an ISO week for manager approval' })
  async submitWeek(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() body: SubmitWeekDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.submitWeek(m, user, body)
  }

  @Post()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Create an expense' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateExpenseDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.create(m, user, dto)
  }

  @Patch(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Update own expense' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.update(m, user, id, dto)
  }

  @Delete(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Delete own unlocked expense' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.remove(m, user, id)
  }
}

@ApiTags('expense-categories')
@ApiBearerAuth()
@Controller('expense-categories')
export class ExpenseCategoriesController {
  constructor(
    private readonly orgContext: OrganizationContextService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Get()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'List expense categories (includes archived)' })
  async list(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.listCategories(m)
  }

  @Post()
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Create category (optional per-unit price)' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.createCategory(m, dto)
  }

  @Patch(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({ summary: 'Update or archive category' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.updateCategory(m, id, dto)
  }

  @Delete(':id')
  @ApiHeader({ name: 'X-Organization-Id', required: false })
  @ApiOperation({
    summary: 'Delete category (400 if linked expenses exist)',
  })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Headers('x-organization-id') xOrganizationId: string | undefined,
    @Param('id') id: string,
  ) {
    const m = await this.orgContext.getActiveMembership(
      user.userId,
      xOrganizationId,
    )
    return this.expensesService.removeCategory(m, id)
  }
}
