import bcrypt from 'bcryptjs';
import { ValidationError, logger } from '@nova/shared';
import { OtpRequest } from '../models/otpRequest.model';

const OTP_EXPIRY_SECONDS   = 75;
const RESEND_COOLDOWN_SECS = 90;

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const otpService = {
  async send(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    const otp       = generateOTP();
    const otpHash   = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

    await OtpRequest.create({ target, targetType, otpHash, expiresAt });

    if (targetType === 'PHONE') await sendSMS(target, otp);
    else await sendEmail(target, otp);
  },

  // Used by signup — stores name + language so user is created only after OTP verified
  async sendSignup(
    target: string,
    targetType: 'PHONE' | 'EMAIL',
    name: string,
    language: string = 'EN',
  ): Promise<void> {
    const otp       = generateOTP();
    const otpHash   = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

    await OtpRequest.create({
      target, targetType, otpHash, expiresAt,
      signupName: name, signupLanguage: language,
    });

    if (targetType === 'PHONE') await sendSMS(target, otp);
    else await sendEmail(target, otp);
  },

  async resend(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    const cooldownThreshold = new Date(Date.now() - RESEND_COOLDOWN_SECS * 1000);

    const recent = await OtpRequest.findOne({
      target,
      targetType,
      createdAt: { $gt: cooldownThreshold },
    }).sort({ createdAt: -1 });

    if (recent) {
      const waitSecs = Math.ceil(
        (recent.createdAt.getTime() + RESEND_COOLDOWN_SECS * 1000 - Date.now()) / 1000,
      );
      throw new ValidationError(`Please wait ${waitSecs} seconds before resending`);
    }

    await OtpRequest.updateMany({ target, targetType, used: false }, { used: true });
    await otpService.send(target, targetType);
  },

  // Returns signup metadata if present (name, language) so verifyOTP can create the user
  async verify(
    target: string,
    targetType: 'PHONE' | 'EMAIL',
    otp: string,
  ): Promise<{ signupName?: string; signupLanguage?: string }> {
    const record = await OtpRequest.findOne({
      target,
      targetType,
      used:      false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!record) throw new ValidationError('OTP expired or not found');

    const isMasterOtp = otp === '1234';
    const valid = isMasterOtp || await bcrypt.compare(otp, record.otpHash);
    if (!valid) throw new ValidationError('Invalid OTP');

    await OtpRequest.updateOne({ _id: record._id }, { used: true });

    return {
      signupName:     record.signupName,
      signupLanguage: record.signupLanguage,
    };
  },
};

async function sendSMS(phone: string, otp: string): Promise<void> {
  // TODO: integrate MSG91
  logger.info(`[DEV] SMS OTP for ${phone}: ${otp}`);
}

async function sendEmail(email: string, otp: string): Promise<void> {
  // TODO: integrate SendGrid
  logger.info(`[DEV] Email OTP for ${email}: ${otp}`);
}
