import { z } from 'zod';
export declare const TOOL_NAME = "engram";
export declare const VERSION = "0.1.3";
export declare const DEFAULT_CONFIG_PATH = ".github/engram.yml";
export declare const ConfigSchema: z.ZodObject<{
    mode: z.ZodDefault<z.ZodEnum<{
        warn: "warn";
        fail: "fail";
    }>>;
    since: z.ZodDefault<z.ZodString>;
    model_path: z.ZodDefault<z.ZodString>;
    min_support: z.ZodDefault<z.ZodNumber>;
    min_confidence: z.ZodDefault<z.ZodNumber>;
    min_lift: z.ZodDefault<z.ZodNumber>;
    max_files_per_commit: z.ZodDefault<z.ZodNumber>;
    max_findings: z.ZodDefault<z.ZodNumber>;
    ignore_authors: z.ZodDefault<z.ZodArray<z.ZodString>>;
    ignore_paths: z.ZodDefault<z.ZodArray<z.ZodString>>;
    boost_paths: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type MissingTwinConfig = z.infer<typeof ConfigSchema>;
export declare function loadConfig(configPath?: string, cwd?: string, overrides?: Partial<MissingTwinConfig>): MissingTwinConfig;
