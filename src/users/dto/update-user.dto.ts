import { PartialType } from '@nestjs/mapped-types';
import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// Everything from CreateUserDto except password/email, all optional.
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email'] as const),
) {}
