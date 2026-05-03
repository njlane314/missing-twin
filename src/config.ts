import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const TOOL_NAME = 'missing-twin';
export const VERSION = '0.1.3';
export const DEFAULT_CONFIG_PATH = '.github/missing-twin.yml';

export const ConfigSchema = z.object({
  mode: z.enum(['warn', 'fail']).default('warn'),
  since: z.string().default('18 months ago'),
  model_path: z.string().default('.missing-twin/model.json'),
  min_support: z.number().int().min(1).default(4),
  min_confidence: z.number().min(0).max(1).default(0.7),
  min_lift: z.number().min(0).default(1.5),
  max_files_per_commit: z.number().int().min(2).default(80),
  max_findings: z.number().int().min(1).default(10),
  ignore_authors: z.array(z.string()).default(['dependabot[bot]', 'renovate[bot]', 'github-actions[bot]']),
  ignore_paths: z.array(z.string()).default(['node_modules/**', 'dist/**', 'coverage/**']),
  boost_paths: z.array(z.string()).default(['db/migrations/**', 'openapi/**', 'schema.graphql', '.github/workflows/**'])
});

export type MissingTwinConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(configPath = DEFAULT_CONFIG_PATH, cwd = process.cwd(), overrides: Partial<MissingTwinConfig> = {}): MissingTwinConfig {
  const resolved = path.resolve(cwd, configPath);
  let section: unknown = {};
  if (fs.existsSync(resolved)) {
    const parsed = parse(fs.readFileSync(resolved, 'utf8')) ?? {};
    section = typeof parsed === 'object' && parsed !== null && 'missing_twin' in parsed ? (parsed as { missing_twin?: unknown }).missing_twin ?? {} : parsed;
  }
  return ConfigSchema.parse({ ...(section as object), ...compact(overrides) });
}

function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as Partial<T>;
}
