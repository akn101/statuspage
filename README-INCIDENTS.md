# Automated Incident Reporting

This status page now features **automatic incident generation** based on service health check logs.

## How It Works

1. **Health checks run every 20 minutes** via GitHub Actions
2. Results are logged to `logs/*_report.log` files
3. **Incidents are auto-generated** by analyzing consecutive failures
4. Each incident is linked to its specific service
5. The system auto-detects if an incident is active or resolved

## Generating Incidents

### Automatic (GitHub Actions)
The workflow runs after every health check and automatically:
- Analyzes all service logs
- Generates `incidents.json`
- Commits changes to the repository

### Manual (Local)
To regenerate incidents locally:

```bash
node generate-incidents.js
```

This will analyze all logs and update `incidents.json`.

## Incident Detection Logic

**What counts as an incident:**
- 2 or more consecutive failed health checks
- Any service except: worldclock, google, hn, reddit, statsig

**Active vs Resolved:**
- **Active**: Last failure within the past 2 hours
- **Resolved**: Last failure more than 2 hours ago

**Incident Titles:**
- "Service Disruption" - < 1 hour of downtime
- "Extended Outage" - 1-24 hours of downtime
- "Multi-Day Outage" - > 24 hours of downtime

## What's Displayed on Status Page

Each incident shows:
- **Date**: When the outage started
- **Service Badge**: Which service was affected (gray badge)
- **Status Badge**: Current status (red/yellow for active, shown in resolved section if fixed)
- **Title**: Auto-generated descriptive title
- **Description**: Details about the outage with timestamps and duration
- **ETA** (active incidents): Estimated resolution time
- **Resolved timestamp** (past incidents): When service was restored

## Example Generated Incident

```json
{
  "date": "2026-02-14",
  "title": "Letters Extended Outage",
  "description": "Letters (https://letters.akn.me.uk) has been inaccessible for approximately 2 hours since 2026-02-14 19:51:00 GMT.",
  "service": "Letters",
  "url": "https://letters.akn.me.uk",
  "status": "investigating",
  "eta": "2026-02-15T22:00:00Z"
}
```

## Manual Incident Entry (Optional)

While incidents are auto-generated, you can still manually add custom incidents to `incidents.json` if needed. Just follow the same JSON structure and include the `service` field to link it to a service.

## Benefits

✅ **No manual updates needed** - Incidents appear automatically when services go down
✅ **Service-linked** - Each incident shows which service was affected
✅ **Accurate timing** - Uses actual health check timestamps
✅ **Auto-resolved** - Incidents move to "resolved" section automatically when service recovers
✅ **Historical record** - All past outages are preserved in the resolved section

## Configuration

To exclude additional services from incident generation, edit `generate-incidents.js`:

```javascript
const EXCLUDED_SERVICES = ['worldclock', 'google', 'hn', 'reddit', 'statsig', 'your-service'];
```

To change the minimum outage duration:

```javascript
const MIN_OUTAGE_DURATION = 2; // Number of consecutive failures
```
