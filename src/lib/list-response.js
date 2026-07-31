const { z } = require('zod');

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  search: z.string().trim().max(100).default(''),
  status: z.string().trim().max(30).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.string().trim().max(40).optional(),
  direction: z.enum(['asc', 'desc']).default('asc')
});

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (date === '0000-00-00' || date === '1111-11-11' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return date;
}

function normalizeRecord(record) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => {
    if (/^data|^vencimento|_date$|_at$/.test(key)) return [key, normalizeDate(value)];
    return [key, value];
  }));
}

function listResponse(rows, rawQuery, { searchFields = [], statusField = 'ativo', dateField, defaultSort = 'id' } = {}) {
  const query = listQuerySchema.parse(rawQuery);
  const needle = query.search.toLocaleLowerCase('pt-BR');
  let items = rows.map(normalizeRecord);
  if (needle) {
    items = items.filter((row) => searchFields.some((field) => String(row[field] ?? '').toLocaleLowerCase('pt-BR').includes(needle)));
  }
  if (query.status) items = items.filter((row) => String(row[statusField] ?? '') === query.status);
  if (dateField && query.from) items = items.filter((row) => row[dateField] && row[dateField] >= query.from);
  if (dateField && query.to) items = items.filter((row) => row[dateField] && row[dateField] <= query.to);
  const sort = query.sort || defaultSort;
  items.sort((left, right) => {
    const result = String(left[sort] ?? '').localeCompare(String(right[sort] ?? ''), 'pt-BR', { numeric: true });
    return query.direction === 'desc' ? -result : result;
  });
  const total = items.length;
  const start = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(start, start + query.pageSize),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / query.pageSize))
    }
  };
}

module.exports = { listQuerySchema, listResponse, normalizeDate, normalizeRecord };
