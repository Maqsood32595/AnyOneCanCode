#!/usr/bin/env node

import * as esbuild from 'esbuild';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const baseConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  external: [
    'vscode',
    '@anthropic-ai/sdk',
    '@aws-sdk/client-bedrock-runtime',
    '@google-cloud/vertexai',
    '@google/genai',
    '@grpc/grpc-js',
    '@modelcontextprotocol/sdk',
    '@opentelemetry/api',
    '@sentry/browser',
    'axios',
    'clone-deep',
    'diff',
    'execa',
    'openai',
    'simple-git',
    'turndown',
    'ulid',
    'uuid',
    'vscode-uri',
    'zod'
  ],
  platform: 'node',
  target: 'node16',
  minify: isProduction,
  sourcemap: !isProduction,
  sourcesContent: !isProduction,
  outfile: 'out/extension.js',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': isProduction ? '"production"' : '"development"'
  }
};

async function build() {
  try {
    if (isWatch) {
      const context = await esbuild.context(baseConfig);
      await context.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(baseConfig);
      console.log('Build completed successfully');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
