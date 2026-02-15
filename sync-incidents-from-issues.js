#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'akn101';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'statuspage';
const INCIDENTS_FILE = './incidents.json';
const URLS_FILE = './urls.cfg';

// Read service URLs
function getServiceUrls() {
  const urlsContent = fs.readFileSync(URLS_FILE, 'utf-8');
  const urls = {};
  urlsContent.split('\n').forEach(line => {
    const [key, url] = line.split('=');
    if (key && url) {
      urls[key.trim()] = url.trim();
    }
  });
  return urls;
}

// Fetch issues from GitHub
function fetchIssues() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=incident&state=all&per_page=100`,
      headers: {
        'User-Agent': 'statuspage-sync',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

// Parse issue body to extract incident details
function parseIssueBody(body) {
  const result = {
    incidentId: null,
    startTime: null,
    service: null,
    status: 'investigating',
    description: '',
    eta: null,
    resolution: null
  };

  if (!body) return result;

  // Extract Incident ID
  const idMatch = body.match(/### Incident ID\s*\n\s*(.+)/);
  if (idMatch) {
    result.incidentId = idMatch[1].trim();
  }

  // Extract Service
  const serviceMatch = body.match(/### Service\s*\n\s*(.+)/);
  if (serviceMatch) {
    result.service = serviceMatch[1].trim();
  }

  // Extract Status
  const statusMatch = body.match(/### Status\s*\n\s*(.+)/);
  if (statusMatch) {
    result.status = statusMatch[1].trim().toLowerCase();
  }

  // Extract Description
  const descMatch = body.match(/### Description\s*\n\s*([\s\S]+?)(?=\n###|$)/);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }

  // Extract ETA
  const etaMatch = body.match(/### Estimated Resolution Time\s*\n\s*(.+)/);
  if (etaMatch && etaMatch[1].trim() && etaMatch[1].trim() !== '_No response_') {
    result.eta = etaMatch[1].trim();
  }

  // Extract Resolution
  const resMatch = body.match(/### Resolution Details\s*\n\s*([\s\S]+?)(?=\n###|$)/);
  if (resMatch && resMatch[1].trim() !== '_No response_') {
    result.resolution = resMatch[1].trim();
  }

  // Extract Started
  const startedMatch = body.match(/Started:\s*(.+)/);
  if (startedMatch) {
    result.startTime = startedMatch[1].trim();
  }

  return result;
}

// Convert issue to incident format
function issueToIncident(issue, serviceUrls) {
  const parsed = parseIssueBody(issue.body);
  const createdDate = new Date(issue.created_at);

  // Extract service from title if not in body
  if (!parsed.service) {
    const titleMatch = issue.title.match(/\[INCIDENT\]\s*(.+?)(?:\s*-|\s*:|$)/i);
    if (titleMatch) {
      parsed.service = titleMatch[1].trim();
    }
  }

  const startTime = parsed.startTime || createdDate.toISOString();
  const incidentId = parsed.incidentId || `${parsed.service}-${startTime}`;
  const incident = {
    incidentId,
    date: new Date(startTime).toISOString().split('T')[0],
    startTime,
    title: issue.title.replace(/^\[INCIDENT\]\s*/i, '').trim(),
    description: parsed.description || issue.title,
    service: parsed.service,
    url: serviceUrls[parsed.service] || null,
    issueNumber: issue.number,
    issueUrl: issue.html_url
  };

  if (issue.state === 'open') {
    incident.status = parsed.status || 'investigating';
    if (parsed.eta) {
      incident.eta = parsed.eta;
    }
  } else {
    // Closed issue = resolved
    const closedDate = new Date(issue.closed_at);
    incident.resolved = `${closedDate.toISOString().replace('T', ' ').split('.')[0]} GMT - ${parsed.resolution || 'Issue resolved'}`;
  }

  return incident;
}

// Main sync function
async function syncIncidents() {
  try {
    console.log('Fetching incidents from GitHub Issues...');
    const issues = await fetchIssues();
    console.log(`Found ${issues.length} incident issue(s)`);

    const serviceUrls = getServiceUrls();
    const bestByKey = new Map();

    issues.forEach(issue => {
      const incident = issueToIncident(issue, serviceUrls);
      const key = incident.incidentId || `${incident.service}-${incident.startTime || incident.date}`;
      const existing = bestByKey.get(key);
      if (!existing) {
        bestByKey.set(key, { issue, incident });
        return;
      }

      const existingOpen = existing.issue.state === 'open';
      const currentOpen = issue.state === 'open';
      if (existingOpen !== currentOpen) {
        if (currentOpen) {
          bestByKey.set(key, { issue, incident });
        }
        return;
      }

      if (new Date(issue.updated_at) > new Date(existing.issue.updated_at)) {
        bestByKey.set(key, { issue, incident });
      }
    });

    const active = [];
    const resolved = [];

    for (const { issue, incident } of bestByKey.values()) {
      if (issue.state === 'open') {
        active.push(incident);
        console.log(`  Active: #${issue.number} - ${incident.title}`);
      } else {
        resolved.push(incident);
        console.log(`  Resolved: #${issue.number} - ${incident.title}`);
      }
    }

    // Sort by date (newest first)
    active.sort((a, b) => new Date(b.date) - new Date(a.date));
    resolved.sort((a, b) => new Date(b.date) - new Date(a.date));

    const incidents = { active, resolved };

    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(incidents, null, 2));

    console.log(`\n✅ Synced ${active.length} active and ${resolved.length} resolved incidents to ${INCIDENTS_FILE}`);
  } catch (error) {
    console.error('Error syncing incidents:', error.message);
    process.exit(1);
  }
}

// Run
syncIncidents();
