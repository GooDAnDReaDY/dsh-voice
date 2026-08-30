# 📦 @goodandready/dsh-voice

<div align="center">

[![npm version](https://img.shields.io/npm/v/@goodandready/dsh-voice.svg?style=flat-square)](https://www.npmjs.com/package/@goodandready/dsh-voice)
[![license](https://img.shields.io/github/license/GooDAnDReaDY/dsh-voice.svg?style=flat-square)](LICENSE)
[![DSH Plugin](https://img.shields.io/badge/DSH-Plugin-6366f1.svg?style=flat-square)](https://github.com/topics/dsh-plugin)

**[ 🇬🇧 English ](#-english) • [ 🇷🇺 Русский ](#-русский) • [ 🇨🇳 中文 ](#-中文)**

</div>

---

<a name="-english"></a>
## 🇬🇧 English

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

---

<a name="-русский"></a>
<details open>
<summary><h2>🇷🇺 Русский (Полное руководство)</h2></summary>

Голосовой ввод для Web GUI DeepSeek Harness в двух режимах, каждый со своей цепочкой отказоустойчивости провайдеров.

**Диктовка** — нажмите микрофон, говорите, и текст появляется в поле ввода на лету: речь нарезается на фразы по тишине (паузам), и каждая фраза распознаётся отдельно. Нажмите ещё раз для остановки; отправка остаётся под вашим контролем.

**Голосовое сообщение** — нажмите кнопку волны, запишите мысль и нажмите снова. Распознанный текст вставляется и автоматически отправляется агенту после короткого окна отмены.

Оба режима перебирают провайдеров по цепочке, поэтому сбой одного сервиса или исчерпание лимитов не приведут к потере записи. API-ключи никогда не попадают в браузер: аудио отправляется на собственный маршрут плагина, а с провайдерами общается хост.

### Установка

```bash
# Из npm:
dsh plugin --profile web add @goodandready/dsh-voice

# Локально из репозитория:
dsh plugin --profile web add file:/path/to/dsh-voice
```

После установки перезапустите Web UI (`systemctl --user restart dsh-web`) и обновите вкладку в браузере.

### Провайдеры

| Ключ | Сервис | Модель по умолчанию | Учётные данные |
|---|---|---|---|
| `browser` | Распознавание браузера (Web Speech API) | — | Не требуются, аудио не уходит на хост |
| `deepgram` | Deepgram | `nova-2` | `DEEPGRAM_API_KEY` |
| `groq` | Groq | `whisper-large-v3-turbo` | `GROQ_API_KEY` |
| `hf` | HuggingFace Inference | `openai/whisper-large-v3` | `HF_TOKEN` |
| `local-whisper` | Локальный сервер whisper.cpp | модель из параметров сервера | Не требуются, 100% оффлайн |

Ключи читаются через сервис учётных данных DSH (Настройки → Учётные данные или `$DSH_HOME/.credentials.yaml`) с откатом к переменным окружения процесса. Провайдер без ключа просто пропускается, не вызывая фатального сбоя.

#### Готовые пресеты провайдеров

Шесть провайдеров уже сконфигурированы — достаточно вписать имя в цепочку и задать ключ:

| Имя | Модель | Переменная ключа |
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

Все эндпоинты были проверены без ключа: все шесть ответили `401` (путь существует и ожидает авторизации). Идентификаторы моделей являются отправной точкой — переопределите поле `model` в строке цепочки, чтобы сменить модель.

Пресет имеет ту же форму, что и пользовательский провайдер: запись в `customProviders` с тем же именем полностью перекрывает пресет.

#### Собственные провайдеры

Любой OpenAI-совместимый API можно добавить в виде провайдера и использовать в цепочках наряду со встроенными. Доступно два шаблона отправки аудио:

| Шаблон | Эндпоинт | Запрос | Откуда читается текст |
|---|---|---|---|
| `openai-transcriptions` | `{baseURL}/audio/transcriptions` | multipart: file, model, language | `text` |
| `openai-chat-audio` | `{baseURL}/chat/completions` | JSON с `input_audio`: base64 и формат | `choices[0].message.content` |

У OpenRouter нет эндпоинта `/audio/transcriptions` — используйте там шаблон чата:

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

Поля: `key` — имя для цепочек (не может перекрывать встроенные ключи), `keyEnv` — имя секрета с API-ключом (пусто = без заголовка авторизации), `prompt` — переопределение инструкции, отправляемой вместе со звуком. В строке цепочки можно переопределить `model`.

Шаблон чата принимает только WAV и MP3, а браузер записывает webm/opus — плагин конвертирует звук через ffmpeg точно так же, как для локального whisper, поэтому **для `openai-chat-audio` необходим ffmpeg**.

### Способы голосового ввода

| Действие | Что происходит |
|---|---|
| Клик по микрофону | Диктовка: фразы режутся по паузам и добавляются в поле ввода |
| Клик по волне | Голосовое сообщение: пишется до остановки, текст уходит после окна отмены |
| **Удержание волны** | Запись только пока зажата кнопка; отпускание отправляет, увод мыши сбрасывает |
| **Удержание `Ctrl`** | То же самое без мыши; клавиша `Escape` отменяет запись |

Горячая клавиша настраивается через `hotkey` в настройках — имя модификатора (`Control`, `Alt`, `Shift`) или код клавиши `KeyboardEvent`. Пустое значение отключает PTT.

### Распознавание в браузере

Поставьте `browser` первым в цепочке — речь будет распознаваться самим браузером: без ключа, без отправки аудио на хост, а текст появляется **прямо во время речи** — живые промежуточные субтитры в строке записи, с переносом каждой законченной фразы в поле ввода.

```yaml
- id: dsh-voice
  config:
    dictation:
      chain:
        - provider: browser
        - provider: local-whisper   # фолбек, если браузер не умеет
```

Два нюанса перед выбором:
- **Chrome отправляет аудио в Google.** В Firefox такого API нет вообще. Всё остальное в этом плагине держит аудио между вашим браузером и сервером, поэтому этот провайдер — единственное исключение (он никогда не используется, пока вы сами не укажете его в цепочке).
- Требуется защищённый контекст (HTTPS или localhost), как и для доступа к микрофону.

### Настройка через интерфейс (Web GUI)

Настройки → **Плагины → Настройки плагинов → Голос** — сворачиваемая карточка плагина. В ней 4 блока:
- **Диктовка** — цепочка фолбеков (провайдер + модель, порядок сверху вниз), язык и порог тишины (`vadSilenceMs`, по умолчанию 700 мс).
- **Голосовое сообщение** — отдельная независимая цепочка, язык и окно отмены перед отправкой (`autoSendMs`, по умолчанию 4000 мс).
- **Свои провайдеры** — карточка OpenAI-совместимого API: имя, шаблон, базовый URL, модель, имя секрета.
- **Общие** — эндпоинт локального whisper, путь к бинарнику, модель, автозапуск.

Для диктовки важна скорость, а для сообщений — точность, поэтому цепочки разделены: разумная пара — Deepgram → Groq → local для диктовки и Groq → HuggingFace → local для сообщений.

### Локальный whisper.cpp

Локальному провайдеру нужен запущенный сервер [whisper.cpp](https://github.com/ggerganov/whisper.cpp):

```bash
whisper-server -m /path/to/ggml-medium-q8_0.bin --host 127.0.0.1 --port 8001
```

Укажите `whisperModel` (и `whisperBin`, если его нет в `PATH`), и плагин сам запустит сервер при включённом `autoStart`. Пока путь к модели пуст, автозапуск отключён.

**Для этого провайдера необходим ffmpeg.** whisper.cpp принимает только WAV и отвергает webm/opus из браузера, поэтому хост конвертирует каждую запись в 16 кГц mono WAV перед отправкой.

### Инструмент агента (Tool)

Плагин регистрирует инструмент `transcribe_audio(file_path, language?)` для агента, используя цепочку голосовых сообщений. Удобно для анализа готовых аудиофайлов и записей с диска.

### Маршруты

| Маршрут | Назначение |
|---|---|
| `POST /dsh-voice/transcribe` | `{dataBase64, mimeType, mode}` → `{ok, text, provider, tookMs}` |
| `GET /dsh-voice/status` | Состояние сервера whisper и активные цепочки |

</details>

---

<a name="-中文"></a>
<details>
<summary><h2>🇨🇳 中文 (完整技术文档)</h2></summary>

为 DeepSeek Harness Web GUI 打造的语音输入插件，具备双输入模式与独立的故障转移备用链。

**实时听写** — 单击麦克风图标，开始说话，文字将实时录入输入框：根据静音停顿自动切分语音片段并逐句转写。再次单击停止；发送控制权始终保留在您手中。

**语音消息** — 单击声波图标进行录音，再次单击停止。转写文本自动填入，并在短暂的撤回倒计时窗口后发送给智能体。

两种模式均支持跨服务商备用链自动重试，单一 API 限流或网络中断绝不会丢失您的录音。API 密钥绝不暴露给浏览器：音频上传至插件专属后端路由，由服务端与各服务商交互。

### 安装方法

```bash
# 从 npm 安装:
dsh plugin --profile web add @goodandready/dsh-voice

# 从本地源码安装:
dsh plugin --profile web add file:/path/to/dsh-voice
```

安装后请重启 Web UI 服务 (`systemctl --user restart dsh-web`) 并强制刷新浏览器页面。

### 服务商列表

| 标识 Key | 对应服务 | 默认模型 | 凭据变量名 | 补充说明 |
|---|---|---|---|---|
| `browser` | 浏览器原生 Web Speech API | — | 无需密钥，音频不上传至服务端 |
| `deepgram` | Deepgram | `nova-2` | `DEEPGRAM_API_KEY` |
| `groq` | Groq | `whisper-large-v3-turbo` | `GROQ_API_KEY` |
| `hf` | HuggingFace Inference | `openai/whisper-large-v3` | `HF_TOKEN` |
| `local-whisper` | 本地 whisper.cpp 服务 | 启动参数指定 | 无需密钥，完全离线运行 |

密钥通过 DSH 凭据服务统一读取（设置 → 凭据 或 `$DSH_HOME/.credentials.yaml`），未配置时自动回退至系统环境变量。未配置密钥的服务商会被自动跳过。

#### 预置服务商

以下 6 家服务商已预设完成，只需在备用链中填入名称并配置 API 密钥即可直接使用：

| 名称 | 模型 | 凭据变量名 |
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

#### 自定义服务商

支持接入任意 OpenAI 兼容接口，并与内置服务商组合使用。提供两种接口模板：

| 模板名称 | 接口端点 | 请求格式 | 转写文本读取位置 |
|---|---|---|---|
| `openai-transcriptions` | `{baseURL}/audio/transcriptions` | multipart: file, model, language | `text` |
| `openai-chat-audio` | `{baseURL}/chat/completions` | JSON (含 `input_audio` base64 数据) | `choices[0].message.content` |

OpenRouter 缺少 `/audio/transcriptions` 端点，可直接使用 chat 模板：

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

Chat 模板仅支持 WAV 和 MP3 格式，插件会自动调用 ffmpeg 进行音频转码，因此 **使用 `openai-chat-audio` 必须安装 ffmpeg**。

### 交互操作手势

| 操作方式 | 行为表现 |
|---|---|
| 单击麦克风 🎙️ | 实时听写：按停顿切分语音，逐句追加至输入框 |
| 单击声波 🌊 | 语音消息：录制完整音频，停止后进入倒计时发送 |
| **长按声波 🌊** | 按住录音；松开立即发送，将光标移出按钮区域则取消 |
| **按住 `Ctrl` 键** | 键盘对讲；松开发送，按 `Escape` 键立即取消 |

可在设置中通过 `hotkey` 自定义快捷键（如 `Control`, `Alt`, `Shift` 或键码）。

### 浏览器本地识别 (`browser`)

将 `browser` 设为备用链首位即可启用浏览器原生识别：无需 API 密钥，音频无需上传，在说话的同时录音栏即会显示**实时同声字幕**。

```yaml
- id: dsh-voice
  config:
    dictation:
      chain:
        - provider: browser
        - provider: local-whisper
```

### Web GUI 配置面板

路径：设置 → **插件 → 插件设置 → 语音**：
- **听写 (Dictation)** — 备用链、识别语言、停顿静音阈值 (`vadSilenceMs`，默认 700 ms)。
- **语音消息 (Voice message)** — 独立备用链、识别语言、撤回窗口 (`autoSendMs`，默认 4000 ms)。
- **自定义服务商** — 配置 OpenAI 格式接口。
- **通用** — 本地 whisper.cpp 端口、路径、模型及自启动开关。

### 本地 whisper.cpp

需运行 [whisper.cpp](https://github.com/ggerganov/whisper.cpp) 服务端：

```bash
whisper-server -m /path/to/ggml-medium-q8_0.bin --host 127.0.0.1 --port 8001
```

配置 `whisperModel` 与 `whisperBin` 后开启 `autoStart`，插件将自动拉起服务。需要系统安装 `ffmpeg` 用于转码 16 kHz mono WAV。

### 智能体工具 (Tool)

向智能体注册 `transcribe_audio(file_path, language?)` 工具，基于语音消息备用链转写磁盘上的录音文件。

### 后端路由

| 路由 | 用途 |
|---|---|
| `POST /dsh-voice/transcribe` | `{dataBase64, mimeType, mode}` → `{ok, text, provider, tookMs}` |
| `GET /dsh-voice/status` | 查询 whisper 运行状态及当前生效备用链 |

</details>
