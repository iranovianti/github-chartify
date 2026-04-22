#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(`--${name}`);
  if (i !== -1) return args[i + 1];
  const eq = args.find(a => a.startsWith(`--${name}=`));
  return eq && eq.slice(name.length + 3);
};

const username = getArg('username');
if (!username) {
  console.error('Usage: node scripts/cli.js --username <user> [--speed|--mode|--style|--loop|--output <value>]');
  process.exit(1);
}

const env = { ...process.env, GITHUB_USERNAME: username };
const map = { speed: 'SVG_SPEED', mode: 'SVG_MODE', style: 'SVG_TRANSFORM_STYLE', loop: 'SVG_LOOP', output: 'SVG_OUTPUT_PATH' };
for (const [k, v] of Object.entries(map)) {
  const val = getArg(k);
  if (val) env[v] = val;
}
if (env.SVG_OUTPUT_PATH && !path.isAbsolute(env.SVG_OUTPUT_PATH)) {
  env.SVG_OUTPUT_PATH = path.resolve(__dirname, '..', env.SVG_OUTPUT_PATH);
}

const run = s => spawnSync('node', [path.join(__dirname, s)], { stdio: 'inherit', env });
if (run('fetch-contributions.js').status !== 0) process.exit(1);
process.exit(run('generate-svg.js').status);
