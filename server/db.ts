import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { ConfigurationManager } from './config/ConfigurationManager';

neonConfig.webSocketConstructor = ws;

const config = ConfigurationManager.getInstance();
const databaseUrl = config.get<string>('database.url');

export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: config.get<number>('database.poolSize'),
  connectionTimeoutMillis: config.get<number>('database.timeout')
});
export const db = drizzle({ client: pool, schema });