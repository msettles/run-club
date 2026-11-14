/** Meta responses are deliberately not surfaced verbatim: they can contain credentials. */
export class MetaRejected extends Error {
  constructor(public readonly code?: number) { super('Meta rejected the request. Check account permissions and connection.'); }
}
export interface GraphClient {
  get(path: string, fields: string): Promise<Record<string, unknown>>;
  post(path: string, data: Record<string, string>): Promise<Record<string, unknown>>;
}
export function metaGraphClient(token: string, version: string, transport: typeof fetch = fetch): GraphClient {
  const request = async (path: string, data: Record<string, string>, method: 'GET' | 'POST') => {
    if (!/^[\d]+(?:\/[a-z_]+)?$/.test(path)) throw new Error('Invalid Meta resource.');
    const url = new URL(`https://graph.facebook.com/${version}/${path}`);
    if (method === 'GET') url.search = new URLSearchParams(data).toString();
    const response = await transport(url, {
      method, headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      ...(method === 'POST' ? { body: new URLSearchParams(data) } : {}), signal: AbortSignal.timeout(20000),
    });
    let value: Record<string, unknown>;
    try { value = await response.json() as Record<string, unknown>; }
    catch { throw new Error('Meta returned an unreadable response.'); }
    if (!response.ok || value.error) {
      // A server/proxy failure can occur after the platform accepted a write.
      if (response.status >= 500) throw new Error('Meta response is uncertain.');
      throw new MetaRejected((value.error as { code?: number } | undefined)?.code);
    }
    return value;
  };
  return { get: (path, fields) => request(path, { fields }, 'GET'), post: (path, data) => request(path, data, 'POST') };
}
export function graphId(value: Record<string, unknown>, field = 'id'): string {
  if (typeof value[field] !== 'string' || !/^\d+(?:_\d+)?$/.test(value[field] as string)) throw new Error('Meta did not return a post ID.');
  return value[field] as string;
}

async function waitForContainer(graph: GraphClient, container: string, pause: (ms: number) => Promise<void>) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await graph.get(container, 'status_code');
    if (status.status_code === 'FINISHED') return;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') throw new MetaRejected();
    if (status.status_code === 'PUBLISHED') throw new Error('Container was already published. Verify it in Instagram.');
    await pause(1000);
  }
  throw new MetaRejected();
}

/** Stage images without feed posts, then publish one Facebook post with all attachments. */
export async function publishFacebook(graph: GraphClient, account: string, imageUrls: string[], caption: string,
  beforePublish: (photoIds: string[]) => Promise<void>) {
  const photos: string[] = [];
  for (const url of imageUrls) photos.push(graphId(await graph.post(`${account}/photos`, { url, published: 'false' })));
  await beforePublish(photos);
  return graphId(await graph.post(`${account}/feed`, { message: caption, attached_media: JSON.stringify(photos.map((id) => ({ media_fbid: id }))) }));
}

/** Create image children for a carousel, then publish its parent exactly once. */
export async function publishInstagram(graph: GraphClient, account: string, imageUrls: string[], caption: string,
  beforePublish: (containerId: string) => Promise<void>, pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))) {
  let container: string;
  if (imageUrls.length === 1) {
    container = graphId(await graph.post(`${account}/media`, { image_url: imageUrls[0], caption }));
  } else {
    const children: string[] = [];
    for (const image_url of imageUrls) {
      const child = graphId(await graph.post(`${account}/media`, { image_url, is_carousel_item: 'true' }));
      await waitForContainer(graph, child, pause);
      children.push(child);
    }
    container = graphId(await graph.post(`${account}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption }));
  }
  await waitForContainer(graph, container, pause);
  await beforePublish(container);
  // No automatic retries of this final write: it may have succeeded even if its response is lost.
  return graphId(await graph.post(`${account}/media_publish`, { creation_id: container }));
}
