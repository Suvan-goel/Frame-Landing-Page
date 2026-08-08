# Canonical branch and release workflow

- `main` is the single canonical branch for this repository and the only branch that may be published.
- Work directly from an up-to-date `main` unless the user explicitly asks for a separate branch.
- Do not publish from a staging branch, feature branch, detached worktree, or dirty working tree.
- Before packaging or publishing the site, push `main` and run `npm run release:check`.
- The commit packaged for Sites must exactly match both local `main` and `origin/main`.
- If an isolated worktree is needed for safety, base it on `main`, merge the finished work back into `main`, and publish only the resulting `main` commit.

