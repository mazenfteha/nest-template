import { Exclude } from 'class-transformer';
import { User, UserRole } from '@prisma/client';

/**
 * Response shape for a user. `passwordHash` is excluded so the global
 * ClassSerializerInterceptor never leaks it, even if an entity is returned.
 */
export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  passwordHash: string | null;

  @Exclude()
  deletedAt: Date | null;

  constructor(user: User) {
    Object.assign(this, user);
  }
}
