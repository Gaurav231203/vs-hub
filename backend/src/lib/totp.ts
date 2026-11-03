import { authenticator } from 'otplib';

authenticator.options = {
  window: 1, // accept 1 step before/after for 30s clock skew
  step: 30,
  digits: 6,
};

export const generateTotpSecret = () => authenticator.generateSecret(20);
export const generateQrUri = (email: string, secret: string) =>
  authenticator.keyuri(email, 'VS Adda', secret);
export const verifyTotpToken = (token: string, secret: string) =>
  authenticator.verify({ token, secret });
