

import { Controller, Post, Body, ConflictException, InternalServerErrorException, UsePipes, ValidationPipe, UnauthorizedException } from '@nestjs/common'; // Import UnauthorizedException
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth') // Base route is /auth
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register') // POST /auth/register
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      return { message: 'Usuario registrado exitosamente', data: result };
    } catch (error) {
      if (error instanceof ConflictException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error(error);
      throw new InternalServerErrorException('Ocurrió un error inesperado durante el registro.');
    }
  }

  @Post('login') // New endpoint: POST /auth/login
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return result; // Return the access token directly
    } catch (error) {
      // Catch UnauthorizedException thrown by the service
      if (error instanceof UnauthorizedException || error instanceof InternalServerErrorException) {
        throw error;
      }
      console.error(error);
      throw new InternalServerErrorException('Ocurrió un error inesperado durante el login.');
    }
  }
}