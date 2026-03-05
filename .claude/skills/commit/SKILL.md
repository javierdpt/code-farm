---
name: commit
description: Version bump, commit, rebase main, and push all changes
disable-model-invocation: true
argument-hint: "[patch|minor|major]"
allowed-tools: Bash(git *), Bash(node scripts/bump-versions.mjs *)
---

# Commit, version bump, rebase & push

Perform the full release flow for the Code Farm monorepo. Follow these steps exactly:

## 1. Inspect changes

- Run `git status` (never use `-uall`) and `git diff --stat` to see what changed.
- Run `git diff` to read the actual changes.
- If there are no changes to commit, stop and tell the user.

## 2. Write commit message

- Analyze the staged + unstaged changes to write a clear, conventional commit message.
- Use conventional commits format: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, etc.
- Add a scope when changes are localized, e.g. `fix(terminal):`, `feat(worker):`.
- Keep the first line under 72 chars. Add a body paragraph only if the change is non-trivial.
- End every commit message with: `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Use a HEREDOC to pass the message to `git commit`.

## 3. Stage & commit

- Stage relevant files by name (avoid `git add -A`). Never commit `.env` or credentials.
- Create the commit.

## 4. Version bump

- Determine bump type from the argument (`$ARGUMENTS`). Default to `patch` if not specified.
- Run `node scripts/bump-versions.mjs <type>`.
- Stage all bumped `package.json` files and commit with message: `feat: bump package versions to <new-version>`.
- End this commit with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` too.

## 5. Rebase on main

- Run `git pull --rebase origin main`.
- If there are conflicts, stop and ask the user for help.

## 6. Push

- Run `git push`.
- Report the final commit hashes and new version number.
