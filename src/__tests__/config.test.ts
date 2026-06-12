import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readConfig, writeConfig, configExists, CONFIG_PATH } from '../config.js';
import fs from 'fs';

vi.mock('fs');

const mockConfig = {
  anthropic_api_key: 'sk-ant-test123',
  effort: 'xhigh' as const,
  phase1_model: 'claude-haiku-4-5',
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('configExists', () => {
  it('returns true when config file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    expect(configExists()).toBe(true);
  });

  it('returns false when config file missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(configExists()).toBe(false);
  });
});

describe('readConfig', () => {
  it('parses config from disk', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockConfig));
    expect(readConfig()).toEqual(mockConfig);
  });

  it('throws when config missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(() => readConfig()).toThrow('PromptWell not initialized');
  });
});

describe('writeConfig', () => {
  it('writes config to disk', () => {
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
    writeConfig(mockConfig);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      CONFIG_PATH,
      JSON.stringify(mockConfig, null, 2)
    );
  });
});
