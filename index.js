const maxDays = 30;
let incidentCache = null;
let incidentCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function genReportLog(container, key, url) {
  try {
    const response = await fetch("logs/" + key + "_report.log");
    let statusLines = "";
    if (response.ok) {
      statusLines = await response.text();
    }

    const normalized = normalizeData(statusLines);
    const statusStream = constructStatusStream(key, url, normalized);
    container.appendChild(statusStream);
  } catch (error) {
    console.error(`Failed to load report for ${key}:`, error);
    // Create a fallback status display
    const statusStream = constructStatusStream(key, url, { upTime: "--%" });
    container.appendChild(statusStream);
  }
}

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    url: url,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal) {
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: getTooltip(key, date, color),
  });

  // Use event delegation instead of individual listeners for better performance
  square.addEventListener("pointerenter", () => {
    showTooltip(square, key, date, color);
  });
  square.addEventListener("pointerleave", hideTooltip);
  return square;
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "No Data Available"
    : color == "success"
    ? "Fully Operational"
    : color == "failure"
    ? "Major Outage"
    : color == "partial"
    ? "Partial Outage"
    : "Unknown";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "No Data Available: Health check was not performed."
    : color == "success"
    ? "No downtime recorded on this day."
    : color == "failure"
    ? "Major outages recorded on this day."
    : color == "partial"
    ? "Partial outages recorded on this day."
    : "Unknown";
}

function getTooltip(key, date, quartile, color) {
  let statusText = getStatusText(color);
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(statusLines) {
  const rows = statusLines.split("\n");
  const dateNormalized = splitRowsByDate(rows);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(",", 2);
    const dateTime = new Date(Date.parse(dateTimeStr.replace(/-/g, "/") + " GMT"));
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (dateValues.length > maxDays) {
        break;
      }
    }

    let result = 0;
    if (resultStr.trim() == "success") {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
  dateValues.upTime = upTime;
  return dateValues;
}

let tooltipTimeout = null;
function showTooltip(element, key, date, color) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10;
  toolTipDiv.style.left =
    element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2;
  toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
  }, 1000);
}

async function genAllReports() {
  const loadingIndicator = document.getElementById("loadingIndicator");

  try {
    const response = await fetch("urls.cfg");
    const configText = await response.text();
    const configLines = configText.split("\n");

    // Use Promise.all to fetch all reports in parallel for better performance
    const reportPromises = configLines
      .map(line => line.split("="))
      .filter(([key, url]) => key && url)
      .map(([key, url]) => genReportLog(document.getElementById("reports"), key, url));

    await Promise.all(reportPromises);
  } finally {
    // Hide loading indicator after reports are loaded
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
}


async function genIncidentReport() {
  // Check cache first
  const now = Date.now();
  if (incidentCache && (now - incidentCacheTime) < CACHE_DURATION) {
    renderIncidents(incidentCache);
    return;
  }

  const response = await fetch(
    "https://raw.githubusercontent.com/akn101/statuspage/main/incidents.json"
  );
  if (response.ok) {
    const json = await response.json();
    incidentCache = json;
    incidentCacheTime = now;
    renderIncidents(json);
  }
}

function renderIncidents(json) {
  try {
    const activeContainer = document.getElementById("activeIncidentReports");
    const pastContainer = document.getElementById("pastIncidentReports");

    // Render active incidents
    if (json.active && json.active.length > 0) {
      activeContainer.innerHTML = json.active.map(incident => `
        <div class="incident-item">
          <div class="incident-header">
            <span class="incident-date">${formatDate(incident.date)}</span>
            ${incident.service ? `<span class="incident-service">${incident.service}</span>` : ''}
            ${incident.status ? `<span class="incident-status status-${incident.status}">${incident.status}</span>` : ''}
          </div>
          <div class="incident-title">${incident.title}</div>
          <div class="incident-description">${incident.description}</div>
          ${incident.eta ? `<div class="incident-eta">ETA: ${formatDateTime(incident.eta)}</div>` : ''}
        </div>
      `).join('');

      setTimeout(() => {
        document.getElementById("incidents").scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    } else {
      activeContainer.innerHTML = '<div class="incident-none">All systems operational</div>';
    }

    // Render resolved incidents
    if (json.resolved && json.resolved.length > 0) {
      pastContainer.innerHTML = json.resolved.map(incident => `
        <div class="incident-item resolved">
          <div class="incident-header">
            <span class="incident-date">${formatDate(incident.date)}</span>
            ${incident.service ? `<span class="incident-service">${incident.service}</span>` : ''}
          </div>
          <div class="incident-title">${incident.title}</div>
          <div class="incident-description">${incident.description}</div>
          <div class="incident-resolved">${incident.resolved}</div>
        </div>
      `).join('');
    } else {
      pastContainer.innerHTML = '<div class="incident-none">No past incidents</div>';
    }
  } catch (e) {
    console.log(e.message);
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}
