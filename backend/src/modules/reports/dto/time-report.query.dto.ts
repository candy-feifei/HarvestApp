import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator'

const YMD = /^\d{4}-\d{2}-\d{2}$/

export class TimeReportQueryDto {
  @Matches(YMD, { message: 'fromYmd must be YYYY-MM-DD' })
  fromYmd: string

  @Matches(YMD, { message: 'toYmd must be YYYY-MM-DD' })
  toYmd: string

  @IsIn(['clients', 'projects', 'tasks', 'team'], {
    message: 'groupBy must be clients, projects, tasks, or team',
  })
  groupBy: 'clients' | 'projects' | 'tasks' | 'team'

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeProjectsOnly = true

  @IsOptional()
  @IsString()
  clientIds?: string

  @IsOptional()
  @IsString()
  projectIds?: string

  @IsOptional()
  @IsString()
  userIds?: string

  @IsOptional()
  @IsString()
  taskIds?: string
}
