import crypto from 'crypto';
import logger from '../utils/logger';

class TokenService {
    private secretKey: string;

    constructor() {
        // Use an environment variable for the secret key in production
        this.secretKey = process.env.TOKEN_SECRET_KEY || 'waveshield-secure-token-key-v4';
    }

    generateToken(licenseKey: string, version: string, expireHours: number = 12): string {
        try {
            const threshold = 70; // 70 seconds
            const now = new Date();
            const nowEpoch = Math.floor(now.getTime() / 1000)
            const issuedAt = nowEpoch - threshold - (12 * 3600);
            const expiresAt = nowEpoch + (expireHours * 3600) + threshold;

            // Create token payload
            const payload = {
                lic: licenseKey,
                iat: issuedAt,
                exp: expiresAt,
                ver: version,
            };

            // Convert payload to base64
            const payloadString = JSON.stringify(payload);
            const base64Payload = Buffer.from(payloadString).toString('base64');

            // Create signature using HMAC
            const signature = crypto
                .createHmac('sha256', this.secretKey)
                .update(base64Payload)
                .digest('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');

            // Return the complete token: payload.signature
            return `${base64Payload}.${signature}`;
        } catch (error) {
            logger.error('Error generating token', { error });
            return '';
        }
    }
}

export default new TokenService();
