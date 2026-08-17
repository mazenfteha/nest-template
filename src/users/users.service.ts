import { ConflictException, Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? UserRole.USER,
      },
    });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Resolve the User for a verified Google profile. Order matters:
   *  1. Already linked (match on googleId) → return as-is.
   *  2. Same email exists (password account) → link by setting googleId.
   *  3. Otherwise create an OAuth-only user (no passwordHash; email is
   *     already verified by Google).
   */
  async findOrCreateGoogleUser(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const linked = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (linked) return linked;

    const existing = await this.findByEmail(profile.email);
    if (existing) {
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { googleId: profile.googleId },
      });
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.googleId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        isEmailVerified: true,
        role: UserRole.USER,
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
