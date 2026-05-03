#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { VERSION, DEFAULT_CONFIG_PATH } from './config.js';
import { learnModel, runScan } from './index.js';
import { exitCodeFor, renderMarkdown } from './report.js';
const program = new Command();
program.name('engram').description('Detect likely omitted companion changes in a PR.').version(VERSION);
program.command('scan')
    .requiredOption('--base <ref>', 'base git ref')
    .requiredOption('--head <ref>', 'head git ref')
    .option('--config <path>', 'config path', DEFAULT_CONFIG_PATH)
    .option('--model <path>', 'precomputed model path')
    .option('--mode <mode>', 'warn or fail', 'warn')
    .option('--format <format>', 'markdown or json', 'markdown')
    .action(async (options) => {
    const result = await runScan({ base: options.base, head: options.head, configPath: options.config, mode: options.mode, modelPath: options.model });
    process.stdout.write(options.format === 'json' ? JSON.stringify(result, null, 2) + '\n' : renderMarkdown(result) + '\n');
    process.exitCode = exitCodeFor(result);
});
program.command('learn')
    .option('--since <window>', 'git history window')
    .option('--out <path>', 'model output path', '.engram/model.json')
    .option('--config <path>', 'config path', DEFAULT_CONFIG_PATH)
    .option('--ref <ref>', 'history ref', 'HEAD')
    .action((options) => {
    const model = learnModel({ ref: options.ref, configPath: options.config, since: options.since });
    const out = path.resolve(process.cwd(), options.out);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(model, null, 2) + '\n');
    process.stdout.write('Wrote ' + model.rules.length + ' co-change rules to ' + options.out + '\n');
});
program.parse();
//# sourceMappingURL=cli.js.map