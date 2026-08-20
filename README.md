# dsh-voice

Voice input for the DeepSeek Harness Web GUI, in two modes, each with its own
provider fallback chain.

**Dictation** — press the mic, talk, and the text lands in the composer as you
go: speech is cut into phrases on silence and each phrase is transcribed on its
own. Press again to stop; sending stays in your hands.

**Voice message** — press the wave button, record, press again. The transcript
is inserted and sent to the agent after a short cancel window.

Both modes fall back across providers, so one outage or rate limit does not
lose your recording. API keys never reach the browser: audio is posted to the
plugin's own route and the host talks to the providers.

## Install

```bash
# From npm:
dsh plugin --profile web add @goodandready/dsh-voice

# Locally from a checkout:
dsh plugin --profile web add file:/path/to/dsh-voice
```

Restart the Web UI afterwards, then hard-refresh the browser.

## Providers

| Key | Service | Default model | Credential |
|---|---|---|---|
| `deepgram` | Deepgram | `nova-2` | `DEEPGRAM_API_KEY` |
| `groq` | Groq | `whisper-large-v3-turbo` | `GROQ_API_KEY` |
| `hf` | HuggingFace Inference | `openai/whisper-large-v3` | `HF_TOKEN` |
| `local-whisper` | local whisper.cpp server | model given at server start | none, fully offline |

Keys are read through the DSH credentials service (Settings → Credentials, or
`$DSH_HOME/.credentials.yaml`), falling back to the process environment. A
provider without a key is skipped, not fatal.

### Your own providers

Any OpenAI-compatible API can be added as a provider and used in the chains
next to the built-in ones. Two templates, because those APIs disagree on how
audio is sent:

| Template | Endpoint | Request | Transcript read from |
|---|---|---|---|
| `openai-transcriptions` | `{baseURL}/audio/transcriptions` | multipart: file, model, language | `text` |
| `openai-chat-audio` | `{baseURL}/chat/completions` | JSON with `input_audio`: base64 and format | `choices[0].message.content` |

OpenRouter has no `/audio/transcriptions` endpoint at all — use the chat
template there:

```yaml
- id: dsh-voice
  config:
    customProviders:
      - key: openrouter
        template: openai-chat-audio
        baseURL: https://openrouter.ai/api/v1
        model: google/gemini-2.5-flash
        keyEnv: OPENROUTER_API_KEY
    message:
      chain:
        - provider: openrouter
        - provider: local-whisper
```

Fields: `key` is the name the chains refer to (it cannot shadow a built-in
one), `keyEnv` names the credential holding the API key (empty means no
authorization header), and `prompt` overrides the instruction sent with the
audio in the chat template. A row in a chain may still override `model`.

The chat template accepts WAV and MP3 only, while the browser records
webm/opus — the plugin converts with ffmpeg, the same way the local whisper
provider does, so **ffmpeg is required for `openai-chat-audio`**.

## Configure (Web GUI)

Settings → **Голос** (Voice) has four blocks:

- **Dictation** — fallback chain (provider + optional model per row, order is
  the order of attempts), language, and the silence threshold that ends a
  phrase (`vadSilenceMs`, default 700 ms).
- **Voice message** — its own independent chain, language, and the cancel
  window before the message is sent (`autoSendMs`, default 4000 ms).
- **Your own providers** — an OpenAI-compatible API per card: name, template,
  base URL, model, credential name. The name becomes selectable in both chains
  as soon as it is filled in.
- **General** — local whisper endpoint, binary, model, autostart.

Speed matters for dictation and accuracy for messages, which is why the chains
are separate: a sensible pair is Deepgram → Groq → local for dictation and
Groq → HuggingFace → local for messages.

## Local whisper.cpp

The local provider needs a running [whisper.cpp](https://github.com/ggerganov/whisper.cpp)
server:

```bash
whisper-server -m /path/to/ggml-medium-q8_0.bin --host 127.0.0.1 --port 8001
```

Set `whisperModel` (and `whisperBin` if it is not in `PATH`) and the plugin
launches the server itself when `autoStart` is on. While `whisperModel` is
empty, autostart stays off.

**ffmpeg is required for this provider.** whisper.cpp accepts WAV only and
rejects the webm/opus the browser records, so the host converts each recording
to 16 kHz mono WAV before forwarding it. Point `ffmpegBin` at your binary if it
is not in `PATH`.

## Tool

The plugin also registers `transcribe_audio(file_path, language?)` for the
agent, using the voice-message chain. Useful for recordings and interviews that
are already files on disk.

## Routes

| Route | Purpose |
|---|---|
| `POST /dsh-voice/transcribe` | `{dataBase64, mimeType, mode}` → `{ok, text, provider, tookMs}` |
| `GET /dsh-voice/status` | whisper server state and the effective chains |

## Structure

```
lib/index.js       host: config, routes, transcribe_audio, whisper autostart
lib/providers.js   the four providers, pure functions (network injected)
lib/chain.js       fallback walk over a chain
lib/wav.js         webm/opus → WAV 16 kHz mono via ffmpeg
lib/client.js      browser: composer buttons, recording, settings page
test/              node --test units for the chain and the providers
```

Run the tests with `npm test` (no dependencies, Node's built-in runner).

## Requirements

- DeepSeek Harness with the Web GUI
- Node 20+
- ffmpeg, for the local whisper provider
- a microphone reachable from the browser (HTTPS or localhost)

## License

MIT
