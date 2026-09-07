export function shortSha(sha: string | null | undefined) {
  return sha ? sha.slice(0, 8) : '—';
}

export function timeAgo(ts: number | null | undefined) {
  if (!ts) {
    return '—';
  }
  const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function fmtTime(ts: number | null | undefined) {
  if (!ts) {
    return '—';
  }
  return new Date(ts).toLocaleString();
}

export function fmtDuration(
  start: number | null | undefined,
  end: number | null | undefined
) {
  if (!start) {
    return '—';
  }
  const ms = (end ?? Date.now()) - start;
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function fmtPercent(ratio: number | null | undefined) {
  if (ratio === null || ratio === undefined) {
    return '—';
  }
  return `${Math.round(ratio * 100)}%`;
}
