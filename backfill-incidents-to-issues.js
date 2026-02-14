#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'akn101';
const REPO_NAME = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'statuspage';
const INCIDENTS_FILE = './incidents.json';

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN environment variable is required');
  console.error('Usage: GITHUB_TOKEN=your_token node backfill-incidents-to-issues.js');
  process.exit(1);
}

// Create GitHub issue
function createIssue(title, body, state) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      title,
      body,
      labels: ['incident', state === 'open' ? 'investigating' : 'resolved']
    });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues`,
      method: 'POST',
      headers: {
        'User-Agent': 'statuspage-backfill',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Close GitHub issue
function closeIssue(issueNumber) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ state: 'closed' });

    const options = {
      hostname: 'api.github.com',
      path: `/repos/${REPO_OWNER}/${REPO_NAME}/issues/${issueNumber}`,
      method: 'PATCH',
      headers: {
        'User-Agent': 'statuspage-backfill',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(responseData));
        } else {
          reject(new Error(`GitHub API returned ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Generate issue body from incident
function generateIssueBody(incident, isActive) {
  let body = `### Service\n\n${incident.service || 'Unknown'}\n\n`;
  body += `### Status\n\n${incident.status || (isActive ? 'investigating' : 'resolved')}\n\n`;
  body += `### Description\n\n${incident.description}\n\n`;

  if (incident.eta) {
    body += `### Estimated Resolution Time\n\n${incident.eta}\n\n`;
  }

  if (incident.resolved) {
    body += `### Resolution Details\n\n${incident.resolved}\n\n`;
  }

  body += `---\n\n*This incident was backfilled from the incidents.json file*`;

  return body;
}

// Main backfill function
async function backfillIncidents() {
  try {
    console.log('Reading incidents from incidents.json...');
    const incidents = JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf-8'));

    console.log(`Found ${incidents.active.length} active and ${incidents.resolved.length} resolved incidents\n`);

    // Backfill active incidents
    for (const incident of incidents.active) {
      console.log(`Creating active incident: ${incident.title}`);
      const title = `[INCIDENT] ${incident.title}`;
      const body = generateIssueBody(incident, true);

      try {
        const issue = await createIssue(title, body, 'open');
        console.log(`  ✓ Created issue #${issue.number}: ${issue.html_url}`);
        // Rate limit: wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ✗ Failed to create issue: ${error.message}`);
      }
    }

    // Backfill resolved incidents
    for (const incident of incidents.resolved) {
      console.log(`Creating resolved incident: ${incident.title}`);
      const title = `[INCIDENT] ${incident.title}`;
      const body = generateIssueBody(incident, false);

      try {
        const issue = await createIssue(title, body, 'open');
        console.log(`  ✓ Created issue #${issue.number}`);

        // Close the issue immediately
        await closeIssue(issue.number);
        console.log(`  ✓ Closed issue #${issue.number}: ${issue.html_url}`);

        // Rate limit: wait 1 second between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`  ✗ Failed to create/close issue: ${error.message}`);
      }
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`\nNext steps:`);
    console.log(`1. Review the created issues at https://github.com/${REPO_OWNER}/${REPO_NAME}/issues?q=label%3Aincident`);
    console.log(`2. Run 'node sync-incidents-from-issues.js' to sync back to incidents.json`);
    console.log(`3. Future incidents can be managed via GitHub Issues`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run
backfillIncidents();
