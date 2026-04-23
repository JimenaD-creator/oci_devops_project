/// <reference types="vitest" />
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');

/**
 * All *.test.js / *.test.jsx under src/ (recursively).
 */
function walkTestFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkTestFiles(p));
    } else if (/\.test\.(js|jsx)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * For myFeature.test.jsx → myFeature.jsx (or .js) in the same directory.
 */
function testFileToSourceGlob(testFile) {
  const relFromSrc = path.relative(srcDir, testFile);
  const noTest = relFromSrc.replace(/\.test\.(js|jsx)$/, '');
  for (const ext of ['.jsx', '.js']) {
    const abs = path.join(srcDir, noTest + ext);
    if (fs.existsSync(abs)) {
      return `src/${noTest.replace(/\\/g, '/')}${ext}`.replace(/\/+/g, '/');
    }
  }
  return null;
}

const testedSourceGlobs = [
  ...new Set(
    walkTestFiles(srcDir)
      .map(testFileToSourceGlob)
      .filter(Boolean),
  ),
];

const coverageInclude = testedSourceGlobs.length
  ? testedSourceGlobs
  : ['src/**/*.{js,jsx}'];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/setupTests.js'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: './coverage',
      include: coverageInclude,
      exclude: [
        'src/**/__mocks__/**',
        'src/**/__tests__/**',
        'src/setupTests.js',
        '**/*.test.{js,jsx}',
        '**/*.config.{js,mjs}',
      ],
    },
  },
});
