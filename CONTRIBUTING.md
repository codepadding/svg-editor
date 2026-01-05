# How to Contribute

Thank you for your interest in contributing to Browser SVG Editor! This guide will help you get started.

## Getting Started

1. **Fork the repository**
   - Click the "Fork" button on GitHub to create your own copy

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/svg-editor.git
   cd svg-editor/svg-editor
   ```

3. **Create a new branch**
   ```bash
   git checkout -b feature/my-feature
   ```
   Use a descriptive branch name:
   - `feature/` for new features
   - `fix/` for bug fixes
   - `docs/` for documentation
   - `refactor/` for code refactoring

4. **Make your changes**
   - Write clear, readable code
   - Follow existing code patterns and structure
   - Test your changes thoroughly

5. **Commit with clear messages**
   ```bash
   git commit -m "Add feature: brief description"
   ```
   - Use present tense ("Add feature" not "Added feature")
   - Be specific about what changed and why
   - Keep commits focused and atomic

6. **Push to your fork**
   ```bash
   git push origin feature/my-feature
   ```

7. **Open a Pull Request**
   - Provide a clear description of your changes
   - Reference any related issues
   - Include screenshots for UI changes

## Guidelines

### Code Standards

- **Keep code simple and readable**
  - Prefer clarity over cleverness
  - Use descriptive variable and function names
  - Break down complex logic into smaller functions

- **Follow existing project structure**
  - Maintain the same file organization
  - Follow existing naming conventions
  - Use the same coding style (TypeScript, React hooks)

- **Add comments where needed**
  - Explain "why" not "what" (code should be self-documenting)
  - Comment complex algorithms or business logic
  - Update JSDoc comments for public APIs

- **Test before submitting**
  - Run `yarn build` to ensure TypeScript compiles
  - Test your changes in the browser (`yarn dev`)
  - Test on different browsers if possible
  - Verify responsive design on mobile and desktop

### TypeScript & React

- Ensure all code is properly typed
- Use React hooks (`useState`, `useEffect`, `useCallback`, etc.) consistently
- Avoid any `@ts-ignore` or `@ts-expect-error` unless absolutely necessary
- Follow React best practices for performance (memoization, proper dependency arrays)

### Code Style

- Use Prettier (if configured) or follow existing formatting
- Use meaningful commit messages
- Keep functions focused and small
- Prefer composition over complex inheritance

### Pull Request Process

1. **Before submitting:**
   - Rebase your branch on the latest `main` branch
   - Ensure all tests pass
   - Update documentation if needed

2. **PR Description should include:**
   - What changes you made
   - Why you made them
   - How to test the changes
   - Screenshots/GIFs for UI changes
   - Related issue numbers (if any)

3. **Review process:**
   - Be open to feedback and suggestions
   - Address review comments promptly
   - Keep PRs focused - one feature/fix per PR

## Areas Where Help is Needed

- 🐛 **Bug Fixes**: Check open issues for bugs to fix
- ✨ **Features**: Review feature requests and implement them
- 📚 **Documentation**: Improve README, add code comments, write guides
- 🎨 **UI/UX**: Enhance the interface, improve accessibility
- ⚡ **Performance**: Optimize rendering, reduce bundle size
- 🧪 **Testing**: Add unit tests, integration tests, or E2E tests
- 🌐 **Internationalization**: Add multi-language support

## Reporting Bugs

If you find a bug, please open an issue with:

- **Clear title**: Brief description of the bug
- **Description**: What happened vs. what you expected
- **Steps to reproduce**: Step-by-step instructions
- **Environment**: Browser, OS, and version
- **Screenshots**: If applicable
- **Error messages**: Copy/paste any console errors

## Suggesting Features

Have an idea? Open an issue with:

- **Clear title**: Brief description of the feature
- **Use case**: Why would this feature be useful?
- **Proposed solution**: How you envision it working
- **Alternatives**: Other approaches you've considered

## Questions?

- Open an issue with the `question` label
- Check existing issues and discussions
- Be respectful and patient with maintainers

Thank you for contributing! 🎉

