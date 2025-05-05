import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto{
    
      @IsString()
      @IsNotEmpty()
      @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
      password_hash: string;

        @IsEmail()
        @IsNotEmpty()
        email: string;
}