import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractImage, extractText, generate, listModels, parseJsonLoose } from './gemini';

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ok = (text: string) => ({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

afterEach(() => vi.unstubAllGlobals());

describe('generate', () => {
  it('falls back to the next model when one is not found', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply({ error: { code: 404, message: 'models/old is not found', status: 'NOT_FOUND' } }, 404)).mockResolvedValueOnce(reply(ok('hi')));
    vi.stubGlobal('fetch', fetch);
    const res = await generate({ key: 'k', models: ['old', 'new'], body: { contents: [] } });
    expect(res.model).toBe('new');
    expect(fetch.mock.calls[1][0]).toContain('/models/new:generateContent');
  });

  it('drops an optional setting the model rejects and retries the same model', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: { code: 400, message: 'Thinking level is not supported for this model.', status: 'INVALID_ARGUMENT' } }, 400))
      .mockResolvedValueOnce(reply(ok('hi')));
    vi.stubGlobal('fetch', fetch);
    const res = await generate({ key: 'k', models: ['m'], body: { generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } } });
    expect(res.model).toBe('m');
    expect(JSON.parse(fetch.mock.calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined();
  });

  it('turns an invalid key into a friendly message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }, 400)));
    await expect(generate({ key: 'bad', models: ['m'], body: {} })).rejects.toThrow(/isn’t valid/);
  });

  it('explains rate limits', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ error: { code: 429, message: 'Resource exhausted', status: 'RESOURCE_EXHAUSTED' } }, 429)));
    await expect(generate({ key: 'k', models: ['m'], body: {} })).rejects.toThrow(/rate limit or quota/);
  });

  it('sends the key in a header, never in the URL', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(ok('hi')));
    vi.stubGlobal('fetch', fetch);
    await generate({ key: 'secret-key', models: ['m'], body: {} });
    expect(fetch.mock.calls[0][0]).not.toContain('secret-key');
    expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('secret-key');
  });
});

describe('response parsing', () => {
  it('skips thought parts in text', () => {
    expect(extractText({ candidates: [{ content: { parts: [{ text: 'thinking', thought: true }, { text: '{"a":1}' }] } }] })).toBe('{"a":1}');
  });

  it('returns the final image as a data URL', () => {
    const json = { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'AAA' }, thought: true }, { text: 'Here' }, { inlineData: { mimeType: 'image/png', data: 'BBB' } }] } }] };
    expect(extractImage(json)).toBe('data:image/png;base64,BBB');
  });

  it('reports blocked prompts', () => {
    expect(() => extractText({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(/declined/);
  });

  it('parses JSON wrapped in code fences or chatter', () => {
    expect(parseJsonLoose('```json\n{"ideas":[]}\n```')).toEqual({ ideas: [] });
    expect(parseJsonLoose('Sure! {"x": 2} Enjoy')).toEqual({ x: 2 });
  });
});

describe('listModels', () => {
  it('keeps generateContent Gemini models and labels image models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply({
          models: [
            { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-3.1-flash-image', displayName: 'Nano Banana 2', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-embedding-001', supportedGenerationMethods: ['embedContent'] },
          ],
        }),
      ),
    );
    expect(await listModels('k')).toEqual([
      { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', kind: 'text' },
      { id: 'gemini-3.1-flash-image', name: 'Nano Banana 2', kind: 'image' },
    ]);
  });
});
