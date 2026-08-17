import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(import.meta.dirname);

/**
 * Firestore セキュリティルール回帰テスト用の vitest 設定。
 * firestore.chat.rules を emulator に読み込み、@firebase/rules-unit-testing で検証する。
 * 実行は `pnpm test:rules`（emulator を起動してから vitest を回す）。
 */
export default defineConfig({
  root,
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
