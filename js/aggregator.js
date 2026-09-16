function computeMetrics(prs) {
  return {
    total: prs.length,
    open: prs.filter(p => p.state === 'open').length,
    merged: prs.filter(p => p.mergedAt !== null).length,
    closedWithoutMerge: prs.filter(p => p.closedWithoutMerge).length,
    withFsFix: prs.filter(p => p.hasFsFixComment).length,
    withHumanLabel: prs.filter(p => p.hasFullsendWithHumanLabel).length,
  };
}

function getDaily(infos) {
  return Object.keys(infos).sort().map(dateKey => ({
    label: dateKey.slice(0, 10),
    metrics: computeMetrics(infos[dateKey]),
  }));
}

function getISOWeek(dateStr) {
  const date = new Date(dateStr);
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function latestSnapshotPerGroup(infos, groupKeyFn) {
  const groups = {};
  const sortedDates = Object.keys(infos).sort();
  for (const dateKey of sortedDates) {
    const groupKey = groupKeyFn(dateKey);
    groups[groupKey] = infos[dateKey];
  }
  return Object.keys(groups).sort().map(groupKey => ({
    label: groupKey,
    metrics: computeMetrics(groups[groupKey]),
  }));
}

function groupByWeek(infos) {
  return latestSnapshotPerGroup(infos, getISOWeek);
}

function groupByMonth(infos) {
  return latestSnapshotPerGroup(infos, dateKey => dateKey.slice(0, 7));
}
