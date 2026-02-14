# Status Page Setup Guide

## Quick Start

Your status page is already running! Just need one more step for GitHub Issues integration.

## GitHub Token Setup (Required for Auto-Issues)

### 1. Create Personal Access Token

Visit: https://github.com/settings/tokens/new

**Settings:**
- Note: `statuspage-incidents`
- Expiration: `No expiration` (or your preference)
- Scopes: Check **`repo`** (Full control of private repositories)

Click **Generate token** and copy it immediately (you won't see it again!)

### 2. Add as Repository Secret

1. Go to: https://github.com/akn101/statuspage/settings/secrets/actions
2. Click **New repository secret**
3. Name: `INCIDENT_TOKEN`
4. Value: Paste your token (starts with `ghp_` or `github_pat_`)
5. Click **Add secret**

### 3. Test It (Optional)

Run the workflow manually to test:
1. Go to: https://github.com/akn101/statuspage/actions/workflows/health-check.yml
2. Click **Run workflow**
3. Check that issues are created for active incidents

## What Happens Next

Once the token is set up:

✅ **Every 20 minutes:**
- Health checks run automatically
- Logs are analyzed for outages
- GitHub Issues are auto-created for new incidents
- GitHub Issues are auto-closed when services recover
- Status page updates automatically

✅ **You can also:**
- Manually create incidents via GitHub Issues
- Edit incident details in GitHub Issues
- Add comments/discussions to incidents
- Close/reopen issues manually if needed

## Local Testing

To test the incident generation locally:

```bash
# Generate incidents from logs
node generate-incidents.js

# Sync to GitHub Issues (needs token)
export INCIDENT_TOKEN=your_github_token_here
node sync-issues-with-incidents.js

# Or backfill existing incidents as issues
node backfill-incidents-to-issues.js
```

## File Structure

```
statuspage/
├── index.html              # Main status page
├── index.css               # Styles (light/dark mode)
├── index.js                # Client-side logic
├── urls.cfg                # Services to monitor
├── incidents.json          # Generated incidents
├── logs/                   # Health check logs
├── generate-incidents.js   # Analyzes logs → incidents
├── sync-issues-with-incidents.js  # Syncs incidents ↔ GitHub Issues
└── .github/
    ├── workflows/
    │   ├── health-check.yml    # Runs every 20 mins
    │   └── sync-incidents.yml  # Syncs on issue changes
    └── ISSUE_TEMPLATE/
        └── incident.yml        # Template for manual incidents
```

## Viewing Your Status Page

- **Production**: https://akn101.github.io/statuspage/
- **Local**: http://localhost:8000 (run `python3 -m http.server 8000`)

## Managing Incidents

### Automated (Default)
Incidents auto-generate from health check failures and sync to GitHub Issues.

### Manual
Create issues at: https://github.com/akn101/statuspage/issues/new/choose

### View All Incidents
https://github.com/akn101/statuspage/issues?q=label%3Aincident

## Troubleshooting

**Issues not creating automatically?**
- Check `INCIDENT_TOKEN` is set in repository secrets
- Verify the token has `repo` scope
- Check GitHub Actions logs for errors

**Want to exclude a service from incidents?**
Edit `generate-incidents.js` and add to `EXCLUDED_SERVICES` array.

**Need help?**
Open an issue at: https://github.com/akn101/statuspage/issues
