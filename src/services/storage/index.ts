import type { HydraConfig } from '@/types';

const STORAGE_KEY = 'hydra_config';

export const storageService = {
  /**
   * Obtém a configuração salva localmente no Chrome.
   */
  getConfig: async (): Promise<Partial<HydraConfig>> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve(result[STORAGE_KEY] || {});
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Salva a configuração localmente no Chrome.
   */
  setConfig: async (config: HydraConfig): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ [STORAGE_KEY]: config }, () => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  },
};
