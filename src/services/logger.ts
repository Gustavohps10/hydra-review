import { storage } from 'wxt/storage';

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

const MAX_LOGS = 100; // Manter apenas os 100 últimos logs para não estourar limite do storage

export const loggerService = {
  async addLog(level: 'info' | 'warn' | 'error', source: string, message: string) {
    console[level](`[${source}] ${message}`); // Também cospe no console do navegador

    try {
      const logs = (await storage.getItem<LogEntry[]>('local:hydra_logs')) || [];
      const newLog: LogEntry = {
        timestamp: Date.now(),
        level,
        message,
        source
      };

      logs.push(newLog);
      
      // Trim se exceder o limite
      if (logs.length > MAX_LOGS) {
        logs.splice(0, logs.length - MAX_LOGS);
      }

      await storage.setItem('local:hydra_logs', logs);
    } catch (err) {
      console.error('Falha ao escrever log no storage', err);
    }
  },

  async getLogs(): Promise<LogEntry[]> {
    return (await storage.getItem<LogEntry[]>('local:hydra_logs')) || [];
  },

  async clearLogs() {
    await storage.removeItem('local:hydra_logs');
  }
};
