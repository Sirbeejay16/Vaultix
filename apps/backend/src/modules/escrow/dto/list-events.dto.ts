import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsUUID,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EscrowEventType } from '../entities/escrow-event.entity';
import { EscrowStatus } from '../entities/escrow.entity';

export enum EventSortBy {
  CREATED_AT = 'createdAt',
  EVENT_TYPE = 'eventType',
  CURSOR = 'cursor',
}

export enum EventSortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class ListEventsDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  @IsEnum(EscrowEventType)
  @IsOptional()
  eventType?: EscrowEventType;

  @IsUUID()
  @IsOptional()
  actorId?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @IsEnum(EventSortBy)
  @IsOptional()
  sortBy?: EventSortBy = EventSortBy.CREATED_AT;

  @IsUUID()
  @IsOptional()
  escrowId?: string;

  @IsEnum(EventSortOrder)
  @IsOptional()
  sortOrder?: EventSortOrder = EventSortOrder.DESC;

  // Cursor-based pagination for incremental sync
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  cursor?: string;

  // When using cursor, fetch events after this cursor
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  after?: string;

  // When using cursor, fetch events before this cursor
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  before?: string;

  // Opt in to cursor (keyset) pagination. The response then carries
  // `nextCursor` / `hasMore` instead of relying on `page` / `total`.
  @IsIn(['cursor'])
  @IsOptional()
  paginate?: 'cursor';

  // Filter by the parent escrow status
  @IsEnum(EscrowStatus)
  @IsOptional()
  status?: EscrowStatus;

  // Filter by the parent escrow asset code (e.g. XLM, USDC)
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @IsOptional()
  assetCode?: string;

  // Case-insensitive text search over escrow title and escrow id
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}
