import { declareComponent } from '@webflow/react';
import { props } from '@webflow/data-types';
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from 'react';
import { useWebflowContext } from '@webflow/react';

/* ─── State machine ─── */
const STATES = {
  IDLE: 'idle',
  REQUESTING_MIC: 'requesting_mic',
  MIC_DENIED: 'mic_denied',
  CONNECTING: 'connecting',
  LIVE: 'live',
  RECONNECTING: 'reconnecting',
  CONNECTION_FAILED: 'connection_failed',
  ENDING: 'ending',
  ENDED: 'ended',
  ERROR: 'error',
} as const;

type CallState = (typeof STATES)[keyof typeof STATES];

/* ─── Agent options ─── */
type AgentOption = {
  agentId: string;
  label: string;
};

const DEFAULT_AGENT_OPTIONS: AgentOption[] = [
  {
    agentId: 'phonic-co-marketing-demo-healthcare',
    label: 'Patient intake with Virginia',
  },
  {
    agentId: 'phonic-co-marketing-demo-customer-support',
    label: 'Customer support with Sabrina',
  },
  {
    agentId: 'phonic-co-marketing-demo-logistics',
    label: 'Driver check-in with Grant',
  },
  {
    agentId: 'phonic-co-marketing-demo-recruiting',
    label: 'Candidate screening with Eleanor',
  },
];

const DEFAULT_AGENTS_JSON_VALUE = JSON.stringify(DEFAULT_AGENT_OPTIONS, null, 2);
const DEFAULT_AGENT_ID = DEFAULT_AGENT_OPTIONS[0].agentId;

const SESSION_TOKEN_URL =
  'https://phonic-session-token.mattspieg.workers.dev/api/phonic/session-token';
const CONVERSATIONS_SLOT_NAME = 'conversations';
const RICH_TEXT_BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, blockquote';

function toText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).join('');
  if (typeof value === 'object') {
    const obj = value as {
      props?: {
        children?: unknown;
        dangerouslySetInnerHTML?: { __html?: string };
      };
    };
    if (obj.props?.children != null) return toText(obj.props.children);
    if (obj.props?.dangerouslySetInnerHTML?.__html) return obj.props.dangerouslySetInnerHTML.__html;
  }
  return '';
}

function normalizeAgentOption(agentId: unknown, label: unknown): AgentOption | null {
  const normalizedAgentId = toText(agentId).trim();
  if (!normalizedAgentId) return null;

  const normalizedLabel = toText(label).trim() || normalizedAgentId;
  return { agentId: normalizedAgentId, label: normalizedLabel };
}

function parseJsonAgentOptions(source: string): AgentOption[] | null {
  try {
    const parsed = JSON.parse(source);
    if (!Array.isArray(parsed)) return null;

    const jsonOptions = parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const option = item as {
          id?: unknown;
          agentId?: unknown;
          key?: unknown;
          value?: unknown;
          label?: unknown;
          name?: unknown;
          title?: unknown;
        };
        return normalizeAgentOption(
          option.agentId ?? option.id ?? option.key ?? option.value,
          option.label ?? option.name ?? option.title,
        );
      })
      .filter((option): option is AgentOption => Boolean(option));

    return jsonOptions.length > 0 ? dedupeAgentOptions(jsonOptions) : null;
  } catch {
    return null;
  }
}

function readObjectProperty(source: string, names: string[]): string {
  for (const name of names) {
    const quotedMatch = source.match(new RegExp(`["']?${name}["']?\\s*:\\s*(["'])([\\s\\S]*?)\\1`));
    if (quotedMatch?.[2]) return quotedMatch[2];

    const bareMatch = source.match(new RegExp(`["']?${name}["']?\\s*:\\s*([^,}\\n]+)`));
    if (bareMatch?.[1]) return bareMatch[1].trim();
  }

  return '';
}

function parseObjectishAgentOptions(source: string): AgentOption[] | null {
  const objectBlocks = source.match(/\{[^{}]*\}/g) ?? [];
  const objectOptions = objectBlocks
    .map((block) =>
      normalizeAgentOption(
        readObjectProperty(block, ['agentId', 'id', 'key', 'value']),
        readObjectProperty(block, ['label', 'name', 'title']),
      ),
    )
    .filter((option): option is AgentOption => Boolean(option));

  return objectOptions.length > 0 ? dedupeAgentOptions(objectOptions) : null;
}

function isLikelyCodeLine(line: string): boolean {
  return /^[\[\]{}]/.test(line) || /^(const|let|var|window\.)\b/.test(line) || line === '];';
}

function parseLineAgentOptions(source: string): AgentOption[] | null {
  const lineOptions = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const cleanedLine = line.replace(/^[-*]\s+/, '');
      if (isLikelyCodeLine(cleanedLine)) return null;

      const separator = ['|', ',', ':', '='].find((candidate) => cleanedLine.includes(candidate));
      if (!separator) return normalizeAgentOption(cleanedLine, cleanedLine);

      const [agentId, ...labelParts] = cleanedLine.split(separator);
      return normalizeAgentOption(agentId, labelParts.join(separator));
    })
    .filter((option): option is AgentOption => Boolean(option));

  return lineOptions.length > 0 ? dedupeAgentOptions(lineOptions) : null;
}

function parseAgentOptionsSource(value: unknown): AgentOption[] | null {
  const source = toText(value).trim();
  if (!source) return null;

  return (
    parseJsonAgentOptions(source) ??
    parseObjectishAgentOptions(source) ??
    parseLineAgentOptions(source)
  );
}

function parseAgentOptions(value: unknown): AgentOption[] {
  return parseAgentOptionsSource(value) ?? DEFAULT_AGENT_OPTIONS;
}

function areAgentOptionsEqual(a: AgentOption[] | null, b: AgentOption[] | null): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;

  return a.every((option, index) => {
    const other = b[index];
    return option.agentId === other.agentId && option.label === other.label;
  });
}

function dedupeAgentOptions(options: AgentOption[]): AgentOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.agentId)) return false;
    seen.add(option.agentId);
    return true;
  });
}

function resolveInitialAgentId(options: AgentOption[]): string {
  return options[0]?.agentId ?? DEFAULT_AGENT_ID;
}

function getShadowHost(anchor: Element | null): Element | null {
  if (!anchor) return null;

  const root = anchor.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
    return root.host;
  }

  return null;
}

function getConversationSlotElements(anchor: Element | null): Element[] {
  const host = getShadowHost(anchor);
  if (!host) return [];

  return Array.from(host.children).filter(
    (child) => child.getAttribute('slot') === CONVERSATIONS_SLOT_NAME,
  );
}

function cloneContentElement(element: Element): Element {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, noscript').forEach((node) => node.remove());
  return clone;
}

function collectConversationTextCandidates(elements: Element[]): string[] {
  const candidates: string[] = [];

  elements.forEach((element) => {
    const clone = cloneContentElement(element);

    clone.querySelectorAll('pre code, pre, code').forEach((codeElement) => {
      candidates.push(codeElement.textContent ?? '');
    });

    element.querySelectorAll('script').forEach((scriptElement) => {
      candidates.push(scriptElement.textContent ?? '');
    });

    const blockText = Array.from(clone.querySelectorAll(RICH_TEXT_BLOCK_SELECTOR))
      .map((block) => block.textContent?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
    candidates.push(blockText);

    candidates.push(clone.textContent ?? '');
  });

  const seen = new Set<string>();
  return candidates
    .map((candidate) => candidate.trim())
    .filter((candidate) => {
      if (!candidate || seen.has(candidate)) return false;
      seen.add(candidate);
      return true;
    });
}

function readSlottedAgentOptions(anchor: Element | null): AgentOption[] | null {
  const candidates = collectConversationTextCandidates(getConversationSlotElements(anchor));

  for (const candidate of candidates) {
    const options = parseAgentOptionsSource(candidate);
    if (options) return options;
  }

  return null;
}

/* ─── Icons ─── */
const ChevronDown = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const MicIcon = ({ muted = false }: { muted?: boolean }) =>
  muted ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.35 2.17" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );

const PhoneIcon = ({ size = 20 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M9.91699 6.86777L9.42226 5.18567C9.17191 4.3345 8.39074 3.75 7.50352 3.75H7.00236H5.72195C4.62914 3.75 3.72593 4.63017 3.84161 5.71684C4.08189 7.97389 4.79191 10.1738 5.93438 12.143C7.35756 14.596 9.40402 16.6424 11.857 18.0656C13.8365 19.2141 16.0078 19.8922 18.2539 20.1409C19.3518 20.2625 20.25 19.3546 20.25 18.25V16.4965C20.25 15.6093 19.6655 14.8281 18.8143 14.5777L17.1322 14.083C16.4366 13.8784 15.6849 14.0783 15.1827 14.6014C14.5934 15.2152 13.6645 15.3863 12.95 14.9242C11.4005 13.9222 10.0778 12.5995 9.07581 11.05C8.61373 10.3355 8.78479 9.40661 9.39863 8.81732C9.92173 8.31514 10.1216 7.56343 9.91699 6.86777Z"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
  </svg>
);

const PhoneOffIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.8242 12.1151C10.4161 11.654 10.0422 11.1618 9.70649 10.6427C9.46639 10.2715 9.52689 9.73471 9.91892 9.35836C10.644 8.66231 10.921 7.62038 10.6374 6.65615L10.1427 4.97404C9.79845 3.80369 8.72434 3 7.50442 3H5.72284C4.24801 3 2.92738 4.20552 3.09672 5.79624C3.34796 8.15623 4.09035 10.4576 5.28656 12.5194C5.90448 13.5844 6.63466 14.5761 7.46096 15.4784L3.21967 19.7197C2.92678 20.0126 2.92678 20.4874 3.21967 20.7803C3.51256 21.0732 3.98744 21.0732 4.28033 20.7803L20.7803 4.28033C21.0732 3.98744 21.0732 3.51256 20.7803 3.21967C20.4874 2.92678 20.0126 2.92678 19.7197 3.21967L10.8242 12.1151ZM8.52274 14.4166C7.78731 13.6067 7.13641 12.7188 6.584 11.7666C5.49525 9.89004 4.81761 7.79155 4.58829 5.63745C4.52627 5.05482 5.01206 4.5 5.72284 4.5H7.50442C8.05893 4.5 8.54716 4.86531 8.70363 5.39729L9.19836 7.07939C9.32398 7.50648 9.20127 7.96798 8.88013 8.27628C8.04447 9.0785 7.76286 10.3995 8.44692 11.4573C8.84021 12.0654 9.2802 12.6405 9.76181 13.1775L8.52274 14.4166Z"
      fill="currentColor"
    />
    <path
      d="M12.2343 17.4169C11.7185 17.1177 11.2216 16.7895 10.7457 16.4347L9.67479 17.5056C10.2492 17.9454 10.8526 18.3494 11.4815 18.7143C13.5573 19.9187 15.8298 20.627 18.1723 20.8864C19.7705 21.0633 21.0009 19.743 21.0009 18.25V16.4965C21.0009 15.2766 20.1972 14.2024 19.0269 13.8582L17.3448 13.3635C16.3805 13.0799 15.3386 13.3569 14.6425 14.082C14.2662 14.474 13.7294 14.5345 13.3582 14.2944C13.2628 14.2327 13.1683 14.1698 13.0748 14.1055L11.998 15.1823C12.1767 15.3104 12.3587 15.4344 12.5436 15.554C13.6014 16.238 14.9224 15.9564 15.7246 15.1208C16.0329 14.7996 16.4944 14.6769 16.9215 14.8025L18.6036 15.2973C19.1356 15.4537 19.5009 15.942 19.5009 16.4965V18.25C19.5009 18.9662 18.9349 19.4616 18.3374 19.3955C16.1875 19.1574 14.1175 18.5095 12.2343 17.4169Z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.8242 12.1151C10.4161 11.654 10.0422 11.1618 9.70649 10.6427C9.46639 10.2715 9.52689 9.73471 9.91892 9.35836C10.644 8.66231 10.921 7.62038 10.6374 6.65615L10.1427 4.97404C9.79845 3.80369 8.72434 3 7.50442 3H5.72284C4.24801 3 2.92738 4.20552 3.09672 5.79624C3.34796 8.15623 4.09035 10.4576 5.28656 12.5194C5.90448 13.5844 6.63466 14.5761 7.46096 15.4784L3.21967 19.7197C2.92678 20.0126 2.92678 20.4874 3.21967 20.7803C3.51256 21.0732 3.98744 21.0732 4.28033 20.7803L20.7803 4.28033C21.0732 3.98744 21.0732 3.51256 20.7803 3.21967C20.4874 2.92678 20.0126 2.92678 19.7197 3.21967L10.8242 12.1151ZM8.52274 14.4166C7.78731 13.6067 7.13641 12.7188 6.584 11.7666C5.49525 9.89004 4.81761 7.79155 4.58829 5.63745C4.52627 5.05482 5.01206 4.5 5.72284 4.5H7.50442C8.05893 4.5 8.54716 4.86531 8.70363 5.39729L9.19836 7.07939C9.32398 7.50648 9.20127 7.96798 8.88013 8.27628C8.04447 9.0785 7.76286 10.3995 8.44692 11.4573C8.84021 12.0654 9.2802 12.6405 9.76181 13.1775L8.52274 14.4166Z"
      stroke="currentColor"
      strokeWidth="0.125"
      strokeLinecap="round"
    />
    <path
      d="M12.2343 17.4169C11.7185 17.1177 11.2216 16.7895 10.7457 16.4347L9.67479 17.5056C10.2492 17.9454 10.8526 18.3494 11.4815 18.7143C13.5573 19.9187 15.8298 20.627 18.1723 20.8864C19.7705 21.0633 21.0009 19.743 21.0009 18.25V16.4965C21.0009 15.2766 20.1972 14.2024 19.0269 13.8582L17.3448 13.3635C16.3805 13.0799 15.3386 13.3569 14.6425 14.082C14.2662 14.474 13.7294 14.5345 13.3582 14.2944C13.2628 14.2327 13.1683 14.1698 13.0748 14.1055L11.998 15.1823C12.1767 15.3104 12.3587 15.4344 12.5436 15.554C13.6014 16.238 14.9224 15.9564 15.7246 15.1208C16.0329 14.7996 16.4944 14.6769 16.9215 14.8025L18.6036 15.2973C19.1356 15.4537 19.5009 15.942 19.5009 16.4965V18.25C19.5009 18.9662 18.9349 19.4616 18.3374 19.3955C16.1875 19.1574 14.1175 18.5095 12.2343 17.4169Z"
      stroke="currentColor"
      strokeWidth="0.125"
      strokeLinecap="round"
    />
  </svg>
);

const CenterWrap = ({ children }: { children: ReactNode }) => (
  <div
    className="plc__centerState"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '16px',
      zIndex: 2,
      position: 'relative',
      width: '100%',
      maxWidth: '240px',
      margin: '0 auto',
      textWrap: 'balance',
    }}
  >
    {children}
  </div>
);

const AgentVoiceFallbackMeter = ({ level = 0 }: { level?: number }) => {
  const clampedLevel = Math.max(0, Math.min(1, level));
  const minHeight = 8;
  const maxHeight = 76;
  const barHeight = minHeight + clampedLevel * (maxHeight - minHeight);

  return (
    <div
      aria-label={`Assistant voice output level ${Math.round(clampedLevel * 100)}%`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <div
        style={{
          width: '28px',
          height: `${maxHeight}px`,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          borderRadius: '14px',
          backgroundColor: '#f5f3f1',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: `${barHeight}px`,
            backgroundColor: '#fe531d',
            borderRadius: '14px 14px 0 0',
            transitionProperty: 'height',
            transitionDuration: '0.08s',
            transitionTimingFunction: 'ease-out',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'inherit',
          fontSize: '11px',
          fontWeight: 500,
          color: '#a3a09d',
          lineHeight: '1',
          textTransform: 'uppercase',
          letterSpacing: 0,
        }}
      >
        Voice activity {Math.round(clampedLevel * 100)}%
      </span>
    </div>
  );
};

/* ─── Status badge config ─── */
function getStatusConfig(state: CallState) {
  const map: Record<
    CallState,
    {
      label: string;
      dotColor: string;
      bgColor: string;
      textColor: string;
      pulse: boolean;
    }
  > = {
    idle: {
      label: 'Ready',
      dotColor: '#a3a09d',
      bgColor: '#f5f3f1',
      textColor: '#6b6966',
      pulse: false,
    },
    requesting_mic: {
      label: 'Mic access needed',
      dotColor: '#f59e0b',
      bgColor: '#fffbeb',
      textColor: '#b45309',
      pulse: true,
    },
    mic_denied: {
      label: 'Mic blocked',
      dotColor: '#ef4444',
      bgColor: '#fef2f2',
      textColor: '#dc2626',
      pulse: false,
    },
    connecting: {
      label: 'Connecting',
      dotColor: '#f59e0b',
      bgColor: '#fffbeb',
      textColor: '#b45309',
      pulse: true,
    },
    live: {
      label: 'Live',
      dotColor: '#fe531d',
      bgColor: '#fff7f5',
      textColor: '#fe531d',
      pulse: true,
    },
    reconnecting: {
      label: 'Reconnecting',
      dotColor: '#f59e0b',
      bgColor: '#fffbeb',
      textColor: '#b45309',
      pulse: true,
    },
    connection_failed: {
      label: 'Connection failed',
      dotColor: '#ef4444',
      bgColor: '#fef2f2',
      textColor: '#dc2626',
      pulse: false,
    },
    ending: {
      label: 'Ending',
      dotColor: '#a3a09d',
      bgColor: '#f5f3f1',
      textColor: '#6b6966',
      pulse: true,
    },
    ended: {
      label: 'Ended',
      dotColor: '#6b6966',
      bgColor: '#f5f3f1',
      textColor: '#6b6966',
      pulse: false,
    },
    error: {
      label: 'Error',
      dotColor: '#ef4444',
      bgColor: '#fef2f2',
      textColor: '#dc2626',
      pulse: false,
    },
  };
  return map[state] ?? map.idle;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Audio encoding / decoding helpers for Phonic STS WebSocket

   Audio format: pcm_44100 (signed 16-bit PCM, 44.1kHz, mono)
   - Client sends: JSON { type: "audio_chunk", audio: "<base64 PCM bytes>" }
   - Server sends: JSON { type: "audio_chunk", audio: "<base64 PCM bytes>" }
   - Config message includes input_format and output_format

   Chunk size: 20ms = 882 samples at 44.1kHz
   ═══════════════════════════════════════════════════════════════════════════ */

const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_INPUT_FORMAT = 'pcm_44100';
const AUDIO_OUTPUT_FORMAT = 'pcm_44100';
const AUDIO_CHUNK_MS = 20;
const AUDIO_CHUNK_SAMPLES = Math.round((AUDIO_SAMPLE_RATE * AUDIO_CHUNK_MS) / 1000);
const PLAYBACK_JITTER_BUFFER_SECONDS = 0.08;
const MIC_LEVEL_VISUAL_GAIN = 4;
const DEFAULT_SCALE_BELOW_WIDTH = 440;
const AGENT_VOICE_IDLE_FLOOR = 0.1;
const AGENT_VOICE_AVERAGE_WINDOW_MS = 350;
const AGENT_VOICE_PEAK_WEIGHT = 0.4;
const AGENT_VOICE_RISE_SMOOTHING = 0.14;
const AGENT_VOICE_FALL_SMOOTHING = 0.07;
const AGENT_SPEAKING_START_THRESHOLD = 0.075;
const AGENT_SPEAKING_STOP_THRESHOLD = 0.035;
const AGENT_SPEAKING_HOLD_MS = 260;
const UNICORN_PROJECT_ID = '56tZPvzwUeyXjakom0Sh';
const UNICORN_SDK_URL =
  'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js';
const UNICORN_SCALE = 1;
const UNICORN_DPI = 2;
const UNICORN_FPS = 30;
const UNICORN_SDK_LAZY_LOAD = false;
const UNICORN_OFFSCREEN_ROOT_MARGIN = '0px';
const UNICORN_OFFSCREEN_TEARDOWN_DELAY_MS = 5000;
const UNICORN_SDK_TIMEOUT_MS = 15000;
const UNICORN_POSTER_FADE_MS = 240;
const UNICORN_EDGE_MASK =
  'linear-gradient(to right, transparent 0%, #000 15%, #000 85%, transparent 100%)';
const UNICORN_VARIABLE_RANGES = {
  speed: { min: 0.1, max: 1 },
  amplitude: { min: 0.02, max: 0.3 },
  brightness: { min: 0.7, max: 3 },
} as const;
const UNICORN_PREVIEW_AMPLITUDE = 0.5;
const UNICORN_PREVIEW_BRIGHTNESS = 0.6;
const UNICORN_LIVE_TRANSITION_MS = 1000;
const UNICORN_VARIABLE_PRECISION = 4;

type UnicornVariables = Record<string, number>;

type UnicornSceneInstance = {
  destroy?: () => void;
  setVariable?: (name: string, value: number) => unknown;
  setVariables?: (variables: UnicornVariables) => unknown;
};

type UnicornStudioApi = {
  addScene?: (options: {
    projectId: string;
    element: HTMLElement;
    scale?: number;
    dpi?: number;
    fps?: number;
    lazyLoad?: boolean;
    initialVariables?: UnicornVariables;
    ariaLabel?: string;
  }) => Promise<UnicornSceneInstance>;
  init?: () => Promise<UnicornSceneInstance[]>;
  scenes?: UnicornSceneInstance[];
  isInitialized?: boolean;
};

declare global {
  interface Window {
    UnicornStudio?: UnicornStudioApi;
    __phonicUnicornStudioPromise?: Promise<UnicornStudioApi>;
  }
}

function findUnicornStudioScript(): HTMLScriptElement | null {
  const expectedSrc = new URL(UNICORN_SDK_URL, document.baseURI).href;

  return (
    Array.from(document.scripts).find((script) => {
      if (!script.src) return false;
      if (script.src === expectedSrc) return true;

      try {
        const scriptUrl = new URL(script.src, document.baseURI);
        return /\/unicornStudio(?:\.min)?\.umd\.js$/i.test(scriptUrl.pathname);
      } catch {
        return false;
      }
    }) ?? null
  );
}

function roundVariable(value: number, precision = 2): number {
  return Number(value.toFixed(precision));
}

function lerp(min: number, max: number, level: number): number {
  return min + (max - min) * level;
}

function getUnicornVariablesForVoiceLevel(level: number): UnicornVariables {
  const clampedLevel = Math.max(AGENT_VOICE_IDLE_FLOOR, Math.min(1, level));
  const normalizedLevel = (clampedLevel - AGENT_VOICE_IDLE_FLOOR) / (1 - AGENT_VOICE_IDLE_FLOOR);

  return {
    'Aurora Speed': roundVariable(
      lerp(UNICORN_VARIABLE_RANGES.speed.min, UNICORN_VARIABLE_RANGES.speed.max, normalizedLevel),
      UNICORN_VARIABLE_PRECISION,
    ),
    'Aurora Amplitude': roundVariable(
      lerp(
        UNICORN_VARIABLE_RANGES.amplitude.min,
        UNICORN_VARIABLE_RANGES.amplitude.max,
        normalizedLevel,
      ),
      UNICORN_VARIABLE_PRECISION,
    ),
    'Aurora Brightness': roundVariable(
      lerp(
        UNICORN_VARIABLE_RANGES.brightness.min,
        UNICORN_VARIABLE_RANGES.brightness.max,
        normalizedLevel,
      ),
      UNICORN_VARIABLE_PRECISION,
    ),
  };
}

function getUnicornPreviewVariables(): UnicornVariables {
  return {
    'Aurora Speed': UNICORN_VARIABLE_RANGES.speed.min,
    'Aurora Amplitude': UNICORN_PREVIEW_AMPLITUDE,
    'Aurora Brightness': roundVariable(
      UNICORN_VARIABLE_RANGES.brightness.max * UNICORN_PREVIEW_BRIGHTNESS,
      UNICORN_VARIABLE_PRECISION,
    ),
  };
}

function getTransitionedUnicornVariables(
  from: UnicornVariables,
  to: UnicornVariables,
  progress: number,
): UnicornVariables {
  const easedProgress =
    progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
  const transitioned: UnicornVariables = {};

  Object.keys(to).forEach((name) => {
    transitioned[name] = roundVariable(
      lerp(from[name] ?? to[name], to[name], easedProgress),
      UNICORN_VARIABLE_PRECISION,
    );
  });

  return transitioned;
}

function loadUnicornStudio(): Promise<UnicornStudioApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Unicorn Studio is only available in the browser.'));
  }

  if (window.UnicornStudio?.addScene) {
    return Promise.resolve(window.UnicornStudio);
  }

  if (window.__phonicUnicornStudioPromise) {
    return window.__phonicUnicornStudioPromise;
  }

  window.UnicornStudio = window.UnicornStudio ?? { isInitialized: false };
  window.__phonicUnicornStudioPromise = new Promise((resolve, reject) => {
    let settled = false;
    let sdkScript: HTMLScriptElement | null = null;

    const cleanup = () => {
      window.clearTimeout(timeout);
      sdkScript?.removeEventListener('load', handleLoad);
      sdkScript?.removeEventListener('error', handleError);
    };

    const resolveSdk = () => {
      if (settled || !window.UnicornStudio?.addScene) return false;
      settled = true;
      cleanup();
      resolve(window.UnicornStudio);
      return true;
    };

    const rejectSdk = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const handleLoad = () => {
      if (sdkScript) {
        sdkScript.dataset.phonicUnicornSdkState = 'loaded';
      }

      if (!resolveSdk()) {
        rejectSdk(new Error('Unicorn Studio SDK loaded without addScene support.'));
      }
    };

    const handleError = () => {
      if (sdkScript) {
        sdkScript.dataset.phonicUnicornSdkState = 'failed';
      }
      rejectSdk(new Error('Failed to load Unicorn Studio SDK.'));
    };

    const timeout = window.setTimeout(() => {
      rejectSdk(new Error('Timed out waiting for the Unicorn Studio SDK.'));
    }, UNICORN_SDK_TIMEOUT_MS);

    sdkScript = findUnicornStudioScript();

    if (!sdkScript) {
      sdkScript = document.createElement('script');
      sdkScript.src = UNICORN_SDK_URL;
      sdkScript.async = true;
      sdkScript.fetchPriority = 'high';
      sdkScript.dataset.phonicUnicornSdkState = 'loading';
      (document.head || document.body).appendChild(sdkScript);
    }

    sdkScript.addEventListener('load', handleLoad, { once: true });
    sdkScript.addEventListener('error', handleError, { once: true });

    if (sdkScript.dataset.phonicUnicornSdkState === 'failed') {
      handleError();
      return;
    }

    if (sdkScript.dataset.phonicUnicornSdkState === 'loaded') {
      handleLoad();
      return;
    }

    resolveSdk();
  }).catch((error) => {
    window.__phonicUnicornStudioPromise = undefined;
    throw error;
  });

  return window.__phonicUnicornStudioPromise;
}

function applyUnicornVariables(
  scene: UnicornSceneInstance | null,
  variables: UnicornVariables,
): void {
  if (!scene) return;

  if (typeof scene.setVariables === 'function') {
    scene.setVariables(variables);
    return;
  }

  if (typeof scene.setVariable === 'function') {
    Object.entries(variables).forEach(([name, value]) => scene.setVariable?.(name, value));
  }
}

function clearUnicornSceneHost(element: HTMLElement): void {
  element.removeAttribute('data-us-initialized');
  element.removeAttribute('data-scene-id');
  element.innerHTML = '';
}

function VoiceUnicornScene({
  voiceLevel,
  preview = false,
  posterSrc,
}: {
  voiceLevel: number;
  preview?: boolean;
  posterSrc?: string;
}) {
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UnicornSceneInstance | null>(null);
  const variables = useMemo(
    () => (preview ? getUnicornPreviewVariables() : getUnicornVariablesForVoiceLevel(voiceLevel)),
    [preview, voiceLevel],
  );
  const latestVariablesRef = useRef(variables);
  const displayedVariablesRef = useRef(variables);
  const transitionFrameRef = useRef<number | null>(null);
  const readyFrameRef = useRef<number | null>(null);
  const pendingAddSceneRef = useRef<Promise<UnicornSceneInstance> | null>(null);
  const previousPreviewRef = useRef(preview);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [fallbackDelayElapsed, setFallbackDelayElapsed] = useState(false);

  useEffect(() => {
    latestVariablesRef.current = variables;
  }, [variables]);

  useEffect(() => {
    const wasPreview = previousPreviewRef.current;
    previousPreviewRef.current = preview;

    if (preview) {
      if (transitionFrameRef.current !== null) {
        cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }
      displayedVariablesRef.current = variables;
      applyUnicornVariables(sceneRef.current, variables);
      return;
    }

    if (!wasPreview) return;

    const startVariables = displayedVariablesRef.current;
    const transitionStart = performance.now();

    const updateTransition = (now: number) => {
      const progress = Math.min(1, (now - transitionStart) / UNICORN_LIVE_TRANSITION_MS);
      const transitionedVariables = getTransitionedUnicornVariables(
        startVariables,
        latestVariablesRef.current,
        progress,
      );

      displayedVariablesRef.current = transitionedVariables;
      applyUnicornVariables(sceneRef.current, transitionedVariables);

      if (progress < 1) {
        transitionFrameRef.current = requestAnimationFrame(updateTransition);
        return;
      }

      displayedVariablesRef.current = latestVariablesRef.current;
      applyUnicornVariables(sceneRef.current, latestVariablesRef.current);
      transitionFrameRef.current = null;
    };

    transitionFrameRef.current = requestAnimationFrame(updateTransition);
  }, [preview]);

  useEffect(() => {
    if (transitionFrameRef.current !== null) return;
    displayedVariablesRef.current = variables;
    applyUnicornVariables(sceneRef.current, variables);
  }, [variables]);

  useEffect(() => {
    const element = sceneHostRef.current;
    if (!element) return;

    let disposed = false;
    let initializing = false;
    let initializationId = 0;
    let intersectionObserver: IntersectionObserver | null = null;
    let teardownTimeout: number | null = null;
    let fallbackDelayTimeout: number | null = null;

    setSceneReady(false);
    setSceneFailed(false);
    setFallbackDelayElapsed(false);

    const cancelReadyFrame = () => {
      if (readyFrameRef.current === null) return;
      cancelAnimationFrame(readyFrameRef.current);
      readyFrameRef.current = null;
    };

    const cancelTeardown = () => {
      if (teardownTimeout === null) return;
      window.clearTimeout(teardownTimeout);
      teardownTimeout = null;
    };

    const cancelFallbackDelay = () => {
      if (fallbackDelayTimeout === null) return;
      window.clearTimeout(fallbackDelayTimeout);
      fallbackDelayTimeout = null;
    };

    const scheduleFallbackDelay = () => {
      cancelFallbackDelay();
      fallbackDelayTimeout = window.setTimeout(() => {
        fallbackDelayTimeout = null;
        if (!disposed) {
          setFallbackDelayElapsed(true);
        }
      }, 1800);
    };

    const destroyScene = (updateReadyState: boolean) => {
      initializationId += 1;
      initializing = false;
      cancelTeardown();
      cancelFallbackDelay();
      cancelReadyFrame();
      sceneRef.current?.destroy?.();
      sceneRef.current = null;
      clearUnicornSceneHost(element);

      if (updateReadyState) {
        setSceneReady(false);
        setSceneFailed(false);
        setFallbackDelayElapsed(false);
      }
    };

    const initializeScene = async () => {
      cancelTeardown();
      if (disposed || initializing || sceneRef.current) return;

      const currentInitializationId = ++initializationId;
      initializing = true;
      setSceneReady(false);
      setSceneFailed(false);
      setFallbackDelayElapsed(false);
      scheduleFallbackDelay();

      try {
        const studio = await loadUnicornStudio();
        if (disposed || currentInitializationId !== initializationId) return;

        if (!studio.addScene) {
          throw new Error('Unicorn Studio SDK addScene method is unavailable.');
        }

        if (pendingAddSceneRef.current) {
          try {
            await pendingAddSceneRef.current;
          } catch {
            // The next initialization attempt can continue after a stale one fails.
          }
          if (disposed || currentInitializationId !== initializationId) return;
        }

        clearUnicornSceneHost(element);

        const addScenePromise = studio.addScene({
          projectId: UNICORN_PROJECT_ID,
          element,
          scale: UNICORN_SCALE,
          dpi: UNICORN_DPI,
          fps: UNICORN_FPS,
          lazyLoad: UNICORN_SDK_LAZY_LOAD,
          initialVariables: displayedVariablesRef.current,
          ariaLabel: 'Phonic assistant voice wave',
        });

        pendingAddSceneRef.current = addScenePromise;

        let scene: UnicornSceneInstance;
        try {
          scene = await addScenePromise;
        } finally {
          if (pendingAddSceneRef.current === addScenePromise) {
            pendingAddSceneRef.current = null;
          }
        }

        if (disposed || currentInitializationId !== initializationId) {
          scene.destroy?.();
          return;
        }

        sceneRef.current = scene;
        applyUnicornVariables(scene, displayedVariablesRef.current);

        readyFrameRef.current = requestAnimationFrame(() => {
          readyFrameRef.current = null;
          if (
            disposed ||
            currentInitializationId !== initializationId ||
            sceneRef.current !== scene
          ) {
            return;
          }
          cancelFallbackDelay();
          setSceneReady(true);
          setFallbackDelayElapsed(false);
        });
      } catch {
        if (disposed || currentInitializationId !== initializationId) return;

        cancelFallbackDelay();
        sceneRef.current?.destroy?.();
        sceneRef.current = null;
        clearUnicornSceneHost(element);
        setSceneReady(false);
        setSceneFailed(true);
      } finally {
        if (currentInitializationId === initializationId) {
          initializing = false;
        }
      }
    };

    const scheduleTeardown = () => {
      if (
        disposed ||
        teardownTimeout !== null ||
        (!initializing && !sceneRef.current)
      ) {
        return;
      }

      teardownTimeout = window.setTimeout(() => {
        teardownTimeout = null;
        if (!disposed) {
          destroyScene(true);
        }
      }, UNICORN_OFFSCREEN_TEARDOWN_DELAY_MS);
    };

    void initializeScene();

    if (typeof window.IntersectionObserver === 'function') {
      intersectionObserver = new window.IntersectionObserver(
        (entries) => {
          const entry = entries.find((candidate) => candidate.target === element);
          if (!entry) return;

          if (entry.isIntersecting) {
            cancelTeardown();
            void initializeScene();
          } else {
            scheduleTeardown();
          }
        },
        {
          rootMargin: UNICORN_OFFSCREEN_ROOT_MARGIN,
          threshold: 0,
        },
      );
      intersectionObserver.observe(element);
    }

    return () => {
      disposed = true;
      intersectionObserver?.disconnect();
      destroyScene(false);
      if (transitionFrameRef.current !== null) {
        cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      style={{
        width: '100%',
        height: 'auto',
        minHeight: '180px',
        flex: '1 1 0',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {posterSrc && (
        <img
          src={posterSrc}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: sceneReady ? 0 : 1,
            transitionProperty: 'opacity',
            transitionDuration: `${UNICORN_POSTER_FADE_MS}ms`,
            transitionTimingFunction: 'ease-out',
            pointerEvents: 'none',
            maskImage: UNICORN_EDGE_MASK,
            WebkitMaskImage: UNICORN_EDGE_MASK,
          }}
        />
      )}

      <div
        ref={sceneHostRef}
        data-us-project={UNICORN_PROJECT_ID}
        data-us-scale={String(UNICORN_SCALE)}
        data-us-dpi={String(UNICORN_DPI)}
        data-us-fps={String(UNICORN_FPS)}
        data-us-lazyload={String(UNICORN_SDK_LAZY_LOAD)}
        data-us-vars={JSON.stringify(variables)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          maskImage: UNICORN_EDGE_MASK,
          WebkitMaskImage: UNICORN_EDGE_MASK,
        }}
      />

      {!preview && !sceneReady && (sceneFailed || fallbackDelayElapsed) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            pointerEvents: 'none',
          }}
        >
          <AgentVoiceFallbackMeter level={voiceLevel} />
        </div>
      )}
    </div>
  );
}

/** Float32 audio [-1,1] → little-endian signed 16-bit PCM bytes */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function float32ToPcm16Bytes(float32: any): Uint8Array {
  const bytes = new Uint8Array(float32.length * 2);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]));
    const pcm16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(i * 2, Math.round(pcm16), true);
  }

  return bytes;
}

/** Little-endian signed 16-bit PCM bytes → Float32 audio [-1,1] */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pcm16BytesToFloat32(bytes: any): Float32Array {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  for (let i = 0; i < sampleCount; i++) {
    const pcm16 = view.getInt16(i * 2, true);
    samples[i] = pcm16 / (pcm16 < 0 ? 0x8000 : 0x7fff);
  }

  return samples;
}

function concatFloat32(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length === 0) return b.slice() as unknown as Float32Array;
  const result = new Float32Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

function resampleFloat32(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return input.slice() as unknown as Float32Array;

  const outputLength = Math.max(1, Math.round((input.length * outputRate) / inputRate));
  const output = new Float32Array(outputLength);
  const ratio = input.length / outputLength;

  for (let i = 0; i < outputLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const nextIndex = Math.min(index + 1, input.length - 1);
    const weight = position - index;
    output[i] = input[index] * (1 - weight) + input[nextIndex] * weight;
  }

  return output;
}

/** Uint8Array → base64 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function uint8ToBase64(bytes: any): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** base64 → Uint8Array */
function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

type PhonicLiveConversationProps = {
  conversations?: ReactNode;
  showConversationSelector?: boolean;
  scaleBelowWidth?: number;
};

/* ─── Main component ─── */
function PhonicLiveConversation({
  conversations = DEFAULT_AGENTS_JSON_VALUE,
  showConversationSelector = true,
  scaleBelowWidth = DEFAULT_SCALE_BELOW_WIDTH,
}: PhonicLiveConversationProps) {
  const { interactive } = useWebflowContext();

  const [slottedAgentOptions, setSlottedAgentOptions] = useState<AgentOption[] | null>(null);
  const fallbackAgentOptions = useMemo(() => parseAgentOptions(conversations), [conversations]);
  const agentOptions = slottedAgentOptions ?? fallbackAgentOptions;
  const initialAgentId = useMemo(() => resolveInitialAgentId(agentOptions), [agentOptions]);
  const responsiveDesignWidth =
    Number.isFinite(scaleBelowWidth) && scaleBelowWidth > 0
      ? scaleBelowWidth
      : DEFAULT_SCALE_BELOW_WIDTH;

  const [callState, setCallState] = useState<CallState>(STATES.IDLE);
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [dropdownTriggerWidth, setDropdownTriggerWidth] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [agentVoiceLevel, setAgentVoiceLevel] = useState(0);
  const [contentScale, setContentScale] = useState(1);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentLevelFrameRef = useRef<number | null>(null);
  const agentLevelDataRef = useRef<Uint8Array | null>(null);
  const agentLevelSamplesRef = useRef<{ time: number; level: number }[]>([]);
  const displayedAgentLevelRef = useRef(0);
  const nextPlayTimeRef = useRef(0);
  const scaleHostRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownLabelMeasureRef = useRef<HTMLSpanElement>(null);
  const reconnectAttempts = useRef(0);
  const callStateRef = useRef<CallState>(STATES.IDLE);
  const isMutedRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const agentSpeakingRef = useRef(false);
  const agentSpeechActiveUntilRef = useRef(0);
  const initialAgentIdRef = useRef(initialAgentId);

  const setAgentSpeakingState = useCallback((speaking: boolean) => {
    agentSpeakingRef.current = speaking;
    setAgentSpeaking((currentSpeaking) =>
      currentSpeaking === speaking ? currentSpeaking : speaking,
    );
  }, []);

  useEffect(() => {
    const host = scaleHostRef.current;
    if (!host) return;

    let animationFrame = 0;
    const updateSlottedOptions = () => {
      const nextOptions = readSlottedAgentOptions(host);
      setSlottedAgentOptions((currentOptions) =>
        areAgentOptionsEqual(currentOptions, nextOptions) ? currentOptions : nextOptions,
      );
    };

    const scheduleUpdate = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateSlottedOptions);
    };

    updateSlottedOptions();
    scheduleUpdate();

    const shadowHost = getShadowHost(host);
    if (!shadowHost || typeof MutationObserver === 'undefined') {
      return () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
      };
    }

    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(shadowHost, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [conversations]);

  // Keep refs in sync
  useEffect(() => {
    callStateRef.current = callState;
    if (
      callState === STATES.LIVE &&
      !userSpeakingRef.current &&
      displayedAgentLevelRef.current < AGENT_VOICE_IDLE_FLOOR
    ) {
      displayedAgentLevelRef.current = AGENT_VOICE_IDLE_FLOOR;
      setAgentVoiceLevel(AGENT_VOICE_IDLE_FLOOR);
    }
  }, [callState]);
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);
  useEffect(() => {
    userSpeakingRef.current = userSpeaking;
    if (userSpeaking) return;
    if (
      callStateRef.current === STATES.LIVE &&
      displayedAgentLevelRef.current < AGENT_VOICE_IDLE_FLOOR
    ) {
      displayedAgentLevelRef.current = AGENT_VOICE_IDLE_FLOOR;
      setAgentVoiceLevel(AGENT_VOICE_IDLE_FLOOR);
    }
  }, [userSpeaking]);

  const isLocked =
    callState === STATES.LIVE ||
    callState === STATES.CONNECTING ||
    callState === STATES.ENDING ||
    callState === STATES.RECONNECTING;

  const selectedOption =
    agentOptions.find((option) => option.agentId === selectedAgentId) ??
    agentOptions.find((option) => option.agentId === initialAgentId) ??
    DEFAULT_AGENT_OPTIONS[0];
  const showConversationControl = showConversationSelector && agentOptions.length > 1;

  useLayoutEffect(() => {
    const label = dropdownLabelMeasureRef.current;
    if (!label) return;

    const updateWidth = () => {
      const labelWidth = Math.ceil(label.getBoundingClientRect().width);
      if (labelWidth <= 0 || !label.isConnected) return;

      const nextWidth = labelWidth + 16 + 8 + 16 + 12;
      setDropdownTriggerWidth((currentWidth) =>
        currentWidth === nextWidth ? currentWidth : nextWidth,
      );
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateWidth);
    observer.observe(label);
    return () => observer.disconnect();
  }, [selectedOption.label, callState]);

  useEffect(() => {
    if (isLocked) return;

    const initialChanged = initialAgentIdRef.current !== initialAgentId;
    const selectedIsAvailable = agentOptions.some((option) => option.agentId === selectedAgentId);
    if (initialChanged || !selectedIsAvailable) {
      setSelectedAgentId(initialAgentId);
    }
    initialAgentIdRef.current = initialAgentId;
  }, [agentOptions, initialAgentId, isLocked, selectedAgentId]);

  useEffect(() => {
    const host = scaleHostRef.current;
    if (!host) return;

    const updateScale = (width: number) => {
      if (width <= 0) return;
      const nextScale = Math.min(1, width / responsiveDesignWidth);
      setContentScale((currentScale) =>
        Math.abs(currentScale - nextScale) > 0.005 ? nextScale : currentScale,
      );
    };

    updateScale(host.getBoundingClientRect().width);

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => updateScale(host.getBoundingClientRect().width);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver(([entry]) => {
      updateScale(entry.contentRect.width);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [responsiveDesignWidth]);

  /* Close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const dropdown = dropdownRef.current;
      if (!dropdown) return;

      const clickedInsideDropdown =
        e.composedPath().includes(dropdown) || dropdown.contains(e.target as Node);
      if (!clickedInsideDropdown) {
        setDropdownOpen(false);
        setHoveredAgentId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      captureCtxRef.current?.close().catch(() => {});
      playbackCtxRef.current?.close().catch(() => {});
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (agentLevelFrameRef.current !== null) cancelAnimationFrame(agentLevelFrameRef.current);
    };
  }, []);

  /* ═══════════════════════════════════════════════════════════════════════
     AUDIO PLAYBACK — nextPlayTime scheduling for gapless assistant audio
     
     Each audio_chunk is decoded from PCM to float32 and scheduled
     back-to-back using AudioBufferSourceNode.start(nextPlayTime).
     A small initial buffer (80ms) absorbs network jitter.
     ═══════════════════════════════════════════════════════════════════════ */
  const startAgentVoiceMeter = useCallback(() => {
    if (agentLevelFrameRef.current !== null) return;

    const updateLevel = () => {
      const analyser = playbackAnalyserRef.current;
      if (!analyser) {
        agentLevelFrameRef.current = null;
        setAgentVoiceLevel(0);
        agentSpeechActiveUntilRef.current = 0;
        setAgentSpeakingState(false);
        return;
      }

      let dataArray = agentLevelDataRef.current;
      if (!dataArray || dataArray.length !== analyser.fftSize) {
        dataArray = new Uint8Array(analyser.fftSize);
        agentLevelDataRef.current = dataArray;
      }

      // @ts-ignore - TS 5.x Uint8Array<ArrayBufferLike> vs Uint8Array<ArrayBuffer> mismatch
      analyser.getByteTimeDomainData(dataArray);

      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const centeredSample = (dataArray[i] - 128) / 128;
        sumSquares += centeredSample * centeredSample;
      }

      const rms = Math.sqrt(sumSquares / dataArray.length);
      const rawLevel = Math.min(1, rms * 10);
      // Aggressive compressor curve: pow(0.35) boosts quiet speech significantly
      // e.g. 0.1 raw → 0.45, 0.3 raw → 0.62, 0.5 raw → 0.76, 1.0 → 1.0
      const measuredLevel = rawLevel < 0.015 ? 0 : Math.pow(rawLevel, 0.35);
      const now = performance.now();
      const samples = agentLevelSamplesRef.current;
      samples.push({ time: now, level: measuredLevel });
      while (samples.length > 0 && now - samples[0].time > AGENT_VOICE_AVERAGE_WINDOW_MS) {
        samples.shift();
      }

      const averagedLevel =
        samples.reduce((total, sample) => total + sample.level, 0) / Math.max(1, samples.length);
      const peakLevel = samples.reduce(
        (highestLevel, sample) => Math.max(highestLevel, sample.level),
        0,
      );
      const peakBiasedLevel =
        averagedLevel * (1 - AGENT_VOICE_PEAK_WEIGHT) + peakLevel * AGENT_VOICE_PEAK_WEIGHT;
      const speakingThreshold = agentSpeakingRef.current
        ? AGENT_SPEAKING_STOP_THRESHOLD
        : AGENT_SPEAKING_START_THRESHOLD;
      if (peakBiasedLevel > speakingThreshold) {
        agentSpeechActiveUntilRef.current = now + AGENT_SPEAKING_HOLD_MS;
      }
      setAgentSpeakingState(
        callStateRef.current === STATES.LIVE &&
          !userSpeakingRef.current &&
          now < agentSpeechActiveUntilRef.current,
      );

      const targetLevel = Math.max(AGENT_VOICE_IDLE_FLOOR, peakBiasedLevel);
      const currentLevel = displayedAgentLevelRef.current;
      const smoothing =
        targetLevel > currentLevel ? AGENT_VOICE_RISE_SMOOTHING : AGENT_VOICE_FALL_SMOOTHING;
      const nextLevel = currentLevel + (targetLevel - currentLevel) * smoothing;
      const settledLevel = Math.abs(nextLevel - targetLevel) < 0.002 ? targetLevel : nextLevel;

      displayedAgentLevelRef.current = settledLevel;
      setAgentVoiceLevel(settledLevel);

      agentLevelFrameRef.current = requestAnimationFrame(updateLevel);
    };

    agentLevelFrameRef.current = requestAnimationFrame(updateLevel);
  }, [setAgentSpeakingState]);

  const getPlaybackCtx = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      analyser.connect(ctx.destination);

      playbackCtxRef.current = ctx;
      playbackAnalyserRef.current = analyser;
      agentLevelDataRef.current = new Uint8Array(analyser.fftSize);
      nextPlayTimeRef.current = 0;
      startAgentVoiceMeter();
    }
    return playbackCtxRef.current;
  }, [startAgentVoiceMeter]);

  const scheduleAgentAudio = useCallback(
    (base64Audio: string) => {
      const ctx = getPlaybackCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const pcmBytes = base64ToUint8(base64Audio);
      const samples = pcm16BytesToFloat32(pcmBytes);

      if (samples.length === 0) {
        return;
      }

      const buffer = ctx.createBuffer(1, samples.length, AUDIO_SAMPLE_RATE);
      const channelData = buffer.getChannelData(0) as unknown as Float32Array;
      for (let i = 0; i < samples.length; i++) {
        channelData[i] = samples[i];
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(playbackAnalyserRef.current ?? ctx.destination);

      const now = ctx.currentTime;
      const startTime =
        nextPlayTimeRef.current > now
          ? nextPlayTimeRef.current
          : now + PLAYBACK_JITTER_BUFFER_SECONDS;

      source.start(startTime);
      nextPlayTimeRef.current = startTime + buffer.duration;
    },
    [getPlaybackCtx],
  );

  const resetPlayback = useCallback(
    (preserveVoiceFloor = false) => {
      nextPlayTimeRef.current = 0;
      if (agentLevelFrameRef.current !== null) {
        cancelAnimationFrame(agentLevelFrameRef.current);
        agentLevelFrameRef.current = null;
      }
      playbackAnalyserRef.current = null;
      agentLevelDataRef.current = null;
      agentLevelSamplesRef.current = [];
      agentSpeechActiveUntilRef.current = 0;
      displayedAgentLevelRef.current = preserveVoiceFloor ? AGENT_VOICE_IDLE_FLOOR : 0;
      setAgentVoiceLevel(displayedAgentLevelRef.current);
      // Close and recreate context to stop all scheduled sources
      if (playbackCtxRef.current && playbackCtxRef.current.state !== 'closed') {
        playbackCtxRef.current.close().catch(() => {});
        playbackCtxRef.current = null;
      }
      setAgentSpeakingState(false);
    },
    [setAgentSpeakingState],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     MICROPHONE CAPTURE — ScriptProcessor → PCM → base64 → JSON
     Captures at 44.1kHz, encodes to signed 16-bit PCM, sends 20ms chunks
     ═══════════════════════════════════════════════════════════════════════ */
  const startMicCapture = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    captureCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);

    // AnalyserNode for real-time mic level metering
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const updateLevel = () => {
      // @ts-ignore - TS 5.x Uint8Array<ArrayBufferLike> vs Uint8Array<ArrayBuffer> mismatch
      analyser.getByteFrequencyData(dataArray);
      // RMS-like average of frequency bins, normalized to 0–1
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length / 255;
      // Boost the visual meter without affecting the microphone audio sent to Phonic.
      const level = Math.min(1, avg * MIC_LEVEL_VISUAL_GAIN);
      setMicLevel(level);

      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    animFrameRef.current = requestAnimationFrame(updateLevel);

    // ScriptProcessor: widely supported, no worklet registration needed in shadow DOM
    const processor = ctx.createScriptProcessor(1024, 1, 1);
    processorRef.current = processor;

    let pendingInput = new Float32Array(0);
    let sentFirstAudioChunk = false;

    processor.onaudioprocess = (e) => {
      if (isMutedRef.current) {
        pendingInput = new Float32Array(0);
        return;
      }

      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0).slice() as unknown as Float32Array;
      const normalizedInput = resampleFloat32(inputData, ctx.sampleRate, AUDIO_SAMPLE_RATE);
      // @ts-ignore - TS 5.x Float32Array<ArrayBufferLike> vs Float32Array<ArrayBuffer> mismatch
      pendingInput = concatFloat32(pendingInput, normalizedInput);

      while (pendingInput.length >= AUDIO_CHUNK_SAMPLES) {
        const subChunk = pendingInput.slice(0, AUDIO_CHUNK_SAMPLES) as unknown as Float32Array;
        // @ts-ignore - TS 5.x Float32Array<ArrayBufferLike> vs Float32Array<ArrayBuffer> mismatch
        pendingInput = pendingInput.slice(AUDIO_CHUNK_SAMPLES) as unknown as Float32Array;

        const pcmBytes = float32ToPcm16Bytes(subChunk);
        const audioBase64 = uint8ToBase64(pcmBytes as unknown as Uint8Array);
        const message: {
          type: 'audio_chunk';
          audio: string;
          iso_date_time?: string;
        } = {
          type: 'audio_chunk',
          audio: audioBase64,
        };

        if (!sentFirstAudioChunk) {
          message.iso_date_time = new Date().toISOString();
          sentFirstAudioChunk = true;
        }

        ws.send(JSON.stringify(message));
      }
    };

    const silentOutput = ctx.createGain();
    silentOutput.gain.value = 0;
    source.connect(processor);
    processor.connect(silentOutput);
    silentOutput.connect(ctx.destination); // required for ScriptProcessor to fire
  }, []);

  /* ─── Microphone access ─── */
  const requestMic = useCallback(async (): Promise<MediaStream | null> => {
    setCallState(STATES.REQUESTING_MIC);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: AUDIO_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCallState(STATES.MIC_DENIED);
        setErrorMessage(
          'Microphone access was denied. Please allow microphone access in your browser settings and try again.',
        );
      } else {
        setCallState(STATES.ERROR);
        setErrorMessage(
          'Could not access microphone. Please check your device and browser settings.',
        );
      }
      return null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks();
      const newMuted = !isMuted;
      tracks.forEach((t) => {
        t.enabled = !newMuted;
      });
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  /* ─── Cleanup helper ─── */
  const cleanupAll = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    analyserRef.current = null;
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (captureCtxRef.current) {
      captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    resetPlayback();
    setMicLevel(0);
  }, [resetPlayback]);

  /* ═══════════════════════════════════════════════════════════════════════
     WEBSOCKET — Phonic STS protocol
     
     Flow:
     1. POST to worker → get { sessionToken, websocketUrl, config }
     2. Open WebSocket to websocketUrl?session_token=...
     3. On open → send config JSON { type: "config", agent: "..." }
     4. Start streaming mic audio as JSON { type: "audio_chunk", audio: "<b64>" }
     5. Receive JSON messages from Phonic:
        - audio_chunk → decode + play
        - user_started_speaking / user_finished_speaking → UI state
        - assistant_started_speaking / assistant_finished_speaking → turn boundaries
        - input_text → transcript
        - assistant_ended_conversation → end state
        - error → error state
     ═══════════════════════════════════════════════════════════════════════ */
  const connectWebSocket = useCallback(
    async (agentId: string, conversationLabel: string, stream: MediaStream) => {
      setCallState(STATES.CONNECTING);
      setErrorMessage('');
      setTranscript('');
      reconnectAttempts.current = 0;

      try {
        const res = await fetch(SESSION_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, conversationLabel }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error((errBody as any).error || `Session token request failed: ${res.status}`);
        }

        const data = await res.json();
        const { sessionToken, websocketUrl, config } = data;

        const ws = new WebSocket(
          `${websocketUrl}?session_token=${encodeURIComponent(sessionToken)}`,
        );
        wsRef.current = ws;

        ws.onopen = () => {
          // Send config with audio format declarations
          const stsConfig = {
            ...(config || {}),
            type: 'config',
            input_format: AUDIO_INPUT_FORMAT,
            output_format: AUDIO_OUTPUT_FORMAT,
          };
          ws.send(JSON.stringify(stsConfig));

          setCallState(STATES.LIVE);
          reconnectAttempts.current = 0;

          // Start streaming mic audio
          startMicCapture(stream);
        };

        ws.onmessage = (event) => {
          // All Phonic STS messages are JSON text
          if (typeof event.data !== 'string') {
            return;
          }

          try {
            const msg = JSON.parse(event.data);

            switch (msg.type) {
              case 'audio_chunk':
                // Assistant voice audio — base64 PCM
                if (msg.audio) {
                  scheduleAgentAudio(msg.audio);
                }
                break;

              case 'user_started_speaking':
                userSpeakingRef.current = true;
                setUserSpeaking(true);
                // When user starts speaking, clear any queued agent audio (barge-in)
                resetPlayback(true);
                break;

              case 'user_finished_speaking':
              case 'user_stopped_speaking':
                userSpeakingRef.current = false;
                displayedAgentLevelRef.current = AGENT_VOICE_IDLE_FLOOR;
                setAgentVoiceLevel(AGENT_VOICE_IDLE_FLOOR);
                setUserSpeaking(false);
                break;

              case 'assistant_started_speaking':
                break;

              case 'assistant_finished_speaking':
              case 'assistant_stopped_speaking':
                setAgentSpeakingState(false);
                if (!userSpeakingRef.current) {
                  displayedAgentLevelRef.current = Math.max(
                    displayedAgentLevelRef.current,
                    AGENT_VOICE_IDLE_FLOOR,
                  );
                  setAgentVoiceLevel(displayedAgentLevelRef.current);
                }
                break;

              case 'input_text':
                // User transcript
                if (msg.text) {
                  setTranscript(msg.text);
                }
                break;

              case 'assistant_ended_conversation':
                setCallState(STATES.ENDED);
                setAgentSpeakingState(false);
                setAgentVoiceLevel(0);
                setUserSpeaking(false);
                cleanupAll();
                ws.close();
                wsRef.current = null;
                break;

              case 'error':
                setCallState(STATES.ERROR);
                setErrorMessage(msg.message || 'An error occurred during the conversation.');
                cleanupAll();
                ws.close();
                wsRef.current = null;
                break;

              default:
                break;
            }
          } catch {
            return;
          }
        };

        ws.onerror = () => {
          if (callStateRef.current === STATES.CONNECTING) {
            setCallState(STATES.CONNECTION_FAILED);
            setErrorMessage('Could not connect to the conversation server. Please try again.');
            cleanupAll();
          }
        };

        ws.onclose = () => {
          const currentState = callStateRef.current;
          // Only attempt reconnect if we were live (not if user ended or error)
          if (currentState === STATES.LIVE || currentState === STATES.RECONNECTING) {
            if (reconnectAttempts.current < 3) {
              setCallState(STATES.RECONNECTING);
              reconnectAttempts.current += 1;
              setTimeout(() => connectWebSocket(agentId, conversationLabel, stream), 2000);
            } else {
              setCallState(STATES.CONNECTION_FAILED);
              setErrorMessage('Connection lost after multiple attempts. Please try again.');
              cleanupAll();
            }
          }
        };
      } catch (err: any) {
        setCallState(STATES.CONNECTION_FAILED);
        setErrorMessage(err.message || 'Failed to start conversation. Please try again.');
        cleanupAll();
      }
    },
    [startMicCapture, scheduleAgentAudio, resetPlayback, cleanupAll, setAgentSpeakingState],
  );

  /* ─── Actions ─── */
  const startConversation = useCallback(async () => {
    const stream = await requestMic();
    if (!stream) return;
    await connectWebSocket(selectedOption.agentId, selectedOption.label, stream);
  }, [requestMic, connectWebSocket, selectedOption.agentId, selectedOption.label]);

  const handleIdleSurfaceClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!interactive || callState !== STATES.IDLE) return;

      const clickPath = event.nativeEvent.composedPath();
      const dropdown = dropdownRef.current;
      if (showConversationControl && dropdown && clickPath.includes(dropdown)) return;

      const clickedButton = clickPath.some(
        (target) => typeof HTMLButtonElement !== 'undefined' && target instanceof HTMLButtonElement,
      );
      if (clickedButton) return;

      void startConversation();
    },
    [callState, interactive, showConversationControl, startConversation],
  );

  const endConversation = useCallback(() => {
    setCallState(STATES.ENDING);
    setAgentSpeakingState(false);
    setAgentVoiceLevel(0);
    setUserSpeaking(false);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    cleanupAll();

    setTimeout(() => {
      setCallState(STATES.ENDED);
      setIsMuted(false);
    }, 600);
  }, [cleanupAll, setAgentSpeakingState]);

  const retry = useCallback(() => {
    setCallState(STATES.IDLE);
    setErrorMessage('');
    setTranscript('');
  }, []);

  const handleConversationSelect = useCallback(
    (agentId: string) => {
      if (isLocked) return;
      setSelectedAgentId(agentId);
      setDropdownOpen(false);
      setHoveredAgentId(null);
      if (callState === STATES.ERROR) {
        setCallState(STATES.IDLE);
        setErrorMessage('');
        setTranscript('');
      }
    },
    [isLocked, callState],
  );

  /* ─── Derived ─── */
  const status = getStatusConfig(callState);
  const showBottomControls =
    callState === STATES.LIVE || callState === STATES.ENDING || callState === STATES.RECONNECTING;
  const showUnicornScene =
    callState === STATES.IDLE ||
    callState === STATES.REQUESTING_MIC ||
    callState === STATES.CONNECTING ||
    callState === STATES.LIVE ||
    callState === STATES.RECONNECTING;
  const useUnicornPreview =
    callState === STATES.IDLE ||
    callState === STATES.REQUESTING_MIC ||
    callState === STATES.CONNECTING;

  const renderConversationDropdown = ({
    menuPlacement = 'down',
  }: {
    menuPlacement?: 'up' | 'down';
  } = {}) => (
    <div
      className={showConversationControl ? 'plc__conversationDropdown' : undefined}
      ref={dropdownRef}
      style={{
        position: 'relative',
        width: dropdownTriggerWidth ? `${dropdownTriggerWidth}px` : 'max-content',
        maxWidth: '100%',
        flexShrink: 0,
        transition: 'width 180ms ease',
      }}
    >
      <span
        ref={dropdownLabelMeasureRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          visibility: 'hidden',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          fontFamily: 'inherit',
          fontSize: '15px',
          fontWeight: 500,
          lineHeight: '1',
        }}
      >
        {selectedOption.label}
      </span>
      {showConversationControl ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (!isLocked && interactive) setDropdownOpen(!dropdownOpen);
            }}
            disabled={isLocked}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            aria-label={`Selected conversation: ${selectedOption.label}`}
            style={{
              fontFamily: 'inherit',
              fontSize: '15px',
              fontWeight: 500,
              color: isLocked ? '#a3a09d' : '#fe531d',
              backgroundColor: '#f5f3f1',
              border: 'none',
              borderRadius: '0.3125rem',
              paddingTop: '10px',
              paddingBottom: '10px',
              paddingLeft: '16px',
              paddingRight: '12px',
              cursor: isLocked ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              lineHeight: '1',
              width: '100%',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            <span style={{ overflow: 'visible', whiteSpace: 'nowrap' }}>
              {selectedOption.label}
            </span>
            <ChevronDown />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              aria-label="Select conversation type"
              style={{
                position: 'absolute',
                top: menuPlacement === 'down' ? 'calc(100% + 6px)' : 'auto',
                bottom: menuPlacement === 'up' ? 'calc(100% + 6px)' : 'auto',
                left: '0',
                backgroundColor: '#ffffff',
                borderRadius: '0.3125rem',
                border: '1px solid #e8e6e3',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                zIndex: 50,
                minWidth: '260px',
                paddingTop: '6px',
                paddingBottom: '6px',
                overflow: 'hidden',
              }}
            >
              {agentOptions.map((option) => (
                <button
                  key={option.agentId}
                  type="button"
                  role="option"
                  aria-selected={option.agentId === selectedOption.agentId}
                  onClick={() => handleConversationSelect(option.agentId)}
                  onPointerEnter={() => setHoveredAgentId(option.agentId)}
                  onPointerLeave={() => setHoveredAgentId(null)}
                  onFocus={() => setHoveredAgentId(option.agentId)}
                  onBlur={() => setHoveredAgentId(null)}
                  style={{
                    fontFamily: 'inherit',
                    fontSize: '14px',
                    fontWeight: option.agentId === selectedOption.agentId ? 500 : 400,
                    color: option.agentId === selectedOption.agentId ? '#fe531d' : '#3a3735',
                    backgroundColor:
                      option.agentId === hoveredAgentId
                        ? '#f5f3f1'
                        : option.agentId === selectedOption.agentId
                          ? '#fff7f5'
                          : 'transparent',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    cursor: 'pointer',
                    display: 'block',
                    lineHeight: '1.4',
                    transition: 'background-color 120ms ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div
          aria-label={`Selected conversation: ${selectedOption.label}`}
          style={{
            fontFamily: 'inherit',
            fontSize: '15px',
            fontWeight: 500,
            color: '#fe531d',
            backgroundColor: '#f5f3f1',
            borderRadius: '0.3125rem',
            paddingTop: '10px',
            paddingBottom: '10px',
            paddingLeft: '20px',
            paddingRight: '20px',
            lineHeight: '1',
            width: '100%',
            boxSizing: 'border-box',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedOption.label}
        </div>
      )}
    </div>
  );

  /* ─── Center content ─── */
  const renderCenterContent = () => {
    const font = 'inherit';

    const CircleIcon = ({
      bg,
      children,
      className,
    }: {
      bg: string;
      children: ReactNode;
      className?: string;
    }) => (
      <div
        className={className}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    );

    const Spinner = ({ color }: { color: string }) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          animationName: 'spin',
          animationDuration: '1s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );

    const Msg = ({
      color,
      children,
      maxWidth = '320px',
    }: {
      color: string;
      children: ReactNode;
      maxWidth?: string;
    }) => (
      <p
        style={{
          fontFamily: font,
          fontSize: '15px',
          color,
          margin: 0,
          textAlign: 'center',
          maxWidth,
          lineHeight: '1.5',
        }}
      >
        {children}
      </p>
    );

    const ActionBtn = ({
      onClick,
      label,
      variant = 'outline',
    }: {
      onClick: () => void;
      label: string;
      variant?: 'outline' | 'filled';
    }) => (
      <button
        onClick={onClick}
        aria-label={label}
        style={{
          fontFamily: font,
          fontSize: '14px',
          fontWeight: 500,
          color: variant === 'filled' ? '#ffffff' : '#fe531d',
          backgroundColor: variant === 'filled' ? '#fe531d' : 'transparent',
          border: variant === 'filled' ? 'none' : '1.5px solid #fe531d',
          borderRadius: '0.3125rem',
          paddingTop: variant === 'filled' ? '10px' : '8px',
          paddingBottom: variant === 'filled' ? '10px' : '8px',
          paddingLeft: variant === 'filled' ? '24px' : '20px',
          paddingRight: variant === 'filled' ? '24px' : '20px',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );

    switch (callState) {
      case STATES.IDLE:
        return (
          <CenterWrap>
            <CircleIcon bg="#f5f3f1" className="plc__startMicIcon">
              <MicIcon />
            </CircleIcon>
            <Msg color="#6b6966" maxWidth="180px">
              Click to start a live conversation
            </Msg>
          </CenterWrap>
        );

      case STATES.REQUESTING_MIC:
        return (
          <CenterWrap>
            <CircleIcon bg="#fffbeb">
              <Spinner color="#b45309" />
            </CircleIcon>
            <Msg color="#b45309">Allow microphone access to start the live conversation.</Msg>
          </CenterWrap>
        );

      case STATES.MIC_DENIED:
        return (
          <CenterWrap>
            <CircleIcon bg="#fef2f2">
              <MicIcon muted />
            </CircleIcon>
            <Msg color="#dc2626">{errorMessage}</Msg>
            <ActionBtn onClick={retry} label="Try again" />
          </CenterWrap>
        );

      case STATES.CONNECTING:
        return (
          <CenterWrap>
            <CircleIcon bg="#fffbeb">
              <Spinner color="#b45309" />
            </CircleIcon>
            <Msg color="#b45309">Connecting to conversation…</Msg>
          </CenterWrap>
        );

      case STATES.LIVE:
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '14px',
              width: '100%',
              height: '100%',
              position: 'relative',
            }}
          >
            <p
              style={{
                fontFamily: font,
                fontSize: '14px',
                color: '#6b6966',
                margin: 0,
              }}
            >
              {agentSpeaking
                ? 'Assistant is speaking…'
                : userSpeaking
                  ? 'Listening to you…'
                  : isMuted
                    ? 'Microphone muted'
                    : 'Conversation active'}
            </p>
            {transcript && (
              <p
                style={{
                  position: 'absolute',
                  left: '24px',
                  right: '24px',
                  bottom: '34px',
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#a3a09d',
                  margin: '0 auto',
                  textAlign: 'center',
                  maxWidth: '400px',
                  lineHeight: '1.4',
                  fontStyle: 'italic',
                  pointerEvents: 'none',
                }}
              >
                {transcript}
              </p>
            )}
          </div>
        );

      case STATES.RECONNECTING:
        return (
          <CenterWrap>
            <Spinner color="#b45309" />
            <Msg color="#b45309">Reconnecting…</Msg>
          </CenterWrap>
        );

      case STATES.CONNECTION_FAILED:
        return (
          <CenterWrap>
            <Msg color="#dc2626">{errorMessage}</Msg>
            <ActionBtn onClick={retry} label="Retry" />
          </CenterWrap>
        );

      case STATES.ENDING:
        return (
          <CenterWrap>
            <Spinner color="#6b6966" />
            <Msg color="#6b6966">Ending conversation…</Msg>
          </CenterWrap>
        );

      case STATES.ENDED:
        return (
          <CenterWrap>
            <CircleIcon bg="#f5f3f1">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6b6966"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </CircleIcon>
            <Msg color="#6b6966">Conversation ended. Try another?</Msg>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: '8px',
              }}
            >
              {renderConversationDropdown({ menuPlacement: 'up' })}
              <button
                className="plc__endedCallButton"
                type="button"
                onClick={interactive ? startConversation : undefined}
                disabled={!interactive}
                aria-label={`Start conversation with ${selectedOption.label}`}
                style={{
                  width: '36px',
                  height: '36px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fe531d',
                  border: 'none',
                  borderRadius: '0.3125rem',
                  padding: 0,
                  cursor: interactive ? 'pointer' : 'default',
                }}
              >
                <PhoneIcon size={20} />
              </button>
            </div>
          </CenterWrap>
        );

      case STATES.ERROR:
        return (
          <CenterWrap>
            <Msg color="#dc2626">{errorMessage || 'Something went wrong. Please try again.'}</Msg>
            <ActionBtn onClick={retry} label="Retry" />
          </CenterWrap>
        );

      default:
        return null;
    }
  };

  /* ─── Primary action button ─── */
  const renderPrimaryAction = () => {
    const base: CSSProperties = {
      fontFamily: 'inherit',
      fontSize: '14px',
      fontWeight: 500,
      color: '#ffffff',
      border: 'none',
      borderRadius: '0.3125rem',
      paddingTop: '12px',
      paddingBottom: '12px',
      paddingLeft: '20px',
      paddingRight: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      height: '40px',
      boxSizing: 'border-box',
      lineHeight: '1',
    };

    if (callState === STATES.IDLE) {
      return (
        <button
          onClick={interactive ? startConversation : undefined}
          aria-label="Start conversation"
          style={{
            ...base,
            backgroundColor: '#3a3735',
            cursor: interactive ? 'pointer' : 'default',
            paddingLeft: '16px',
            paddingRight: '20px',
            gap: '6px',
          }}
        >
          <PhoneIcon />
          Start conversation
        </button>
      );
    }

    if (
      callState === STATES.LIVE ||
      callState === STATES.CONNECTING ||
      callState === STATES.RECONNECTING
    ) {
      const canEnd = callState === STATES.LIVE;
      return (
        <button
          onClick={interactive && canEnd ? endConversation : undefined}
          disabled={!canEnd}
          aria-label="End conversation"
          style={{
            ...base,
            backgroundColor: canEnd ? '#3a3735' : '#a3a09d',
            cursor: interactive && canEnd ? 'pointer' : 'not-allowed',
            opacity: canEnd ? 1 : 0.6,
            paddingLeft: '16px',
            paddingRight: '20px',
            gap: '6px',
          }}
        >
          <PhoneOffIcon />
          End conversation
        </button>
      );
    }

    if (callState === STATES.ENDING) {
      return (
        <button
          disabled
          aria-label="Ending conversation"
          style={{
            ...base,
            backgroundColor: '#a3a09d',
            cursor: 'not-allowed',
            opacity: 0.6,
          }}
        >
          <PhoneOffIcon />
          Ending…
        </button>
      );
    }

    return null;
  };

  /* ─── Render ─── */
  return (
    <div
      className={callState === STATES.IDLE && interactive ? 'plc__startSurface' : undefined}
      onClick={handleIdleSurfaceClick}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
        backgroundColor: '#f5f3f1',
        padding: '8px',
        overflow: 'hidden',
      }}
    >
      <style>{`
        :host { font-family: inherit; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .plc__centerState::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: 70%;
          left: 50%;
          width: 100%;
          aspect-ratio: 1;
          transform: translate(-50%, -50%);
          background-color: rgba(255, 255, 255, 0.8);
          -webkit-mask-image: radial-gradient(circle closest-side at 50% 50%, #000 50%, transparent);
          mask-image: radial-gradient(circle closest-side at 50% 50%, #000 50%, transparent);
          pointer-events: none;
        }
        .plc__endedCallButton {
          background-color: #f5f3f1;
          transition: background-color 120ms ease;
        }
        .plc__endedCallButton:not(:disabled):hover {
          background-color: #e8e6e3;
        }
        .plc__endedCallButton:not(:disabled):focus-visible {
          outline: 2px solid rgba(254, 83, 29, 0.35);
          outline-offset: 2px;
        }
        .plc__surface {
          background-color: #ffffff;
        }
        .plc__unicornScene {
          transform: scale(1);
          transform-origin: center;
          filter: saturate(1) brightness(1);
          will-change: transform;
        }
        .plc__startSurface {
          cursor: pointer;
        }
        .plc__startMicIcon {
          transform: scale(1);
          transform-origin: center;
          transition: transform 400ms ease-out;
          will-change: transform;
        }
        @media (hover: hover) {
          .plc__startSurface:hover:not(:has(.plc__conversationDropdown:hover))
            .plc__startMicIcon {
            transform: scale(1.1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .plc__unicornScene,
          .plc__startMicIcon {
            transition-duration: 0.01ms;
          }
        }
        @media (max-width: 479.98px) {
          .plc__statusBadge {
            display: none !important;
          }
          .plc__centerArea--ended {
            overflow: visible !important;
          }
        }
      `}</style>

      <div
        ref={scaleHostRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          className="plc__surface"
          style={{
            width: contentScale < 1 ? `${responsiveDesignWidth}px` : '100%',
            height: contentScale < 1 ? `${100 / contentScale}%` : '100%',
            flexShrink: 0,
            transform: contentScale < 1 ? `scale(${contentScale})` : 'none',
            transformOrigin: 'top center',
            boxShadow: '0 1px 3px 0 rgba(20, 17, 17, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* ─── Top bar ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '20px',
              paddingBottom: '20px',
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
          >
            {/* Dropdown moves into the center after a conversation ends. */}
            {callState === STATES.ENDED ? <div /> : renderConversationDropdown()}

            {/* Status badge */}
            <div
              className="plc__statusBadge"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: status.bgColor,
                borderRadius: '0.3125rem',
                height: '2.25rem',
                paddingTop: '8px',
                paddingBottom: '8px',
                paddingLeft: '14px',
                paddingRight: '16px',
                lineHeight: '1',
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: status.dotColor,
                  animationName: status.pulse ? 'pulse-dot' : 'none',
                  animationDuration: '1.5s',
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                }}
              />
              <span
                style={{
                  fontFamily: 'inherit',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: status.textColor,
                }}
              >
                {status.label}
              </span>
            </div>
          </div>

          {/* ─── Center area ─── */}
          <div
            className={callState === STATES.ENDED ? 'plc__centerArea--ended' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              className="plc__unicornScene"
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                opacity: showUnicornScene ? 1 : 0,
                transitionProperty: 'opacity, transform, filter',
                transitionDuration: '200ms, 800ms, 800ms',
                transitionTimingFunction:
                  'ease-out, cubic-bezier(0.22, 1, 0.36, 1), cubic-bezier(0.22, 1, 0.36, 1)',
                pointerEvents: 'none',
              }}
            >
              <VoiceUnicornScene
                voiceLevel={agentVoiceLevel}
                preview={useUnicornPreview}
                posterSrc="https://cdn.prod.website-files.com/6a26780bad2144a03e65dcec/6a6a0f7eb42b1bbbf0d2a484_flowing_line_adjustable_vars_scene.webp"
              />
            </div>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                paddingLeft: callState === STATES.LIVE ? 0 : '24px',
                paddingRight: callState === STATES.LIVE ? 0 : '24px',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: callState === STATES.LIVE ? '100%' : 'auto',
                  pointerEvents: 'auto',
                }}
              >
                {renderCenterContent()}
              </div>
            </div>
          </div>

          {/* ─── Bottom bar ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '20px',
              paddingBottom: '20px',
              paddingLeft: '24px',
              paddingRight: '24px',
            }}
          >
            {/* Left controls — static mic level chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                height: '40px',
                borderRadius: '0.3125rem',
                backgroundColor: '#f5f3f1',
                paddingLeft: '12px',
                paddingRight: '14px',
                opacity: showBottomControls ? 1 : 0,
                pointerEvents: 'none',
              }}
            >
              <MicIcon muted={isMuted} />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5px',
                  height: '20px',
                }}
                aria-hidden="true"
              >
                {[0.3, 0.6, 1.0, 0.7, 0.4].map((sensitivity, i) => {
                  const barLevel = isMuted ? 0 : micLevel * sensitivity;
                  const minH = 4;
                  const maxH = 16;
                  const h = minH + barLevel * (maxH - minH);
                  return (
                    <div
                      key={i}
                      style={{
                        width: '3px',
                        height: `${h}px`,
                        backgroundColor: '#3a3735',
                        borderRadius: '1.5px',
                        transitionProperty: 'height',
                        transitionDuration: '0.08s',
                        transitionTimingFunction: 'ease-out',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Right action */}
            <div>{renderPrimaryAction()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Component = PhonicLiveConversation;

export default declareComponent(PhonicLiveConversation, {
  name: 'Phonic Live Conversation',
  description:
    'Live voice conversation demo using the Phonic STS WebSocket API with real-time bidirectional audio streaming.',
  group: 'Interactive',
  props: {
    conversations: props.RichText({
      name: 'Conversations',
    }),
    showConversationSelector: props.Boolean({
      name: 'Show conversation selector',
      defaultValue: true,
      trueLabel: 'Show',
      falseLabel: 'Hide',
      tooltip:
        'Show: visitors can choose between configured conversations. Hide: component uses only the default agent.',
    }),
    scaleBelowWidth: props.Number({
      name: 'Scale below width',
      defaultValue: DEFAULT_SCALE_BELOW_WIDTH,
      min: 240,
      max: 1200,
      decimals: 0,
      tooltip: 'Content scales down when the component is narrower than this pixel width.',
    }),
  },
});
/* build-trigger */
