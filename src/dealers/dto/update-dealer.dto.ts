import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsISO31661Alpha2,
  IsISO4217CurrencyCode,
  IsLocale,
  IsOptional,
  IsTimeZone,
} from 'class-validator';
import { CreateDealerDto } from './create-dealer.dto';

function toUpperTrimmed(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

export class UpdateDealerDto extends PartialType(CreateDealerDto) {
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsISO4217CurrencyCode()
  currency?: string;

  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsISO31661Alpha2()
  country?: string;

  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @IsOptional()
  @IsLocale()
  locale?: string;
}
