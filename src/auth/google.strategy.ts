import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { VerifyCallback } from "jsonwebtoken";
import { Strategy } from "passport-google-oauth20";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') { // 'google' es el nombre de la estrategia

  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL, 
      scope: ['email', 'profile'],
    });
  }

  // Este método se llama después de que Google autentica al usuario
  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    // 'profile' contiene la información del usuario de Google (ej: profile.emails, profile.displayName)
    const user = {
      email: profile.emails[0].value, // Asume que al menos hay un email
      firstName: profile.name.givenName,
      lastName: profile.name.familyName,
      // Puedes añadir más datos si Google los proporciona y los solicitaste en el scope
      googleId: profile.id, // Guarda el ID de Google para referencia
    };

    // Llama a 'done'. El primer argumento es el error (null si no hay), el segundo es el usuario
    // Este 'user' objeto será el que Passport adjunte al objeto request (req.user)
    // en el controlador de callback.
    done(null, user);
  }
}

