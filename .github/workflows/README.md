# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated CI/CD.

## CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request to `main`:

- **Linting**: Checks code style with ESLint
- **Type Checking**: Validates TypeScript compilation
- **Build**: Ensures the project builds successfully

All checks must pass before a PR can be merged.

### Requirements

- Node.js 18+
- Yarn package manager

### Manual Testing

You can test the CI locally by running:

```bash
yarn lint
yarn build
```

