import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { CreateDealerDto } from 'src/dealers/dto/create-dealer.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

export class RegisterDto extends OmitType(CreateUserDto, ['addresses'] as const) {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CreateDealerDto)
  dealer: CreateDealerDto;
}
