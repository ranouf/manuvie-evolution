module.exports = {
  collectCoverageFrom: ["src/analytics.js"],
  coverageDirectory: "coverage/jest",
  coverageReporters: ["text", "lcov", "cobertura"],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
  testEnvironment: "node",
  testMatch: ["**/tests/jest/**/*.test.js"],
};
