import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
@Module({
  imports:[
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'yourSecretKeyChangeThis', // ¡¡¡CAMBIA ESTO EN PRODUCCIÓN Y USA VARIABLES DE ENTORNO!!!
      signOptions: { expiresIn: '60m' }, // Tiempo de expiración del token (ej: 60 minutos)
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports:[AuthService, JwtModule]
})
export class AuthModule {}
