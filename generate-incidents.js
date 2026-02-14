#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOGS_DIR = './logs';
const INCIDENTS_FILE = './incidents.json';
const URLS_FILE = './urls.cfg';
const MIN_OUTAGE_DURATION = 2; // Minimum consecutive failures to count as incident

// Services to exclude from incident generation
const EXCLUDED_SERVICES = ['worldclock', 'google', 'hn', 'reddit', 'statsig'];

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

// Parse log file and detect outages
function parseLogFile(logPath) {
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n');

  const outages = [];
  let currentOutage = null;

  lines.forEach((line, index) => {
    if (!line) return;

    const [dateTimeStr, status] = line.split(',').map(s => s.trim());
    const dateTime = new Date(dateTimeStr.replace(/-/g, '/') + ' GMT');
    const isFailed = status === 'failed';

    if (isFailed) {
      if (!currentOutage) {
        // Start new outage
        currentOutage = {
          startTime: dateTime,
          endTime: dateTime,
          failureCount: 1
        };
      } else {
        // Continue existing outage
        currentOutage.endTime = dateTime;
        currentOutage.failureCount++;
      }
    } else {
      // Success - end current outage if exists
      if (currentOutage && currentOutage.failureCount >= MIN_OUTAGE_DURATION) {
        outages.push(currentOutage);
      }
      currentOutage = null;
    }
  });

  // Handle outage that extends to end of log
  if (currentOutage && currentOutage.failureCount >= MIN_OUTAGE_DURATION) {
    outages.push(currentOutage);
  }

  return outages;
}

// Format date for incident JSON
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Format datetime for display
function formatDateTime(date) {
  return date.toISOString().replace('T', ' ').split('.')[0] + ' GMT';
}

// Check if outage is still active (within last 2 hours)
function isOutageActive(outage) {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return outage.endTime > twoHoursAgo;
}

// Generate incident title
function generateIncidentTitle(serviceName, outage) {
  const duration = Math.round((outage.endTime - outage.startTime) / (60 * 1000));
  if (duration < 60) {
    return `${serviceName} Service Disruption`;
  } else if (duration < 24 * 60) {
    return `${serviceName} Extended Outage`;
  } else {
    return `${serviceName} Multi-Day Outage`;
  }
}

// Generate incident description
function generateIncidentDescription(serviceName, outage, url) {
  const startStr = formatDateTime(outage.startTime);
  const duration = Math.round((outage.endTime - outage.startTime) / (60 * 1000));

  if (duration < 60) {
    return `${serviceName} (${url}) experienced downtime starting at ${startStr}.`;
  } else if (duration < 24 * 60) {
    const hours = Math.round(duration / 60);
    return `${serviceName} (${url}) has been inaccessible for approximately ${hours} hours since ${startStr}.`;
  } else {
    const days = Math.round(duration / (24 * 60));
    return `${serviceName} (${url}) has been offline for ${days} days since ${startStr}.`;
  }
}

// Main function
function generateIncidents() {
  const serviceUrls = getServiceUrls();
  const allIncidents = {
    active: [],
    resolved: []
  };

  // Get all log files
  const logFiles = fs.readdirSync(LOGS_DIR)
    .filter(f => f.endsWith('_report.log'))
    .filter(f => {
      const serviceName = f.replace('_report.log', '');
      return !EXCLUDED_SERVICES.includes(serviceName.toLowerCase());
    });

  console.log(`Analyzing ${logFiles.length} log files...`);

  logFiles.forEach(logFile => {
    const serviceName = logFile.replace('_report.log', '');
    const url = serviceUrls[serviceName] || 'Unknown URL';
    const logPath = path.join(LOGS_DIR, logFile);

    console.log(`Processing ${serviceName}...`);

    const outages = parseLogFile(logPath);

    if (outages.length === 0) {
      console.log(`  ✓ No significant outages detected`);
      return;
    }

    console.log(`  Found ${outages.length} outage(s)`);

    outages.forEach(outage => {
      const incident = {
        date: formatDate(outage.startTime),
        title: generateIncidentTitle(serviceName, outage),
        description: generateIncidentDescription(serviceName, outage, url),
        service: serviceName,
        url: url
      };

      if (isOutageActive(outage)) {
        // Active incident
        incident.status = 'investigating';
        incident.eta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        allIncidents.active.push(incident);
        console.log(`  ⚠️  Active: ${incident.title}`);
      } else {
        // Resolved incident
        const endStr = formatDateTime(outage.endTime);
        incident.resolved = `${endStr} - Service restored`;
        allIncidents.resolved.push(incident);
        console.log(`  ✓ Resolved: ${incident.title} (${formatDate(outage.startTime)})`);
      }
    });
  });

  // Sort incidents by date (newest first)
  allIncidents.active.sort((a, b) => new Date(b.date) - new Date(a.date));
  allIncidents.resolved.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Write to file
  fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(allIncidents, null, 2));

  console.log(`\n✅ Generated incidents.json:`);
  console.log(`   Active incidents: ${allIncidents.active.length}`);
  console.log(`   Resolved incidents: ${allIncidents.resolved.length}`);
}

// Run
try {
  generateIncidents();
} catch (error) {
  console.error('Error generating incidents:', error);
  process.exit(1);
}
