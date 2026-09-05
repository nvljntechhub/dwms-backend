import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateUserAddressDto } from 'src/user-addresses/dto/create-user-address.dto';
import { Transform, Type, plainToInstance } from 'class-transformer';
import { ASSIGNABLE_USER_ROLES, UserRole } from 'src/common/utils/enums/user-role';

function parseAddresses(value: unknown): CreateUserAddressDto[] {
  if (value == null || value === '') {
    return [];
  }

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return value as unknown as CreateUserAddressDto[];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return plainToInstance(CreateUserAddressDto, parsed);
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @IsNotEmpty()
  @IsString()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_USER_ROLES)
  role?: UserRole;

  @IsNotEmpty()
  @IsString()
  password: string;

  /** Set by the server from the uploaded file — do not send in the form body. */
  @IsOptional()
  @IsString()
  profileURL?: string;

  @Transform(({ value }) => parseAddresses(value))
  @ValidateNested({ each: true })
  @Type(() => CreateUserAddressDto)
  addresses: CreateUserAddressDto[];
}
