# Managing Incidents via GitHub Issues

Incidents are automatically managed through GitHub Issues:
- ✅ **Auto-created** when services go down (from health check logs)
- ✅ **Auto-closed** when services recover
- ✅ Edit manually via GitHub UI if needed
- ✅ Discussion threads for each incident
- ✅ Mobile-friendly (GitHub mobile app)
- ✅ Email notifications
- ✅ Full history and audit trail

## Setup Required

**One-time setup:** Create a GitHub Personal Access Token with `repo` scope and add it as a repository secret named `INCIDENT_TOKEN`.

### Step 1: Create GitHub Token
1. Go to https://github.com/settings/tokens/new
2. Name: "statuspage-incidents"
3. Select scope: `repo` (full control)
4. Generate token and copy it (starts with `ghp_`)

### Step 2: Add as Repository Secret
1. Go to https://github.com/akn101/statuspage/settings/secrets/actions
2. Click "New repository secret"
3. Name: `INCIDENT_TOKEN`
4. Value: paste your token
5. Save

## How It Works (Automatic)

Every 20 minutes:
1. **Health checks run** → logs updated
2. **Incidents generated** from consecutive failures
3. **GitHub Issues auto-created** for new incidents
4. **GitHub Issues auto-closed** when services recover
5. **Status page updated** automatically

## Creating a New Incident

1. Go to [Issues](../../issues/new/choose)
2. Select "Service Incident" template
3. Fill in:
   - **Service**: Which service is affected
   - **Status**: investigating/monitoring/resolved
   - **Description**: What's happening
   - **ETA** (optional): Expected resolution time
   - **Resolution** (optional): How it was fixed (for resolved incidents)
4. Submit the issue with `[INCIDENT]` prefix in title

## Editing an Incident

1. Open the incident issue
2. Click "Edit" on the issue body
3. Update any fields
4. Save - the status page will update automatically

## Resolving an Incident

1. Edit the issue and add resolution details
2. Close the issue
3. The incident moves to "Past Incidents" on the status page

## Backfilling Existing Incidents

To create GitHub Issues from your existing `incidents.json`:

```bash
# Set your GitHub token (needs repo scope)
export GITHUB_TOKEN=your_github_personal_access_token

# Run backfill script
node backfill-incidents-to-issues.js
```

This will:
1. Create an issue for each incident in `incidents.json`
2. Close issues for resolved incidents
3. Preserve all incident details

After backfilling, run sync to update `incidents.json` with issue numbers:
```bash
node sync-incidents-from-issues.js
```

## Auto-Generated vs Manual Incidents

You can use both approaches:

### Option 1: GitHub Issues (Recommended)
- Create/edit incidents via GitHub Issues
- Status page syncs automatically
- Best for manual incident management

### Option 2: Auto-Generated from Logs
- Run `node generate-incidents.js` to scan logs
- Incidents created automatically from health check failures
- Best for automated incident detection

### Combined Approach
1. Let logs auto-generate incidents
2. GitHub Action creates issues for new incidents
3. Edit/manage via GitHub Issues
4. Manual incidents can be added via Issues too

## GitHub Issue Labels

Issues are automatically labeled:
- `incident` - All incident-related issues
- `investigating` - Active incidents being investigated
- `monitoring` - Incidents being monitored
- `resolved` - Resolved incidents (auto-added when closed)

## Example Issue Format

```markdown
[INCIDENT] Letters Service Unavailable

### Service

Letters

### Status

investigating

### Description

Letters service is returning 503 errors since 14:00 GMT. Database connection appears to be timing out.

### Estimated Resolution Time

2026-02-15T16:00:00Z

### Resolution Details

_Will be filled when resolved_
```

## Troubleshooting

**Issue not syncing to status page?**
- Check the issue has the `incident` label
- Verify GitHub Actions is enabled
- Check workflow runs in the Actions tab

**Want to prevent auto-generation for a service?**
Edit `generate-incidents.js` and add to `EXCLUDED_SERVICES` array.

## API Permissions

The sync workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions. No additional setup needed.

For backfilling, you need a Personal Access Token with `repo` scope.
