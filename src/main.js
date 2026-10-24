import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
<header><div class="brand"><span class="logo">◉</span><span>TRANSCRIBE<span class="muted"> STUDIO</span></span></div><span class="private">● Private browser processing</span></header>
<main>
  <div class="hero"><span class="eyebrow">SPEECH → TEXT</span><h1>Turn audio into <em>clear text.</em></h1><p>Upload a recording or capture your voice. Powered by open-source Whisper, processed on your computer.</p></div>
  <section class="panel">
    <div class="section-head"><h2>01 <span>Source audio</span></h2><span class="sub">MP3 · WAV · M4A · WebM · more*</span></div>
    <div id="drop" class="drop" tabindex="0" role="button" aria-label="Select audio file"><div class="upload-symbol">↑</div><strong>Drop an audio file here</strong><p>or <span>click to browse</span></p><input id="file" type="file" accept="audio/*,video/mp4,.mp3,.wav,.m4a,.ogg,.webm,.flac" hidden></div>
    <div class="rec-row"><span id="fileInfo">No audio selected</span><button id="record" class="secondary" type="button">● Record audio</button></div>
    <audio id="player" controls hidden></audio>
  </section>
  <section class="panel">
    <div class="section-head"><h2>02 <span>Recognition settings</span></h2></div>
    <div class="settings"><label>Speech model<select id="model"><option value="tiny.en">Whisper Tiny · English · fastest</option><option value="base.en" selected>Whisper Base · English · better accuracy</option><option value="tiny">Whisper Tiny · multilingual</option></select></label><label>Processor<select id="device"><option value="wasm">Compatible · CPU</option><option value="webgpu">Fast · WebGPU (Chrome/Edge)</option></select></label></div>
    <button id="transcribe" class="primary" type="button" disabled>✦ Transcribe audio <span>→</span></button>
    <div class="status" aria-live="polite"><span id="status">Select an audio file to begin.</span><span id="progress"></span></div>
  </section>
  <section class="panel result-panel"><div class="section-head"><h2>03 <span>Transcript</span></h2><div class="actions"><button id="copy" disabled>Copy</button><button id="txt" disabled>TXT ↓</button><button id="srt" disabled>SRT ↓</button></div></div><textarea id="output" placeholder="Your transcript will appear here. You can edit it after transcription." spellcheck="true"></textarea><div class="foot"><span id="wordCount">0 words</span><span>Timestamped subtitles are approximate.</span></div></section>
  <footer>Runs entirely in your browser after model download. Audio is not uploaded to our server. *Format support depends on your browser; long recordings may require significant memory.</footer>
</main>`;
const el = (id) => document.getElementById(id);
let selected, url, recorder, stream, recordings = [], segments = [], busy = false, worker;
const status = (message) => { el('status').textContent = message; };
const setBusy = (yes) => { busy = yes; el('transcribe').disabled = yes || !selected; el('record').disabled = yes; el('model').disabled = yes; el('device').disabled = yes; };
function setSource(file) {
  if (!file) return;
  if (url) URL.revokeObjectURL(url);
  selected = file; url = URL.createObjectURL(file);
  el('player').src = url; el('player').hidden = false;
  el('fileInfo').textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  el('transcribe').disabled = false;
  status('Ready to transcribe.');
}
el('drop').onclick = () => el('file').click();
el('drop').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el('file').click(); } };
el('file').onchange = (e) => setSource(e.target.files[0]);
el('drop').ondragover = (e) => { e.preventDefault(); el('drop').classList.add('drag'); };
el('drop').ondragleave = () => el('drop').classList.remove('drag');
el('drop').ondrop = (e) => { e.preventDefault(); el('drop').classList.remove('drag'); setSource(e.dataTransfer.files[0]); };
el('record').onclick = async () => {
  if (recorder && recorder.state === 'recording') { recorder.stop(); el('record').textContent = '● Record audio'; return; }
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording is unavailable in this browser.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordings = []; recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size) recordings.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(recordings, { type: recorder.mimeType || 'audio/webm' });
      setSource(new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }));
      stream.getTracks().forEach((t) => t.stop()); stream = null;
    };
    recorder.start(); el('record').textContent = '■ Stop recording'; status('Recording…');
  } catch (e) { status(`Microphone error: ${e.message}`); if (stream) stream.getTracks().forEach((t) => t.stop()); }
};
async function decode16k(file) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    status('Decoding audio…');
    const buffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
    const length = Math.ceil(buffer.duration * 16000);
    const offline = new OfflineAudioContext(1, length, 16000);
    const source = offline.createBufferSource();
    source.buffer = buffer; source.connect(offline.destination); source.start();
    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } finally { await audioCtx.close(); }
}
function updateOutput(txt) { el('output').value = txt; updateCount(); el('copy').disabled = !txt; el('txt').disabled = !txt; el('srt').disabled = !segments.length; }
function updateCount() { el('wordCount').textContent = `${el('output').value.trim() ? el('output').value.trim().split(/\s+/).length : 0} words`; }
el('output').addEventListener('input', updateCount);
el('transcribe').onclick = async () => {
  if (!selected || busy) return;
  setBusy(true); segments = []; updateOutput(''); el('progress').textContent = '';
  try {
    const audio = await decode16k(selected);
    const model = el('model').value, device = el('device').value;
    if (worker) worker.terminate();
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (data.type === 'status') status(data.message);
      if (data.type === 'download') el('progress').textContent = `${data.progress}%`;
      if (data.type === 'partial' || data.type === 'done') {
        segments = data.segments; updateOutput(data.text);
        if (data.type === 'partial') el('progress').textContent = `${data.completed}/${data.total} parts`;
      }
      if (data.type === 'done') { status('Transcription complete. Review the text before use.'); el('progress').textContent = '✓'; setBusy(false); }
      if (data.type === 'error') { status(`Error: ${data.message}. Try Compatible · CPU or a smaller model.`); setBusy(false); }
    };
    worker.onerror = (e) => { status(`Worker error: ${e.message}`); setBusy(false); };
    worker.postMessage({ audio, model, device }, [audio.buffer]);
  } catch (e) { status(`Audio error: ${e.message}`); setBusy(false); }
};
el('copy').onclick = async () => { try { await navigator.clipboard.writeText(el('output').value); status('Transcript copied.'); } catch { status('Copy not permitted. Select the text and copy manually.'); } };
function download(name, content, mime) { const blob = new Blob([content], { type: mime }); const href = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = href; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(href), 1000); }
const stamp = (s) => { const ms = Math.round(Math.max(0, s) * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms % 1000).padStart(3,'0')}`; };
el('txt').onclick = () => download('transcript.txt', el('output').value, 'text/plain;charset=utf-8');
el('srt').onclick = () => download('subtitles.srt', segments.map((c, i) => `${i + 1}\n${stamp(c.start)} --> ${stamp(c.end)}\n${c.text}\n`).join('\n'), 'text/plain;charset=utf-8');
if ('gpu' in navigator) el('device').value = 'webgpu';
