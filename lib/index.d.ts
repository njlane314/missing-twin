import { ConfigSchema, type MissingTwinConfig } from './config.js';
import { type Mode, type ScanResult } from './report.js';
export interface CochangeRule {
    source: string;
    target: string;
    support: number;
    sourceSupport: number;
    confidence: number;
    lift: number;
    score: number;
}
export interface CochangeModel {
    tool: string;
    version: string;
    since: string;
    commitsAnalyzed: number;
    commitsIgnored: number;
    rules: CochangeRule[];
}
export interface ScanOptions {
    base: string;
    head: string;
    cwd?: string;
    configPath?: string;
    configOverrides?: Partial<MissingTwinConfig>;
    mode?: Mode;
    modelPath?: string;
    since?: string;
    coverage?: string;
    eventPath?: string;
}
export declare function runScan(options: ScanOptions): Promise<ScanResult>;
export declare function learnModel(options: {
    cwd?: string;
    ref?: string;
    configPath?: string;
    configOverrides?: Partial<MissingTwinConfig>;
    since?: string;
}): CochangeModel;
export { ConfigSchema };
