interface FilterOption {
  field: string;
  value: any;
}

interface SearchOption {
  fields: string[];
  value: string;
}

interface QueryBuilderOptions {
  search?: SearchOption;
  filters?: (FilterOption | undefined)[];
}

export function buildWhereClause(
  options: QueryBuilderOptions
): Record<string, any> {
  const where: Record<string, any> = {};

  // Add search conditions
  if (options.search) {
    const { fields, value } = options.search;
    const searchConditions = fields.map((field) => ({
      [field]: {
        contains: value,
        mode: "insensitive" as const,
      },
    }));

    where.OR = searchConditions;
  }

  // Add filter conditions
  if (options.filters) {
    const validFilters = options.filters.filter(
      (filter) => filter !== undefined
    ) as FilterOption[];

    validFilters.forEach((filter) => {
      where[filter.field] = filter.value;
    });
  }

  return where;
}

export function buildOrderByClause(
  sortBy: string,
  sortOrder: "asc" | "desc"
): Record<string, any> {
  return {
    [sortBy]: sortOrder,
  };
}

export function calculatePagination(
  page: number,
  perPage: number,
  totalItems: number
) {
  const totalPages = Math.ceil(totalItems / perPage);

  return {
    page,
    per_page: perPage,
    total_items: totalItems,
    total_pages: totalPages,
  };
}
