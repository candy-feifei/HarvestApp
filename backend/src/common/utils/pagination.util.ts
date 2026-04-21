export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  data: T[];
  meta: PageMeta;
};

export function getSkipTake(page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  return { skip: (safePage - 1) * safeSize, take: safeSize };
}

export function buildPageMeta(
  page: number,
  pageSize: number,
  total: number,
): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return { page, pageSize, total, totalPages };
}

export function toPaginatedResult<T>(
  data: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResult<T> {
  return {
    data,
    meta: buildPageMeta(page, pageSize, total),
  };
}
