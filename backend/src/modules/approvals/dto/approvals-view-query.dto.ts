import { IsIn, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator'

const STATUS_IN = ['UNSUBMITTED', 'SUBMITTED', 'APPROVED', 'ALL'] as const
export const APPROVALS_STATUS_VALUES = STATUS_IN

/**
 * Approvals list query: `from`/`to` are computed on the client from `ReportPeriod` and navigation.
 * `entryStatus` is `ALL` or an `EntryStatus` value.
 */
export class ApprovalsViewQueryDto {
  @IsString()
  @IsNotEmpty()
  from!: string

  @IsString()
  @IsNotEmpty()
  to!: string

  @IsOptional()
  @IsIn(STATUS_IN)
  entryStatus?: (typeof STATUS_IN)[number]

  @IsString()
  @IsIn(['PERSON', 'PROJECT', 'CLIENT'])
  groupBy!: 'PERSON' | 'PROJECT' | 'CLIENT'

  @IsOptional()
  @IsString()
  clientIds?: string

  @IsOptional()
  @IsString()
  projectIds?: string

  @IsOptional()
  @IsString()
  roleIds?: string

  @IsOptional()
  @IsString()
  userIds?: string
}

function splitIds(raw?: string): string[] {
  if (!raw?.trim()) {
    return []
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export class ApprovalsApproveGroupBodyDto extends ApprovalsViewQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID('4')
  groupId!: string
}

function isUuidList(ids: string[]): boolean {
  const re =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return ids.every((id) => re.test(id))
}

export function parseUuidList(
  param: 'clientIds' | 'projectIds' | 'roleIds' | 'userIds',
  raw: string | undefined,
): { ok: true; ids: string[] } | { ok: false; message: string } {
  const ids = splitIds(raw)
  if (ids.length === 0) {
    return { ok: true, ids: [] }
  }
  if (!isUuidList(ids)) {
    return { ok: false, message: `${param} contains an invalid id` }
  }
  return { ok: true, ids }
}
