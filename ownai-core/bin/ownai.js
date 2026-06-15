#!/usr/bin/env node
import { runCli } from '../src/cli.js';

runCli(process.argv).catch((err) => {
  console.error('ownai:', err.message);
  process.exit(1);
});
