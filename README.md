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
| `browser` | the browser's own speech recognition | — | none, and nothing is uploaded to the host |
| `deepgram` | Deepgram | `nova-2` | `DEEPGRAM_API_KEY` |
| `groq` | Groq | `whisper-large-v3-turbo` | `GROQ_API_KEY` |
| `hf` | HuggingFace Inference | `openai/whisper-large-v3` | `HF_TOKEN` |
| `local-whisper` | local whisper.cpp server | model given at server start | none, fully offline |

Keys are read through the DSH credentials service (Settings → Credentials, or
`$DSH_HOME/.credentials.yaml`), falling back to the process environment. A
provider without a key is skipped, not fatal.

### Ready-made providers

Six providers are filled in already — put the name in a chain and add the key:

| Name | Model | Credential |
|---|---|---|
| `openai` | `whisper-1` | `OPENAI_API_KEY` |
| `siliconflow` | `FunAudioLLM/SenseVoiceSmall` | `SILICONFLOW_API_KEY` |
| `deepinfra` | `openai/whisper-large-v3-turbo` | `DEEPINFRA_API_KEY` |
| `fireworks` | `whisper-v3-turbo` | `FIREWORKS_API_KEY` |
| `mistral` | `voxtral-mini-latest` | `MISTRAL_API_KEY` |
| `openrouter` | `google/gemini-2.5-flash` | `OPENROUTER_API_KEY` |

```yaml
- id: dsh-voice
  config:
    message:
      chain:
        - provider: openai
        - provider: local-whisper
```

Every endpoint was probed without a key before being written down: all six answered `401`, the answer of a path that exists and wants credentials. The model ids are starting points — override `model` in a chain row to change one.

A preset is the same form as a custom provider with the fields filled in, so a `customProviders` entry under the same name replaces it outright.

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

## Three ways to speak

| Gesture | What happens |
|---|---|
| Click the microphone | dictation: speech is cut on pauses and each phrase is appended to the composer |
| Click the wave | a voice message: recording runs until you stop it, then the text is sent after a cancel window |
| **Hold the wave** | records only while held; release sends it, moving the pointer off the button discards |
| **Hold `Ctrl`** | the same without reaching for the mouse; `Escape` discards |

The hotkey is `hotkey` in the settings — a modifier name (`Control`, `Alt`, `Shift`) or a `KeyboardEvent` code. Empty turns it off.

## Recognition in the browser

Put `browser` first in a chain and speech is recognised by the browser itself: no key, no upload to this host, and the text appears **while you are still speaking** — an interim caption in the recording bar, with each finished phrase going into the composer.

```yaml
- id: dsh-voice
  config:
    dictation:
      chain:
        - provider: browser
        - provider: local-whisper   # если браузер не умеет — обычный путь
```

Two things to know before choosing it:

- **Chrome sends the audio to Google.** Firefox has no such API at all. Everything else in this plugin keeps audio between your browser and your own host, so this provider is the one exception — it is never used unless you put it in a chain yourself.
- It needs a secure context (HTTPS or localhost), like the microphone itself.

Put a normal provider after it: if the browser cannot do it, recording falls back to the chain as usual.

## Configure (Web GUI)

Settings → **Plugins → Plugin settings → Voice** — the plugin's own
collapsible card in the plugins tab; the sidebar keeps no separate row for it.
The card has four blocks:

- **Dictation** — fallback chain (provider + optional model per row, order is
  the order of attempts), language, and the silence threshold that ends a
  phrase (`vadSilenceMs`, default 700 ms).
- **Voice message** — its own independent chain, language, and the cancel
  window before the message is sent (`autoSendMs`, default 4000 ms).
- **Your own providers** — an OpenAI-compatible API per card: name, template,
  base URL, model, credential name. The name becomes selectable in both chains
  as soon as it is filled in.
- **General** — local whisper endpoint, binary, model, autostart, beep, localOnly,
  microphone, custom vocabulary, offline polish endpoint (`polishBaseUrl`/`polishModel`/`polishKeyEnv`).
- **Voice message** also has `polishSend` (polish the whole draft before sending) and
  `sessionCommands` ("send", "cancel", "stop", "continue" act on the session instead of text).
- **Dictation** also has a wake word: browser recognition starts recording when speech
  begins with that phrase (empty disables it).

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
