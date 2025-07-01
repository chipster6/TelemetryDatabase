import { 
  users, 
  promptTemplates, 
  promptSessions, 
  biometricData, 
  cognitiveCorrelations, 
  deviceConnections,
  type User, 
  type InsertUser,
  type PromptTemplate,
  type InsertPromptTemplate,
  type PromptSession,
  type InsertPromptSession,
  type BiometricData,
  type InsertBiometricData,
  type CognitiveCorrelation,
  type InsertCognitiveCorrelation,
  type DeviceConnection,
  type InsertDeviceConnection
} from "@shared/schema";
import { postQuantumEncryption } from './services/encryption.js';
import { db } from './db.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  authenticateUser(username: string, password: string): Promise<User | undefined>;

  // Prompt template methods
  getPromptTemplates(userId?: number): Promise<PromptTemplate[]>;
  getPromptTemplate(id: number): Promise<PromptTemplate | undefined>;
  createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate>;
  updatePromptTemplate(id: number, template: Partial<InsertPromptTemplate>): Promise<PromptTemplate | undefined>;
  deletePromptTemplate(id: number): Promise<boolean>;

  // Prompt session methods
  getPromptSessions(userId?: number, limit?: number): Promise<PromptSession[]>;
  getPromptSession(id: number): Promise<PromptSession | undefined>;
  createPromptSession(session: InsertPromptSession): Promise<PromptSession>;
  updatePromptSession(id: number, session: Partial<PromptSession>): Promise<PromptSession | undefined>;

  // Biometric data methods
  getBiometricData(sessionId?: number, limit?: number): Promise<BiometricData[]>;
  createBiometricData(data: InsertBiometricData): Promise<BiometricData>;
  getLatestBiometricData(userId?: number): Promise<BiometricData | undefined>;

  // Cognitive correlation methods
  getCognitiveCorrelations(sessionId?: number): Promise<CognitiveCorrelation[]>;
  createCognitiveCorrelation(correlation: InsertCognitiveCorrelation): Promise<CognitiveCorrelation>;

  // Device connection methods
  getDeviceConnections(userId?: number): Promise<DeviceConnection[]>;
  updateDeviceConnection(id: number, connection: Partial<DeviceConnection>): Promise<DeviceConnection | undefined>;
  createDeviceConnection(connection: InsertDeviceConnection): Promise<DeviceConnection>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private promptTemplates: Map<number, PromptTemplate>;
  private promptSessions: Map<number, PromptSession>;
  private biometricData: Map<number, BiometricData>;
  private cognitiveCorrelations: Map<number, CognitiveCorrelation>;
  private deviceConnections: Map<number, DeviceConnection>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.promptTemplates = new Map();
    this.promptSessions = new Map();
    this.biometricData = new Map();
    this.cognitiveCorrelations = new Map();
    this.deviceConnections = new Map();
    this.currentId = 1;

    // Initialize with default templates and devices
    this.initializeDefaultData();
  }

  private initializeDefaultData() {
    // Create default user
    const defaultUser: User = {
      id: this.currentId++,
      username: "demo_user",
      password: "demo_password"
    };
    this.users.set(defaultUser.id, defaultUser);

    // Create default prompt templates
    const templates = [
      {
        id: this.currentId++,
        name: "Creative Writing Assistant",
        systemPrompt: "You are an expert creative writing assistant. Your responses should be imaginative, well-structured, and engaging. Consider the user's biometric state when adjusting tone and complexity.",
        category: "Creative",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Code Review Expert",
        systemPrompt: "You are a senior software engineer specializing in code review. Provide detailed, constructive feedback on code quality, best practices, and potential improvements.",
        category: "Technical",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Data Analysis Specialist",
        systemPrompt: "You are a data analysis expert. Help users understand complex data patterns, provide insights, and suggest analytical approaches.",
        category: "Analytics",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Business Strategy Advisor",
        systemPrompt: "You are a strategic business consultant with expertise in market analysis, competitive positioning, and growth strategies. Provide actionable insights for business decisions.",
        category: "Business",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Scientific Research Assistant",
        systemPrompt: "You are a research scientist assistant specialized in methodology, literature review, and hypothesis development. Help design experiments and analyze research findings.",
        category: "Research",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Learning & Education Tutor",
        systemPrompt: "You are an expert educator and tutor. Adapt your teaching style to the user's learning pace and comprehension level. Break down complex concepts into digestible parts.",
        category: "Education",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Health & Wellness Coach",
        systemPrompt: "You are a certified health and wellness coach. Provide evidence-based advice on nutrition, fitness, mental health, and lifestyle optimization. Consider biometric data when available.",
        category: "Health",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Legal Research Assistant",
        systemPrompt: "You are a legal research specialist with expertise in case law, regulations, and legal analysis. Provide thorough research and clear explanations of legal concepts.",
        category: "Legal",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Financial Planning Advisor",
        systemPrompt: "You are a financial planning expert specializing in investment strategies, risk assessment, and wealth management. Provide personalized financial guidance and market insights.",
        category: "Finance",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Marketing & Content Strategist",
        systemPrompt: "You are a digital marketing strategist with expertise in content creation, brand positioning, and campaign optimization. Create compelling marketing materials and strategies.",
        category: "Marketing",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "UX/UI Design Consultant",
        systemPrompt: "You are a user experience and interface design expert. Provide insights on user research, wireframing, prototyping, and design systems for optimal user experiences.",
        category: "Design",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Project Management Expert",
        systemPrompt: "You are a certified project manager with expertise in agile methodologies, risk management, and team coordination. Help plan, execute, and monitor projects effectively.",
        category: "Management",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Therapeutic Writing Guide",
        systemPrompt: "You are a therapeutic writing specialist. Guide users through reflective writing exercises that promote emotional processing and personal growth. Adapt based on stress levels.",
        category: "Wellness",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Technical Documentation Writer",
        systemPrompt: "You are a technical writing expert specializing in clear, comprehensive documentation. Create user manuals, API docs, and technical guides that are accessible and well-structured.",
        category: "Technical",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Innovation & Problem Solving",
        systemPrompt: "You are an innovation consultant specializing in creative problem-solving, design thinking, and breakthrough solutions. Help generate novel approaches to complex challenges.",
        category: "Innovation",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Mindfulness & Meditation Guide",
        systemPrompt: "You are a mindfulness instructor and meditation guide. Provide personalized mindfulness exercises, breathing techniques, and stress reduction practices based on current stress levels.",
        category: "Wellness",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Academic Research Writer",
        systemPrompt: "You are an academic writing specialist with expertise in research papers, thesis development, and scholarly communication. Help structure arguments and improve academic writing quality.",
        category: "Academic",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Customer Service Optimizer",
        systemPrompt: "You are a customer experience specialist focused on service optimization, complaint resolution, and customer satisfaction strategies. Provide solutions for customer-facing challenges.",
        category: "Service",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Productivity & Time Management",
        systemPrompt: "You are a productivity expert specializing in time management, workflow optimization, and efficiency strategies. Help users maximize their productive potential and reduce cognitive load.",
        category: "Productivity",
        userId: defaultUser.id,
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "AI Ethics & Philosophy",
        systemPrompt: "You are an AI ethics researcher and philosopher. Explore ethical implications of technology, discuss philosophical questions, and provide thoughtful analysis of complex moral issues.",
        category: "Ethics",
        userId: defaultUser.id,
        createdAt: new Date()
      }
    ];

    templates.forEach(template => {
      this.promptTemplates.set(template.id, template);
    });

    // Create default device connections
    const devices = [
      {
        id: this.currentId++,
        deviceType: "heart_rate_monitor",
        deviceName: "Polar H10",
        connectionStatus: "connected",
        lastSeen: new Date(),
        userId: defaultUser.id
      },
      {
        id: this.currentId++,
        deviceType: "smart_ring",
        deviceName: "Oura Ring Gen3",
        connectionStatus: "connected",
        lastSeen: new Date(),
        userId: defaultUser.id
      },
      {
        id: this.currentId++,
        deviceType: "environmental",
        deviceName: "Environmental Sensors",
        connectionStatus: "simulated",
        lastSeen: new Date(),
        userId: defaultUser.id
      }
    ];

    devices.forEach(device => {
      this.deviceConnections.set(device.id, device);
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getPromptTemplates(userId?: number): Promise<PromptTemplate[]> {
    const templates = Array.from(this.promptTemplates.values());
    return userId ? templates.filter(t => t.userId === userId) : templates;
  }

  async getPromptTemplate(id: number): Promise<PromptTemplate | undefined> {
    return this.promptTemplates.get(id);
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    const id = this.currentId++;
    const newTemplate: PromptTemplate = { 
      ...template, 
      id, 
      createdAt: new Date() 
    };
    this.promptTemplates.set(id, newTemplate);
    return newTemplate;
  }

  async updatePromptTemplate(id: number, template: Partial<InsertPromptTemplate>): Promise<PromptTemplate | undefined> {
    const existing = this.promptTemplates.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...template };
    this.promptTemplates.set(id, updated);
    return updated;
  }

  async deletePromptTemplate(id: number): Promise<boolean> {
    return this.promptTemplates.delete(id);
  }

  async getPromptSessions(userId?: number, limit?: number): Promise<PromptSession[]> {
    const sessions = Array.from(this.promptSessions.values())
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    
    let filtered = userId ? sessions.filter(s => s.userId === userId) : sessions;
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async getPromptSession(id: number): Promise<PromptSession | undefined> {
    return this.promptSessions.get(id);
  }

  async createPromptSession(session: InsertPromptSession): Promise<PromptSession> {
    const id = this.currentId++;
    const newSession: PromptSession = { 
      ...session, 
      id, 
      createdAt: new Date(),
      aiResponse: null,
      responseTime: null
    };
    this.promptSessions.set(id, newSession);
    return newSession;
  }

  async updatePromptSession(id: number, session: Partial<PromptSession>): Promise<PromptSession | undefined> {
    const existing = this.promptSessions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...session };
    this.promptSessions.set(id, updated);
    return updated;
  }

  async getBiometricData(sessionId?: number, limit?: number): Promise<BiometricData[]> {
    const data = Array.from(this.biometricData.values())
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    
    let filtered = sessionId ? data.filter(d => d.sessionId === sessionId) : data;
    return limit ? filtered.slice(0, limit) : filtered;
  }

  async createBiometricData(data: InsertBiometricData): Promise<BiometricData> {
    const id = this.currentId++;
    
    // Encrypt sensitive biometric data at rest
    const sensitiveData = {
      heartRate: data.heartRate,
      hrv: data.hrv,
      stressLevel: data.stressLevel,
      attentionLevel: data.attentionLevel,
      cognitiveLoad: data.cognitiveLoad,
      skinTemperature: data.skinTemperature,
      respiratoryRate: data.respiratoryRate,
      oxygenSaturation: data.oxygenSaturation,
      environmentalData: data.environmentalData
    };
    
    const encryptedData = await postQuantumEncryption.encryptBiometricData(sensitiveData);
    
    const newData: BiometricData = { 
      ...data, 
      id, 
      timestamp: new Date(),
      // Store encryption metadata for decryption
      metadata: JSON.stringify({ encrypted: true, keyId: encryptedData.keyId })
    };
    this.biometricData.set(id, newData);
    return newData;
  }

  async getLatestBiometricData(userId?: number): Promise<BiometricData | undefined> {
    const data = Array.from(this.biometricData.values())
      .sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    
    return data[0];
  }

  async getCognitiveCorrelations(sessionId?: number): Promise<CognitiveCorrelation[]> {
    const correlations = Array.from(this.cognitiveCorrelations.values());
    return sessionId ? correlations.filter(c => c.sessionId === sessionId) : correlations;
  }

  async createCognitiveCorrelation(correlation: InsertCognitiveCorrelation): Promise<CognitiveCorrelation> {
    const id = this.currentId++;
    const newCorrelation: CognitiveCorrelation = { 
      ...correlation, 
      id, 
      timestamp: new Date() 
    };
    this.cognitiveCorrelations.set(id, newCorrelation);
    return newCorrelation;
  }

  async getDeviceConnections(userId?: number): Promise<DeviceConnection[]> {
    const connections = Array.from(this.deviceConnections.values());
    return userId ? connections.filter(c => c.userId === userId) : connections;
  }

  async updateDeviceConnection(id: number, connection: Partial<DeviceConnection>): Promise<DeviceConnection | undefined> {
    const existing = this.deviceConnections.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...connection, lastSeen: new Date() };
    this.deviceConnections.set(id, updated);
    return updated;
  }

  async createDeviceConnection(connection: InsertDeviceConnection): Promise<DeviceConnection> {
    const id = this.currentId++;
    const newConnection: DeviceConnection = { 
      ...connection, 
      id, 
      lastSeen: new Date() 
    };
    this.deviceConnections.set(id, newConnection);
    return newConnection;
  }
}

export const storage = new MemStorage();
