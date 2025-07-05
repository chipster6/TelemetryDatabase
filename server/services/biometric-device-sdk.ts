import { EventEmitter } from 'events';
import { storage } from '../storage.js';
import type { BiometricData, InsertBiometricData, DeviceConnection } from '../../shared/schema.js';

export interface BiometricReading {
  heartRate?: number;
  hrv?: number;
  stressLevel?: number;
  attentionLevel?: number;
  cognitiveLoad?: number;
  bloodOxygen?: number;
  skinTemperature?: number;
  galvanicSkinResponse?: number;
  timestamp: number;
  deviceId: string;
  deviceSource?: string;
  quality: 'high' | 'medium' | 'low';
  confidence: number;
}

export interface DeviceCapabilities {
  heartRate: boolean;
  hrv: boolean;
  stress: boolean;
  attention: boolean;
  bloodOxygen: boolean;
  temperature: boolean;
  gsr: boolean;
  continuousMonitoring: boolean;
  realTimeStreaming: boolean;
  batteryMonitoring: boolean;
}

export interface DeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  version: string;
  type: 'bluetooth' | 'usb' | 'wifi' | 'proprietary';
  capabilities: DeviceCapabilities;
  connectionStatus: 'connected' | 'disconnected' | 'pairing' | 'error';
  batteryLevel?: number;
  signalStrength?: number;
}

export abstract class BiometricDevice extends EventEmitter {
  protected deviceInfo: DeviceInfo;
  protected isConnected = false;
  protected isStreaming = false;
  protected connectionRetries = 0;
  protected maxRetries = 3;
  protected heartbeatInterval?: NodeJS.Timeout;

  constructor(deviceInfo: DeviceInfo) {
    super();
    this.deviceInfo = deviceInfo;
    this.setupHeartbeat();
  }

  // Abstract methods that must be implemented by device-specific classes
  abstract connect(): Promise<boolean>;
  abstract disconnect(): Promise<boolean>;
  abstract startReading(): Promise<boolean>;
  abstract stopReading(): Promise<boolean>;
  abstract calibrate(): Promise<boolean>;
  abstract getReading(): Promise<BiometricReading>;

  // Common device management methods
  getDeviceInfo(): DeviceInfo {
    return { ...this.deviceInfo };
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  isDeviceStreaming(): boolean {
    return this.isStreaming;
  }

  protected setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.emit('heartbeat', {
        deviceId: this.deviceInfo.id,
        timestamp: Date.now(),
        connected: this.isConnected,
        streaming: this.isStreaming
      });
    }, 30000); // 30-second heartbeat
  }

  protected async handleConnectionError(error: Error): Promise<void> {
    console.error(`Device ${this.deviceInfo.id} connection error:`, error);
    this.connectionRetries++;
    
    if (this.connectionRetries < this.maxRetries) {
      console.log(`Retrying connection (${this.connectionRetries}/${this.maxRetries})`);
      setTimeout(() => this.connect(), 5000);
    } else {
      this.emit('error', { deviceId: this.deviceInfo.id, error: error.message });
    }
  }

  protected validateReading(reading: BiometricReading): boolean {
    // Basic validation for biometric readings
    if (reading.heartRate && (reading.heartRate < 30 || reading.heartRate > 220)) {
      return false;
    }
    if (reading.hrv && (reading.hrv < 0 || reading.hrv > 200)) {
      return false;
    }
    if (reading.stressLevel && (reading.stressLevel < 0 || reading.stressLevel > 1)) {
      return false;
    }
    if (reading.attentionLevel && (reading.attentionLevel < 0 || reading.attentionLevel > 1)) {
      return false;
    }
    if (reading.confidence < 0 || reading.confidence > 1) {
      return false;
    }
    return true;
  }

  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.removeAllListeners();
  }
}

// Apple HealthKit Device Implementation
export class AppleHealthKitDevice extends BiometricDevice {
  constructor() {
    super({
      id: 'healthkit-device',
      name: 'Apple HealthKit',
      manufacturer: 'Apple',
      model: 'HealthKit',
      version: '1.0',
      type: 'proprietary',
      capabilities: {
        heartRate: true,
        hrv: true,
        stress: false,
        attention: false,
        bloodOxygen: true,
        temperature: false,
        gsr: false,
        continuousMonitoring: true,
        realTimeStreaming: false,
        batteryMonitoring: false
      },
      connectionStatus: 'disconnected'
    });
  }

  async connect(): Promise<boolean> {
    try {
      // Simulate HealthKit authorization request
      console.log('Requesting HealthKit authorization...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.isConnected = true;
      this.deviceInfo.connectionStatus = 'connected';
      this.emit('connected', this.deviceInfo);
      return true;
    } catch (error) {
      await this.handleConnectionError(error as Error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    this.isConnected = false;
    this.isStreaming = false;
    this.deviceInfo.connectionStatus = 'disconnected';
    this.emit('disconnected', this.deviceInfo);
    return true;
  }

  async startReading(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    this.isStreaming = true;
    this.emit('streamingStarted', this.deviceInfo);
    return true;
  }

  async stopReading(): Promise<boolean> {
    this.isStreaming = false;
    this.emit('streamingStopped', this.deviceInfo);
    return true;
  }

  async calibrate(): Promise<boolean> {
    // HealthKit doesn't require manual calibration
    return true;
  }

  async getReading(): Promise<BiometricReading> {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    // Simulate reading from HealthKit
    const reading: BiometricReading = {
      heartRate: 60 + Math.random() * 40,
      hrv: 20 + Math.random() * 60,
      bloodOxygen: 95 + Math.random() * 5,
      timestamp: Date.now(),
      deviceId: this.deviceInfo.id,
      quality: 'high',
      confidence: 0.85 + Math.random() * 0.15
    };

    if (this.validateReading(reading)) {
      this.emit('reading', reading);
      return reading;
    } else {
      throw new Error('Invalid reading received');
    }
  }
}

// Bluetooth Heart Rate Monitor
export class BluetoothHRMDevice extends BiometricDevice {
  private bluetoothDevice?: any;

  constructor(deviceId: string, deviceName: string) {
    super({
      id: deviceId,
      name: deviceName,
      manufacturer: 'Generic',
      model: 'Bluetooth HRM',
      version: '1.0',
      type: 'bluetooth',
      capabilities: {
        heartRate: true,
        hrv: false,
        stress: false,
        attention: false,
        bloodOxygen: false,
        temperature: false,
        gsr: false,
        continuousMonitoring: true,
        realTimeStreaming: true,
        batteryMonitoring: true
      },
      connectionStatus: 'disconnected'
    });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to Bluetooth device ${this.deviceInfo.name}...`);
      
      // Simulate Bluetooth connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.isConnected = true;
      this.deviceInfo.connectionStatus = 'connected';
      this.deviceInfo.batteryLevel = 85;
      this.deviceInfo.signalStrength = 92;
      
      this.emit('connected', this.deviceInfo);
      return true;
    } catch (error) {
      await this.handleConnectionError(error as Error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    if (this.bluetoothDevice) {
      // Disconnect from Bluetooth device
      this.bluetoothDevice = undefined;
    }
    
    this.isConnected = false;
    this.isStreaming = false;
    this.deviceInfo.connectionStatus = 'disconnected';
    this.emit('disconnected', this.deviceInfo);
    return true;
  }

  async startReading(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    this.isStreaming = true;
    this.emit('streamingStarted', this.deviceInfo);
    
    // Start continuous reading simulation
    this.startContinuousReading();
    return true;
  }

  async stopReading(): Promise<boolean> {
    this.isStreaming = false;
    this.emit('streamingStopped', this.deviceInfo);
    return true;
  }

  async calibrate(): Promise<boolean> {
    console.log(`Calibrating ${this.deviceInfo.name}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    this.emit('calibrated', this.deviceInfo);
    return true;
  }

  async getReading(): Promise<BiometricReading> {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    const reading: BiometricReading = {
      heartRate: 65 + Math.random() * 30,
      timestamp: Date.now(),
      deviceId: this.deviceInfo.id,
      quality: Math.random() > 0.1 ? 'high' : 'medium',
      confidence: 0.8 + Math.random() * 0.2
    };

    if (this.validateReading(reading)) {
      this.emit('reading', reading);
      return reading;
    } else {
      throw new Error('Invalid reading received');
    }
  }

  private startContinuousReading(): void {
    const readingInterval = setInterval(async () => {
      if (!this.isStreaming) {
        clearInterval(readingInterval);
        return;
      }

      try {
        await this.getReading();
      } catch (error) {
        console.error('Error getting reading:', error);
      }
    }, 1000); // 1-second intervals
  }
}

// EEG Device for Attention and Cognitive Load
export class EEGDevice extends BiometricDevice {
  constructor(deviceId: string, deviceName: string) {
    super({
      id: deviceId,
      name: deviceName,
      manufacturer: 'NeuroSky',
      model: 'MindWave Mobile',
      version: '2.0',
      type: 'bluetooth',
      capabilities: {
        heartRate: false,
        hrv: false,
        stress: true,
        attention: true,
        bloodOxygen: false,
        temperature: false,
        gsr: false,
        continuousMonitoring: true,
        realTimeStreaming: true,
        batteryMonitoring: true
      },
      connectionStatus: 'disconnected'
    });
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to EEG device ${this.deviceInfo.name}...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.isConnected = true;
      this.deviceInfo.connectionStatus = 'connected';
      this.deviceInfo.batteryLevel = 72;
      this.deviceInfo.signalStrength = 88;
      
      this.emit('connected', this.deviceInfo);
      return true;
    } catch (error) {
      await this.handleConnectionError(error as Error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    this.isConnected = false;
    this.isStreaming = false;
    this.deviceInfo.connectionStatus = 'disconnected';
    this.emit('disconnected', this.deviceInfo);
    return true;
  }

  async startReading(): Promise<boolean> {
    if (!this.isConnected) return false;
    
    this.isStreaming = true;
    this.emit('streamingStarted', this.deviceInfo);
    return true;
  }

  async stopReading(): Promise<boolean> {
    this.isStreaming = false;
    this.emit('streamingStopped', this.deviceInfo);
    return true;
  }

  async calibrate(): Promise<boolean> {
    console.log(`Calibrating EEG sensors for ${this.deviceInfo.name}...`);
    await new Promise(resolve => setTimeout(resolve, 10000)); // EEG calibration takes longer
    this.emit('calibrated', this.deviceInfo);
    return true;
  }

  async getReading(): Promise<BiometricReading> {
    if (!this.isConnected) {
      throw new Error('Device not connected');
    }

    const reading: BiometricReading = {
      attentionLevel: Math.random(),
      cognitiveLoad: Math.random(),
      stressLevel: Math.random() * 0.8, // Generally lower stress in normal conditions
      timestamp: Date.now(),
      deviceId: this.deviceInfo.id,
      quality: Math.random() > 0.15 ? 'high' : 'medium',
      confidence: 0.7 + Math.random() * 0.3
    };

    if (this.validateReading(reading)) {
      this.emit('reading', reading);
      return reading;
    } else {
      throw new Error('Invalid reading received');
    }
  }
}

// Device SDK Manager
export class BiometricDeviceSDK extends EventEmitter {
  private devices = new Map<string, BiometricDevice>();
  private registeredDeviceTypes = new Map<string, typeof BiometricDevice>();

  constructor() {
    super();
    this.registerBuiltInDevices();
  }

  /**
   * Register built-in device types
   */
  private registerBuiltInDevices(): void {
    this.registeredDeviceTypes.set('apple-healthkit', AppleHealthKitDevice as any);
    this.registeredDeviceTypes.set('bluetooth-hrm', BluetoothHRMDevice as any);
    this.registeredDeviceTypes.set('eeg-device', EEGDevice as any);
  }

  /**
   * Register a custom device type
   */
  registerDeviceType(typeName: string, deviceClass: typeof BiometricDevice): void {
    this.registeredDeviceTypes.set(typeName, deviceClass);
    console.log(`Registered device type: ${typeName}`);
  }

  /**
   * Create and add a device
   */
  async addDevice(
    deviceType: string,
    deviceId: string,
    deviceName?: string,
    options?: any
  ): Promise<BiometricDevice | null> {
    try {
      const DeviceClass = this.registeredDeviceTypes.get(deviceType);
      if (!DeviceClass) {
        throw new Error(`Unknown device type: ${deviceType}`);
      }

      let device: BiometricDevice;
      
      // Create device instance based on type
      switch (deviceType) {
        case 'apple-healthkit':
          device = new (DeviceClass as any)();
          break;
        case 'bluetooth-hrm':
          device = new (DeviceClass as any)(deviceId, deviceName || 'Bluetooth HRM');
          break;
        case 'eeg-device':
          device = new (DeviceClass as any)(deviceId, deviceName || 'EEG Device');
          break;
        default:
          device = new (DeviceClass as any)(deviceId, deviceName, options);
      }

      // Set up event forwarding
      this.setupDeviceEvents(device);
      
      // Store device
      this.devices.set(deviceId, device);
      
      // Store in database
      await this.storeDeviceConnection(device);
      
      this.emit('deviceAdded', device.getDeviceInfo());
      console.log(`Added device: ${deviceId} (${deviceType})`);
      
      return device;
    } catch (error) {
      console.error(`Failed to add device ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Remove a device
   */
  async removeDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    try {
      await device.disconnect();
      device.cleanup();
      this.devices.delete(deviceId);
      
      this.emit('deviceRemoved', deviceId);
      console.log(`Removed device: ${deviceId}`);
      return true;
    } catch (error) {
      console.error(`Failed to remove device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Get all connected devices
   */
  getDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).map(device => device.getDeviceInfo());
  }

  /**
   * Get specific device
   */
  getDevice(deviceId: string): BiometricDevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Connect to a device
   */
  async connectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    return await device.connect();
  }

  /**
   * Disconnect from a device
   */
  async disconnectDevice(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    return await device.disconnect();
  }

  /**
   * Start reading from a device
   */
  async startDeviceReading(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    return await device.startReading();
  }

  /**
   * Stop reading from a device
   */
  async stopDeviceReading(deviceId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    return await device.stopReading();
  }

  /**
   * Get reading from a device
   */
  async getDeviceReading(deviceId: string): Promise<BiometricReading | null> {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    try {
      return await device.getReading();
    } catch (error) {
      console.error(`Failed to get reading from ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Setup event forwarding for devices
   */
  private setupDeviceEvents(device: BiometricDevice): void {
    device.on('connected', (deviceInfo) => {
      this.emit('deviceConnected', deviceInfo);
    });

    device.on('disconnected', (deviceInfo) => {
      this.emit('deviceDisconnected', deviceInfo);
    });

    device.on('reading', async (reading) => {
      this.emit('biometricReading', reading);
      await this.storeBiometricReading(reading);
    });

    device.on('error', (error) => {
      this.emit('deviceError', error);
    });

    device.on('heartbeat', (heartbeat) => {
      this.emit('deviceHeartbeat', heartbeat);
    });
  }

  /**
   * Store device connection in database
   */
  private async storeDeviceConnection(device: BiometricDevice): Promise<void> {
    try {
      const deviceInfo = device.getDeviceInfo();
      
      const connectionData = {
        userId: 1, // Default user for now
        deviceType: deviceInfo.type,
        deviceName: deviceInfo.name,
        connectionStatus: device.isDeviceConnected() ? 'connected' : 'disconnected'
      };

      await storage.createDeviceConnection(connectionData);
    } catch (error) {
      console.error('Failed to store device connection:', error);
    }
  }

  /**
   * Store biometric reading in database
   */
  private async storeBiometricReading(reading: BiometricReading): Promise<void> {
    try {
      const biometricData: InsertBiometricData = {
        sessionId: 1, // Default session for now
        heartRate: reading.heartRate,
        hrv: reading.hrv,
        stressLevel: reading.stressLevel,
        attentionLevel: reading.attentionLevel,
        cognitiveLoad: reading.cognitiveLoad,
        skinTemperature: null,
        respiratoryRate: null,
        oxygenSaturation: null,
        environmentalData: null
      };

      await storage.createBiometricData(biometricData);
    } catch (error) {
      console.error('Failed to store biometric reading:', error);
    }
  }

  /**
   * Discover available devices (simulation)
   */
  async discoverDevices(): Promise<DeviceInfo[]> {
    console.log('Discovering biometric devices...');
    
    // Simulate device discovery
    const discoveredDevices: DeviceInfo[] = [
      {
        id: 'healthkit-001',
        name: 'Apple HealthKit',
        manufacturer: 'Apple',
        model: 'HealthKit',
        version: '1.0',
        type: 'proprietary',
        capabilities: {
          heartRate: true,
          hrv: true,
          stress: false,
          attention: false,
          bloodOxygen: true,
          temperature: false,
          gsr: false,
          continuousMonitoring: true,
          realTimeStreaming: false,
          batteryMonitoring: false
        },
        connectionStatus: 'disconnected'
      },
      {
        id: 'polar-h10-001',
        name: 'Polar H10',
        manufacturer: 'Polar',
        model: 'H10',
        version: '2.1',
        type: 'bluetooth',
        capabilities: {
          heartRate: true,
          hrv: true,
          stress: false,
          attention: false,
          bloodOxygen: false,
          temperature: false,
          gsr: false,
          continuousMonitoring: true,
          realTimeStreaming: true,
          batteryMonitoring: true
        },
        connectionStatus: 'disconnected',
        batteryLevel: 89,
        signalStrength: 95
      }
    ];

    this.emit('devicesDiscovered', discoveredDevices);
    return discoveredDevices;
  }

  /**
   * Cleanup all devices
   */
  cleanup(): void {
    for (const device of this.devices.values()) {
      device.cleanup();
    }
    this.devices.clear();
    this.removeAllListeners();
  }
}

export const deviceSDK = new BiometricDeviceSDK();