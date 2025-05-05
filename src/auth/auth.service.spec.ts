import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register-auth.dto';

describe('AuthService', () => {
  let service: AuthService; // Declarar la instancia del servicio a probar
  // Opcional: declarar las dependencias moqueadas con tipado para facilitar el trabajo
  let prismaServiceMock: any; // Usamos 'any' o tipos específicos si creas interfaces para mocks
  let jwtServiceMock: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService, // ¡Provee el servicio real que quieres probar!
        {
          provide: PrismaService, // Cuando AuthService pida PrismaService...
          useValue: mockPrismaService, // ...dale nuestro mockPrismaService
        },
         {
          provide: JwtService, // Cuando AuthService pida JwtService...
          useValue: mockJwtService, // ...dale nuestro mockJwtService
        },
        // Si usas ConfigService en AuthService, moquéalo también aquí
      ],
    }).compile(); // Compila el módulo de pruebas

    // Obtén las instancias del servicio y los mocks del módulo de pruebas
    service = module.get<AuthService>(AuthService);
    prismaServiceMock = module.get<PrismaService>(PrismaService); // O module.get(PrismaService as any)
    jwtServiceMock = module.get<JwtService>(JwtService); // O module.get(JwtService as any)

    // Limpiar los mocks antes de cada prueba es CRUCIAL.
    // Asegura que los contadores de llamadas y los valores de retorno moqueados se resetean.
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Aquí vendrán las pruebas para el método register
  describe('register', () => {
       // Define un objeto de datos de registro de prueba (los mismos datos que enviarías a la API)
       const registerDto: RegisterDto = {
        email: 'test@example.com',
        password_hash: 'password123',
        first_name: 'Test',
        last_name: 'User',
        user_type: 'freelancer',
        business_name: 'Test Business',
        nit: '12345-6',
      };

      it('should successfully register a new user and business', async () => { // Prueba 1: Escenario exitoso
        // --- ARRANGE (Configurar el escenario de prueba) ---
        // 1. Moquear la búsqueda de usuario: Queremos que parezca que el email NO existe.
        //    AuthService llama a prismaService.client.users.findUnique.
        //    Le decimos a nuestro mock que, cuando se llame findUnique, resuelva con null.
        mockPrismaService.client.users.findUnique.mockResolvedValue(null);

        // 2. Moquear la transacción y las operaciones dentro de ella:
        //    AuthService llama a prismaService.client.$transaction.
        //    Dentro de la transacción, llama a prisma.user.create y prisma.business.create.
        //    Necesitamos moquear $transaction para que simule la ejecución de la lógica interna
        //    y moquear los métodos create para que simulen que se crearon los objetos.
        mockPrismaService.client.$transaction.mockImplementation(async (callback) => {
             // Datos dummy que simulan los objetos creados por la DB
             const createdUser = { userId: 1, ...registerDto, passwordHash: 'hashedpassword' };
             const createdBusiness = { businessId: 1, userId: 1, ...registerDto };

             // Dentro del callback que pasa Prisma a $transaction, usamos *esa* instancia.
             // Nuestro mock $transaction recibe ese callback y le pasa un mock de Prisma.
             // Asegúrate de que los métodos create dentro de este mock de Prisma interno
             // también retornen los valores dummy.
             // (Nota: la implementación de mockImplementation puede ser un poco compleja,
             //  a veces es más fácil moquear directamente los métodos create y esperar que
             //  $transaction los llame, pero con $transaction que recibe un callback es así)

             // Simplificación: En lugar de simular el callback exacto, a veces es suficiente
             // asegurarse de que los métodos create son llamados con los datos correctos
             // y moquear lo que $transaction DEBERÍA retornar si todo fuera bien.

             // --- Enfoque Alternativo más Sencillo para $transaction ---
             // Moquea lo que los métodos create retornarían si fueran exitosos.
             mockPrismaService.client.users.create.mockResolvedValue(createdUser);
             mockPrismaService.client.businesses.create.mockResolvedValue(createdBusiness);

             // Moquea $transaction para que simplemente ejecute el callback con un mock
             // de la instancia de Prisma que tiene los métodos create moqueados,
             // y retorne el resultado esperado de la transacción.
             const prismaMockForTransaction = { // Mock de la instancia de Prisma dentro de $transaction
                  user: { create: mockPrismaService.client.users.create }, // Usa los mocks que ya tenemos
                  business: { create: mockPrismaService.client.businesses.create },
                  $transaction: jest.fn(), // Moquear esto también por si acaso
             };
             // El callback que AuthService pasa a $transaction se ejecuta aquí
             const transactionResult = await callback(prismaMockForTransaction);

            // Simular el retorno exitoso de la transacción.
             return { user: createdUser, business: createdBusiness }; // O lo que retorne tu callback si lo moqueaste así
         });

        // Moqueamos el hashing de contraseña. Aunque AuthService llama a bcrypt.hash
        // antes de la transacción, nos aseguramos de que cuando se llame, retorne algo.
        // jest.spyOn(bcrypt, 'hash').mockResolvedValue('sdfsdfsdfsdf'); // Espiar y moquear bcrypt.hash


        // --- ACT (Ejecutar el código que estamos probando) ---
        const result = await service.register(registerDto); // Llama al método register

        // --- ASSERT (Verificar que el resultado es el esperado y las dependencias fueron llamadas) ---
        // 1. Verificar que se llamó a findUnique para buscar el email.
        expect(mockPrismaService.client.users.findUnique).toHaveBeenCalledWith({
          where: { email: registerDto.email },
        });

        // 2. Verificar que se llamó a la transacción.
        expect(mockPrismaService.client.$transaction).toHaveBeenCalled();

        // 3. Verificar que los métodos create fueron llamados dentro de la transacción
        //    con los datos correctos (el mockImplementation de $transaction ayuda aquí).
        //    Usamos expect.objectContaining() para verificar solo las propiedades que nos importan.
        expect(mockPrismaService.client.users.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                email: registerDto.email,
                firstName: registerDto.first_name,
                lastName: registerDto.last_name,
                userType: registerDto.user_type,
                passwordHash: 'hashedpassword', // ¡Verificamos que se usó la contraseña hasheada!
            }),
        });
        expect(mockPrismaService.client.businesses.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                nit: registerDto.nit,
                businessName: registerDto.business_name,
                userId: expect.any(Number), // Esperamos que el userId del nuevo usuario sea un número (o el tipo que uses)
            }),
        });

        // 4. Verificar que el método register retornó el resultado esperado.
        //    Debe coincidir con lo que la transacción moqueada retornó, pero excluyendo passwordHash.
        expect(result).toEqual({
          user: expect.objectContaining({
             userId: expect.any(Number),
             email: registerDto.email,
             firstName: registerDto.first_name,
             lastName: registerDto.last_name,
             userType: registerDto.user_type,
          }),
           business: expect.objectContaining({
              businessId: expect.any(Number),
              businessName: registerDto.business_name,
              nit: registerDto.nit,
           })
        });
      });

      // Aqu // Aquí definiremos los escenarios de prueba para register
  });
});

const mockPrismaService = {
  // Mimica la estructura que AuthService espera usar
  client: {
    users: {
      findUnique: jest.fn(), // jest.fn() crea una función moqueada
      create: jest.fn(),
    },
    businesses: {
      create: jest.fn(),
    },
     $transaction: jest.fn(), // También moqueamos $transaction
  },
};

const mockJwtService = {
  signAsync: jest.fn(),
};


// Moquear bcrypt.compare
jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'), // Mantener otras funciones de bcryptjs
  compare: jest.fn(), // Moquear solo la función compare
}));

