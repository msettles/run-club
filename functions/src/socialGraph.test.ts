import { describe, expect, it, vi } from 'vitest';
import { metaGraphClient, MetaRejected, publishInstagram, publishFacebook, type GraphClient } from './socialGraph';

describe('Meta publishing protocol', () => {
  it('sends tokens only in headers and encodes photo captions safely', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ post_id: '12_34' })));
    await metaGraphClient('test-secret', 'v27.0', transport).post('12/photos', { caption: 'Run & walk = fun!', url: 'https://example.test/image.jpg' });
    const [url, init] = transport.mock.calls[0];
    expect(String(url)).not.toContain('test-secret');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-secret' });
    expect(new URLSearchParams(String(init?.body)).get('caption')).toBe('Run & walk = fun!');
  });
  it('does not leak raw Meta errors and distinguishes rejected from uncertain writes', async () => {
    const rejected = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'test-secret', code: 190 } }), { status: 400 }));
    await expect(metaGraphClient('test-secret', 'v27.0', rejected).post('12/photos', {})).rejects.toThrow(MetaRejected);
    await expect(metaGraphClient('test-secret', 'v27.0', rejected).post('12/photos', {})).rejects.not.toThrow('test-secret');
    const uncertain = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 502 }));
    await expect(metaGraphClient('test-secret', 'v27.0', uncertain).post('12/photos', {})).rejects.not.toBeInstanceOf(MetaRejected);
  });
  it('waits for the Instagram image container and saves intent before publishing', async () => {
    const events: string[] = [];
    const graph: GraphClient = {
      post: vi.fn(async (path) => { events.push(path); return { id: path.endsWith('/media') ? '123' : '456' }; }),
      get: vi.fn().mockResolvedValueOnce({ status_code: 'IN_PROGRESS' }).mockResolvedValueOnce({ status_code: 'FINISHED' }),
    };
    expect(await publishInstagram(graph, '789', ['https://example.test/image.jpg'], 'caption', async (id) => { events.push(`saved:${id}`); }, async () => {})).toBe('456');
    expect(events).toEqual(['789/media', 'saved:123', '789/media_publish']);
  });
  it('does not publish an errored container or retry an ambiguous publishing response', async () => {
    const graph: GraphClient = { post: vi.fn().mockResolvedValueOnce({ id: '123' }), get: vi.fn().mockResolvedValue({ status_code: 'ERROR' }) };
    await expect(publishInstagram(graph, '789', ['https://example.test/image.jpg'], 'caption', async () => {}, async () => {})).rejects.toBeInstanceOf(MetaRejected);
    expect(graph.post).toHaveBeenCalledTimes(1);
    const next: GraphClient = { post: vi.fn().mockResolvedValueOnce({ id: '123' }).mockRejectedValueOnce(new Error('Timeout')), get: vi.fn().mockResolvedValue({ status_code: 'FINISHED' }) };
    await expect(publishInstagram(next, '789', ['https://example.test/image.jpg'], 'caption', async () => {}, async () => {})).rejects.toThrow('Timeout');
    expect(next.post).toHaveBeenCalledTimes(2);
  });
});

describe('multiple route photos in one post', () => {
  it('stages two Facebook photos and makes only one feed post', async () => {
    const graph: GraphClient = { post: vi.fn().mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '22' }).mockResolvedValueOnce({ id: '12_34' }), get: vi.fn() };
    const before = vi.fn(async () => {});
    expect(await publishFacebook(graph, '12', ['https://example.test/short.jpg', 'https://example.test/long.jpg'], 'Two routes', before)).toBe('12_34');
    expect(graph.post).toHaveBeenNthCalledWith(1, '12/photos', { url: 'https://example.test/short.jpg', published: 'false' });
    expect(graph.post).toHaveBeenNthCalledWith(2, '12/photos', { url: 'https://example.test/long.jpg', published: 'false' });
    expect(before).toHaveBeenCalledWith(['11', '22']);
    expect(graph.post).toHaveBeenNthCalledWith(3, '12/feed', { message: 'Two routes', attached_media: JSON.stringify([{ media_fbid: '11' }, { media_fbid: '22' }]) });
  });
  it('publishes one Instagram carousel with both route images in order', async () => {
    const graph: GraphClient = { post: vi.fn().mockResolvedValueOnce({ id: '11' }).mockResolvedValueOnce({ id: '22' }).mockResolvedValueOnce({ id: '33' }).mockResolvedValueOnce({ id: '44' }), get: vi.fn().mockResolvedValue({ status_code: 'FINISHED' }) };
    const before = vi.fn(async () => {});
    expect(await publishInstagram(graph, '12', ['https://example.test/short.jpg', 'https://example.test/long.jpg'], 'Two routes', before, async () => {})).toBe('44');
    expect(graph.post).toHaveBeenNthCalledWith(1, '12/media', { image_url: 'https://example.test/short.jpg', is_carousel_item: 'true' });
    expect(graph.post).toHaveBeenNthCalledWith(2, '12/media', { image_url: 'https://example.test/long.jpg', is_carousel_item: 'true' });
    expect(graph.post).toHaveBeenNthCalledWith(3, '12/media', { media_type: 'CAROUSEL', children: '11,22', caption: 'Two routes' });
    expect(before).toHaveBeenCalledWith('33');
    expect(graph.post).toHaveBeenNthCalledWith(4, '12/media_publish', { creation_id: '33' });
  });
  it('does not make a partial post if the second image fails to stage', async () => {
    const graph: GraphClient = { post: vi.fn().mockResolvedValueOnce({ id: '11' }).mockRejectedValueOnce(new MetaRejected()), get: vi.fn().mockResolvedValue({ status_code: 'FINISHED' }) };
    const before = vi.fn(async () => {});
    await expect(publishFacebook(graph, '12', ['https://example.test/1.jpg', 'https://example.test/2.jpg'], 'caption', before)).rejects.toBeInstanceOf(MetaRejected);
    expect(before).not.toHaveBeenCalled(); expect(graph.post).toHaveBeenCalledTimes(2);
  });
});
