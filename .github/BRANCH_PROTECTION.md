# Branch Protection & Merge Strategy

## Branch Protection Rules (GitHub Settings)

To enable the full collaboration flow, configure these branch protection rules in GitHub:

**Settings → Branches → Add rule → Branch name pattern: `main`**

### Required Settings:

1. ✅ **Require a pull request before merging**
   - Require approvals: **1** (minimum)
   - Dismiss stale pull request approvals when new commits are pushed

2. ✅ **Require status checks to pass before merging**
   - Require branches to be up to date before merging
   - Required status checks:
     - `lint-and-build` (from CI workflow)

3. ✅ **Require conversation resolution before merging**

4. ✅ **Do not allow bypassing the above settings** (for administrators)

### Merge Strategy:

- **Preferred**: **Squash and Merge** (keeps main linear and clean)
- **Alternative**: **Rebase and Merge** (preserves commit history)
- ❌ **Do not use**: Merge commit (creates unnecessary merge commits)

### Benefits:

- ✅ All code is reviewed before merging
- ✅ CI runs automatically on every PR
- ✅ `main` branch stays stable and deployable
- ✅ Clean git history with linear commits
- ✅ No broken code in production

## Setting This Up

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Branches**
3. Click **Add rule**
4. Enter `main` as the branch name pattern
5. Configure the settings above
6. Click **Create**

---

**Note**: This document is for reference. The actual branch protection rules need to be configured in GitHub repository settings.

