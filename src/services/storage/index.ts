import type { HydraConfig, ReviewSkill } from '@/types';

const STORAGE_KEY = 'hydra_config';
const SKILLS_STORAGE_KEY = 'hydra_review_skills';

export const DEFAULT_REVIEW_SKILLS: ReviewSkill[] = [
  {
    id: 'criterios-aceite',
    name: '✨ Critérios de aceite',
    prompt: 'Analise se as alterações atendem aos critérios de aceite descritos na tarefa do Redmine.',
    description: 'Validação de requisitos funcionais',
    isDefault: true,
  },
  {
    id: 'analisar-riscos',
    name: '🔍 Analisar riscos',
    prompt: 'Quais os principais riscos ou impactos nas branches e módulos afetados?',
    description: 'Efeitos colaterais e regressões',
    isDefault: true,
  },
  {
    id: 'resumo-alteracoes',
    name: '📝 Resumo das alterações',
    prompt: 'Faça um resumo executivo desta tarefa e dos Merge Requests.',
    description: 'Síntese clara das mudanças',
    isDefault: true,
  },
  {
    id: 'boas-praticas',
    name: '🛡️ Padrões & Tratamento de Erro',
    prompt: 'Verifique se o código segue padrões de tratamento de exceções, validação de inputs e boas práticas.',
    description: 'Qualidade de código e segurança',
    isDefault: true,
  },
];

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

  /**
   * Obtém as skills/tópicos de revisão cadastradas pelo usuário.
   */
  getReviewSkills: async (): Promise<ReviewSkill[]> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get([SKILLS_STORAGE_KEY], (result) => {
          if (chrome.runtime.lastError) {
            return reject(chrome.runtime.lastError);
          }
          const saved = result[SKILLS_STORAGE_KEY];
          if (Array.isArray(saved) && saved.length > 0) {
            resolve(saved);
          } else {
            // Inicializa com as skills padrão caso não haja nenhuma cadastrada
            resolve(DEFAULT_REVIEW_SKILLS);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Salva a lista completa de skills de revisão.
   */
  saveReviewSkills: async (skills: ReviewSkill[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ [SKILLS_STORAGE_KEY]: skills }, () => {
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

  /**
   * Adiciona uma nova skill de revisão.
   */
  addReviewSkill: async (skill: Omit<ReviewSkill, 'id'>): Promise<ReviewSkill[]> => {
    const current = await storageService.getReviewSkills();
    const newSkill: ReviewSkill = {
      ...skill,
      id: `skill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      isDefault: false,
    };
    const updated = [...current, newSkill];
    await storageService.saveReviewSkills(updated);
    return updated;
  },

  /**
   * Remove uma skill de revisão pelo ID.
   */
  deleteReviewSkill: async (id: string): Promise<ReviewSkill[]> => {
    const current = await storageService.getReviewSkills();
    const updated = current.filter((s) => s.id !== id);
    await storageService.saveReviewSkills(updated);
    return updated;
  },

  /**
   * Restaura as skills padrão.
   */
  resetReviewSkills: async (): Promise<ReviewSkill[]> => {
    await storageService.saveReviewSkills(DEFAULT_REVIEW_SKILLS);
    return DEFAULT_REVIEW_SKILLS;
  },
};

