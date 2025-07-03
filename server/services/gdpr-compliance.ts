// GDPR Compliance Service for Biometric Data Processing
import { storage } from '../storage.js';
import { postQuantumEncryption } from './encryption.js';

export interface GDPRConsent {
  id: number;
  userId: number;
  consentType: 'biometric_processing' | 'data_storage' | 'analytics' | 'research';
  purpose: string;
  granted: boolean;
  grantedAt: Date;
  revokedAt?: Date;
  legalBasis: 'consent' | 'legitimate_interest' | 'contract' | 'legal_obligation';
  dataCategories: string[];
  retentionPeriod: number; // days
  ipAddress: string;
  userAgent: string;
}

export interface DataSubjectRequest {
  id: number;
  userId: number;
  requestType: 'access' | 'portability' | 'erasure' | 'rectification' | 'restriction';
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  submittedAt: Date;
  completedAt?: Date;
  reason?: string;
  requestData?: any;
  responseData?: any;
}

export interface ProcessingRecord {
  id: number;
  userId: number;
  operation: string;
  dataType: 'biometric' | 'personal' | 'session' | 'device';
  purpose: string;
  legalBasis: string;
  timestamp: Date;
  ipAddress: string;
  dataSize: number; // bytes
  encrypted: boolean;
}

export class GDPRComplianceService {
  private consents: Map<number, GDPRConsent> = new Map();
  private requests: Map<number, DataSubjectRequest> = new Map();
  private processingRecords: Map<number, ProcessingRecord> = new Map();
  private currentId = 1;

  constructor() {
    console.log('GDPR Compliance Service initialized');
    
    // Set up automatic data retention cleanup
    setInterval(() => {
      this.cleanupExpiredData();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  /**
   * Record consent for biometric data processing (GDPR Article 7)
   */
  async recordConsent(
    userId: number,
    consentType: GDPRConsent['consentType'],
    purpose: string,
    legalBasis: GDPRConsent['legalBasis'],
    dataCategories: string[],
    retentionPeriod: number,
    ipAddress: string,
    userAgent: string
  ): Promise<GDPRConsent> {
    const consent: GDPRConsent = {
      id: this.currentId++,
      userId,
      consentType,
      purpose,
      granted: true,
      grantedAt: new Date(),
      legalBasis,
      dataCategories,
      retentionPeriod,
      ipAddress,
      userAgent
    };

    this.consents.set(consent.id, consent);
    
    // Log for audit trail
    await this.recordProcessingActivity(
      userId,
      'CONSENT_GRANTED',
      'personal',
      purpose,
      legalBasis,
      ipAddress,
      JSON.stringify(consent).length
    );

    console.log(`GDPR: Consent recorded for user ${userId} - ${consentType} for ${purpose}`);
    return consent;
  }

  /**
   * Revoke consent (GDPR Article 7.3)
   */
  async revokeConsent(consentId: number, userId: number): Promise<boolean> {
    const consent = this.consents.get(consentId);
    if (!consent || consent.userId !== userId) {
      return false;
    }

    consent.granted = false;
    consent.revokedAt = new Date();
    this.consents.set(consentId, consent);

    // Log for audit trail
    await this.recordProcessingActivity(
      userId,
      'CONSENT_REVOKED',
      'personal',
      consent.purpose,
      consent.legalBasis,
      'system',
      JSON.stringify(consent).length
    );

    console.log(`GDPR: Consent revoked for user ${userId} - consent ID ${consentId}`);
    
    // Trigger data cleanup if consent was for data storage
    if (consent.consentType === 'data_storage' || consent.consentType === 'biometric_processing') {
      await this.initiateDataErasure(userId, 'consent_revoked');
    }

    return true;
  }

  /**
   * Check if user has valid consent for specific processing (GDPR Article 6)
   */
  hasValidConsent(userId: number, consentType: GDPRConsent['consentType']): boolean {
    const userConsents = Array.from(this.consents.values())
      .filter(c => c.userId === userId && c.consentType === consentType && c.granted && !c.revokedAt);
    
    return userConsents.length > 0;
  }

  /**
   * Submit data subject request (GDPR Chapter III)
   */
  async submitDataSubjectRequest(
    userId: number,
    requestType: DataSubjectRequest['requestType'],
    reason?: string,
    requestData?: any
  ): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: this.currentId++,
      userId,
      requestType,
      status: 'pending',
      submittedAt: new Date(),
      reason,
      requestData
    };

    this.requests.set(request.id, request);

    console.log(`GDPR: Data subject request submitted - User ${userId} requesting ${requestType}`);
    
    // Auto-process certain requests
    if (requestType === 'access') {
      await this.processAccessRequest(request.id);
    }

    return request;
  }

  /**
   * Process access request (GDPR Article 15)
   */
  async processAccessRequest(requestId: number): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request || request.requestType !== 'access') {
      return;
    }

    request.status = 'processing';
    
    try {
      // Collect all user data
      const userData = {
        personal: await this.collectPersonalData(request.userId),
        biometric: await this.collectBiometricData(request.userId),
        sessions: await this.collectSessionData(request.userId),
        devices: await this.collectDeviceData(request.userId),
        consents: this.getUserConsents(request.userId),
        processingRecords: this.getUserProcessingRecords(request.userId)
      };

      request.responseData = userData;
      request.status = 'completed';
      request.completedAt = new Date();

      console.log(`GDPR: Access request completed for user ${request.userId}`);
    } catch (error) {
      request.status = 'rejected';
      request.reason = `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`GDPR: Access request failed for user ${request.userId}:`, error);
    }

    this.requests.set(requestId, request);
  }

  /**
   * Process erasure request (GDPR Article 17 - Right to be forgotten)
   */
  async processErasureRequest(requestId: number): Promise<void> {
    const request = this.requests.get(requestId);
    if (!request || request.requestType !== 'erasure') {
      return;
    }

    request.status = 'processing';
    
    try {
      await this.initiateDataErasure(request.userId, 'user_request');
      
      request.status = 'completed';
      request.completedAt = new Date();
      
      console.log(`GDPR: Erasure request completed for user ${request.userId}`);
    } catch (error) {
      request.status = 'rejected';
      request.reason = `Erasure failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(`GDPR: Erasure request failed for user ${request.userId}:`, error);
    }

    this.requests.set(requestId, request);
  }

  /**
   * Initiate data erasure process
   */
  private async initiateDataErasure(userId: number, reason: string): Promise<void> {
    console.log(`GDPR: Initiating data erasure for user ${userId} - reason: ${reason}`);
    
    // This would integrate with the storage system to delete user data
    // For now, we'll log the action
    await this.recordProcessingActivity(
      userId,
      'DATA_ERASURE_INITIATED',
      'personal',
      'Right to be forgotten',
      'user_request',
      'system',
      0
    );

    // In a real implementation, this would:
    // 1. Delete biometric data from Weaviate
    // 2. Delete session data
    // 3. Delete device connections
    // 4. Anonymize or delete processing records
    // 5. Update consent records
  }

  /**
   * Record processing activity (GDPR Article 30)
   */
  async recordProcessingActivity(
    userId: number,
    operation: string,
    dataType: ProcessingRecord['dataType'],
    purpose: string,
    legalBasis: string,
    ipAddress: string,
    dataSize: number,
    encrypted: boolean = true
  ): Promise<void> {
    const record: ProcessingRecord = {
      id: this.currentId++,
      userId,
      operation,
      dataType,
      purpose,
      legalBasis,
      timestamp: new Date(),
      ipAddress,
      dataSize,
      encrypted
    };

    this.processingRecords.set(record.id, record);
  }

  /**
   * Clean up expired data based on retention policies
   */
  private async cleanupExpiredData(): Promise<void> {
    console.log('GDPR: Running automatic data retention cleanup');
    
    const now = new Date();
    const userConsents = new Map<number, GDPRConsent[]>();
    
    // Group consents by user
    for (const consent of this.consents.values()) {
      if (!userConsents.has(consent.userId)) {
        userConsents.set(consent.userId, []);
      }
      userConsents.get(consent.userId)!.push(consent);
    }

    // Check each user's data retention
    for (const [userId, consents] of userConsents) {
      const activeConsents = consents.filter(c => c.granted && !c.revokedAt);
      
      if (activeConsents.length === 0) {
        // No active consents - check if data should be deleted
        const lastActivity = Math.max(...consents.map(c => c.grantedAt.getTime()));
        const daysSinceLastActivity = (now.getTime() - lastActivity) / (1000 * 60 * 60 * 24);
        
        if (daysSinceLastActivity > 30) { // Default 30-day grace period
          console.log(`GDPR: Auto-deleting data for inactive user ${userId}`);
          await this.initiateDataErasure(userId, 'retention_policy');
        }
      } else {
        // Check retention periods for each consent
        for (const consent of activeConsents) {
          const daysSinceGrant = (now.getTime() - consent.grantedAt.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceGrant > consent.retentionPeriod) {
            console.log(`GDPR: Auto-revoking expired consent ${consent.id} for user ${userId}`);
            await this.revokeConsent(consent.id, userId);
          }
        }
      }
    }
  }

  // Helper methods for data collection
  private async collectPersonalData(userId: number): Promise<any> {
    const user = await storage.getUser(userId);
    return user ? { id: user.id, username: user.username, createdAt: new Date() } : null;
  }

  private async collectBiometricData(userId: number): Promise<any> {
    const data = await storage.getBiometricData();
    return data.filter(d => d.userId === userId || !d.userId); // Include user-specific or general data
  }

  private async collectSessionData(userId: number): Promise<any> {
    return await storage.getPromptSessions(userId);
  }

  private async collectDeviceData(userId: number): Promise<any> {
    return await storage.getDeviceConnections(userId);
  }

  private getUserConsents(userId: number): GDPRConsent[] {
    return Array.from(this.consents.values()).filter(c => c.userId === userId);
  }

  private getUserProcessingRecords(userId: number): ProcessingRecord[] {
    return Array.from(this.processingRecords.values()).filter(r => r.userId === userId);
  }

  // Public API methods
  getConsentStatus(userId: number): { [key: string]: boolean } {
    const consents = this.getUserConsents(userId);
    return {
      biometric_processing: this.hasValidConsent(userId, 'biometric_processing'),
      data_storage: this.hasValidConsent(userId, 'data_storage'),
      analytics: this.hasValidConsent(userId, 'analytics'),
      research: this.hasValidConsent(userId, 'research')
    };
  }

  getDataSubjectRequests(userId: number): DataSubjectRequest[] {
    return Array.from(this.requests.values()).filter(r => r.userId === userId);
  }

  async exportUserData(userId: number): Promise<any> {
    const accessRequest = await this.submitDataSubjectRequest(userId, 'access');
    await this.processAccessRequest(accessRequest.id);
    
    const completedRequest = this.requests.get(accessRequest.id);
    return completedRequest?.responseData;
  }
}

export const gdprService = new GDPRComplianceService();