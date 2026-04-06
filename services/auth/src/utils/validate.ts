import { ValidationError } from '@nova/shared';

// E.164 format: +[country code][number], 8-15 digits total
const PHONE_REGEX = /^\+[1-9]\d{7,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_REGEX   = /^\d{4}$/;

export function validatePhone(phone: string): void {
  if (!PHONE_REGEX.test(phone.trim())) {
    throw new ValidationError('Invalid phone number. Use international format e.g. +919876543210');
  }
}

export function validateEmail(email: string): void {
  if (!EMAIL_REGEX.test(email.trim())) {
    throw new ValidationError('Invalid email address');
  }
}

export function validateOTP(otp: string): void {
  if (!OTP_REGEX.test(otp)) {
    throw new ValidationError('OTP must be a 4-digit number');
  }
}

export function validateTarget(target: string, targetType: 'PHONE' | 'EMAIL'): void {
  if (targetType === 'PHONE') validatePhone(target);
  else validateEmail(target);
}
