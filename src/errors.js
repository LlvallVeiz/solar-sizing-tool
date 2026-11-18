/**
 * errors.js — error types shared by the library and the CLI.
 *
 * Two kinds only: input errors (bad profile, bad option, unknown location)
 * and internal errors (should never happen; a bug, not a user mistake).
 * The CLI prints input errors as a one-line message and exits 2.
 */
"use strict";

class InputError extends Error {
  constructor(message) {
    super(message);
    this.name = "InputError";
    this.code = "E_INPUT";
  }
}

class InternalError extends Error {
  constructor(message) {
    super(message);
    this.name = "InternalError";
    this.code = "E_INTERNAL";
  }
}

module.exports = { InputError, InternalError };
