import jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: string;
  tier: string;
}

export function signAccessToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: number,
): string {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(
  userId: string,
  secret: string,
  expiresIn: number,
): string {
  return jwt.sign({ userId }, secret, { expiresIn });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}
