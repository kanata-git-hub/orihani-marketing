import { saveToDB, loadFromDB } from './useThumbnailHistory';

export interface ScenarioHistoryItem {
  id: string;
  title: string;
  rawPlan: string;
  imagePrompt: string;
  videoPrompt: string;
  createdAt: number;
}

export const saveScenarioHistory = async (val: ScenarioHistoryItem[]) => {
  return saveToDB('scenario_history', val);
};

export const loadScenarioHistory = async (): Promise<ScenarioHistoryItem[]> => {
  const result = await loadFromDB('scenario_history');
  return result || [];
};
