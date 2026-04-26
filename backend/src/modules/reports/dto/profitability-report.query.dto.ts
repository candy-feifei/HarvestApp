import { Transform } from 'class-transformer'
import { IsIn, IsOptional, IsString, Matches } from 'class-validator'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export class ProfitabilityReportQueryDto {
  @Matches(YMD, { message: 'fromYmd must be YYYY-MM-DD' })
  fromYmd: string

  @Matches(YMD, { message: 'toYmd must be YYYY-MM-DD' })
  toYmd: string

  @IsIn(['clients', 'projects', 'tasks', 'team'], {
    message: 'groupBy must be clients, projects, tasks, or team',
  })
  groupBy: 'clients' | 'projects' | 'tasks' | 'team'

  @IsOptional()
  @IsString()
  currency?: string

  @IsOptional()
  @IsString()
  projectStatuses?: string

  @IsOptional()
  @IsString()
  projectTypes?: string

  @IsOptional()
  @IsString()
  projectManagerUserIds?: string
}
