import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class GrnItemDto {
  @IsUUID()
  itemId: string;

  @IsInt()
  @Min(1)
  quantityReceived: number;
}

export class ReceiveGrnDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GrnItemDto)
  items: GrnItemDto[];
}
