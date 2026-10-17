import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import {
  applyHistoryFilters,
  escapeLike,
  parseEventCursor,
} from './event-history-query.util';

describe('event-history-query.util', () => {
  const makeQb = () => {
    const qb = { andWhere: jest.fn() };
    qb.andWhere.mockReturnValue(qb);
    return qb as unknown as SelectQueryBuilder<EscrowEvent> & {
      andWhere: jest.Mock;
    };
  };

  describe('parseEventCursor', () => {
    it('accepts numeric cursors', () => {
      expect(parseEventCursor('12345')).toBe('12345');
    });

    it.each(['abc', '12; DROP', '-1', '1.5', ''])('rejects %p', (value) => {
      expect(() => parseEventCursor(value)).toThrow(BadRequestException);
    });
  });

  describe('escapeLike', () => {
    it('escapes wildcard characters', () => {
      expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    });
  });

  describe('applyHistoryFilters', () => {
    it('adds no clauses when no filters are set', () => {
      const qb = makeQb();
      applyHistoryFilters(qb, {});
      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('filters by status and asset code', () => {
      const qb = makeQb();
      applyHistoryFilters(qb, {
        status: EscrowStatus.COMPLETED,
        assetCode: 'USDC',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('escrow.status = :status', {
        status: EscrowStatus.COMPLETED,
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        'escrow.assetCode = :assetCode',
        { assetCode: 'USDC' },
      );
    });

    it('applies a lowercased, escaped search term', () => {
      const qb = makeQb();
      applyHistoryFilters(qb, { search: '  Logo_100% ' });
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
      expect(qb.andWhere.mock.calls[0][1]).toEqual({
        search: '%logo\\_100\\%%',
      });
    });

    it('ignores blank search', () => {
      const qb = makeQb();
      applyHistoryFilters(qb, { search: '   ' });
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });
});
