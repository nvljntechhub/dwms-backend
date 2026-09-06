import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { errorMessages } from 'src/utils/properties.utils';

const HEADER_ALIASES: Record<string, string> = {
  sku: 'sku',
  name: 'name',
  barcode: 'barcode',
  categoryid: 'categoryId',
  category_id: 'categoryId',
  costprice: 'costPrice',
  cost_price: 'costPrice',
  sellingprice: 'sellingPrice',
  selling_price: 'sellingPrice',
  reorderlevel: 'reorderLevel',
  reorder_level: 'reorderLevel',
  manufacturerid: 'manufacturerId',
  manufacturer_id: 'manufacturerId',
};

export type ParsedProductCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

function resolveHeader(header: string): string {
  const normalized = header.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (HEADER_ALIASES[normalized]) {
    return HEADER_ALIASES[normalized];
  }

  const compact = normalized.replace(/_/g, '');
  return HEADER_ALIASES[compact] ?? header.trim();
}

export function compactCsvRow(
  values: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null) {
      continue;
    }

    const trimmed = String(value).trim();
    if (trimmed === '') {
      continue;
    }

    result[key] = trimmed;
  }

  return result;
}

export function parseProductCsv(buffer: Buffer): ParsedProductCsvRow[] {
  let records: Record<string, string>[];

  try {
    records = parse(buffer, {
      columns: (headers: string[]) => headers.map(resolveHeader),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });
  } catch {
    throw new BadRequestException(errorMessages.PRODUCT_CSV_INVALID);
  }

  if (!records.length) {
    throw new BadRequestException(errorMessages.PRODUCT_CSV_EMPTY);
  }

  if (!('sku' in records[0]) || !('name' in records[0])) {
    throw new BadRequestException(errorMessages.PRODUCT_CSV_MISSING_COLUMNS);
  }

  return records.map((values, index) => ({
    rowNumber: index + 2,
    values,
  }));
}
