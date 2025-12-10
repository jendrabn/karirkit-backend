#!/usr/bin/env node

/**
 * CLI helper to generate random secrets for .env usage.
 */
const { randomBytes } = require("crypto");

const size = Number(process.argv[2]) || 32;
const secret = randomBytes(size).toString("hex");

console.log(secret);
