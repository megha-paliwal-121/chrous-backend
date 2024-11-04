// import { Injectable, Logger } from '@nestjs/common';
// import * as sgMail from '@sendgrid/mail';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class MailerService {
//   private readonly logger = new Logger(MailerService.name);
//   private apiKey: string;
//   private emailUser: string;

//   constructor(private readonly configService: ConfigService) {
//     this.apiKey = this.configService.get<string>('SENDGRID_API_KEY');
//     this.emailUser = this.configService.get<string>('EMAIL_USER');

//     if (!this.apiKey) {
//       this.logger.error(
//         'SendGrid API Key is not defined in the environment variables.',
//       );
//       throw new Error(
//         'SendGrid API Key is not defined in the environment variables.',
//       );
//     }

//     if (!this.emailUser) {
//       this.logger.error(
//         'Sender email is not defined in the environment variables.',
//       );
//       throw new Error(
//         'Sender email is not defined in the environment variables.',
//       );
//     }

//     sgMail.setApiKey(this.apiKey);
//     this.logger.log('SendGrid API Key set successfully.');
//   }

//   async sendOtpEmail(to: string, otp: string) {
//     this.logger.log(`Attempting to send OTP email to: ${to}`);

//     const msg = {
//       to,
//       from: this.emailUser, // Make sure this is a verified sender
//       subject: 'Your Password Reset OTP',
//       text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
//     };

//     try {
//       await sgMail.send(msg);
//       this.logger.log(`OTP email sent successfully to ${to}`);
//       return { message: 'OTP sent successfully' };
//     } catch (error) {
//       this.logger.error(
//         `Failed to send OTP email to ${to}`,
//         error.response?.body || error,
//       );
//       return {
//         message: 'Failed to send OTP',
//         error: error.response?.body || error,
//       };
//     }
//   }

//   async sendPasswordEmail(to: string, password: string) {
//     this.logger.log(`Attempting to send registration email to: ${to}`);

//     const msg = {
//       to,
//       from: this.emailUser, // Make sure this is a verified sender
//       subject: 'Your Account Registration',
//       text: `Hi,\n\nYour account has been successfully created.\nYour password is: ${password}\n\nPlease keep it safe!`,
//     };

//     try {
//       await sgMail.send(msg);
//       this.logger.log(`Email sent successfully to ${to}`);
//       return { message: 'Email sent successfully' };
//     } catch (error) {
//       this.logger.error(
//         `Failed to send email to ${to}`,
//         error.response?.body || error,
//       );
//       return {
//         message: 'Failed to send email',
//         error: error.response?.body || error,
//       };
//     }
//   }

//   generateOtp(): string {
//     // Generate a 6-digit OTP
//     const otp = Math.floor(1000 + Math.random() * 9000).toString();
//     this.logger.log(`Generated OTP: ${otp}`);
//     return otp;
//   }
// }

// import { Injectable, Logger } from '@nestjs/common';
// import * as nodemailer from 'nodemailer';
// import { google } from 'googleapis';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class MailerService {
//   private readonly logger = new Logger(MailerService.name);
//   private oAuth2Client: any;

//   constructor(private readonly configService: ConfigService) {
//     const CLIENT_ID = this.configService.get<string>('CLIENT_ID'); // Your client ID
//     const CLIENT_SECRET = this.configService.get<string>('CLIENT_SECRET'); // Your client secret
//     const REFRESH_TOKEN = this.configService.get<string>('REFRESH_TOKEN'); // Your refresh token

//     this.oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);

//     this.oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
//   }

//   private async createTransporter() {
//     const accessToken = await this.oAuth2Client.getAccessToken();

//     return nodemailer.createTransport({
//       service: 'gmail',
//       auth: {
//         type: 'OAuth2',
//         user: this.configService.get<string>('EMAIL_USER'), // Your email address (verified with Gmail)
//         clientId: this.configService.get<string>('CLIENT_ID'),
//         clientSecret: this.configService.get<string>('CLIENT_SECRET'),
//         refreshToken: this.configService.get<string>('REFRESH_TOKEN'),
//         accessToken: accessToken.token,
//       },
//     });
//   }

//   async sendOtpEmail(to: string, otp: string) {
//     this.logger.log(`Attempting to send OTP email to: ${to}`);

//     const transporter = await this.createTransporter();

//     const mailOptions = {
//       from: this.configService.get<string>('EMAIL_USER'), // Sender address
//       to,
//       subject: 'Your OTP Code',
//       text: `Your OTP code is: ${otp}. It is valid for 10 minutes.`,
//       html: `<p>Your OTP code is: <strong>${otp}</strong>. It is valid for 10 minutes.</p>`,
//     };

//     try {
//       const result = await transporter.sendMail(mailOptions);
//       this.logger.log(`OTP email sent successfully to ${to}`);
//       return { message: 'OTP sent successfully' };
//     } catch (error) {
//       this.logger.error(`Failed to send OTP email to ${to}`, error.message);
//       return { message: 'Failed to send OTP', error: error.message };
//     }
//   }

//   generateOtp(): string {
//     // Generate a 4-digit OTP
//     const otp = Math.floor(1000 + Math.random() * 9000).toString();
//     this.logger.log(`Generated OTP: ${otp}`);
//     return otp;
//   }
// }

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter;
  private emailUser: string;
  constructor(private readonly configService: ConfigService) {
    this.emailUser = this.configService.get<string>('EMAIL_USER');
    // Initialize the Nodemailer transporter with SMTP configuration
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      secure: true, // true for 465, false for other ports

      auth: {
        user: this.emailUser, // generated ethereal user
        pass: this.configService.get<string>('EMAIL_PASSWORD'), // generated ethereal password
      },
      tls: {
        rejectUnAuthorized: true,
      },
    });

    if (!this.emailUser) {
      this.logger.error(
        'Sender email is not defined in the environment variables.',
      );
    }
  }

  async sendOtpEmail(to: string, otp): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.emailUser, // sender address
        to, // list of receivers
        subject: 'Chorus Password Reset OTP',
        text: `Your OTP for password reset is: ${otp}. It is valid for 10 minutes.`,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
    }
  }

  // async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
  //   try {
  //     const capitalizedFirstName =
  //       firstName.charAt(0).toUpperCase() + firstName.slice(1);
  //     await this.transporter.sendMail({
  //       from: this.emailUser, // Sender address
  //       to, // List of receivers
  //       subject: 'Welcome to Chorus Asset Management',
  //       html: `
  //         <p>Hi ${capitalizedFirstName},</p>
  //         <p>Thank you for registering with Asset management. Your account has been successfully created.</p>
  //         <p>To get started, you can download the Asset Management mobile app on your smartphone by scanning the appropriate QR code or clicking the link below:</p>
  //         <p><strong>For iOS Users:</strong><br>
  //           <a href="https://testflight.apple.com/join/QhDVnyWR" style="display:inline-block; margin-bottom:10px;">iOS Install</a><br>
  //           <img src="cid:iosQR" alt="iOS QR Code" style="width:150px;height:150px;" /></p>
  //         <p><strong>For Android Users:</strong><br>
  //           <a href="http://34.171.78.199/apks/chorus.apk" style="display:inline-block; margin-bottom:10px;">Android Install</a><br>
  //           <img src="cid:androidQR" alt="Android QR Code" style="width:150px;height:150px;" /></p>
  //         <p>Additionally, we've attached the Chorus Asset Management User Manual to help you familiarize yourself with the platform. It contains step-by-step instructions and helpful tips to get the most out of the app.</p>
  //         <p>Best Regards,<br>Chorus Team</p>
  //       `,
  //       attachments: [
  //         {
  //           filename: 'Chorus Asset Management User Manual.pdf',
  //           path: path.resolve(
  //             __dirname,
  //             '..',
  //             '..',
  //             'documents',
  //             'Chorus_Asset_Management_User_Manual.pdf',
  //           ), // Corrected relative path
  //         },
  //         {
  //           filename: 'IOS_QR.jpeg',
  //           path: path.resolve(__dirname, '..', '..', 'documents', 'ios.jpeg'), // Corrected relative path
  //           cid: 'iosQR', // Embedding iOS QR code using cid
  //         },
  //         {
  //           filename: 'Android_QR.png',
  //           path: path.resolve(
  //             __dirname,
  //             '..',
  //             '..',
  //             'documents',
  //             'android.png',
  //           ), // Corrected relative path
  //           cid: 'androidQR', // Embedding Android QR code using cid
  //         },
  //       ],
  //     });
  //     this.logger.log(`Welcome email sent to ${to}`);
  //   } catch (error) {
  //     this.logger.error(`Failed to send email: ${error.message}`);
  //   }
  // }

  async sendWelcomeEmail(to: string, firstName: string): Promise<void> {
    try {
      const capitalizedFirstName =
        firstName.charAt(0).toUpperCase() + firstName.slice(1);

      // Determine environment (dev or prod) from your environment variables
      const environment = this.configService.get<string>('ENV'); // 'development' or 'production'

      // Set different QR codes and links based on environment
      const iosLink =
        environment === 'production'
          ? 'https://testflight.apple.com/join/UVTbUD7M' // Production iOS link
          : 'https://testflight.apple.com/join/KDfe3tGH'; // Development iOS link

      const androidLink =
        environment === 'production'
          ? 'http://34.57.92.8/apks/chorus.apk' // Production Android APK link
          : 'http://35.223.244.137/apks/chorus_dev.apk'; // Development Android APK link

      const iosQRPath =
        environment === 'production'
          ? path.resolve(
              __dirname,
              '..',
              '..',
              'documents',
              'iOS_chorus_prod.png',
            ) // Production iOS QR code
          : path.resolve(
              __dirname,
              '..',
              '..',
              'documents',
              'iOS_chorus_dev.png',
            ); // Development iOS QR code

      const androidQRPath =
        environment === 'production'
          ? path.resolve(
              __dirname,
              '..',
              '..',
              'documents',
              'android_chorus_prod.png',
            ) // Production Android QR code
          : path.resolve(
              __dirname,
              '..',
              '..',
              'documents',
              'android_chorus_dev.png',
            ); // Development Android QR code

      await this.transporter.sendMail({
        from: this.emailUser, // Sender address
        to, // List of receivers
        subject: 'Welcome to Chorus Asset Management',
        html: `
          <p>Hi ${capitalizedFirstName},</p>
          <p>Thank you for registering with Asset management. Your account has been successfully created.</p>
          <p>To get started, you can download the Asset Management mobile app on your smartphone by scanning the appropriate QR code or clicking the link below:</p>
          <p><strong>For iOS Users:</strong><br>
            <a href="${iosLink}" style="display:inline-block; margin-bottom:10px;">iOS Install</a><br>
            <img src="cid:iosQR" alt="iOS QR Code" style="width:150px;height:150px;" /></p>
          <p><strong>For Android Users:</strong><br>
            <a href="${androidLink}" style="display:inline-block; margin-bottom:10px;">Android Install</a><br>
            <img src="cid:androidQR" alt="Android QR Code" style="width:150px;height:150px;" /></p>
          <p>Additionally, we've attached the Chorus Asset Management User Manual to help you familiarize yourself with the platform. It contains step-by-step instructions and helpful tips to get the most out of the app.</p>
          <p>Best Regards,<br>Chorus Team</p>
        `,
        attachments: [
          {
            filename: 'Chorus Asset Management User Manual.pdf',
            path: path.resolve(
              __dirname,
              '..',
              '..',
              'documents',
              'Chorus_Asset_Management_User_Manual.pdf',
            ), // Path to user manual
          },
          {
            filename: 'IOS_QR.jpeg',
            path: iosQRPath, // Dynamic iOS QR code based on environment
            cid: 'iosQR', // Embedding iOS QR code using cid
          },
          {
            filename: 'Android_QR.png',
            path: androidQRPath, // Dynamic Android QR code based on environment
            cid: 'androidQR', // Embedding Android QR code using cid
          },
        ],
      });

      this.logger.log(`Welcome email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
    }
  }

  generateOtp(): string {
    // Generate a 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    return otp;
  }
}
