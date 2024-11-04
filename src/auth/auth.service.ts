// src/auth/auth.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from 'src/user/schemas/user.entity';
import { MailerService } from 'src/helpers/mailer.service';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { RegisterUserDto } from './dto/register-user.dto';

@Injectable()
export class AuthService {
  private readonly logger: Logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly mailerService: MailerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async register(registerUserDto: RegisterUserDto): Promise<any> {
    try {
      const {
        email,
        firstName,
        lastName,
        middleInitial,
        hospitalId,
        phoneNumber,
      } = registerUserDto;

      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const existingUser =
        await this.userService.findUserByEmail(lowercasedEmail);
      if (existingUser) {
        this.logger.warn(
          `Registration failed: User already exists with email ${lowercasedEmail}`,
        );
        throw new BadRequestException('User already exists');
      }

      const password = crypto.randomBytes(4).toString('hex'); // Generate a random 8-character password
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User();
      user.email = lowercasedEmail;
      user.firstName = firstName;
      user.lastName = lastName;
      user.middleInitial = middleInitial;
      user.hospitalId = hospitalId;
      user.phoneNumber = phoneNumber;
      user.password = hashedPassword;
      user.isUserVerified = false;

      this.logger.log(`Registering user with email ${lowercasedEmail}`);
      await this.userService.registerUser(user);

      // Send the generated password to the user via email
      this.mailerService.sendWelcomeEmail(lowercasedEmail, user.firstName);

      return { message: 'User Registered successfully' };
    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to register user');
    }
  }

  async initLogin(
    email: string,
  ): Promise<{ hashedUser: string; isUserVerified: boolean }> {
    try {
      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const user = await this.userService.findUserByEmail(lowercasedEmail);
      if (!user) {
        throw new BadRequestException('User not found.');
      }

      if (!user.isUserVerified) {
        const otp = this.mailerService.generateOtp();
        const hashedUser = crypto
          .createHash('sha256')
          .update(lowercasedEmail)
          .digest('hex');

        // Store OTP and hashed user in cache manager
        await this.cacheManager.set(
          hashedUser,
          { otp, email: lowercasedEmail },
          300000,
        ); // TTL 5 minutes
        this.logger.log(`OTP generated for email ${lowercasedEmail}`);
        await this.mailerService.sendOtpEmail(lowercasedEmail, otp);
        return { hashedUser, isUserVerified: false };
      } else {
        const hashedUser = crypto
          .createHash('sha256')
          .update(lowercasedEmail)
          .digest('hex');
        return { hashedUser, isUserVerified: true };
      }
    } catch (error) {
      this.logger.error(`Login initialization failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to initiate login process',
      );
    }
  }

  async login(email: string, userPassword: string): Promise<any> {
    try {
      if (!email || !userPassword) {
        this.logger.warn('Login failed: email and password are required');
        throw new BadRequestException('Email and password are required');
      }

      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const user = await this.userService.findUserByEmail(lowercasedEmail);
      if (!user || !(await bcrypt.compare(userPassword, user.password))) {
        this.logger.warn(
          `Login failed: Invalid credentials for email ${lowercasedEmail}`,
        );
        throw new UnauthorizedException('Invalid credentials');
      }

      const accessToken = this.jwtService.sign({
        email: user.email,
        sub: user.id,
      });

      const { id, password, ...sanitizedUser } = user;
      this.logger.log(`User logged in with email ${lowercasedEmail}`);
      return { user: sanitizedUser, accessToken };
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to login');
    }
  }

  async forgetPassword(email: string): Promise<any> {
    try {
      if (!email) {
        this.logger.warn('Forget Password failed: email is required');
        throw new BadRequestException('Email is required');
      }

      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const user = await this.userService.findUserByEmail(lowercasedEmail);
      if (!user) {
        this.logger.warn(
          `Forget Password failed: User not found with email ${lowercasedEmail}`,
        );
        throw new NotFoundException('User not found');
      }

      const otp = this.mailerService.generateOtp();
      const hashedUser = crypto
        .createHash('sha256')
        .update(lowercasedEmail)
        .digest('hex');
      await this.cacheManager.set(
        hashedUser,
        { otp, email: lowercasedEmail },
        300000,
      );

      this.logger.log(`OTP generated for email ${lowercasedEmail}`);
      await this.mailerService.sendOtpEmail(lowercasedEmail, otp);

      return { message: 'otp sent successfully', hashedUser };
    } catch (error) {
      this.logger.error(`Forget Password failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to initiate password reset',
      );
    }
  }

  async verifyOtp(hashedUser: string, otp: string): Promise<any> {
    try {
      if (!hashedUser || !otp) {
        this.logger.warn('Verify OTP failed: HashUser and OTP are required');
        throw new BadRequestException('Key and OTP are required');
      }

      const cachedData = await this.cacheManager.get<{
        otp: string;
        email: string;
      }>(hashedUser);
      if (!cachedData || cachedData.otp !== otp) {
        this.logger.warn(
          `Verify OTP failed: Invalid or expired OTP for email ${cachedData?.email}`,
        );
        throw new BadRequestException('Invalid or expired OTP');
      }

      await this.cacheManager.del(hashedUser);
      this.logger.log(`OTP verified for email ${cachedData.email}`);

      const user = await this.userService.findUserByEmail(cachedData.email);
      user.isUserVerified = true;
      await this.userService.updateUser(user);
      const payload = { sub: user.id, email: user.email };
      const access_token = this.jwtService.sign(payload, { expiresIn: '1m' });

      return { message: 'OTP verified successfully.', access_token };
    } catch (error) {
      this.logger.error(`OTP verification failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to verify OTP');
    }
  }

  async resetPassword(email: string, newPassword: string): Promise<any> {
    try {
      if (!email || !newPassword) {
        this.logger.warn(
          'Reset Password failed: email and new password are required',
        );
        throw new BadRequestException('Email and new password are required');
      }

      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const user = await this.userService.findUserByEmail(lowercasedEmail);
      if (!user) {
        this.logger.warn(
          `Reset Password failed: User not found with email ${lowercasedEmail}`,
        );
        throw new NotFoundException('User not found');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      this.logger.log(`Password reset for user with email ${lowercasedEmail}`);
      await this.userService.updateUser(user);
      return { message: 'Password reset successfully' };
    } catch (error) {
      this.logger.error(`Reset Password failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to reset password');
    }
  }

  async initPassword(email: string, newPassword: string): Promise<any> {
    try {
      if (!email || !newPassword) {
        this.logger.warn(
          'Reset Password failed: email and new password are required',
        );
        throw new BadRequestException('Email and new password are required');
      }

      const lowercasedEmail = email.toLowerCase(); // Lowercase email
      const user = await this.userService.findUserByEmail(lowercasedEmail);
      if (!user) {
        this.logger.warn(
          `Reset Password failed: User not found with email ${lowercasedEmail}`,
        );
        throw new NotFoundException('User not found');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;

      this.logger.log(`Password reset for user with email ${lowercasedEmail}`);
      await this.userService.updateUser(user);
      const { id, password, ...sanitizedUser } = user;
      const accessToken = this.jwtService.sign({
        email: user.email,
        sub: user.id,
      });
      return { user: sanitizedUser, accessToken };
    } catch (error) {
      this.logger.error(`Password initialization failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to initialize password');
    }
  }
}
