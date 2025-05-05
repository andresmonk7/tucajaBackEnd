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
    const payload = { email: user.email, sub: user.user_id }; // 'sub' is a standard claim for subject (user ID)

    // 5. Sign the payload to generate the token using the configured JwtService
    const accessToken = await this.jwtService.signAsync(payload);

    // 6. Return the access token
    return { accessToken };
  }
}
