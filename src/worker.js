import { pipeline, env } from '@huggingface/transformers';
env.allowLocalModels = false;
const cache = new Map();
const models = {
  'tiny.en': 'onnx-community/whisper-tiny.en',
  'base.en': 'onnx-community/whisper-base.en',
  'tiny': 'onnx-community/whisper-tiny',
};
const post = (type, data = {}) => self.postMessage({ type, ...data });
self.onmessage = async (event) => {
  const { audio, model, device } = event.data;
  try {
    const modelId = models[model];
    if (!modelId) throw new Error('Unknown model');
    const key = modelId + ':' + device;
    let transcriber = cache.get(key);
    if (!transcriber) {
      post('status', { message: 'Downloading/loading speech model (first use may take a while)…' });
      const options = {
        device,
        progress_callback: (progress) => {
          if (progress.status === 'progress' && Number.isFinite(progress.progress)) {
            post('download', { progress: Math.round(progress.progress), file: progress.file ?? '' });
          }
        },
      };
      transcriber = await pipeline('automatic-speech-recognition', modelId, options);
      cache.set(key, transcriber);
    }
    const seconds = audio.length / 16000;
    const chunkSeconds = 25;
    const count = Math.ceil(seconds / chunkSeconds);
    let full = '';
    const segments = [];
    for (let i = 0; i < count; i++) {
      const start = i * chunkSeconds;
      const end = Math.min(start + chunkSeconds, seconds);
      const slice = audio.subarray(Math.round(start * 16000), Math.round(end * 16000));
      post('status', { message: `Transcribing part ${i + 1} of ${count}…` });
      const result = await transcriber(slice, { return_timestamps: true });
      const txt = (result.text || '').trim();
      if (txt) full += (full ? ' ' : '') + txt;
      if (Array.isArray(result.chunks) && result.chunks.length) {
        result.chunks.forEach((c) => segments.push({
          start: start + Math.max(0, c.timestamp?.[0] ?? 0),
          end: start + Math.max(0, c.timestamp?.[1] ?? end - start),
          text: (c.text || '').trim(),
        }));
      } else if (txt) segments.push({ start, end, text: txt });
      post('partial', { text: full, segments, completed: i + 1, total: count });
    }
    post('done', { text: full, segments });
  } catch (error) {
    post('error', { message: error?.message || String(error) });
  }
};
