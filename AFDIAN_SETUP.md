# AFDian API Configuration

This project integrates with the AFDian (爱发电) API for sponsorship tracking.

## Configuration

Create a config file at `~/.local/bin/afdian-link-config.json`:

```json
{
  "user_id": "YOUR_AFDIAN_USER_ID",
  "token": "YOUR_AFDIAN_API_TOKEN",
  "api_base": "https://afdian.com/api/open",
  "webhook_secret": "",
  "creator_page": "https://afdian.com/a/YOUR_USERNAME"
}
```

## Getting Your API Token

1. Log in to https://afdian.com
2. Go to your creator dashboard
3. Navigate to API settings
4. Generate a new API token

## Usage in Scripts

The `scripts/` directory includes scripts that read this config file:
- `push-all.ps1` - One-click push to all platforms
- `sync-to-gitee.ps1` - Gitee sync
- `init-tri-link.ps1` - New project initialization

## Webhook Integration (Optional)

To receive real-time sponsorship notifications:

```bash
# Add webhook endpoint to your config
# Then configure in AFDian creator dashboard:
# Settings -> Webhook -> Add endpoint
```
