# Versioning Strategy

This project follows [Semantic Versioning (SemVer)](https://semver.org/spec/v2.0.0.html).

## Version Format

Version numbers follow the pattern: **MAJOR.MINOR.PATCH**

```
MAJOR.MINOR.PATCH
  ↑      ↑     ↑
  │      │     └─ Patch: Bug fixes, patches (1.0.1)
  │      └─────── Minor: New features, backwards compatible (1.1.0)
  └────────────── Major: Breaking changes (2.0.0)
```

## Version Number Rules

### MAJOR Version (X.0.0)
Increment when you make **incompatible API changes**:
- Breaking changes to the public API
- Removing features
- Changing behavior in ways that break existing functionality
- Major refactoring that affects how users interact with the project

**Example**: `1.0.0` → `2.0.0`
- Removing a feature that users depend on
- Changing file formats or data structures
- Rewriting core functionality

### MINOR Version (0.X.0)
Increment when you add **backward-compatible functionality**:
- New features that don't break existing functionality
- New UI components or tools
- Enhancements to existing features
- New export formats or options

**Example**: `1.0.0` → `1.1.0`
- Adding a new shape tool
- New keyboard shortcuts
- Adding layer management
- New export format (PNG, PDF, etc.)

### PATCH Version (0.0.X)
Increment when you make **backward-compatible bug fixes**:
- Bug fixes
- Security patches
- Performance improvements
- Documentation updates (if not changing functionality)
- UI/UX improvements that don't change behavior

**Example**: `1.0.0` → `1.0.1`
- Fixing a color picker bug
- Fixing selection issues
- Performance optimization
- Fixing typos in documentation

## Release Process

1. **Update version in `package.json`**
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Update `CHANGELOG.md`**
   - Move items from "Unreleased" to new version section
   - Date the release
   - Categorize changes (Added, Changed, Fixed, etc.)

3. **Create Git Tag**
   ```bash
   git tag -a v1.2.3 -m "Release version 1.2.3"
   git push origin v1.2.3
   ```

4. **Create GitHub Release**
   - Go to GitHub → Releases → Draft a new release
   - Tag: `v1.2.3`
   - Title: `Version 1.2.3`
   - Copy changelog content
   - Attach build artifacts if needed

## Pre-Release Versions

For development versions, you can use pre-release identifiers:

- **Alpha**: `1.0.0-alpha.1` - Early development, may be unstable
- **Beta**: `1.0.0-beta.1` - Feature complete, testing phase
- **RC (Release Candidate)**: `1.0.0-rc.1` - Near final, final testing

## Examples

### Version History Example

```
0.1.0 - Initial beta release
0.2.0 - Added multi-select feature (MINOR)
0.2.1 - Fixed selection bug (PATCH)
0.2.2 - Fixed color picker issue (PATCH)
0.3.0 - Added layer management (MINOR)
1.0.0 - First stable release (MAJOR - breaking API changes)
1.0.1 - Fixed export bug (PATCH)
1.1.0 - Added path editing (MINOR)
1.1.1 - Performance improvements (PATCH)
2.0.0 - Complete rewrite with new architecture (MAJOR)
```

## Version in Code

The version is stored in:
- `package.json` - `"version": "1.0.0"`
- Can be accessed at runtime via `import packageJson from '../package.json'`

## Automated Versioning

Consider using tools like:
- **semantic-release** - Automates versioning and releases
- **conventional-changelog** - Generates changelogs from commit messages
- **standard-version** - Automates version bumping and changelog generation

## Commit Messages

For easier versioning, use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new shape tool          → MINOR bump
fix: resolve selection bug         → PATCH bump
docs: update README                → PATCH bump
refactor: improve performance      → PATCH bump
perf: optimize rendering           → PATCH bump
BREAKING CHANGE: remove API        → MAJOR bump
```

## Questions?

If you're unsure which version to bump:
- **Patch**: Bug fixes, small improvements
- **Minor**: New features that don't break anything
- **Major**: Changes that might break existing usage

When in doubt, ask in an issue or discussion!

