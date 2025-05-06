import { Controller, Post, Body, ConflictException, InternalServerErrorException, UsePipes, ValidationPipe, UnauthorizedException, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register-auth.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express'; // Import Express types

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

  @Post('login') //  POST /auth/login
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
  
  // Ruta para iniciar el flujo de autenticación con Google
  @Get('google') // GET /auth/google
  @UseGuards(AuthGuard('google')) // Activa la estrategia 'google'
  async googleAuth(@Req() req) {
    console.log("viene peticion desde el front",req);
    // Este endpoint redirigirá automáticamente a la página de login de Google.
    // El código dentro de esta función rara vez se ejecuta realmente
    // antes de la redirección por parte de Passport.
    console.log('Redirigiendo a Google para autenticación...');
  }
  
  // Ruta de callback a la que Google redirige después de la autenticación
  @Get('google/callback') // GET /auth/google/callback (Debe coincidir con GOOGLE_CALLBACK_URL)
  @UseGuards(AuthGuard('google')) // Activa la estrategia 'google' (maneja la respuesta de Google)
  async googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    // Si la autenticación con Google fue exitosa, 'req.user' contendrá el objeto 'user'
    // que retornaste en el método 'validate' de GoogleStrategy.
    const googleUser = (req as any).user; // Asegúrate del tipo correcto y accede correctamente a user

    if (!googleUser) {
      // Manejar el caso en que la autenticación con Google falló
      // Podrías redirigir a una página de error en el frontend
      return res.redirect('http://localhost:4200/login?error=google_auth_failed'); // Ejemplo
      // O lanzar una excepción: throw new UnauthorizedException('Google authentication failed');
    }

    try {
      // Ahora, gestiona el usuario en tu propia base de datos (buscar o crear)
      // Esta lógica podría ir en AuthService para mantenerlo limpio
      const authResult = await this.authService.findOrCreateFromGoogle(googleUser); // <-- Necesitas crear este método en AuthService

      // Si todo es exitoso, authResult debe contener el JWT propio de tu sistema
      const jwt = authResult.accessToken; // Asume que findOrCreateFromGoogle retorna { accessToken: '...' }

      // Redirige al frontend, pasando el JWT (ej: como parámetro de consulta)
      // En un escenario real, podrías usar cookies seguras o un postMessage
      // para transferir el token de forma más segura.
      return res.redirect(`http://localhost:4200/login/google/callback?token=${jwt}`); // Redirige al frontend con el token

    } catch (error) {
      console.error('Error al procesar usuario de Google o generar JWT:', error);
      // Manejar errores internos al procesar el usuario después de la autenticación de Google
      // Redirigir a una página de error en el frontend
      return res.redirect('http://localhost:4200/login?error=internal_server_error'); // Ejemplo
      // O lanzar una excepción: throw new InternalServerErrorException('Error processing Google user');
    }
  }
}