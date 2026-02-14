# Incident Management

## Automated Incident Generation

Incidents are now automatically generated from service health check logs. The system:
- Analyzes all service logs (excluding worldclock and test services)
- Detects consecutive failures (2+ failed checks)
- Generates incident reports with service names and timestamps
- Links incidents to specific services
- Auto-detects active vs resolved incidents

## Running the Generator

To regenerate incidents from logs:

```bash
node generate-incidents.js
```

This will:
1. Parse all `logs/*_report.log` files
2. Detect outage periods
3. Generate `incidents.json` with active and resolved incidents
4. Auto-link each incident to its service

## Generated incidents.json Structure

```json
{
  "active": [
    {
      "date": "YYYY-MM-DD",
      "title": "ServiceName Multi-Day Outage",
      "description": "ServiceName (URL) has been offline since...",
      "service": "ServiceName",
      "url": "https://service.url",
      "status": "investigating",
      "eta": "YYYY-MM-DDTHH:MM:SSZ"
    }
  ],
  "resolved": [
    {
      "date": "YYYY-MM-DD",
      "title": "ServiceName Extended Outage",
      "description": "ServiceName (URL) experienced downtime...",
      "service": "ServiceName",
      "url": "https://service.url",
      "resolved": "YYYY-MM-DD HH:MM:SS GMT - Service restored"
    }
  ]
}
```

## Manual Incident Creation (Optional)

If you need to manually add an incident not detected by logs:

### Active Incident
```json
{
  "date": "2024-02-14",
  "title": "Custom Incident Title",
  "description": "Detailed description of the issue",
  "service": "ServiceName",
  "url": "https://service.url",
  "status": "investigating|monitoring",
  "eta": "2024-02-14T18:00:00Z"
}
```

### Resolved Incident
```json
{
  "date": "2024-02-14",
  "title": "Custom Incident Title",
  "description": "What happened",
  "service": "ServiceName",
  "url": "https://service.url",
  "resolved": "14:30 GMT - Issue resolved and services restored"
}
```

## Incident Detection Logic

- **Minimum Duration**: 2+ consecutive failed checks
- **Active Status**: Last failure within 2 hours
- **Excluded Services**: worldclock, google, hn, reddit, statsig

## Status Options

- `investigating` - Red badge, issue is being investigated
- `monitoring` - Yellow badge, fix deployed but monitoring
- `resolved` - Green badge (in past incidents section)

## Service Badge

Each incident now displays:
- Date (when outage started)
- Service name (gray badge)
- Status (colored badge)

This makes it easy to see which service was affected at a glance.
