import ejs from 'ejs';
import nodemailer from 'nodemailer';
import path from 'path';
import { config } from '../../configs/config';

interface IEmailData {
  user: {
    email: string;
  };
}

export class SendMail {
  private readonly data: IEmailData;

  constructor(data: IEmailData) {
    this.data = data;
  }

  private transporter = nodemailer.createTransport({
    host: config.EMAIL_HOST,
    port: Number(config.EMAIL_PORT),
    secure: Number(config.EMAIL_PORT) === 465,
    auth: {
      user: config.EMAIL_USERNAME,
      pass: config.EMAIL_PASSWORD,
    },
  });

  send = async (template: string, subject: string) => {
    try {
      await this.transporter.sendMail({
        from: `Jsdev Robin <${config.EMAIL_FROM}>`,
        to: this.data.user.email,
        subject: subject,
        html: await ejs.renderFile(
          path.join(__dirname, '../../views/emails', `${template}.ejs`),
          {
            data: { ...this.data },
            subject,
          }
        ),
      });
    } catch (error) {
      console.error(`Error sending email:`, error);
    }
  };

  public async verifyEmail(): Promise<void> {
    await this.send('verifyEmail', 'Email verify');
  }

  public async parcelAssignCustomer(): Promise<void> {
    await this.send(
      'parcelAssignCustomer',
      'Your parcel has been assigned to a delivery agent'
    );
  }

  public async parcelAssignAgent(): Promise<void> {
    await this.send(
      'parcelAssignAgent',
      'Your have assigned a parcel from admin'
    );
  }
}
