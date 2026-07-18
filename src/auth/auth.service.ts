import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from '../common/enums/user-role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const exists = await this.usersService.findByEmail(dto.email);
    if (exists) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Public registration always creates a base USER. Privileged roles are
    // provisioned via the seed or an admin-only endpoint, never self-assigned.
    await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.USER,
      },
    });

    return { message: 'Registration successful' };
  }

  async login(user: User): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const { refreshToken, tokenHash, family } = this.generateRefreshToken();

    await this.storeRefreshToken(user.id, tokenHash, family);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async refresh(rawToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    if (!stored) throw new UnauthorizedException('Invalid refresh token');

    if (stored.isRevoked) {
      // Reuse of a rotated token → treat the whole family as compromised.
      await this.revokeFamily(stored.family);
      throw new UnauthorizedException('Token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Token expired');
    }

    // Rotate: revoke the presented token and issue a new one in the same family.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    const user = await this.usersService.findById(stored.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    const accessToken = this.generateAccessToken(user);
    const { refreshToken, tokenHash: newHash } = this.generateRefreshToken();
    await this.storeRefreshToken(user.id, newHash, stored.family);

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async logout(rawToken: string): Promise<{ message: string }> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash },
    });

    // Never reveal whether the token existed — always return success.
    if (stored) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) return null;
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;
    return user; // never return the password hash to callers
  }

  private generateAccessToken(user: User): string {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken() {
    const raw = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(raw);
    const family = crypto.randomUUID();
    return { refreshToken: raw, tokenHash, family };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async storeRefreshToken(
    userId: string,
    tokenHash: string,
    family: string,
  ): Promise<void> {
    const days = this.config.get<number>('jwt.refreshExpiresDays') ?? 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, family, expiresAt },
    });
  }

  private async revokeFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family },
      data: { isRevoked: true },
    });
  }
}
