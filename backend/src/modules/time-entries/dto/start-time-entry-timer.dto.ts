import { IsOptional, IsString, Matches } from 'class-validator'

export class StartTimeEntryTimerDto {
  @IsString()
  projectTaskId!: string

  /** YYYY-MM-DD（按 UTC 当天 00:00 归档） */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string

  @IsOptional()
  @IsString()
  notes?: string
}

