import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiDoc } from '../common/decorators/api-doc.decorator';
import { CreateTtsDto } from './dto/create-tts.dto';
import { JobsService } from './jobs.service';

@ApiTags('tts')
@Controller()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post('tts')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiDoc({
    summary: 'Submit Bengali text for speech synthesis (async, returns job)',
    auth: true,
    errors: [400, 401, 422, 503],
  })
  async submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTtsDto,
  ) {
    const result = await this.jobsService.submit(user, dto);
    return {
      message: 'Job accepted — poll GET /v1/jobs/{jobId} for status',
      result,
    };
  }

  @Get('jobs')
  @ApiDoc({
    summary: 'List my TTS jobs, newest first',
    auth: true,
    errors: [401],
  })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const { items, meta } = await this.jobsService.findAllForUser(
      user,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
    );
    return { message: 'Data retrieved', result: items, meta };
  }

  @Get('jobs/:id')
  @ApiDoc({
    summary: 'Job status and detail',
    auth: true,
    errors: [401, 404],
  })
  async detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const result = await this.jobsService.findOneForUser(user, id);
    return { message: 'Data retrieved', result };
  }

  @Get('jobs/:id/audio')
  @ApiDoc({
    summary: 'Download generated audio (WAV) for a completed job',
    auth: true,
    errors: [401, 404, 409],
  })
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { stream, filename } = await this.jobsService.getAudioStream(
      user,
      id,
    );
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    stream.pipe(res);
  }
}
