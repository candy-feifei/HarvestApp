import { Prisma } from '@prisma/client';

/** 与 seed / bcrypt.hash('demo123', 12) 需一致；e2e 使用 mock 时写死同盐哈希 */
export const DEMO_PASSWORD_HASH =
  '$2b$12$BiiODdj7unAjqc6hSpN5oOrglxzJb4GbEepiiz2ItS/eKBUDCEmE6';

export const E2E_USER_ID = 'user-e2e-1';
export const E2E_ORG_ID = 'org-e2e-1';

const e2eMembershipRow = {
  id: 'uorg-e2e-1',
  organizationId: E2E_ORG_ID,
  systemRole: 'ADMINISTRATOR' as const,
  user: {
    firstName: 'Demo',
    lastName: 'User',
    email: 'demo@harvest.app',
  },
  organization: {
    id: E2E_ORG_ID,
    name: 'E2E Org',
    defaultCurrency: 'USD',
  },
};

type TaskRow = {
  id: string;
  name: string;
  organizationId: string;
  isCommon: boolean;
  isArchived: boolean;
  isBillable: boolean;
  defaultHourlyRate: Prisma.Decimal | null;
};

/**
 * 供 e2e 覆写 Prisma：补全 `userOrganization`、任务相关表及 `expense` 等，
 * 使登录后的组织解析与业务查询链可跑通（无真实 DB）。
 */
export function createE2ePrismaMock() {
  const taskRows: TaskRow[] = [
    {
      id: 'task-common-1',
      name: 'Common A',
      organizationId: E2E_ORG_ID,
      isCommon: true,
      isArchived: false,
      isBillable: true,
      defaultHourlyRate: new Prisma.Decimal(50),
    },
    {
      id: 'task-other-1',
      name: 'Other B',
      organizationId: E2E_ORG_ID,
      isCommon: false,
      isArchived: false,
      isBillable: true,
      defaultHourlyRate: null,
    },
  ];

  const prismaMock = {
    onModuleInit: async () => {},
    onModuleDestroy: async () => {},
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    $queryRaw: jest
      .fn()
      .mockResolvedValue([
        { spent: new Prisma.Decimal(0), costs: new Prisma.Decimal(0) },
      ]),
    $transaction: jest.fn().mockImplementation((arg: unknown) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.resolve();
    }),
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest
        .fn()
        .mockImplementation(
          (args: { where: { email?: string; id?: string } }) => {
            const email = args?.where?.email;
            const id = args?.where?.id;
            if (email === 'demo@harvest.app' || id === E2E_USER_ID) {
              return Promise.resolve({
                id: E2E_USER_ID,
                email: 'demo@harvest.app',
                passwordHash: DEMO_PASSWORD_HASH,
                failedLoginCount: 0,
                lockedUntil: null,
                firstName: 'Demo',
                lastName: 'User',
              });
            }
            return Promise.resolve(null);
          },
        ),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ id: 'new' }),
    },
    userOrganization: {
      findFirst: jest
        .fn()
        .mockImplementation(
          (args: { where: Record<string, unknown> | undefined }) => {
            const w = args?.where;
            if (!w || w.status !== 'ACTIVE') {
              return Promise.resolve(null);
            }
            if (w.userId !== E2E_USER_ID) {
              return Promise.resolve(null);
            }
            if (
              typeof w.organizationId === 'string' &&
              w.organizationId !== E2E_ORG_ID
            ) {
              return Promise.resolve(null);
            }
            return Promise.resolve(e2eMembershipRow);
          },
        ),
      findMany: jest.fn().mockImplementation(
        (args: { where?: { organizationId?: string; status?: string } }) => {
          const w = args?.where;
          if (
            w?.organizationId === E2E_ORG_ID
            && w?.status === 'ACTIVE'
          ) {
            return Promise.resolve([
              {
                id: 'uorg-e2e-1',
                userId: E2E_USER_ID,
                organizationId: E2E_ORG_ID,
                systemRole: 'ADMINISTRATOR',
                weeklyCapacity: 40,
                employeeId: 'e1',
                employmentType: 'EMPLOYEE' as const,
                jobLabel: null,
                isPinned: false,
                user: {
                  id: E2E_USER_ID,
                  firstName: 'Demo',
                  lastName: 'User',
                  email: 'demo@harvest.app',
                  invitationStatus: 'ACTIVE',
                },
                rateHistories: [],
              },
            ]);
          }
          return Promise.resolve([]);
        },
      ),
      create: jest
        .fn()
        .mockImplementation(() => Promise.resolve(e2eMembershipRow)),
    },
    organization: {
      create: jest.fn().mockResolvedValue({ id: E2E_ORG_ID, name: 'x' }),
    },
    client: {
      findMany: jest.fn().mockImplementation(
        (args: { where?: { organizationId?: string } }) => {
          if (args?.where?.organizationId === E2E_ORG_ID) {
            return Promise.resolve([
              {
                id: 'client-e2e-1',
                name: 'Acme',
                _count: { contacts: 0 },
                contacts: [],
              },
            ]);
          }
          return Promise.resolve([]);
        },
      ),
      findFirst: jest
        .fn()
        .mockImplementation((args: Record<string, unknown>) => {
          const w = args.where as {
            id?: string;
            organizationId?: string;
            isArchived?: boolean;
          };
          if (
            w?.id === 'client-e2e-1'
            && w?.organizationId === E2E_ORG_ID
            && w?.isArchived === false
          ) {
            const inc = args.include as { projects?: unknown } | undefined;
            if (inc?.projects) {
              const now = new Date();
              return Promise.resolve({
                id: 'client-e2e-1',
                name: 'Acme',
                address: null,
                organizationId: E2E_ORG_ID,
                currency: 'USD',
                taxRate: null,
                secondaryTaxRate: null,
                discountRate: null,
                invoiceDueMode: 'UPON_RECEIPT' as const,
                invoiceNetDays: null,
                isArchived: false,
                createdAt: now,
                updatedAt: now,
                projects: [{ id: 'proj-e2e-1', name: 'E2E Project' }],
                _count: { projects: 1 },
              });
            }
            const sel = args.select as Record<string, boolean> | undefined;
            if (sel?.id === true) {
              return Promise.resolve({ id: 'client-e2e-1' });
            }
          }
          return Promise.resolve(null);
        }),
      create: jest
        .fn()
        .mockImplementation((args: { data: Record<string, unknown> }) => {
          const now = new Date();
          return Promise.resolve({
            id: `client-new-${Date.now()}`,
            name: args.data.name,
            address: args.data.address ?? null,
            organizationId: args.data.organizationId,
            currency: args.data.currency ?? null,
            taxRate: args.data.taxRate ?? null,
            secondaryTaxRate: args.data.secondaryTaxRate ?? null,
            discountRate: args.data.discountRate ?? null,
            invoiceDueMode: args.data.invoiceDueMode,
            invoiceNetDays: args.data.invoiceNetDays ?? null,
            isArchived: false,
            createdAt: now,
            updatedAt: now,
          });
        }),
      update: jest
        .fn()
        .mockImplementation(
          (args: { where: { id: string }; data: Record<string, unknown> }) => {
            const now = new Date();
            return Promise.resolve({
              id: args.where.id,
              name: args.data.name,
              address: args.data.address ?? null,
              organizationId: E2E_ORG_ID,
              currency: args.data.currency ?? null,
              taxRate: args.data.taxRate ?? null,
              secondaryTaxRate: args.data.secondaryTaxRate ?? null,
              discountRate: args.data.discountRate ?? null,
              invoiceDueMode: args.data.invoiceDueMode,
              invoiceNetDays: args.data.invoiceNetDays ?? null,
              isArchived: false,
              createdAt: now,
              updatedAt: now,
            });
          },
        ),
    },
    project: {
      findFirst: jest
        .fn()
        .mockImplementation(
          (args: { where: { id?: string; organizationId?: string } }) => {
            const w = args?.where;
            if (w?.id === 'proj-e2e-1' && w?.organizationId === E2E_ORG_ID) {
              const now = new Date();
              return Promise.resolve({
                id: 'proj-e2e-1',
                name: 'E2E Project',
                code: null,
                isBillable: true,
                billingMethod: 'TM' as const,
                hourlyRate: new Prisma.Decimal(100),
                fixedFee: null,
                budgetType: 'TOTAL_PROJECT_HOURS' as const,
                budgetAmount: null,
                notifyAt: null,
                isArchived: false,
                isPinned: false,
                startsOn: null,
                endsOn: null,
                notes: null,
                metadata: null,
                invoiceDueMode: 'UPON_RECEIPT' as const,
                invoiceNetDays: null,
                invoicePoNumber: null,
                invoiceTaxPercent: null,
                invoiceSecondTaxEnabled: false,
                invoiceSecondTaxPercent: null,
                invoiceDiscountPercent: null,
                createdAt: now,
                updatedAt: now,
                organizationId: E2E_ORG_ID,
                clientId: 'client-e2e-1',
                client: {
                  id: 'client-e2e-1',
                  name: 'Acme',
                  invoiceDueMode: 'UPON_RECEIPT' as const,
                  invoiceNetDays: null,
                  taxRate: null,
                  secondaryTaxRate: null,
                  discountRate: null,
                },
                projectTasks: [
                  {
                    taskId: 'task-other-1',
                    isBillable: true,
                    hourlyRate: new Prisma.Decimal(50),
                    task: { name: 'Other B' },
                  },
                ],
                assignments: [
                  {
                    userId: E2E_USER_ID,
                    isManager: true,
                    projectBillableRate: new Prisma.Decimal(80),
                    user: {
                      firstName: 'Demo',
                      lastName: 'User',
                      email: 'demo@harvest.app',
                    },
                  },
                ],
              });
            }
            return Promise.resolve(null);
          },
        ),
      findMany: jest.fn().mockImplementation((args: Record<string, unknown>) => {
        const w = args?.where as
          | {
              AND?: Array<{ organizationId?: string }>;
              organizationId?: string;
              isArchived?: boolean;
            }
          | undefined;
        if (w?.AND && Array.isArray(w.AND)) {
          const hasOrg = w.AND.some(
            (clause) =>
              clause
              && typeof clause === 'object'
              && clause.organizationId === E2E_ORG_ID,
          );
          const sel = args?.select as Record<string, boolean> | undefined;
          if (hasOrg && sel?.id === true) {
            return Promise.resolve([{ id: 'proj-e2e-1' }]);
          }
        }
        const wFlat = args?.where as
          | { organizationId?: string; isArchived?: boolean }
          | undefined;
        const orderBy = args?.orderBy as Record<string, unknown> | Record<string, unknown>[] | undefined;
        const include = args?.include as Record<string, unknown> | undefined;
        const obSingle = !Array.isArray(orderBy) ? orderBy : null;
        if (
          obSingle
          && 'updatedAt' in obSingle
          && include
          && typeof include.client === 'object'
        ) {
          const cs = (include.client as { select?: Record<string, unknown> }).select;
          if (cs && 'invoiceDueMode' in cs) {
            return Promise.resolve([]);
          }
        }
        if (Array.isArray(orderBy) && include && 'projectTasks' in include) {
          return Promise.resolve([
            {
              id: 'proj-e2e-1',
              name: 'E2E Project',
              clientId: 'client-e2e-1',
              client: { id: 'client-e2e-1', name: 'Acme' },
              projectTasks: [
                {
                  id: 'pt-e2e-1',
                  taskId: 'task-other-1',
                  task: { id: 'task-other-1', name: 'Other B' },
                },
              ],
            },
          ]);
        }
        if (wFlat?.organizationId === E2E_ORG_ID && wFlat?.isArchived === false) {
          return Promise.resolve([
            {
              id: 'proj-e2e-1',
              name: 'E2E Project',
              billingMethod: 'TM',
              isArchived: false,
              clientId: 'client-e2e-1',
              client: { id: 'client-e2e-1', name: 'Acme' },
              assignments: [],
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      count: jest.fn().mockResolvedValue(0),
    },
    projectTask: {
      findMany: jest.fn().mockImplementation(
        (args: { where?: { project?: { organizationId?: string } } }) => {
          const orgId = args?.where?.project?.organizationId;
          if (orgId === E2E_ORG_ID) {
            return Promise.resolve([
              {
                id: 'pt-e2e-1',
                projectId: 'proj-e2e-1',
                taskId: 'task-other-1',
                project: {
                  id: 'proj-e2e-1',
                  name: 'E2E Project',
                  client: { id: 'client-e2e-1', name: 'Acme' },
                },
                task: { id: 'task-other-1', name: 'Other B' },
              },
            ]);
          }
          return Promise.resolve([]);
        },
      ),
      findFirst: jest
        .fn()
        .mockImplementation(
          (args: { where: { projectId?: string; taskId?: string } }) => {
            const w = args?.where;
            if (w?.projectId != null && w?.taskId != null) {
              return Promise.resolve(null);
            }
            return Promise.resolve(null);
          },
        ),
      create: jest.fn().mockResolvedValue({ id: 'pt' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    timeEntry: {
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _max: { spentDate: null } }),
    },
    approval: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    expenseCategory: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'cat-e2e-1',
          name: 'Travel',
          unitName: 'trip',
          unitPrice: null,
          isArchived: false,
        },
      ]),
    },
    expense: {
      findMany: jest.fn().mockResolvedValue([]),
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
    },
    role: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'role-e2e-1', name: 'Custom Role', members: [] },
      ]),
    },
    task: {
      findMany: jest.fn().mockImplementation((args: { where: Prisma.TaskWhereInput }) => {
        const w = args?.where;
        if (!w || !('organizationId' in w) || w.organizationId !== E2E_ORG_ID) {
          return Promise.resolve([]);
        }
        let rows = taskRows.filter(
          (t) => t.organizationId === E2E_ORG_ID,
        );
        if (w.isArchived === false) {
          rows = rows.filter((t) => !t.isArchived);
        }
        if (
          w.name &&
          typeof w.name === 'object' &&
          'contains' in w.name &&
          typeof w.name.contains === 'string'
        ) {
          const q = w.name.contains.toLowerCase();
          rows = rows.filter((t) => t.name.toLowerCase().includes(q));
        }
        const order = args as {
          orderBy?: Prisma.TaskOrderByWithRelationInput | Prisma.TaskOrderByWithRelationInput[];
        };
        const ob = order.orderBy;
        if (Array.isArray(ob) && ob[0] && 'isCommon' in ob[0]) {
          rows = [...rows].sort((a, b) => {
            if (a.isCommon !== b.isCommon) {
              return a.isCommon ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
        } else {
          rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
        }
        return Promise.resolve(rows);
      }),
      findFirst: jest
        .fn()
        .mockImplementation((args: { where: { id?: string; organizationId?: string } }) => {
          const w = args?.where;
          if (!w?.id) {
            return Promise.resolve(null);
          }
          const t = taskRows.find(
            (r) => r.id === w.id && r.organizationId === w.organizationId,
          );
          return Promise.resolve(t ?? null);
        }),
      create: jest.fn().mockImplementation(
        (args: {
          data: {
            name: string;
            isCommon: boolean;
            isBillable: boolean;
            defaultHourlyRate: Prisma.Decimal | null;
            organizationId: string;
          };
        }) => {
          const id = `task-new-${Date.now()}`;
          const t: TaskRow = {
            id,
            name: args.data.name,
            organizationId: args.data.organizationId,
            isCommon: args.data.isCommon,
            isBillable: args.data.isBillable,
            isArchived: false,
            defaultHourlyRate: args.data.defaultHourlyRate,
          };
          taskRows.push(t);
          return Promise.resolve(t);
        },
      ),
      update: jest
        .fn()
        .mockImplementation(
          (args: { where: { id: string }; data: Prisma.TaskUpdateInput }) => {
            const i = taskRows.findIndex((r) => r.id === args.where.id);
            if (i < 0) {
              return Promise.resolve(null);
            }
            const cur = taskRows[i];
            const d = args.data;
            const next: TaskRow = { ...cur };
            if (typeof d.name === 'string') {
              next.name = d.name;
            }
            if (d.isCommon !== undefined && d.isCommon !== null) {
              next.isCommon = d.isCommon as boolean;
            }
            if (d.isBillable !== undefined && d.isBillable !== null) {
              next.isBillable = d.isBillable as boolean;
            }
            if (d.defaultHourlyRate !== undefined) {
              if (d.defaultHourlyRate === null) {
                next.defaultHourlyRate = null;
              } else {
                next.defaultHourlyRate = d.defaultHourlyRate as Prisma.Decimal;
              }
            }
            if (d.isArchived !== undefined && d.isArchived !== null) {
              next.isArchived = d.isArchived as boolean;
            }
            taskRows[i] = next;
            return Promise.resolve(next);
          },
        ),
      updateMany: jest.fn().mockImplementation(
        (args: {
          where: {
            organizationId?: string;
            id?: { in: string[] };
            isArchived?: boolean;
          };
          data: { isArchived?: boolean };
        }) => {
          const ids = args.where.id?.in;
          const orgId = args.where.organizationId;
          if (!ids?.length || !orgId) {
            return Promise.resolve({ count: 0 });
          }
          let n = 0;
          for (const id of ids) {
            const i = taskRows.findIndex(
              (r) =>
                r.id === id
                && r.organizationId === orgId
                && (args.where.isArchived === false ? !r.isArchived : true),
            );
            if (i < 0) {
              continue;
            }
            if (args.data.isArchived === true) {
              taskRows[i] = { ...taskRows[i], isArchived: true };
              n += 1;
            }
          }
          return Promise.resolve({ count: n });
        },
      ),
      delete: jest.fn().mockImplementation((args: { where: { id: string } }) => {
        const i = taskRows.findIndex((r) => r.id === args.where.id);
        if (i < 0) {
          return Promise.resolve(null);
        }
        const removed = taskRows[i];
        taskRows.splice(i, 1);
        return Promise.resolve(removed);
      }),
    },
    loginAttempt: {
      create: jest.fn().mockResolvedValue({}),
    },
    passwordResetToken: {
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
  };

  return prismaMock;
}

export type E2EPrismaMock = ReturnType<typeof createE2ePrismaMock>;
