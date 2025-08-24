const fetch = globalThis.fetch ?? ((...args) =>
  import('node-fetch').then(({ default: f }) => f(...args))
);

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphGet(path, accessToken) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Graph GET ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function graphPost(path, accessToken, body) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Graph POST ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function graphDelete(path, accessToken) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Graph DELETE ${path} failed: ${res.status} ${txt}`);
  }
  return true;
}

module.exports = { graphGet, graphPost, graphDelete };
