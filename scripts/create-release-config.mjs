import { writeFileSync } from "node:fs";

const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
const repository = process.env.GITHUB_REPOSITORY;
if (!publicKey || !repository) {
  throw new Error(
    "TAURI_UPDATER_PUBLIC_KEY and GITHUB_REPOSITORY are required for release builds.",
  );
}

writeFileSync(
  "src-tauri/tauri.release.conf.json",
  `${JSON.stringify(
    {
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          pubkey: publicKey,
          endpoints: [
            `https://github.com/${repository}/releases/latest/download/latest.json`,
          ],
        },
      },
    },
    null,
    2,
  )}\n`,
);
