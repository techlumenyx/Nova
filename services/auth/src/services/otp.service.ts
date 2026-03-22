import bcrypt from 'bcryptjs';
import { getPrismaClient, ValidationError, logger } from '@nova/shared';

const prisma = getPrismaClient();

const OTP_EXPIRY_SECONDS  = 75; // matches the 1:15 timer in the UI
const RESEND_COOLDOWN_SECS = 90;

function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit
}

export const otpService = {
  async send(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    const otp     = generateOTP();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

    await prisma.otpRequest.create({
      data: { target, targetType, otpHash, expiresAt },
    });

    if (targetType === 'PHONE') {
      await sendSMS(target, otp);
    } else {
      await sendEmail(target, otp);
    }
  },

  async resend(target: string, targetType: 'PHONE' | 'EMAIL'): Promise<void> {
    // enforce 90s cooldown — check if a recent OTP was sent
    const cooldownThreshold = new Date(Date.now() - RESEND_COOLDOWN_SECS * 1000);
    const recent = await prisma.otpRequest.findFirst({
      where: {
        target,
        targetType,
        createdAt: { gt: cooldownThreshold },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recent) {
      const waitSecs = Math.ceil(
        (recent.createdAt.getTime() + RESEND_COOLDOWN_SECS * 1000 - Date.now()) / 1000,
      );
      throw new ValidationError(`Please wait ${waitSecs} seconds before resending`);
    }

    // invalidate all previous unused OTPs for this target
    await prisma.otpRequest.updateMany({
      where: { target, targetType, used: false },
      data:  { used: true },
    });

    await otpService.send(target, targetType);
  },

  async verify(target: string, targetType: 'PHONE' | 'EMAIL', otp: string): Promise<void> {
    const record = await prisma.otpRequest.findFirst({
      where: {
        target,
        targetType,
        used:      false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) throw new ValidationError('OTP expired or not found');

    const valid = await bcrypt.compare(otp, record.otpHash);
    if (!valid) throw new ValidationError('Invalid OTP');

    await prisma.otpRequest.update({
      where: { id: record.id },
      data:  { used: true },
    });
  },
};

async function sendSMS(phone: string, otp: string): Promise<void> {
  // TODO: integrate MSG91
  // await fetch('https://api.msg91.com/api/v5/otp', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', authkey: process.env.MSG91_API_KEY! },
  //   body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: phone, otp }),
  // });
  logger.info(`[DEV] SMS OTP for ${phone}: ${otp}`);
}

async function sendEmail(email: string, otp: string): Promise<void> {
  // TODO: integrate SendGrid
  // await fetch('https://api.sendgrid.com/v3/mail/send', { ... });
  logger.info(`[DEV] Email OTP for ${email}: ${otp}`);
}
