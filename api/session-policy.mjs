const idleWindow = "INTERVAL '15 minutes'";

export const idleDeadline = `COALESCE(s.last_seen_at, s.created_at) + ${idleWindow}`;
export const activeSession = `s.expires_at > NOW() AND ${idleDeadline} > NOW()`;
