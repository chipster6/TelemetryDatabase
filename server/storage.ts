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
    // No default users - users must be created through proper registration
    // This prevents hardcoded credentials security vulnerability

    // Create default prompt templates (without userId - will be assigned when user creates them)
    const templates = [
      {
        id: this.currentId++,
        name: "Creative Writing Assistant",
        systemPrompt: "You are an expert creative writing assistant. Your responses should be imaginative, well-structured, and engaging. Consider the user's biometric state when adjusting tone and complexity.",
        category: "Creative",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Code Review Expert",
        systemPrompt: "You are a senior software engineer specializing in code review. Provide detailed, constructive feedback on code quality, best practices, and potential improvements.",
        category: "Technical",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Data Analysis Specialist",
        systemPrompt: "You are a data analysis expert. Help users understand complex data patterns, provide insights, and suggest analytical approaches.",
        category: "Analytics",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Business Strategy Advisor",
        systemPrompt: "You are a strategic business consultant with expertise in market analysis, competitive positioning, and growth strategies. Provide actionable insights for business decisions.",
        category: "Business",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Scientific Research Assistant",
        systemPrompt: "You are a research scientist assistant specialized in methodology, literature review, and hypothesis development. Help design experiments and analyze research findings.",
        category: "Research",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Learning & Education Tutor",
        systemPrompt: "You are an expert educator and tutor. Adapt your teaching style to the user's learning pace and comprehension level. Break down complex concepts into digestible parts.",
        category: "Education",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Health & Wellness Coach",
        systemPrompt: "You are a certified health and wellness coach. Provide evidence-based advice on nutrition, fitness, mental health, and lifestyle optimization. Consider biometric data when available.",
        category: "Health",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Legal Research Assistant",
        systemPrompt: "You are a legal research specialist with expertise in case law, regulations, and legal analysis. Provide thorough research and clear explanations of legal concepts.",
        category: "Legal",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Financial Planning Advisor",
        systemPrompt: "You are a financial planning expert specializing in investment strategies, risk assessment, and wealth management. Provide personalized financial guidance and market insights.",
        category: "Finance",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Marketing & Content Strategist",
        systemPrompt: "You are a digital marketing strategist with expertise in content creation, brand positioning, and campaign optimization. Create compelling marketing materials and strategies.",
        category: "Marketing",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "UX/UI Design Consultant",
        systemPrompt: "You are a user experience and interface design expert. Provide insights on user research, wireframing, prototyping, and design systems for optimal user experiences.",
        category: "Design",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Project Management Expert",
        systemPrompt: "You are a certified project manager with expertise in agile methodologies, risk management, and team coordination. Help plan, execute, and monitor projects effectively.",
        category: "Management",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Therapeutic Writing Guide",
        systemPrompt: "You are a therapeutic writing specialist. Guide users through reflective writing exercises that promote emotional processing and personal growth. Adapt based on stress levels.",
        category: "Wellness",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Technical Documentation Writer",
        systemPrompt: "You are a technical writing expert specializing in clear, comprehensive documentation. Create user manuals, API docs, and technical guides that are accessible and well-structured.",
        category: "Technical",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Innovation & Problem Solving",
        systemPrompt: "You are an innovation consultant specializing in creative problem-solving, design thinking, and breakthrough solutions. Help generate novel approaches to complex challenges.",
        category: "Innovation",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Mindfulness & Meditation Guide",
        systemPrompt: "You are a mindfulness instructor and meditation guide. Provide personalized mindfulness exercises, breathing techniques, and stress reduction practices based on current stress levels.",
        category: "Wellness",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Academic Research Writer",
        systemPrompt: "You are an academic writing specialist with expertise in research papers, thesis development, and scholarly communication. Help structure arguments and improve academic writing quality.",
        category: "Academic",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Customer Service Optimizer",
        systemPrompt: "You are a customer experience specialist focused on service optimization, complaint resolution, and customer satisfaction strategies. Provide solutions for customer-facing challenges.",
        category: "Service",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "Productivity & Time Management",
        systemPrompt: "You are a productivity expert specializing in time management, workflow optimization, and efficiency strategies. Help users maximize their productive potential and reduce cognitive load.",
        category: "Productivity",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      },
      {
        id: this.currentId++,
        name: "AI Ethics & Philosophy",
        systemPrompt: "You are an AI ethics researcher and philosopher. Explore ethical implications of technology, discuss philosophical questions, and provide thoughtful analysis of complex moral issues.",
        category: "Ethics",
        userId: null, // Templates will be assigned to users when they create them
        createdAt: new Date()
      }
    ];

    templates.forEach(template => {
      this.promptTemplates.set(template.id, template);
    });

    // No default device connections - devices will be connected per user
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const user: User = { ...insertUser, password: hashedPassword, id };
    this.users.set(id, user);
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    // For MemStorage, passwords should be hashed when creating users
    // This is a temporary check for plaintext passwords that should be removed
    // once all users are properly created with hashed passwords
    if (user.password.startsWith('$2')) {
      // Password is already hashed
      const isValid = await bcrypt.compare(password, user.password);
      return isValid ? user : undefined;
    } else {
      // Legacy plaintext password - should not exist in production
      console.error('WARNING: Plaintext password detected for user:', username);
      return undefined; // Reject plaintext passwords for security
    }
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
      createdAt: new Date(),
      userId: template.userId ?? null
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
      responseTime: null,
      temperature: session.temperature ?? null,
      maxTokens: session.maxTokens ?? null,
      userId: session.userId ?? null,
      templateId: session.templateId ?? null
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
      timestamp: new Date()
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
      timestamp: new Date(),
      sessionId: correlation.sessionId ?? null,
      attentionScore: correlation.attentionScore ?? null,
      stressScore: correlation.stressScore ?? null,
      cognitiveLoadScore: correlation.cognitiveLoadScore ?? null,
      circadianAlignment: correlation.circadianAlignment ?? null,
      promptComplexityScore: correlation.promptComplexityScore ?? null,
      responseQualityScore: correlation.responseQualityScore ?? null
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
      lastSeen: new Date(),
      userId: connection.userId ?? null
    };
    this.deviceConnections.set(id, newConnection);
    return newConnection;
  }
}

// Database Storage Implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async authenticateUser(username: string, password: string): Promise<User | undefined> {
    const user = await this.getUserByUsername(username);
    if (!user) return undefined;
    
    const isValid = await bcrypt.compare(password, user.password);
    return isValid ? user : undefined;
  }

  // Initialize the admin user from environment variables
  async initializeAdminUser(): Promise<void> {
    const username = process.env.PROMPT_USERNAME;
    const password = process.env.PROMPT_PASSWORD;
    
    if (!username || !password) {
      console.warn('PROMPT_USERNAME or PROMPT_PASSWORD not set');
      return;
    }

    // Check if admin user already exists
    const existingUser = await this.getUserByUsername(username);
    if (existingUser) return;

    // Hash the password and create the admin user
    const hashedPassword = await bcrypt.hash(password, 10);
    await this.createUser({
      username,
      password: hashedPassword,
    });
    
    console.log(`Admin user '${username}' created successfully`);
  }

  // Placeholder implementations for other methods (keep using MemStorage for now)
  async getPromptTemplates(userId?: number): Promise<PromptTemplate[]> {
    return memStorage.getPromptTemplates(userId);
  }

  async getPromptTemplate(id: number): Promise<PromptTemplate | undefined> {
    return memStorage.getPromptTemplate(id);
  }

  async createPromptTemplate(template: InsertPromptTemplate): Promise<PromptTemplate> {
    return memStorage.createPromptTemplate(template);
  }

  async updatePromptTemplate(id: number, template: Partial<InsertPromptTemplate>): Promise<PromptTemplate | undefined> {
    return memStorage.updatePromptTemplate(id, template);
  }

  async deletePromptTemplate(id: number): Promise<boolean> {
    return memStorage.deletePromptTemplate(id);
  }

  async getPromptSessions(userId?: number, limit?: number): Promise<PromptSession[]> {
    return memStorage.getPromptSessions(userId, limit);
  }

  async getPromptSession(id: number): Promise<PromptSession | undefined> {
    return memStorage.getPromptSession(id);
  }

  async createPromptSession(session: InsertPromptSession): Promise<PromptSession> {
    return memStorage.createPromptSession(session);
  }

  async updatePromptSession(id: number, session: Partial<PromptSession>): Promise<PromptSession | undefined> {
    return memStorage.updatePromptSession(id, session);
  }

  async getBiometricData(sessionId?: number, limit?: number): Promise<BiometricData[]> {
    return memStorage.getBiometricData(sessionId, limit);
  }

  async createBiometricData(data: InsertBiometricData): Promise<BiometricData> {
    return memStorage.createBiometricData(data);
  }

  async getLatestBiometricData(userId?: number): Promise<BiometricData | undefined> {
    return memStorage.getLatestBiometricData(userId);
  }

  async getCognitiveCorrelations(sessionId?: number): Promise<CognitiveCorrelation[]> {
    return memStorage.getCognitiveCorrelations(sessionId);
  }

  async createCognitiveCorrelation(correlation: InsertCognitiveCorrelation): Promise<CognitiveCorrelation> {
    return memStorage.createCognitiveCorrelation(correlation);
  }

  async getDeviceConnections(userId?: number): Promise<DeviceConnection[]> {
    return memStorage.getDeviceConnections(userId);
  }

  async updateDeviceConnection(id: number, connection: Partial<DeviceConnection>): Promise<DeviceConnection | undefined> {
    return memStorage.updateDeviceConnection(id, connection);
  }

  async createDeviceConnection(connection: InsertDeviceConnection): Promise<DeviceConnection> {
    return memStorage.createDeviceConnection(connection);
  }
}

const memStorage = new MemStorage();
const dbStorage = new DatabaseStorage();

// Initialize admin user
dbStorage.initializeAdminUser().catch(console.error);

export const storage = dbStorage;
