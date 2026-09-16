let chartInstances = {};

async function init() {
  const response = await fetch('data/prs.json');
  const data = await response.json();

  if (!data.infos || Object.keys(data.infos).length === 0) {
    document.getElementById('dashboard').innerHTML =
      '<p class="empty-state">No data collected yet. Run the collection workflow first.</p>';
    return;
  }

  const sortedDates = Object.keys(data.infos).sort();
  const latestPrs = data.infos[sortedDates[sortedDates.length - 1]];
  document.getElementById('last-updated').textContent =
    new Date(data.lastUpdated).toLocaleString();

  renderSummaryCards('summary-cards', latestPrs);
  renderCharts(data.infos, 'day');
  populateDateSelector(data.infos);

  document.getElementById('granularity').addEventListener('change', (e) => {
    renderCharts(data.infos, e.target.value);
  });

  document.getElementById('date-selector').addEventListener('change', (e) => {
    renderDateDetail(data.infos, e.target.value);
  });
}

function renderSummaryCards(containerId, prs) {
  const metrics = computeMetrics(prs);
  const cards = document.getElementById(containerId);
  cards.innerHTML = [
    { label: 'Total PRs', value: metrics.total, cls: 'total' },
    { label: 'Open', value: metrics.open, cls: 'open' },
    { label: 'Merged', value: metrics.merged, cls: 'merged' },
    { label: 'Closed (no merge)', value: metrics.closedWithoutMerge, cls: 'closed' },
    { label: 'With /fs-fix', value: metrics.withFsFix, cls: 'fsfix' },
    { label: 'With human label', value: metrics.withHumanLabel, cls: 'human' },
  ].map(c => `<div class="card ${c.cls}"><div class="card-value">${c.value}</div><div class="card-label">${c.label}</div></div>`).join('');
}

function populateDateSelector(infos) {
  const selector = document.getElementById('date-selector');
  const dates = Object.keys(infos).sort();
  dates.forEach(dateKey => {
    const option = document.createElement('option');
    option.value = dateKey;
    option.textContent = `${dateKey.slice(0, 10)} (${infos[dateKey].length} PRs)`;
    selector.appendChild(option);
  });
}

function renderDateDetail(infos, dateKey) {
  const detailCards = document.getElementById('detail-cards');
  const table = document.getElementById('pr-table');

  if (!dateKey) {
    detailCards.style.display = 'none';
    table.style.display = 'none';
    return;
  }

  const prs = infos[dateKey] || [];

  detailCards.style.display = '';
  renderSummaryCards('detail-cards', prs);

  table.style.display = '';
  const tbody = table.querySelector('tbody');

  function stateBadge(pr) {
    if (pr.mergedAt) return '<span class="badge merged">Merged</span>';
    if (pr.closedWithoutMerge) return '<span class="badge closed-no-merge">Closed</span>';
    return '<span class="badge open">Open</span>';
  }

  function boolBadge(val) {
    return val
      ? '<span class="badge yes">Yes</span>'
      : '<span class="badge no">No</span>';
  }

  tbody.innerHTML = prs.map(pr => `
    <tr>
      <td>#${pr.number}</td>
      <td>${pr.title}</td>
      <td>${stateBadge(pr)}</td>
      <td>${boolBadge(pr.mergedAt !== null)}</td>
      <td>${boolBadge(pr.hasFsFixComment)}</td>
      <td>${boolBadge(pr.hasFullsendWithHumanLabel)}</td>
    </tr>
  `).join('');
}

function renderCharts(infos, granularity) {
  const groupFn = { day: getDaily, week: groupByWeek, month: groupByMonth }[granularity];
  const entries = groupFn(infos);
  const labels = entries.map(e => e.label);

  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  chartInstances.prCount = new Chart(
    document.getElementById('prCountChart'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Open',
            data: entries.map(e => e.metrics.open),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
          },
          {
            label: 'Merged',
            data: entries.map(e => e.metrics.merged),
            backgroundColor: 'rgba(34, 197, 94, 0.8)',
          },
          {
            label: 'Closed (no merge)',
            data: entries.map(e => e.metrics.closedWithoutMerge),
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'PR Status Breakdown' } },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      },
    }
  );

  chartInstances.fsFix = new Chart(
    document.getElementById('fsfixChart'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'PRs with /fs-fix',
          data: entries.map(e => e.metrics.withFsFix),
          backgroundColor: 'rgba(168, 85, 247, 0.8)',
        }],
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'PRs with /fs-fix Comment' } },
        scales: { y: { beginAtZero: true } },
      },
    }
  );

  chartInstances.humanLabel = new Chart(
    document.getElementById('humanLabelChart'),
    {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'PRs with fullsend-with-human',
          data: entries.map(e => e.metrics.withHumanLabel),
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
        }],
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: 'PRs with fullsend-with-human Label' } },
        scales: { y: { beginAtZero: true } },
      },
    }
  );
}

document.addEventListener('DOMContentLoaded', init);
