export default {
  transform: {},
  moduleFileExtensions: ["js", "mjs", "cjs", "json"],
  testEnvironment: "node",
  setupFilesAfterEnv: ["./jest.setup.js"],
  testPathIgnorePatterns: ["/node_modules/"],
  clearMocks: true,
};
