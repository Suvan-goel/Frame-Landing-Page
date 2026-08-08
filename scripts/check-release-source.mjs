import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(`Release source check failed: ${message}`);
  process.exit(1);
}

let branch;

try {
  branch = git("branch", "--show-current");
} catch (error) {
  fail(error instanceof Error ? error.message : "Git is unavailable.");
}

if (branch !== "main") {
  fail(`expected branch main, found ${branch || "a detached HEAD"}.`);
}

if (git("status", "--porcelain")) {
  fail("the working tree has uncommitted changes.");
}

let localCommit;
let remoteCommit;

try {
  localCommit = git("rev-parse", "HEAD");
  remoteCommit = git("rev-parse", "origin/main");
} catch {
  fail("origin/main is unavailable; fetch and push main before releasing.");
}

if (localCommit !== remoteCommit) {
  fail("local main does not exactly match origin/main; push or update it first.");
}

console.log(`Release source verified: main at ${localCommit}.`);

