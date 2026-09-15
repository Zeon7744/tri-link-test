# Contributing to tri-link-test

First off, thanks for taking the time to contribute!

## How Can I Contribute?

### Reporting Bugs

- Use the GitHub Issues tab to report bugs.
- Include as much detail as possible: steps to reproduce, expected behavior, actual behavior.
- Mention your OS, Git version, and which platform(s) you're using (GitHub / Gitee).

### Suggesting Enhancements

- Open an issue with the `enhancement` label.
- Describe the problem and your proposed solution.
- Explain why this enhancement would be useful to other users.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. Make sure your changes follow the existing style.
3. Update documentation if needed.
4. Ensure all commits are signed (`git commit -S`).
5. Submit a pull request with a clear description.

### Development Workflow

This project maintains three-way sync between platforms:

```bash
# Push to all configured remotes
git push-all

# Sync to Gitee specifically
git sync-gitee
```

Make sure to test your changes locally before pushing.

## Code Style

- Follow the existing PowerShell script conventions (PowerShell 7+).
- Use descriptive variable names.
- Add comments for non-obvious logic.
- Keep commits atomic and messages descriptive.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
