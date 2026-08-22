import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth-extra.dto';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import { v4 as uuidv4 } from 'uuid';

interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  async register(dto: RegisterDto) {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const userRole = await this.prisma.role.findFirst({ where: { name: 'user' } });
    const user = await this.userService.create({
      name: dto.name,
      email: dto.email,
      password: dto.password,
      roleId: userRole?.id,
    });

    const accessToken = this.generateToken(user.id);

    return { accessToken, user };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('This account uses Google sign-in. Please continue with Google.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.generateToken(user.id);

    const { password, ...result } = user;
    return { accessToken, user: result };
  }

  async googleAuth(accessToken: string) {
    const profile = await this.fetchGoogleProfile(accessToken);

    if (!profile.email) {
      throw new UnauthorizedException('Google account has no email address');
    }
    if (profile.email_verified === false) {
      throw new UnauthorizedException('Google email is not verified');
    }

    // Match an existing account by Google identity first, then by email so an
    // account originally created with email/password gets linked, not duplicated.
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
    });

    if (user) {
      // Backfill the Google link / avatar for a pre-existing local account.
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.sub,
            avatar: user.avatar ?? profile.picture,
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          },
        });
      }
    } else {
      const userRole = await this.prisma.role.findFirst({ where: { name: 'user' } });
      user = await this.prisma.user.create({
        data: {
          name: profile.name || profile.email.split('@')[0],
          email: profile.email,
          googleId: profile.sub,
          avatar: profile.picture,
          provider: 'google',
          emailVerifiedAt: new Date(),
          roleId: userRole?.id,
        },
      });
    }

    const token = this.generateToken(user.id);
    return { accessToken: token, user: await this.userService.findOne(user.id) };
  }

  private async fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    let response: Response;
    try {
      response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new ServiceUnavailableException('Could not reach Google to verify your account');
    }

    if (!response.ok) {
      throw new UnauthorizedException('Invalid or expired Google access token');
    }

    return (await response.json()) as GoogleProfile;
  }

  private generateToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId } as any,
      {
        secret: process.env.JWT_SECRET || 'default-secret',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      } as any
    );
  }

  me(userId: string) {
    return this.userService.findOne(userId);
  }

  refreshToken(userId: string) {
    return { accessToken: this.generateToken(userId) };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (dto.email) {
      const existing = await this.userService.findByEmail(dto.email);
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email already exists');
      }
    }
    return this.userService.update(userId, dto);
  }

  logout() {
    return { message: 'Logged out successfully' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userService.findByEmail((await this.userService.findOne(userId)).email);
    if (!user) throw new NotFoundException('User not found');
    if (!user.password) {
      throw new UnauthorizedException('This account uses Google sign-in and has no password to change.');
    }
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    await this.userService.update(userId, { password: dto.newPassword });
    return { message: 'Password changed successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) return { message: 'If the email exists, a reset token was generated' };
    const token = uuidv4();
    await this.prisma.passwordReset.create({
      data: {
        email: dto.email,
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return { message: 'Reset token generated', token };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const reset = await this.prisma.passwordReset.findFirst({
      where: { token: dto.token, expiresAt: { gt: new Date() } },
    });
    if (!reset?.userId) throw new UnauthorizedException('Invalid or expired reset token');
    await this.userService.update(reset.userId, { password: dto.password });
    return { message: 'Password reset successfully' };
  }
}
