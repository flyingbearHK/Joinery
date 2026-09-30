import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowedTokens = new Set([
  "0BSD",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "BSL-1.0",
  "CC0-1.0",
  "CDLA-Permissive-2.0",
  "EPL-2.0",
  "GPL-3.0-or-later",
  "ISC",
  "LGPL-2.1-or-later",
  "MIT",
  "MIT-0",
  "MPL-2.0",
  "Unicode-3.0",
  "Unicode-DFS-2016",
  "Unlicense",
  "Zlib",
]);

function isAllowed(expression) {
  if (!expression) return false;
  return expression
    .replace(/[()]/g, "")
    .replace(/\s*\/\s*/g, " OR ")
    .split(/\s+(?:OR|AND)\s+/)
    .every((token) => allowedTokens.has(token.trim()));
}

const failures = [];
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
for (const [path, pkg] of Object.entries(packageLock.packages ?? {})) {
  if (!path || pkg.dev || !pkg.license) continue;
  if (!isAllowed(pkg.license)) {
    failures.push(`npm ${path.replace(/^node_modules\//, "")}: ${pkg.license}`);
  }
}

const cargo = JSON.parse(
  execFileSync(
    "cargo",
    ["metadata", "--format-version", "1", "--manifest-path", "src-tauri/Cargo.toml"],
    { encoding: "utf8", maxBuffer: 30 * 1024 * 1024 },
  ),
);
for (const pkg of cargo.packages) {
  if (pkg.name === "joinery") continue;
  if (!isAllowed(pkg.license)) {
    failures.push(`cargo ${pkg.name}@${pkg.version}: ${pkg.license ?? "missing"}`);
  }
}

if (failures.length > 0) {
  console.error("Unapproved or missing dependency licenses:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("All production dependency licenses match the approved policy.");
