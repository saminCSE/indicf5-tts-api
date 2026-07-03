import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const MAX_CHARS = parseInt(process.env.TTS_MAX_CHARS ?? '1000', 10);

export class CreateTtsDto {
  @ApiProperty({
    example: 'আমার সোনার বাংলা, আমি তোমায় ভালোবাসি।',
    description: `Bengali text to synthesize, 1-${MAX_CHARS} characters`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : (value as unknown),
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_CHARS)
  text!: string;
}
