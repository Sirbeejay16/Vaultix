import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { ListEventsDto } from '../dto/list-events.dto';

const CURSOR_PATTERN = /^\d{1,19}$/;

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Validates an opaque event cursor (monotonic bigint sequence as a string). */
export function parseEventCursor(cursor: string): string {
  if (!CURSOR_PATTERN.test(cursor)) {
    throw new BadRequestException('Invalid cursor');
  }
  return cursor;
}

/**
 * Applies the history-view filters (escrow status, asset code, free text
 * search) shared by offset and cursor pagination.
 */
export function applyHistoryFilters(
  qb: SelectQueryBuilder<EscrowEvent>,
  query: Pick<ListEventsDto, 'status' | 'assetCode' | 'search'>,
): void {
  if (query.status) {
    qb.andWhere('escrow.status = :status', { status: query.status });
  }

  if (query.assetCode) {
    qb.andWhere('escrow.assetCode = :assetCode', {
      assetCode: query.assetCode,
    });
  }

  const search = query.search?.trim();
  if (search) {
    qb.andWhere(
      "(LOWER(escrow.title) LIKE :search ESCAPE '\\' OR LOWER(event.escrowId) LIKE :search ESCAPE '\\')",
      { search: `%${escapeLike(search.toLowerCase())}%` },
    );
  }
}
