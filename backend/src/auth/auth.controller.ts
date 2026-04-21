import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Tighten the global 100/min limit for auth endpoints — 10 attempts per
  // minute per IP is well above legitimate login retries but kills
  // automated brute-force.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(
    @Body() body: { username: string; password: string },
    @Req() req: any,
  ) {
    return this.authService.login(body.username, body.password, req.ip);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('pin-login')
  pinLogin(@Body() body: { pin: string }, @Req() req: any) {
    return this.authService.loginWithPin(body.pin, req.ip);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.revokeRefreshToken(body.refreshToken);
    return { message: 'Logged out' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
