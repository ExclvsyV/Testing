import { Pool, QueryResult } from 'pg';
import config from '../config';
import logger from '../utils/logger';

class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;

  private constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      ssl: {
        rejectUnauthorized: false
      }
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected error on idle database client', err);
    });

    this.pool.on('connect', () => {
      logger.info('Connected to database');
    });
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async query<T>(text: string, params: any[] = []): Promise<T[]> {
    try {
      const result: QueryResult = await this.pool.query(text, params);
      return result.rows as T[];
    } catch (error) {
      logger.error('Database query error', { error, text, params });
      throw error;
    }
  }

  public async end(): Promise<void> {
    await this.pool.end();
  }
}

export default DatabaseService.getInstance();
