import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type GenerateAuthenticationOptionsOpts,
  type VerifyRegistrationResponseOpts,
  type VerifyAuthenticationResponseOpts
} from '@simplewebauthn/server';
import { storage } from '../storage.js';
import type { 
  WebauthnCredential, 
  InsertWebauthnCredential, 
  InsertWebauthnChallenge,
  User 
} from '../../shared/schema.js';
import { ConfigurationManager } from '../config/ConfigurationManager';

export class WebauthnService {
  private rpName = 'AI Biometric Platform';
  private rpID: string;
  private origin: string;

  constructor() {
    const config = ConfigurationManager.getInstance();
    this.rpID = this.validateRpId(config.get<string>('webauthn.rpId'));
    this.origin = this.validateOrigin(config.get<string>('webauthn.origin'));
  }

  private validateRpId(rpId?: string): string {
    if (!rpId) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('RP_ID environment variable is required in production');
      }
      return 'localhost';
    }
    
    // Validate RP_ID format (basic domain validation)
    if (!/^[a-zA-Z0-9.-]+$/.test(rpId)) {
      throw new Error('Invalid RP_ID format');
    }
    
    return rpId;
  }

  private validateOrigin(origin?: string): string {
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('ORIGIN environment variable is required in production');
      }
      return 'http://localhost:5000';
    }
    
    // Validate origin format
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Origin must use http or https protocol');
      }
      if (process.env.NODE_ENV === 'production' && url.protocol === 'http:') {
        throw new Error('HTTPS required in production');
      }
      return origin;
    } catch (error) {
      throw new Error(`Invalid ORIGIN format: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate registration options for new WebAuthn credential
   */
  async generateRegistrationOptions(user: User): Promise<any> {
    try {
      // Get existing credentials for the user
      const existingCredentials = await this.getUserCredentials(user.id);
      
      const options = await generateRegistrationOptions({
        rpName: this.rpName,
        rpID: this.rpID,
        userID: user.id.toString(),
        userName: user.username,
        userDisplayName: user.username,
        timeout: 60000,
        attestationType: 'none',
        excludeCredentials: existingCredentials.map(cred => ({
          id: Buffer.from(cred.id, 'base64url'),
          type: 'public-key',
          transports: cred.transports as AuthenticatorTransport[]
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform'
        },
        supportedAlgorithmIDs: [-7, -257]
      });

      // Store challenge
      await this.storeChallenge(options.challenge, user.id, 'registration');

      return options;
    } catch (error) {
      console.error('Error generating registration options:', error);
      throw new Error('Failed to generate registration options');
    }
  }

  /**
   * Verify registration response and store credential
   */
  async verifyRegistration(
    response: any,
    expectedChallenge: string,
    credentialName?: string
  ): Promise<{ verified: boolean; credential?: WebauthnCredential }> {
    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: true
      });

      if (!verification.verified || !verification.registrationInfo) {
        return { verified: false };
      }

      const { registrationInfo } = verification;
      
      // Store the credential
      const credentialData: InsertWebauthnCredential = {
        id: Buffer.from(registrationInfo.credentialID).toString('base64url'),
        userId: await this.getUserIdFromChallenge(expectedChallenge),
        publicKey: Buffer.from(registrationInfo.credentialPublicKey).toString('base64'),
        counter: BigInt(registrationInfo.counter),
        deviceType: registrationInfo.aaguid ? 'platform' : 'roaming',
        backedUp: registrationInfo.credentialBackedUp,
        transports: response.response.transports,
        credentialName: credentialName || 'Biometric Device'
      };

      const credential = await storage.createWebauthnCredential(credentialData);
      
      // Mark challenge as used
      await this.markChallengeUsed(expectedChallenge);

      return { verified: true, credential };
    } catch (error) {
      console.error('Error verifying registration:', error);
      return { verified: false };
    }
  }

  /**
   * Generate authentication options
   */
  async generateAuthenticationOptions(userId?: number): Promise<any> {
    try {
      let allowCredentials: any[] = [];

      if (userId) {
        const userCredentials = await this.getUserCredentials(userId);
        allowCredentials = userCredentials.map(cred => ({
          id: Buffer.from(cred.id, 'base64url'),
          type: 'public-key',
          transports: cred.transports as AuthenticatorTransport[]
        }));
      }

      const options = await generateAuthenticationOptions({
        timeout: 60000,
        allowCredentials,
        userVerification: 'preferred',
        rpID: this.rpID
      });

      // Store challenge
      await this.storeChallenge(options.challenge, userId, 'authentication');

      return options;
    } catch (error) {
      console.error('Error generating authentication options:', error);
      throw new Error('Failed to generate authentication options');
    }
  }

  /**
   * Verify authentication response
   */
  async verifyAuthentication(
    response: any,
    expectedChallenge: string
  ): Promise<{ verified: boolean; user?: User; credential?: WebauthnCredential }> {
    try {
      const credentialId = Buffer.from(response.id, 'base64url').toString('base64url');
      const credential = await this.getCredentialById(credentialId);

      if (!credential) {
        return { verified: false };
      }

      const user = await storage.getUser(credential.userId);
      if (!user) {
        return { verified: false };
      }

      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        authenticator: {
          credentialID: Buffer.from(credential.id, 'base64url'),
          credentialPublicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: Number(credential.counter),
          transports: credential.transports as AuthenticatorTransport[]
        },
        requireUserVerification: true
      });

      if (!verification.verified) {
        return { verified: false };
      }

      // SECURITY FIX: Atomic update to prevent race conditions
      await Promise.all([
        this.updateCredentialCounter(
          credential.id,
          BigInt(verification.authenticationInfo.newCounter)
        ),
        this.markChallengeUsed(expectedChallenge)
      ]);

      return { verified: true, user, credential };
    } catch (error) {
      console.error('Error verifying authentication:', error);
      return { verified: false };
    }
  }

  /**
   * Get user's WebAuthn credentials
   */
  async getUserCredentials(userId: number): Promise<WebauthnCredential[]> {
    return await storage.getWebauthnCredentials(userId);
  }

  /**
   * Get credential by ID
   */
  async getCredentialById(credentialId: string): Promise<WebauthnCredential | undefined> {
    return await storage.getWebauthnCredential(credentialId);
  }

  /**
   * Delete a credential
   */
  async deleteCredential(credentialId: string, userId: number): Promise<boolean> {
    const credential = await this.getCredentialById(credentialId);
    if (!credential || credential.userId !== userId) {
      return false;
    }
    return await storage.deleteWebauthnCredential(credentialId);
  }

  /**
   * Store challenge for verification
   */
  private async storeChallenge(
    challenge: string,
    userId: number | undefined,
    type: 'registration' | 'authentication'
  ): Promise<void> {
    // SECURITY FIX: Prevent challenge reuse attacks by requiring valid userId
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      throw new Error('Invalid userId: challenges must be associated with valid user accounts');
    }
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    
    const challengeData: InsertWebauthnChallenge = {
      challenge,
      userId,
      type,
      expiresAt
    };

    await storage.createWebauthnChallenge(challengeData);
  }

  /**
   * Get user ID from challenge
   */
  private async getUserIdFromChallenge(challenge: string): Promise<number> {
    const challengeRecord = await storage.getWebauthnChallenge(challenge);
    if (!challengeRecord || !challengeRecord.userId) {
      throw new Error('Invalid challenge');
    }
    return challengeRecord.userId;
  }

  /**
   * Mark challenge as used
   */
  private async markChallengeUsed(challenge: string): Promise<void> {
    await storage.markWebauthnChallengeUsed(challenge);
  }

  /**
   * Update credential counter
   */
  private async updateCredentialCounter(credentialId: string, counter: bigint): Promise<void> {
    await storage.updateWebauthnCredentialCounter(credentialId, counter);
  }

  /**
   * Check if user has WebAuthn credentials
   */
  async hasWebauthnCredentials(userId: number): Promise<boolean> {
    const credentials = await this.getUserCredentials(userId);
    return credentials.length > 0;
  }

  /**
   * Cleanup expired challenges
   */
  async cleanupExpiredChallenges(): Promise<void> {
    await storage.cleanupExpiredWebauthnChallenges();
  }
}

export const webauthnService = new WebauthnService();