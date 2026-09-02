// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // worker/ targets the Cloudflare runtime, not React Native — it has its
    // own tsconfig and is linted/type-checked from inside that directory.
    ignores: ["dist/*", "worker/*"],
  }
]);
