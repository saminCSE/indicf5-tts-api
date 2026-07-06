import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { ApiDoc } from '../common/decorators/api-doc.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './decorators/current-user.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiDoc({
    summary: 'Register and receive an API key (shown only once)',
    errors: [400, 409],
  })
  @ApiBody({
    type: RegisterDto,
    examples: {
      'valid → 201 (key shown once)': {
        value: { email: 'reviewer@example.com', name: 'Reviewer' },
      },
      'same email again → 409': {
        value: { email: 'reviewer@example.com', name: 'Duplicate' },
      },
      'invalid email → 400': {
        value: { email: 'not-an-email', name: 'Bad Email' },
      },
      'unknown extra field → 400': {
        value: { email: 'x@example.com', name: 'X', role: 'admin' },
      },
    },
  })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);
    return {
      message:
        'Registered successfully. Store your API key — it cannot be retrieved again.',
      result,
    };
  }
}

@ApiTags('auth')
@Controller('me')
export class MeController {
  @Get()
  @ApiDoc({ summary: 'Current authenticated user', auth: true, errors: [401] })
  me(@CurrentUser() user: AuthenticatedUser) {
    return { message: 'Data retrieved', result: user };
  }
}
