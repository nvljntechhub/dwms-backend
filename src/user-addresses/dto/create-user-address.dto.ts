import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserAddressDto {
  @IsNotEmpty()
  @IsString()
  label: string;

  @IsNotEmpty()
  @IsString()
  street: string;

  @IsNotEmpty()
  @IsString()
  city: string;

  @IsNotEmpty()
  @IsString()
  state: string;

  @IsNotEmpty()
  @IsString()
  postalCode: string;

  @IsNotEmpty()
  @IsString()
  country: string;

  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return value;
  })
  @IsNotEmpty()
  @IsBoolean()
  isDefault: boolean;
}
