const buckets = new Map();
const recent = new Map();

export function allowRequest(ip, limit = 10, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const stamps = (buckets.get(ip) || []).filter((stamp) => now - stamp < windowMs);
  if (stamps.length >= limit) {
    buckets.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  buckets.set(ip, stamps);
  return true;
}

export function rememberSubmission(key, store) {
  const now = Date.now();
  for (const [saved, at] of recent) {
    if (now - at > 10 * 60 * 1000) recent.delete(saved);
  }
  if (!store) return recent.has(key);
  recent.set(key, now);
  return false;
}
