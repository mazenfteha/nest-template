import { Controller, Get, NotFoundException } from '@nestjs/common';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { UserResponseDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

// Protected by the global JwtAuthGuard; no @Public() here.
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Current authenticated user's profile. */
  @Get('me')
  async me(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(current.id);
    if (!user) throw new NotFoundException('User not found');
    return new UserResponseDto(user);
  }

  /** Admin-only example route (global RolesGuard enforces @Roles). */
  @Roles(UserRole.ADMIN)
  @Get()
  async findAll(): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll();
    return users.map((user) => new UserResponseDto(user));
  }
}
