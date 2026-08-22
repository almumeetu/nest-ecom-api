import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google OAuth access token obtained from the client-side Google sign-in flow',
    example: 'ya29.a0AfH6SM...',
  })
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
