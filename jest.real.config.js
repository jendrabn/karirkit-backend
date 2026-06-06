const { createDefaultPreset } = require("ts-jest");
const fs = require("fs");
const path = require("path");

const tsJestTransformCfg = createDefaultPreset().transform;
const apiTestDirectory = path.join(__dirname, "tests", "api");
const realApiTests = fs
  .readdirSync(apiTestDirectory)
  .filter((fileName) => fileName.endsWith(".test.ts"))
  .filter((fileName) =>
    fs
      .readFileSync(path.join(apiTestDirectory, fileName), "utf8")
      .includes("RUN_REAL_API_TESTS"),
  )
  .map((fileName) => `<rootDir>/tests/api/${fileName}`);

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  testMatch: realApiTests,
  transform: {
    ...tsJestTransformCfg,
  },
  setupFilesAfterEnv: ["<rootDir>/tests/api/jest.real.setup.ts"],
};
