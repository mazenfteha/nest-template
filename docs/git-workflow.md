# Git workflow

Preferred GitHub branching model and the feature lifecycle (Issue → Branch → PR → Review → Merge).

## Branch model

| Branch | Purpose |
|--------|---------|
| `main` / `master` | Production. Always deployable. Protected — no direct pushes. |
| `release` / `staging` | Pre-production; what's queued for the next release / QA. |
| `develop` (`dev`) | Integration branch — features merge here first. |
| `feature/<name>` | One feature or issue. Branched from `develop`. |
| `hotfix/<name>` | Urgent production fix. Branched from `main`, merged back to `main` **and** `develop`. |

Branch naming ties work to its issue:

```
feature/42-s3-file-upload      # #42 → feature-name
feature/57-refresh-token-ttl   # #57 → feature-name
hotfix/61-login-500
```

## The workflow (Feature → Issue → PR → Review → Merge)

### 1️⃣ Create an Issue — the "Why"
Describe the problem/goal, acceptance criteria, and scope. The issue number (e.g. `#42`) anchors everything that follows.

### 2️⃣ Create a feature branch — the "How"
Branch from the latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/42-s3-file-upload
```

### 3️⃣ Implement the feature — the "Work"
Small, focused commits with clear messages (imperative mood):

```bash
git add .
git commit -m "feat(upload): add S3 client config and service"
```

### 4️⃣ Push the branch to GitHub

```bash
git push -u origin feature/42-s3-file-upload
```

### 5️⃣ Open a Pull Request — the "Conversation"
Target `develop`. In the PR description, **link the issue so it auto-closes on merge**:

```
Closes #42
```

Summarize what changed and how to test it.

### 6️⃣ Code review — the "Quality Gate"
Reviewer(s) check correctness, tests, and that it follows the project conventions
(see the `nestjs-best-practices` skill). CI must be green: the
[`ci.yml`](../.github/workflows/ci.yml) workflow runs `lint:check` + `build` on every PR (and on
pushes to `main` / `develop`). Commit messages are validated locally by **commitlint** (Conventional
Commits) via a Husky `commit-msg` hook, and staged files are auto-linted/formatted on `pre-commit`.

### 7️⃣ Address feedback, then approve & merge — the "Finish Line"
Push fixes to the same branch (the PR updates automatically). Once approved and CI passes, merge
(prefer **Squash & merge** to keep `develop` history clean).

### 8️⃣ Clean up — the professional touch
Delete the merged branch:

```bash
git branch -d feature/42-s3-file-upload           # local
git push origin --delete feature/42-s3-file-upload # remote
```

## At a glance

```
Issue (#42)
  ↓
Create feature branch
  ↓
Write code + commits
  ↓
Push branch
  ↓
Open Pull Request → Link issue (Closes #42)
  ↓
Code review
  ↓
Fix comments
  ↓
Approve & merge
  ↓
Issue auto-closed  +  branch deleted
```

## Release & hotfix flow

- **Release:** `develop` → `release`/`staging` for QA → merge to `main` and tag (e.g. `v1.2.0`).
- **Hotfix:** branch `hotfix/<name>` from `main`, fix, PR to `main`, then merge the fix back into
  `develop` (and `release` if one is open) so it isn't lost.
