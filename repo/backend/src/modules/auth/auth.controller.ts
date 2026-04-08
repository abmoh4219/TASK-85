import {
  Controller, Post, Get, Body, Req,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip;
    const result = await this.authService.login(dto, ip);
    return { data: result };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    const result = await this.authService.refresh(dto.userId, dto.refreshToken);
    return { data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: RefreshDto, @CurrentUser() user: { id: string }) {
    await this.authService.logout(user.id, dto.refreshToken);
    return { data: { message: 'Logged out successfully' } };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { id: string }) {
    const profile = await this.authService.getProfile(user.id);
    return { data: profile };
  }
}
