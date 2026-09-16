const fs = require('fs');
const path = require('path');

const REPO = 'openkaiden/kaiden';
const BOT_AUTHOR = 'fullsend-ai-coder[bot]';
const DATA_FILE = path.join(__dirname, '..', 'data', 'prs.json');
const API_BASE = 'https://api.github.com';

async function ghFetch(url) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 403 || response.status === 429) {
    const resetAt = response.headers.get('x-ratelimit-reset');
    const waitMs = resetAt
      ? (parseInt(resetAt) * 1000) - Date.now() + 1000
      : 60000;
    console.log(`Rate limited, waiting ${Math.ceil(waitMs / 1000)}s`);
    await new Promise(r => setTimeout(r, Math.max(waitMs, 1000)));
    return ghFetch(url);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${url}`);
  }

  return response;
}

function parseLinkHeader(header) {
  if (!header) return null;
  const links = {};
  for (const part of header.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="(\w+)"/);
    if (match) links[match[2]] = match[1];
  }
  return links;
}

async function fetchAllPages(baseUrl) {
  const results = [];
  let url = baseUrl;

  while (url) {
    const response = await ghFetch(url);
    const data = await response.json();
    const items = data.items || data;
    results.push(...items);

    if (data.total_count !== undefined) {
      console.log(`  Search returned ${data.total_count} total results, fetched ${results.length} so far`);
    }

    const linkHeader = response.headers.get('link');
    url = parseLinkHeader(linkHeader)?.next || null;
  }

  return results;
}

async function checkForFsFixComment(prNumber) {
  const url = `${API_BASE}/repos/${REPO}/issues/${prNumber}/comments?per_page=100`;
  const comments = await fetchAllPages(url);
  return comments.some(c => c.body && c.body.includes('/fs-fix'));
}

function toDateKey(isoString) {
  const date = new Date(isoString);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00Z`;
}

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { lastUpdated: null, infos: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n');
}

async function collect() {
  const data = loadData();
  const collectionDateKey = toDateKey(new Date().toISOString());

  const encodedAuthor = encodeURIComponent(`author:${BOT_AUTHOR}`);
  const query = `repo:${REPO}+${encodedAuthor}+is:pr`;
  const searchUrl = `${API_BASE}/search/issues?q=${query}&sort=updated&order=desc&per_page=100`;

  console.log('Fetching PRs from GitHub Search API...');
  const allPrs = await fetchAllPages(searchUrl);
  console.log(`Found ${allPrs.length} PRs from ${BOT_AUTHOR}`);

  const snapshot = [];

  for (const pr of allPrs) {
    console.log(`  Processing PR #${pr.number}: ${pr.title}`);

    const hasFsFixComment = await checkForFsFixComment(pr.number);
    const hasFullsendWithHumanLabel = pr.labels.some(l => l.name === 'fullsend-with-human');
    const mergedAt = pr.pull_request?.merged_at || null;

    snapshot.push({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      createdAt: pr.created_at,
      closedAt: pr.closed_at,
      mergedAt,
      closedWithoutMerge: pr.state === 'closed' && mergedAt === null,
      hasFsFixComment,
      hasFullsendWithHumanLabel,
    });
  }

  data.infos[collectionDateKey] = snapshot;
  data.lastUpdated = new Date().toISOString();
  saveData(data);

  console.log(`Done. Stored ${snapshot.length} PRs under ${collectionDateKey}, total collection dates: ${Object.keys(data.infos).length}`);
}

collect().catch(err => {
  console.error('Collection failed:', err);
  process.exit(1);
});
