#!/usr/bin/env node
/**
 * solar — off-grid solar PV sizing CLI.
 * See src/cli.js for the full command list, or run `solar --help`.
 */
"use strict";

const { run } = require("../src/cli");
const { InputError } = require("../src/errors");

try {
  const output = run(process.argv.slice(2));
  if (output) process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
} catch (err) {
  if (err instanceof InputError) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`Internal error: ${err.message}\n`);
  process.exit(1);
}
