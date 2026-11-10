import { generateFromParsed } from './generate';
self.onmessage = async ({ data }) => {
  try {
    const result = await generateFromParsed(data.parsed, data.filename, { ...data.options, onProgress: (progress: string) => self.postMessage({ progress }) });
    self.postMessage({ result });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'Route generation failed.' }); }
};
