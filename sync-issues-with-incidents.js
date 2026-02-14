#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.INCIDENT_TOKEN || process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'akn101';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'statuspage';
const INCIDENTS_FILE = './incidents.json';

if (!GITHUB_TOKEN) {
  console.error('Error: INCIDENT_TOKEN or GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// GitHub API helper
function githubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'statuspage-sync',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    if (data) {
      const jsonData = JSON.stringify(data);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = jsonData.length;
    }

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(responseData ? JSON.parse(responseData) : null);
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Fetch all incident issues
async function fetchIncidentIssues() {
  const openIssues = await githubRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=incident&state=open&per_page=100`);
  const closedIssues = await githubRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/issues?labels=incident&state=closed&per_page=100`);
  return { open: openIssues, closed: closedIssues };
}

// Create GitHub issue
async function createIssue(incident) {
  const title = `[INCIDENT] ${incident.title}`;
  const body = generateIssueBody(incident);

  console.log(`  Creating issue: ${title}`);
  const issue = await githubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
    title,
    body,
    labels: ['incident', incident.status || 'investigating']
  });

  return issue;
}

// Update GitHub issue
async function updateIssue(issueNumber, incident) {
  const body = generateIssueBody(incident);
  const labels = ['incident', incident.status || 'investigating'];

  console.log(`  Updating issue #${issueNumber}`);
  await githubRequest('PATCH', `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`, {
    body,
    labels
  });
}

// Close GitHub issue
async function closeIssue(issueNumber, resolution) {
  console.log(`  Closing issue #${issueNumber}`);
  await githubRequest('PATCH', `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`, {
    state: 'closed'
  });

  // Add closing comment with resolution
  if (resolution) {
    await githubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}/comments`, {
      body: `**Resolved:** ${resolution}`
    });
  }
}

// Reopen GitHub issue
async function reopenIssue(issueNumber) {
  console.log(`  Reopening issue #${issueNumber}`);
  await githubRequest('PATCH', `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`, {
    state: 'open',
    labels: ['incident', 'investigating']
  });
}

// Generate issue body from incident
function generateIssueBody(incident) {
  let body = `### Service\n\n${incident.service || 'Unknown'}\n\n`;
  body += `### Status\n\n${incident.status || 'investigating'}\n\n`;
  body += `### Description\n\n${incident.description}\n\n`;

  if (incident.eta) {
    body += `### Estimated Resolution Time\n\n${incident.eta}\n\n`;
  }

  if (incident.resolved) {
    body += `### Resolution Details\n\n${incident.resolved}\n\n`;
  }

  body += `---\n\n`;
  body += `*Auto-generated from health check logs*\n\n`;
  body += `Started: ${incident.date}\n`;

  if (incident.url) {
    body += `Service URL: ${incident.url}\n`;
  }

  return body;
}

// Extract incident key (service + date)
function getIncidentKey(incident) {
  return `${incident.service}-${incident.date}`;
}

// Parse issue to get incident key
function getIssueIncidentKey(issue) {
  const serviceMatch = issue.body?.match(/### Service\s*\n\s*(.+)/);
  const dateMatch = issue.body?.match(/Started:\s*(.+)/);
  if (serviceMatch && dateMatch) {
    return `${serviceMatch[1].trim()}-${dateMatch[1].trim()}`;
  }
  return null;
}

// Main sync function
async function syncIssuesWithIncidents() {
  try {
    console.log('Reading incidents from incidents.json...');
    const incidents = JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf-8'));

    console.log('Fetching existing GitHub issues...');
    const existingIssues = await fetchIncidentIssues();

    // Build maps of existing issues
    const openIssuesMap = new Map();
    const closedIssuesMap = new Map();

    existingIssues.open.forEach(issue => {
      const key = getIssueIncidentKey(issue);
      if (key) openIssuesMap.set(key, issue);
    });

    existingIssues.closed.forEach(issue => {
      const key = getIssueIncidentKey(issue);
      if (key) closedIssuesMap.set(key, issue);
    });

    console.log(`Found ${openIssuesMap.size} open and ${closedIssuesMap.size} closed incident issues\n`);

    // Process active incidents
    console.log('Processing active incidents...');
    for (const incident of incidents.active) {
      const key = getIncidentKey(incident);
      const existingOpen = openIssuesMap.get(key);
      const existingClosed = closedIssuesMap.get(key);

      if (existingOpen) {
        // Update existing open issue
        await updateIssue(existingOpen.number, incident);
        openIssuesMap.delete(key);
      } else if (existingClosed) {
        // Reopen closed issue (service went down again)
        await reopenIssue(existingClosed.number);
        await updateIssue(existingClosed.number, incident);
        closedIssuesMap.delete(key);
      } else {
        // Create new issue
        const issue = await createIssue(incident);
        console.log(`  ✓ Created issue #${issue.number}: ${issue.html_url}`);
      }

      // Rate limit: wait 500ms between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Process resolved incidents
    console.log('\nProcessing resolved incidents...');
    for (const incident of incidents.resolved) {
      const key = getIncidentKey(incident);
      const existingOpen = openIssuesMap.get(key);
      const existingClosed = closedIssuesMap.get(key);

      if (existingOpen) {
        // Close the open issue
        await closeIssue(existingOpen.number, incident.resolved);
        console.log(`  ✓ Closed issue #${existingOpen.number}: ${existingOpen.html_url}`);
        openIssuesMap.delete(key);
      } else if (!existingClosed) {
        // Create issue and immediately close it (for historical record)
        const issue = await createIssue(incident);
        await closeIssue(issue.number, incident.resolved);
        console.log(`  ✓ Created and closed issue #${issue.number}: ${issue.html_url}`);
      }
      // If existingClosed exists, it's already closed - do nothing

      // Rate limit: wait 500ms between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Close any remaining open issues that are no longer active
    if (openIssuesMap.size > 0) {
      console.log(`\nClosing ${openIssuesMap.size} stale issue(s)...`);
      for (const [key, issue] of openIssuesMap) {
        await closeIssue(issue.number, 'Service has recovered');
        console.log(`  ✓ Closed stale issue #${issue.number}`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ Sync complete!`);
    console.log(`\nView all incidents: https://github.com/${REPO_OWNER}/${REPO_NAME}/issues?q=label%3Aincident`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run
syncIssuesWithIncidents();
