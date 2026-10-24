# Transcribe Studio

Free, browser-based audio transcription built with Whisper and Transformers.js.

## Features
- Drag-and-drop audio files or microphone recording
- Choose fast English, higher-accuracy English, or multilingual model
- WebGPU acceleration when supported; CPU fallback selectable
- Editable transcript, copy, TXT and approximate SRT export
- No backend or API keys; audio is processed locally
- Deploy to GitHub Pages with GitHub Actions

## Run locally
Requirements: Node.js 20.19+ (Node 22 recommended).
```bash
npm install
npm run dev
```

## Deploy to GitHub Pages
1. Create a **public** GitHub repository (e.g. `audio-transcriber`).
2. Upload **all files**, including the hidden `.github/workflows/deploy.yml`, preserving folders. Alternatively extract this ZIP locally and push with Git:
```bash
git init
git add .
git commit -m "Initial audio transcriber"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/audio-transcriber.git
git push -u origin main
```
3. In GitHub repository **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
4. The included workflow builds and deploys after pushes to `main`. Your URL will be `https://YOUR_USERNAME.github.io/audio-transcriber/`.

## Notes and limitations
- Whisper model weights download from Hugging Face on first use and may be substantial; subsequent loads are generally cached by the browser.
- Audio remains in your browser, but dependencies and model weights must be downloaded; this is not fully offline on first load.
- Audio decoding depends on browser codec support. For unsupported FLAC or other formats, convert to WAV or MP3.
- Long files use substantial RAM; audio is divided into 25-second chunks for recognition, but decoding currently loads the complete file first.
- Chunk boundaries and timestamps can be imperfect. SRT is approximate, and transcript editing does not retime subtitles.
- Models can make transcription mistakes and hallucinate, especially with music/silence. Proofread important recordings.
- For best performance use Chrome/Edge with WebGPU; switch to Compatible CPU if WebGPU fails.
