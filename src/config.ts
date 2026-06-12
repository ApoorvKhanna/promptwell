import fs from 'fs';
import path from 'path';
import os from 'os';

export interface PromptWellConfig {
  anthropic_api_key: string;
  effort: 'low' | 'high' | 'xhigh';
  phase1_model: string;
}

export const CONFIG_DIR = path.join(os.homedir(), '.promptwell');
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH);
}

export function readConfig(): PromptWellConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error('PromptWell not initialized. Run: npx promptwell init');
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as PromptWellConfig;
}

export function writeConfig(config: PromptWellConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
