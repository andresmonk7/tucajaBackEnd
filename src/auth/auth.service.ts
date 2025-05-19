// src/auth/auth.service.ts

import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RegisterDto } from './dto/register-auth.dto';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';


@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService,
    private prismaService: PrismaService, // Inyectamos nuestro PrismaService
    private jwtService: JwtService, // Inyectamos JwtService
  ) {} // Inject PrismaService

  async register(registerDto: RegisterDto): Promise<any> { // Adjust return type
    const { email, password_hash, first_name, last_name, user_type, business_name, nit, business_type } = registerDto;

    // 1. Check if user already exists
    const existingUser = await this.prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado.');
    }
        const existingNit = await this.prisma.businesses.findUnique({
      where: { nit },
    });

    if (existingNit) {
      throw new ConflictException('El nit ya está registrado.');
    }

    try {
      // 2. Hash the password
      const saltOrRounds = 10;
      const passwordHash = await bcrypt.hash(password_hash, saltOrRounds);

      // 3. Use a Prisma transaction to create User and Business atomically
      const result = await this.prisma.$transaction(async (prisma) => {
        // Create the user
        const newUser = await prisma.users.create({
          data: {
            email,
            password_hash:passwordHash,
            first_name,
            last_name,
            user_type,
          },
        });

        // Create the business and link it to the user
        const newBusiness = await prisma.businesses.create({
          data: {
            nit,
            business_name,
          },
        });

        // Return relevant info (exclude passwordHash)
        return {
          user: {
            userId: newUser.user_id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            userType: newUser.user_type,
          },
          business: {
            businessId: newBusiness.business_id,
            businessName: newBusiness.business_name,
            nit: newBusiness.nit,
          }
        };
      });

      return result;

    } catch (error) {
      console.error(error);
      // Consider checking specific Prisma errors for more granular feedback
      throw new InternalServerErrorException('Ocurrió un error durante el registro.');
    }
  }


  async login(loginDto: LoginDto): Promise<{ accessToken: string }> { // Define return type explicitly
    const { email, password_hash } = loginDto;

    // 1. Find the user by email using the corrected model name (.users)
    const user = await this.prismaService.users.findUnique({
      where: { email },
    });

    // 2. Check if user exists and is active
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 3. Compare the provided password with the stored hash
    const isPasswordValid = await bcrypt.compare(password_hash, user.password_hash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 4. If credentials are valid, generate JWT payload
    // The payload should contain claims to identify the user (e.g., userId, email)
    const payload = { email: user.email, sub: user.user_id, name: user.first_name }; // 'sub' is a standard claim for subject (user ID)

    // 5. Sign the payload to generate the token using the configured JwtService
    const accessToken = await this.jwtService.signAsync(payload);

    // 6. Return the access token
    return { accessToken };
  }

  async findOrCreateFromGoogle(googleUserData: { email: string; firstName: string; lastName: string; googleId: string }): Promise<{ accessToken: string }> {
    const { email, firstName, lastName, googleId } = googleUserData;

    // 1. Intentar encontrar el usuario por googleId o email
    let user = await this.prismaService.users.findFirst({
      where: { google_id: googleId },
       // Buscar primero por googleId si lo guardas
    });

    if (!user) {
      // Si no se encuentra por googleId, intentar por email
      user = await this.prismaService.users.findUnique({
        where: { email: email },
      });
    }

    // 2. Si el usuario existe
    if (user) {
       // Si el usuario existe pero no tiene googleId, actualízalo (vincula la cuenta de Google)
       if (!user.google_id) {
          user = await this.prismaService.users.update({
             where: { user_id: user.user_id },
             data: {  }
          });
       }
       // Asegúrate de que el usuario esté activo
        if (!user.is_active) {
            throw new UnauthorizedException('Usuario inactivo.'); // O manejar como prefieras
        }
       // Generar un JWT para el usuario existente
       const payload = { email: user.email, sub: user.user_id };
       const accessToken = await this.jwtService.signAsync(payload);
       return { accessToken };

    } else {
      // 3. Si el usuario NO existe, crearlo
      try {
         const newUser = await this.prismaService.users.create({
           data: {
             email: email,
             // No tenemos contraseña para un usuario de Google, passwordHash puede ser null o un valor especial
             password_hash: 'GOOGLE_AUTHED', // O puedes usar un valor indicador como 'GOOGLE_AUTHED'
             first_name: firstName,
             last_name: lastName,
              // Guardar el ID de Google
             user_type: 'usuario_google', // O un tipo por defecto
             is_active: true,
             // ... otros campos obligatorios en tu modelo User
           },
         });

         // Puedes decidir si crear una Business asociada por defecto aquí o en otro momento
         // Para MVP, quizás no creas la Business automáticamente para Google Auth users.

         // Generar un JWT para el nuevo usuario creado
         const payload = { email: newUser.email, sub: newUser.user_id };
         const accessToken = await this.jwtService.signAsync(payload);
         return { accessToken };

      } catch (error) {
         console.error('Error al crear usuario de Google en DB:', error);
         // Manejar errores de base de datos durante la creación
         throw new InternalServerErrorException('Error al crear usuario de Google.');
      }
    }
    }
}
