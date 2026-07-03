import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'reviewer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Reviewer', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
