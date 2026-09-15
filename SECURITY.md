# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Active          |
| < 1.0   | ❌ No longer supported |

## Reporting a Vulnerability

We take the security of tri-link-test seriously. If you believe you've found a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public issue
2. Email: zeon7744@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Status updates every week until resolved
- Credit in changelog when fixed (unless you prefer anonymity)

## Security Best Practices

### SSH Keys
- Use Ed25519 keys (recommended) or RSA 4096+
- Never commit private keys to any repository
- Rotate keys if you suspect compromise

### API Tokens
- Store tokens in environment variables or secure vaults
- Never commit tokens to source control
- Use scoped tokens with minimal permissions
- Rotate tokens regularly

### GitHub Secrets
- Enable branch protection rules
- Require code review for all changes
- Keep dependabot or similar tools updated
- Review authorized integrations periodically

### Git Configuration
- Sign commits with GPG/SSH (`git config --global commit.gpgsign true`)
- Enable two-factor authentication on all platforms
- Review active sessions regularly

## Dependencies

This project uses the following dependencies:

| Dependency | Purpose | Security Notes |
|-----------|---------|---------------|
| GitHub Actions | CI/CD | Use pinned action versions |
| PowerShell 7+ | Scripts | Keep updated via official channels |
| SSH (OpenSSH) | Authentication | Use latest OpenSSH version |

## Compliance

- All configurations follow industry-standard security practices
- No sensitive data stored in repository
- Scripts designed to be read-auditable
