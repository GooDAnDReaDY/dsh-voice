    // 5. Hardware & Audio Engines Card
    function HardwareOptionsCard(props) {
      const t = props.t || moduleT
      const draft = props.draft
      const setTop = props.setTop
      const writable = props.writable
      const catching = props.catching
      const setCatching = props.setCatching
      const devices = props.devices || []
      const testingMic = props.testingMic
      const toggleTestMic = props.toggleTestMic
      const testLevel = props.testLevel || 0
      const gateDbVal = props.gateDbVal
      const gateThresholdPercent = props.gateThresholdPercent
      const onClearKey = props.onClearKey

      const textField = (key, label, hint) => React.createElement('div', { className: 'cb-field' },
        React.createElement('label', null, label),
        React.createElement('input', {
          type: 'text', value: draft && draft[key] !== undefined ? draft[key] : '', disabled: !writable,
          onChange: (e) => setTop(key, e.target.value),
        }),
        React.createElement('span', { className: 'dvs-sub' }, hint),
      )

      return React.createElement('div', { className: 'cb-section-card' },
        React.createElement('div', { className: 'cb-section-title' },
          React.createElement('span', null, '⚙️ ' + t('hardwareTitle')),
        ),
        React.createElement('div', { className: 'cb-section-desc' }, t('hardwareDesc')),
        // Hotkey picker
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('hotkey')),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('button', {
              type: 'button', className: 'cb-btn cb-btn-primary', disabled: !writable,
              onClick: () => setCatching(true),
            }, catching ? t('pressKey') : keyLabel(draft && draft.hotkey)),
            React.createElement('button', {
              type: 'button', className: 'cb-btn cb-btn-mini', title: t('clearKey'),
              disabled: !writable, onClick: onClearKey,
            }, '×'),
          ),
          React.createElement('span', { className: 'dvs-sub' }, t('hotkeyHint1') + t('hotkeyHint2')),
        ),
        // Mic & noise gate
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('mic')),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('select', {
              value: String((draft && draft.micDeviceId) ?? ''), disabled: !writable || testingMic,
              onChange: (e) => setTop('micDeviceId', e.target.value),
              style: { flex: 1 },
            },
              React.createElement('option', { value: '' }, t('micDefault')),
              devices.map((d) => React.createElement('option', { key: d.deviceId, value: d.deviceId },
                d.label || d.deviceId.slice(0, 12))),
            ),
            React.createElement('button', {
              type: 'button',
              className: 'cb-btn ' + (testingMic ? 'cb-btn-primary' : 'cb-btn-secondary'),
              onClick: toggleTestMic,
              style: { flex: 'none' },
            }, testingMic ? t('stopTest') : t('testMic')),
          ),
          testingMic ? React.createElement('div', { className: 'dvo-mic-test' },
            React.createElement('span', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' } }, t('micLevel') + ':'),
            React.createElement('div', { className: 'dvo-meter-bar' },
              React.createElement('div', { className: 'dvo-meter-fill', style: { width: `${testLevel}%` } }),
              gateThresholdPercent > 0 ? React.createElement('div', { className: 'dvo-meter-gate', style: { left: `${gateThresholdPercent}%` }, title: `${gateDbVal} dB` }) : null,
            ),
            React.createElement('span', { style: { fontSize: '11px', fontVariantNumeric: 'tabular-nums', width: '32px', textAlign: 'right' } }, `${testLevel}%`),
          ) : null,
          React.createElement('div', { className: 'cb-row', style: { marginTop: '6px' } },
            React.createElement('span', { style: { fontSize: '12px', color: 'var(--dsw-alias-label-secondary)', minWidth: '120px' } }, t('noiseGate') + ':'),
            React.createElement('select', {
              value: String(gateDbVal), disabled: !writable,
              onChange: (e) => setTop('noiseGateDb', Number(e.target.value)),
              style: { flex: 1 },
            },
              React.createElement('option', { value: '-999' }, t('noiseGateOff')),
              React.createElement('option', { value: '-50' }, '-50 dB (Low / Gentle)'),
              React.createElement('option', { value: '-45' }, '-45 dB (Standard Default)'),
              React.createElement('option', { value: '-35' }, '-35 dB (Medium Room)'),
              React.createElement('option', { value: '-25' }, '-25 dB (High / Mechanical Clicks)'),
            ),
          ),
          React.createElement('span', { className: 'dvs-sub' }, t('noiseGateHint')),
        ),
        // Endpoint text fields
        React.createElement('div', { className: 'cb-grid-2' },
          textField('whisperUrl', t('whisperEndpoint'), t('whisperEndpointHint')),
          textField('whisperBin', t('whisperBin'), t('whisperBinHint')),
          textField('whisperModel', t('whisperModel'), t('whisperModelHint')),
          textField('deepgramBaseUrl', t('deepgramEndpoint'), t('deepgramEndpointHint')),
          textField('sensevoiceUrl', t('sensevoiceEndpoint'), t('sensevoiceEndpointHint')),
          textField('sensevoiceBin', t('sensevoiceBin'), t('sensevoiceBinHint')),
          textField('sensevoiceModel', t('sensevoiceModel'), t('sensevoiceModelHint')),
          textField('polishBaseUrl', t('polishBaseUrl'), t('polishBaseUrlHint')),
          textField('polishModel', t('polishModel'), ''),
          textField('polishKeyEnv', t('polishKeyEnv'), ''),
        ),
        // Engine checkboxes
        React.createElement('div', { className: 'cb-row' },
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.autoStart), disabled: !writable,
              onChange: (e) => setTop('autoStart', e.target.checked),
            }),
            t('whisperAutostart'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.sensevoiceAutostart), disabled: !writable,
              onChange: (e) => setTop('sensevoiceAutostart', e.target.checked),
            }),
            t('sensevoiceAutostart'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.localOnly), disabled: !writable,
              onChange: (e) => setTop('localOnly', e.target.checked),
            }),
            t('localOnly'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.beep), disabled: !writable,
              onChange: (e) => setTop('beep', e.target.checked),
            }),
            t('beep'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.noiseSuppression !== false : true, disabled: !writable,
              onChange: (e) => setTop('noiseSuppression', e.target.checked),
            }),
            t('noiseSuppression'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: draft ? draft.contextGlossary !== false : true, disabled: !writable,
              onChange: (e) => setTop('contextGlossary', e.target.checked),
            }),
            t('contextGlossary'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.voiceCommands), disabled: !writable,
              onChange: (e) => setTop('voiceCommands', e.target.checked),
            }),
            t('voiceCommandsLabel'),
          ),
          React.createElement('label', { className: 'cb-check-label' },
            React.createElement('input', {
              type: 'checkbox', checked: !!(draft && draft.normalizeTranscript), disabled: !writable,
              onChange: (e) => setTop('normalizeTranscript', e.target.checked),
            }),
            t('normalizeTranscript'),
          ),
        ),
        // Visualizer select
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('visualizerStyle')),
          React.createElement('select', {
            value: String((draft && draft.visualizerStyle) || 'liquid-wave'), disabled: !writable,
            onChange: (e) => setTop('visualizerStyle', e.target.value),
          },
            React.createElement('option', { value: 'liquid-wave' }, t('visLiquidWave')),
            React.createElement('option', { value: 'dynamic-orb' }, t('visDynamicOrb')),
            React.createElement('option', { value: 'bars' }, t('visBars')),
            React.createElement('option', { value: 'off' }, t('visOff')),
          ),
        ),
        // Hardware Acceleration (SBC NPU / Host)
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('npuProvider')),
          React.createElement('div', { className: 'cb-row' },
            React.createElement('select', {
              value: String((draft && draft.sensevoiceProvider) || 'cpu'),
              disabled: !writable,
              onChange: (e) => setTop('sensevoiceProvider', e.target.value),
              style: { flex: 1 },
            },
              React.createElement('option', { value: 'cpu' }, 'CPU (Standard)'),
              React.createElement('option', { value: 'rknpu' }, 'Rockchip RK3588 NPU (rknpu)'),
              React.createElement('option', { value: 'openvino' }, 'Intel OpenVINO'),
              React.createElement('option', { value: 'cuda' }, 'NVIDIA CUDA'),
            ),
            React.createElement('input', {
              type: 'number',
              min: 1,
              max: 32,
              value: Number((draft && draft.sensevoiceThreads) || 4),
              disabled: !writable,
              title: t('npuThreads'),
              style: { width: '80px' },
              onChange: (e) => setTop('sensevoiceThreads', Math.max(1, Math.min(32, Number(e.target.value) || 4))),
            }),
          ),
          React.createElement('span', { className: 'dvs-sub' }, t('npuProviderHint')),
        ),
        // WebGPU Status Indicator
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('webgpuStatus')),
          React.createElement('div', {
            style: {
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              backgroundColor: 'var(--dsw-alias-fill-quaternary)',
              color: (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
                ? 'var(--dsw-alias-state-success)'
                : 'var(--dsw-alias-label-secondary)'
            }
          }, (typeof isWebGpuSupported === 'function' && isWebGpuSupported())
              ? ('✓ ' + t('webgpuAvailable'))
              : ('ℹ ' + t('webgpuNotAvailable'))),
        ),
        // Vocabulary textarea
        React.createElement('div', { className: 'cb-field' },
          React.createElement('label', null, t('vocabulary')),
          React.createElement('textarea', {
            rows: 3, disabled: !writable,
            value: Array.isArray(draft && draft.vocabulary) ? draft.vocabulary.join('\n') : '',
            onChange: (e) => setTop('vocabulary', e.target.value.split('\n').map((x) => x.trim()).filter(Boolean)),
          }),
        ),
      )
    }
