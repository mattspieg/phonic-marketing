import { props } from '@webflow/data-types';
import { declareComponent, useWebflowContext } from '@webflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';

const UNICORN_PROJECT_ID = 'cTZuzQier00vpcfldDM6';
const UNICORN_SDK_URL =
  'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.2.5/dist/unicornStudio.umd.js';
const UNICORN_SCALE = 1;
const UNICORN_DPI = 2;
const UNICORN_FPS = 30;
const UNICORN_LOADING_PRIORITY: 'eager' | 'lazy' = 'lazy';
const UNICORN_PREWARM_ROOT_MARGIN = '800px 0px';
const UNICORN_TEARDOWN_DELAY_MS = 15_000;
const DEFAULT_SELECTED_LANGUAGE = 'es';
const DEFAULT_VOLUME_LEVEL = 75;
const DEFAULT_AUDIO_DURATION_SECONDS = 12;
const AUDIO_ASSET_BASE_URL = 'https://phonic-static-assets.pages.dev';
const PLAYBACK_VOICE_IDLE_FLOOR = 0.1;
const PLAYBACK_VOICE_AVERAGE_WINDOW_MS = 280;
const PLAYBACK_VOICE_LEVEL_CURVE = 0.48;
const PLAYBACK_VOICE_PEAK_WEIGHT = 0.28;
const PLAYBACK_VOICE_RISE_SMOOTHING = 0.14;
const PLAYBACK_VOICE_FALL_SMOOTHING = 0.07;
const WAVE_FULL_AMPLITUDE_MAX_WIDTH = 420;
const WAVE_REDUCED_AMPLITUDE_MIN_WIDTH = 520;
const WAVE_REDUCED_AMPLITUDE_SCALE = 0.68;
const UNICORN_VARIABLE_RANGES = {
  speed: { min: 0.1, max: 1 },
  amplitude: { min: 0.1, max: 0.48 },
  brightness: { min: 1.05, max: 3.4 },
} as const;
const UNICORN_VARIABLE_PRECISION = 4;

type FlagCode = string;

type LanguageOption = {
  id: string;
  label: string;
  flag: FlagCode;
  voice: string;
};

type AudioSample = {
  id: string;
  languageId: string;
  label: string;
  src: string;
};

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
    initialVariables?: UnicornVariables;
    ariaLabel?: string;
  }) => Promise<UnicornSceneInstance>;
  isInitialized?: boolean;
};

type PlaybackWindow = Window &
  typeof globalThis & {
    UnicornStudio?: UnicornStudioApi;
    __phonicUnicornStudioPromise?: Promise<UnicornStudioApi>;
    webkitAudioContext?: typeof AudioContext;
  };

type PhonicMultiLanguagePlaybackProps = {
  firstStepLabel?: string;
  languageHeading?: string;
  secondStepLabel?: string;
  playbackHeading?: string;
  selectedLanguage?: string;
  searchPlaceholder?: string;
  shuffleButtonLabel?: string;
  voiceName?: string;
  timestamp?: string;
  animateWave?: boolean;
  volumeLevel?: number;
};

const languageOptions: LanguageOption[] = [
  { id: 'sq', label: 'Albanian', flag: 'sq', voice: 'Elira' },
  { id: 'ar', label: 'Arabic', flag: 'ar', voice: 'Leila' },
  { id: 'az', label: 'Azerbaijani', flag: 'az', voice: 'Aysel' },
  { id: 'bn', label: 'Bengali', flag: 'bn', voice: 'Anika' },
  { id: 'bg', label: 'Bulgarian', flag: 'bg', voice: 'Mila' },
  { id: 'yue', label: 'Cantonese', flag: 'yue', voice: 'Mei' },
  { id: 'zh', label: 'Chinese (Mandarin)', flag: 'zh', voice: 'Lin' },
  { id: 'cs', label: 'Czech', flag: 'cs', voice: 'Tereza' },
  { id: 'da', label: 'Danish', flag: 'da', voice: 'Freja' },
  { id: 'nl', label: 'Dutch', flag: 'nl', voice: 'Noor' },
  { id: 'en', label: 'English', flag: 'en', voice: 'Olivia' },
  { id: 'fil', label: 'Filipino', flag: 'fil', voice: 'Maya' },
  { id: 'fi', label: 'Finnish', flag: 'fi', voice: 'Aino' },
  { id: 'fr', label: 'French', flag: 'fr', voice: 'Camille' },
  { id: 'ka', label: 'Georgian', flag: 'ka', voice: 'Nino' },
  { id: 'de', label: 'German', flag: 'de', voice: 'Lukas' },
  { id: 'el', label: 'Greek', flag: 'el', voice: 'Eleni' },
  { id: 'gu', label: 'Gujarati', flag: 'in', voice: 'Kavya' },
  { id: 'he', label: 'Hebrew', flag: 'he', voice: 'Noa' },
  { id: 'hi', label: 'Hindi', flag: 'in', voice: 'Priya' },
  { id: 'hu', label: 'Hungarian', flag: 'hu', voice: 'Eszter' },
  { id: 'id', label: 'Indonesian', flag: 'id', voice: 'Sari' },
  { id: 'it', label: 'Italian', flag: 'it', voice: 'Giulia' },
  { id: 'ja', label: 'Japanese', flag: 'ja', voice: 'Yuki' },
  { id: 'kn', label: 'Kannada', flag: 'in', voice: 'Ananya' },
  { id: 'km', label: 'Khmer', flag: 'km', voice: 'Sreymom' },
  { id: 'ko', label: 'Korean', flag: 'ko', voice: 'Minji' },
  { id: 'lv', label: 'Latvian', flag: 'lv', voice: 'Liene' },
  { id: 'lt', label: 'Lithuanian', flag: 'lt', voice: 'Ieva' },
  { id: 'ms', label: 'Malay', flag: 'ms', voice: 'Aisha' },
  { id: 'ml', label: 'Malayalam', flag: 'in', voice: 'Meera' },
  { id: 'mr', label: 'Marathi', flag: 'in', voice: 'Asha' },
  { id: 'ne', label: 'Nepali', flag: 'ne', voice: 'Sita' },
  { id: 'no', label: 'Norwegian', flag: 'no', voice: 'Ingrid' },
  { id: 'fa', label: 'Persian', flag: 'fa', voice: 'Sara' },
  { id: 'pl', label: 'Polish', flag: 'pl', voice: 'Zofia' },
  { id: 'pt', label: 'Portuguese', flag: 'pt', voice: 'Ines' },
  { id: 'pa', label: 'Punjabi', flag: 'in', voice: 'Simran' },
  { id: 'ro', label: 'Romanian', flag: 'ro', voice: 'Elena' },
  { id: 'ru', label: 'Russian', flag: 'ru', voice: 'Anya' },
  { id: 'si', label: 'Sinhala', flag: 'si', voice: 'Dilani' },
  { id: 'sk', label: 'Slovak', flag: 'sk', voice: 'Lucia' },
  { id: 'es', label: 'Spanish', flag: 'es', voice: 'Sabrina' },
  { id: 'sw', label: 'Swahili', flag: 'sw', voice: 'Amina' },
  { id: 'sv', label: 'Swedish', flag: 'sv', voice: 'Astrid' },
  { id: 'ta', label: 'Tamil', flag: 'in', voice: 'Kavitha' },
  { id: 'te', label: 'Telugu', flag: 'in', voice: 'Lakshmi' },
  { id: 'th', label: 'Thai', flag: 'th', voice: 'Mali' },
  { id: 'tr', label: 'Turkish', flag: 'tr', voice: 'Elif' },
  { id: 'uk', label: 'Ukrainian', flag: 'uk', voice: 'Oksana' },
  { id: 'ur', label: 'Urdu', flag: 'ur', voice: 'Ayesha' },
  { id: 'vi', label: 'Vietnamese', flag: 'vi', voice: 'Linh' },
];

const languageAliases: Record<string, string> = {
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  spanish: 'es',
  'spanish-latam': 'es',
  'spanish (latam)': 'es',
  'english-us': 'en',
  'english (us)': 'en',
  'english-uk': 'en',
  'english (uk)': 'en',
};

const selectedLanguageOptions = languageOptions.map((language) => language.label);

type FlagVisual = {
  direction: 'horizontal' | 'vertical';
  bands: string[];
  canton?: { fill: string; width: number; height: number };
  circle?: { fill: string; cx?: number; cy?: number; r?: number };
  cross?: {
    fill: string;
    width: number;
    cx?: number;
    cy?: number;
    outlineFill?: string;
    outlineWidth?: number;
  };
  triangle?: { fill: string };
  star?: { fill: string; cx?: number; cy?: number; size?: number };
};

const flagVisuals: Record<string, FlagVisual> = {
  sq: {
    direction: 'horizontal',
    bands: ['#e41e20'],
    star: { fill: '#111111', size: 2.8 },
  },
  ar: {
    direction: 'horizontal',
    bands: ['#111111', '#ffffff', '#007a3d'],
    triangle: { fill: '#ce1126' },
  },
  az: {
    direction: 'horizontal',
    bands: ['#00b5e2', '#ef3340', '#509e2f'],
    circle: { fill: '#ffffff', r: 2.1 },
    star: { fill: '#ffffff', cx: 14.7, size: 1.7 },
  },
  bn: {
    direction: 'horizontal',
    bands: ['#006a4e'],
    circle: { fill: '#f42a41', cx: 11, r: 4.2 },
  },
  bg: { direction: 'horizontal', bands: ['#ffffff', '#00966e', '#d62612'] },
  yue: {
    direction: 'horizontal',
    bands: ['#de2910'],
    star: { fill: '#ffde00', cx: 9, cy: 9, size: 3 },
  },
  zh: {
    direction: 'horizontal',
    bands: ['#de2910'],
    star: { fill: '#ffde00', cx: 9, cy: 9, size: 3 },
  },
  cs: {
    direction: 'horizontal',
    bands: ['#ffffff', '#d7141a'],
    triangle: { fill: '#11457e' },
  },
  da: {
    direction: 'horizontal',
    bands: ['#c60c30'],
    cross: { fill: '#ffffff', width: 3, cx: 9.5 },
  },
  nl: { direction: 'horizontal', bands: ['#ae1c28', '#ffffff', '#21468b'] },
  en: {
    direction: 'horizontal',
    bands: ['#012169'],
    cross: {
      fill: '#c8102e',
      width: 3.4,
      outlineFill: '#ffffff',
      outlineWidth: 6,
    },
  },
  fil: {
    direction: 'horizontal',
    bands: ['#0038a8', '#ce1126'],
    triangle: { fill: '#ffffff' },
    circle: { fill: '#fcd116', cx: 7.2, r: 1.7 },
  },
  fi: {
    direction: 'horizontal',
    bands: ['#ffffff'],
    cross: { fill: '#002f6c', width: 4, cx: 9.5 },
  },
  fr: { direction: 'vertical', bands: ['#0055a4', '#ffffff', '#ef4135'] },
  ka: {
    direction: 'horizontal',
    bands: ['#ffffff'],
    cross: { fill: '#ff0000', width: 2.5 },
  },
  de: { direction: 'horizontal', bands: ['#111111', '#dd1f1f', '#ffcf31'] },
  el: {
    direction: 'horizontal',
    bands: ['#0d5eaf', '#ffffff', '#0d5eaf', '#ffffff', '#0d5eaf'],
    cross: { fill: '#ffffff', width: 2.2 },
  },
  in: {
    direction: 'horizontal',
    bands: ['#ff9933', '#ffffff', '#138808'],
    circle: { fill: '#000080', r: 2.1 },
  },
  he: {
    direction: 'horizontal',
    bands: ['#ffffff', '#0038b8', '#ffffff', '#0038b8', '#ffffff'],
    star: { fill: '#0038b8', size: 2.8 },
  },
  hu: { direction: 'horizontal', bands: ['#ce2939', '#ffffff', '#477050'] },
  id: { direction: 'horizontal', bands: ['#ff0000', '#ffffff'] },
  it: { direction: 'vertical', bands: ['#009246', '#ffffff', '#ce2b37'] },
  ja: {
    direction: 'horizontal',
    bands: ['#ffffff'],
    circle: { fill: '#bc002d', r: 4.1 },
  },
  km: { direction: 'horizontal', bands: ['#032ea1', '#e00025', '#032ea1'] },
  ko: {
    direction: 'horizontal',
    bands: ['#ffffff'],
    circle: { fill: '#cd2e3a', r: 4 },
    star: { fill: '#0047a0', cy: 14.2, size: 2 },
  },
  lv: { direction: 'horizontal', bands: ['#9e3039', '#ffffff', '#9e3039'] },
  lt: { direction: 'horizontal', bands: ['#fdb913', '#006a44', '#c1272d'] },
  ms: {
    direction: 'horizontal',
    bands: ['#cc0001', '#ffffff', '#cc0001', '#ffffff', '#cc0001', '#ffffff'],
    canton: { fill: '#010066', width: 11, height: 10.5 },
    circle: { fill: '#ffcc00', cx: 6, cy: 5.4, r: 2.1 },
  },
  ne: {
    direction: 'horizontal',
    bands: ['#dc143c'],
    triangle: { fill: '#003893' },
    star: { fill: '#ffffff', cx: 13, cy: 10, size: 2.4 },
  },
  no: {
    direction: 'horizontal',
    bands: ['#ba0c2f'],
    cross: {
      fill: '#00205b',
      width: 3,
      cx: 9.5,
      outlineFill: '#ffffff',
      outlineWidth: 5.2,
    },
  },
  fa: { direction: 'horizontal', bands: ['#239f40', '#ffffff', '#da0000'] },
  pl: { direction: 'horizontal', bands: ['#ffffff', '#dc143c'] },
  pt: {
    direction: 'vertical',
    bands: ['#006600', '#ff0000'],
    circle: { fill: '#ffcc00', cx: 10, r: 2.6 },
  },
  ro: { direction: 'vertical', bands: ['#002b7f', '#fcd116', '#ce1126'] },
  ru: { direction: 'horizontal', bands: ['#ffffff', '#0039a6', '#d52b1e'] },
  si: {
    direction: 'vertical',
    bands: ['#ffbe29', '#8d153a'],
    triangle: { fill: '#00534e' },
  },
  sk: {
    direction: 'horizontal',
    bands: ['#ffffff', '#0b4ea2', '#ee1c25'],
    circle: { fill: '#ffffff', cx: 8.5, r: 2 },
  },
  es: { direction: 'horizontal', bands: ['#aa151b', '#f1bf00', '#aa151b'] },
  sw: {
    direction: 'horizontal',
    bands: ['#1eb53a', '#fcd116', '#000000', '#fcd116', '#00a3dd'],
  },
  sv: {
    direction: 'horizontal',
    bands: ['#006aa7'],
    cross: { fill: '#fecc00', width: 3.3, cx: 9.5 },
  },
  th: {
    direction: 'horizontal',
    bands: ['#a51931', '#ffffff', '#2d2a4a', '#ffffff', '#a51931'],
  },
  tr: {
    direction: 'horizontal',
    bands: ['#e30a17'],
    circle: { fill: '#ffffff', cx: 9.6, r: 3.1 },
    star: { fill: '#ffffff', cx: 14.4, size: 2.2 },
  },
  uk: { direction: 'horizontal', bands: ['#0057b7', '#ffd700'] },
  ur: {
    direction: 'vertical',
    bands: ['#ffffff', '#01411c'],
    circle: { fill: '#ffffff', cx: 15.2, r: 2.5 },
    star: { fill: '#ffffff', cx: 17.4, cy: 9, size: 1.8 },
  },
  vi: {
    direction: 'horizontal',
    bands: ['#da251d'],
    star: { fill: '#ffdd00', size: 3.4 },
  },
};

const styles = `
:host {
  font-family: inherit;
}

.pmlp {
  --pmlp-bg: var(--bg-default, #f9f7f5);
  --pmlp-surface: var(--bg-light, #fff);
  --pmlp-muted-surface: var(--bg-dark, #f0eeec);
  --pmlp-hover: #f6f4f2;
  --pmlp-accent: var(--elements-primary, #fe531d);
  --pmlp-text: var(--elements-highem, #211f1e);
  --pmlp-text-mid: var(--elements-midem, rgba(20, 17, 17, 0.7));
  --pmlp-text-disabled: var(--elements-disabled, rgba(20, 17, 17, 0.3));
  --pmlp-border: var(--border-default, rgba(20, 17, 17, 0.1));
  --pmlp-border-soft: rgba(20, 17, 17, 0.03);
  align-items: flex-start;
  color: var(--pmlp-text);
  display: flex;
  font-family: inherit;
  font-weight: 500;
  letter-spacing: 0;
  min-width: 0;
  position: relative;
  width: 100%;
}

.pmlp *, .pmlp *::before, .pmlp *::after {
  box-sizing: border-box;
}

.pmlp button {
  font: inherit;
}

.pmlp__section {
  align-items: flex-start;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  position: relative;
  align-self: stretch;
}

.pmlp__section--languages {
  max-width: 480px;
}

.pmlp__headingWrap {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
  padding: 0 8px;
  width: 100%;
}

.pmlp__heading {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: center;
  width: 100%;
}

.pmlp__step {
  align-items: center;
  border: 1px solid var(--pmlp-accent);
  border-radius: 5px;
  color: var(--pmlp-accent);
  display: flex;
  font-size: 15px;
  justify-content: center;
  line-height: 22px;
  min-width: 32px;
  padding: 2px 6px;
  text-align: center;
}

.pmlp__title {
  color: var(--pmlp-text);
  flex: 1 1 0;
  font-size: var(--font-size-text-lg, 18px);
  line-height: var(--line-height-text-lg, 28px);
  margin: 0;
  min-width: 0;
}

.pmlp__shell {
  background: var(--pmlp-bg);
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  width: 100%;
}

.pmlp__shell--languages {
  padding: 8px 0 8px 8px;
}

.pmlp__shell--player {
  padding: 8px;
}

.pmlp__card {
  background: var(--pmlp-surface);
  border: 1px solid var(--pmlp-border-soft);
  box-shadow: 0 1px 1.5px rgba(20, 17, 17, 0.03);
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  position: relative;
  width: 100%;
}

.pmlp__card--languages {
  height: 392px;
  justify-content: center;
}

.pmlp__card--player {
  justify-content: center;
  overflow: hidden;
}

.pmlp__search {
  align-items: center;
  background: var(--pmlp-surface);
  border: 1px solid var(--pmlp-border);
  border-radius: 5px;
  color: var(--pmlp-text-disabled);
  display: flex;
  flex: 0 0 40px;
  gap: 2px;
  height: 40px;
  overflow: hidden;
  padding: 8px 12px;
  width: 100%;
}

.pmlp__search:focus-within {
  border-color: rgba(254, 83, 29, 0.45);
  box-shadow: 0 0 0 2px rgba(254, 83, 29, 0.12);
}

.pmlp__search svg {
  color: rgba(20, 17, 17, 0.35);
  flex: 0 0 20px;
  height: 20px;
  width: 20px;
}

.pmlp__searchInput {
  appearance: none;
  background: transparent;
  border: 0;
  color: var(--pmlp-text);
  display: flex;
  flex: 1 1 auto;
  font-size: 15px;
  font: inherit;
  font-weight: 500;
  line-height: 22px;
  min-width: 0;
  outline: 0;
  padding: 0 4px;
}

.pmlp__searchInput::placeholder {
  color: var(--pmlp-text-disabled);
  opacity: 1;
}

.pmlp__searchInput::-webkit-search-cancel-button {
  cursor: pointer;
}

.pmlp__languageMask {
  flex: 0 0 324px;
  height: 324px;
  margin-top: 2px;
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  scrollbar-width: none;
  width: 100%;
  -webkit-overflow-scrolling: touch;
}

.pmlp__languageMask::-webkit-scrollbar {
  display: none;
}

.pmlp__languageMask.can-scroll-up {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 100%);
}

.pmlp__languageMask.can-scroll-down {
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 88%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 88%, transparent 100%);
}

.pmlp__languageMask.can-scroll-up.can-scroll-down {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, #000 12%, #000 88%, transparent 100%);
}

.pmlp__languageList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  position: relative;
  width: 100%;
}

.pmlp__languageRow {
  align-items: center;
  appearance: none;
  background: var(--pmlp-surface);
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--pmlp-text);
  cursor: pointer;
  display: flex;
  flex: 0 0 auto;
  gap: 12px;
  min-height: 44px;
  margin: 0;
  min-width: 0;
  padding: 9px 12px;
  position: relative;
  text-align: left;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
  width: 100%;
}

.pmlp__languageRow.is-muted {
  color: rgba(33, 31, 30, 0.5);
}

.pmlp__languageRow:hover {
  background: var(--pmlp-hover);
  color: var(--pmlp-text);
}

.pmlp__languageRow.is-selected {
  background: linear-gradient(90deg, rgba(254, 83, 29, 0.07), rgba(254, 83, 29, 0.07)), #fff;
  border-color: var(--pmlp-accent);
  color: var(--pmlp-text);
}

.pmlp__languageRow:focus-visible,
.pmlp__shuffle:focus-visible,
.pmlp__play:focus-visible {
  outline: 2px solid rgba(254, 83, 29, 0.45);
  outline-offset: 2px;
}

.pmlp__flag {
  border-radius: 999px;
  display: block;
  flex: 0 0 24px;
  height: 24px;
  opacity: 1;
  overflow: hidden;
  position: relative;
  transition: filter 180ms ease, opacity 180ms ease;
  width: 24px;
}

.pmlp__flag svg {
  display: block;
  height: 100%;
  width: 100%;
}

.pmlp__languageRow .pmlp__flag {
  filter: grayscale(1);
  opacity: 0.5;
}

.pmlp__languageRow:hover .pmlp__flag,
.pmlp__languageRow.is-selected .pmlp__flag,
.pmlp__voice .pmlp__flag {
  filter: grayscale(0);
  opacity: 1;
}

.pmlp__languageText {
  display: block;
  flex: 1 1 auto;
  font-size: var(--font-size-text-md, 16px);
  line-height: var(--line-height-text-md, 24px);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pmlp__check {
  display: flex;
  flex: 0 0 24px;
  height: 24px;
  opacity: 0;
  transition: opacity 160ms ease;
  width: 24px;
}

.pmlp__check svg {
  display: block;
  height: 24px;
  width: 24px;
}

.pmlp__languageRow.is-selected .pmlp__check {
  opacity: 1;
}

.pmlp__empty {
  align-items: center;
  color: var(--pmlp-text-disabled);
  display: flex;
  font-size: var(--font-size-text-md, 16px);
  justify-content: center;
  line-height: var(--line-height-text-md, 24px);
  min-height: 88px;
  padding: 18px 12px;
  text-align: center;
}

.pmlp__playerStage {
  background: var(--pmlp-surface);
  display: flex;
  flex-direction: column;
  height: 368px;
  justify-content: space-between;
  min-width: 0;
  overflow: visible;
  padding: 16px;
  width: 100%;
}

.pmlp__playerTop {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-width: 0;
  position: relative;
  width: 100%;
  z-index: 2;
}

.pmlp__voice {
  align-items: center;
  display: flex;
  flex: 1 1 auto;
  gap: 12px;
  min-width: 0;
}

.pmlp__voiceText {
  color: var(--pmlp-text);
  display: block;
  flex: 1 1 auto;
  font-size: var(--font-size-text-md, 16px);
  line-height: var(--line-height-text-md, 24px);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pmlp__shuffle {
  align-items: center;
  appearance: none;
  background: var(--pmlp-muted-surface);
  border: 0;
  border-radius: 5px;
  color: var(--pmlp-text);
  cursor: pointer;
  display: flex;
  flex: 0 0 auto;
  gap: 2px;
  height: 36px;
  justify-content: center;
  margin: 0;
  padding: 8px 12px;
  transition: background-color 160ms ease;
}

.pmlp__shuffle:hover {
  background: #e9e6e3;
}

.pmlp__shuffleText {
  display: block;
  font-size: 15px;
  line-height: 22px;
  padding: 0 6px;
  white-space: nowrap;
}

.pmlp__shuffle svg {
  flex: 0 0 14px;
  height: 14px;
  width: 14px;
}

.pmlp__shuffle--bottom {
  display: none;
}

.pmlp__wave {
  height: 100%;
  inset: 0;
  -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%);
  mask-image: linear-gradient(to right, transparent 0%, #000 20%, #000 80%, transparent 100%);
  overflow: hidden;
  pointer-events: none;
  position: absolute;
  width: 100%;
  z-index: 1;
}

.pmlp__poster,
.pmlp__posterPlaceholder {
  height: 100%;
  inset: 0;
  opacity: 1;
  position: absolute;
  transition: opacity 220ms ease;
  width: 100%;
  z-index: 0;
}

.pmlp__poster {
  display: block;
  object-fit: cover;
}

.pmlp__poster.is-hidden,
.pmlp__posterPlaceholder.is-hidden {
  opacity: 0;
}

.pmlp__unicorn {
  height: 100%;
  inset: 0;
  opacity: 0;
  position: absolute;
  transition: opacity 220ms ease;
  width: 100%;
  z-index: 1;
}

.pmlp__unicorn canvas {
  display: block !important;
  height: 100% !important;
  width: 100% !important;
}

.pmlp__unicorn.is-ready {
  opacity: 1;
}

.pmlp__controls {
  align-items: center;
  display: flex;
  justify-content: space-between;
  min-width: 0;
  padding-right: 8px;
  position: relative;
  width: 100%;
  z-index: 2;
}

.pmlp__timeGroup,
.pmlp__volumeGroup {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
}

.pmlp__timeGroup {
  gap: 12px;
}

.pmlp__volumeGroup {
  gap: 12.8px;
  height: 35.2px;
}

.pmlp__play {
  align-items: center;
  appearance: none;
  background: #ccc8c5;
  border: 0;
  border-radius: 999px;
  color: #fff;
  cursor: pointer;
  display: flex;
  flex: 0 0 32px;
  height: 32px;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 32px;
}

.pmlp__play svg {
  height: 16px;
  width: 16px;
}

.pmlp__playIcon {
  height: 18.9px !important;
  transform: translateX(-3%);
  width: 18.9px !important;
}

.pmlp__time {
  color: var(--pmlp-text-mid);
  font-size: var(--font-size-text-md, 16px);
  line-height: var(--line-height-text-md, 24px);
  white-space: nowrap;
}

.pmlp__volumeIcon {
  color: #bcb8b5;
  flex: 0 0 24px;
  height: 24px;
  width: 24px;
}

.pmlp__slider {
  --pmlp-volume: 75%;
  flex: 0 0 115.2px;
  height: 35.2px;
  position: relative;
  width: 115.2px;
}

.pmlp__sliderTrack,
.pmlp__sliderProgress {
  border-radius: 999px;
  height: 6.4px;
  left: 0;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.pmlp__sliderTrack {
  background: rgba(20, 17, 17, 0.1);
  right: 0;
}

.pmlp__sliderProgress {
  background: var(--pmlp-accent);
  right: auto;
  width: var(--pmlp-volume);
}

.pmlp__sliderHandle {
  background: #fff;
  border: 1.33px solid var(--pmlp-accent);
  border-radius: 999px;
  box-shadow: 0 2.667px 4px -0.667px rgba(10, 13, 18, 0.1), 0 1.333px 2.667px -1.333px rgba(10, 13, 18, 0.06);
  height: 16px;
  left: clamp(0px, calc(var(--pmlp-volume) - 8px), calc(100% - 16px));
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
}

.pmlp__sliderInput {
  appearance: none;
  background: transparent;
  cursor: pointer;
  height: 100%;
  inset: 0;
  margin: 0;
  opacity: 0;
  position: absolute;
  width: 100%;
  z-index: 3;
}

.pmlp__sliderInput:focus-visible ~ .pmlp__sliderHandle {
  outline: 2px solid rgba(254, 83, 29, 0.45);
  outline-offset: 3px;
}

.pmlp__audio {
  display: none;
}

@media (max-width: 990px) {
  .pmlp__section--languages {
    max-width: none;
  }

  .pmlp__card--player {
    flex: 1 1 auto;
    gap: 16px;
    min-height: 0;
  }

  .pmlp__shell--player {
    flex: 1 1 auto;
    min-height: 0;
  }

  .pmlp__playerStage {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    padding: 0;
  }

  .pmlp__shuffle--top {
    display: none;
  }

  .pmlp__shuffle--bottom {
    display: flex;
    flex: 0 0 36px;
    width: 100%;
  }

  .pmlp__play {
    flex-basis: 28px;
    height: 28px;
    width: 28px;
  }

  .pmlp__play svg {
    height: 12px;
    width: 12px;
  }

  .pmlp__playIcon {
    height: 16.2px !important;
    width: 16.2px !important;
  }

  .pmlp__time {
    font-size: 13px;
    line-height: 19px;
  }

  .pmlp__volumeGroup {
    gap: 8px;
  }

  .pmlp__volumeIcon {
    flex-basis: 20px;
    height: 20px;
    width: 20px;
  }

  .pmlp__sliderTrack,
  .pmlp__sliderProgress {
    height: 5.6px;
    top: calc(50% - 0.4px);
  }

  .pmlp__sliderHandle {
    border-width: 1px;
    height: 12px;
    left: clamp(0px, calc(var(--pmlp-volume) - 6px), calc(100% - 12px));
    width: 12px;
  }
}

@media (max-width: 767px) {
  .pmlp {
    flex-direction: column;
    gap: 0;
  }

  .pmlp__section {
    flex: 0 0 auto;
    height: 484px;
    width: 100%;
  }

  .pmlp__section + .pmlp__section {
    margin-top: 28px;
  }

  .pmlp__shell--languages {
    padding: 8px;
  }

  .pmlp__shell--player {
    flex: 1 1 auto;
  }

  .pmlp__card--player {
    height: 100%;
  }

  .pmlp__languageText,
  .pmlp__voiceText {
    white-space: nowrap;
  }
}
`;

function getPlaybackWindow(): PlaybackWindow | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  return window as PlaybackWindow;
}

function findExistingUnicornScript(): HTMLScriptElement | null {
  const targetUrl = new URL(UNICORN_SDK_URL, document.baseURI).href;

  return (
    Array.from(document.scripts).find((script) => {
      if (!script.src) return false;
      if (script.src === targetUrl) return true;

      try {
        const filename = new URL(script.src, document.baseURI).pathname
          .split('/')
          .pop()
          ?.toLowerCase();
        return filename === 'unicornstudio.umd.js' || filename === 'unicornstudio.js';
      } catch {
        return false;
      }
    }) ?? null
  );
}

function waitForUnicornSdk(
  playbackWindow: PlaybackWindow,
  script: HTMLScriptElement,
): Promise<UnicornStudioApi> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      playbackWindow.clearInterval(checkInterval);
      playbackWindow.clearTimeout(timeout);
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
      callback();
    };
    const resolveIfReady = () => {
      if (!playbackWindow.UnicornStudio?.addScene) return false;
      finish(() => resolve(playbackWindow.UnicornStudio as UnicornStudioApi));
      return true;
    };
    const handleLoad = () => {
      if (!resolveIfReady()) {
        finish(() =>
          reject(new Error('Unicorn Studio SDK loaded without addScene support.')),
        );
      }
    };
    const handleError = () => {
      finish(() => reject(new Error('Failed to load Unicorn Studio SDK.')));
    };
    const checkInterval = playbackWindow.setInterval(resolveIfReady, 50);
    const timeout = playbackWindow.setTimeout(() => {
      finish(() => reject(new Error('Timed out while loading the Unicorn Studio SDK.')));
    }, 15_000);

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    resolveIfReady();
  });
}

function loadUnicornStudio(): Promise<UnicornStudioApi> {
  const playbackWindow = getPlaybackWindow();

  if (!playbackWindow) {
    return Promise.reject(new Error('Unicorn Studio is only available in the browser.'));
  }

  if (playbackWindow.UnicornStudio?.addScene) {
    return Promise.resolve(playbackWindow.UnicornStudio);
  }

  if (playbackWindow.__phonicUnicornStudioPromise) {
    return playbackWindow.__phonicUnicornStudioPromise;
  }

  let insertedScript: HTMLScriptElement | null = null;
  const existingScript = findExistingUnicornScript();

  if (!existingScript) {
    insertedScript = document.createElement('script');
    insertedScript.src = UNICORN_SDK_URL;
    insertedScript.async = true;
    insertedScript.dataset.phonicUnicornSdk = 'true';
  }

  const script = existingScript ?? insertedScript;
  if (!script) {
    return Promise.reject(new Error('Unable to create the Unicorn Studio SDK script.'));
  }

  playbackWindow.__phonicUnicornStudioPromise = waitForUnicornSdk(
    playbackWindow,
    script,
  ).catch((error) => {
    insertedScript?.remove();
    playbackWindow.__phonicUnicornStudioPromise = undefined;
    throw error;
  });

  if (insertedScript) {
    (document.head || document.body).appendChild(insertedScript);
  }

  return playbackWindow.__phonicUnicornStudioPromise;
}

function clearUnicornHost(element: HTMLElement): void {
  element.removeAttribute('data-us-initialized');
  element.removeAttribute('data-scene-id');
  element.innerHTML = '';
}

function waitForUnicornCanvas(element: HTMLElement): {
  promise: Promise<void>;
  cancel: () => void;
} {
  let cancelled = false;
  let frameId: number | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    const startedAt = performance.now();

    const checkForCanvas = () => {
      if (cancelled) return;

      if (element.querySelector('canvas')) {
        frameId = requestAnimationFrame(() => {
          frameId = requestAnimationFrame(() => resolve());
        });
        return;
      }

      if (performance.now() - startedAt >= 8_000) {
        reject(new Error('Unicorn Studio did not create a canvas.'));
        return;
      }

      frameId = requestAnimationFrame(checkForCanvas);
    };

    checkForCanvas();
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (frameId !== null) cancelAnimationFrame(frameId);
    },
  };
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

function clampVolumeLevel(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_VOLUME_LEVEL;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function roundVariable(value: number, precision = 2): number {
  return Number(value.toFixed(precision));
}

function lerp(min: number, max: number, level: number): number {
  return min + (max - min) * level;
}

function getWaveAmplitudeScale(componentWidth: number): number {
  if (!Number.isFinite(componentWidth) || componentWidth <= 0) {
    return WAVE_REDUCED_AMPLITUDE_SCALE;
  }

  if (componentWidth <= WAVE_FULL_AMPLITUDE_MAX_WIDTH) return 1;
  if (componentWidth >= WAVE_REDUCED_AMPLITUDE_MIN_WIDTH) {
    return WAVE_REDUCED_AMPLITUDE_SCALE;
  }

  const progress =
    (componentWidth - WAVE_FULL_AMPLITUDE_MAX_WIDTH) /
    (WAVE_REDUCED_AMPLITUDE_MIN_WIDTH - WAVE_FULL_AMPLITUDE_MAX_WIDTH);
  return lerp(1, WAVE_REDUCED_AMPLITUDE_SCALE, progress);
}

function getPlaybackUnicornVariables(voiceLevel: number, amplitudeScale = 1): UnicornVariables {
  const safeVoiceLevel =
    typeof voiceLevel === 'number' && Number.isFinite(voiceLevel) ? voiceLevel : 0;
  const safeAmplitudeScale =
    typeof amplitudeScale === 'number' && Number.isFinite(amplitudeScale)
      ? Math.max(0.1, Math.min(1, amplitudeScale))
      : 1;
  const clampedLevel = Math.max(PLAYBACK_VOICE_IDLE_FLOOR, Math.min(1, safeVoiceLevel));
  const normalizedLevel =
    (clampedLevel - PLAYBACK_VOICE_IDLE_FLOOR) / (1 - PLAYBACK_VOICE_IDLE_FLOOR);

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
      ) * safeAmplitudeScale,
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

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

  const roundedSeconds = Math.floor(seconds);
  const minutes = Math.floor(roundedSeconds / 60);
  const remainingSeconds = roundedSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

const hostedAudioSamples: AudioSample[] = [
  {
    id: 'screen-recording-2026-06-24-20-55-15',
    languageId: '*',
    label: 'Voice sample 1',
    src: `${AUDIO_ASSET_BASE_URL}/assets/audio/phonic-voice-sample-1.mp3`,
  },
  {
    id: 'screen-recording-2026-06-24-20-53-24',
    languageId: '*',
    label: 'Voice sample 2',
    src: `${AUDIO_ASSET_BASE_URL}/assets/audio/phonic-voice-sample-2.mp3`,
  },
];

function normalizeLanguageSearch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function resolveLanguageId(value: string | undefined): string {
  if (!value) return DEFAULT_SELECTED_LANGUAGE;

  const normalized = value.trim().toLowerCase();
  if (languageAliases[normalized]) return languageAliases[normalized];

  const directMatch = languageOptions.find((language) => language.id === normalized);
  if (directMatch) return directMatch.id;

  const labelMatch = languageOptions.find(
    (language) => language.label.toLowerCase() === normalized,
  );
  return labelMatch?.id ?? DEFAULT_SELECTED_LANGUAGE;
}

function getLanguageById(languageId: string): LanguageOption {
  return (
    languageOptions.find((language) => language.id === languageId) ??
    languageOptions.find((language) => language.id === DEFAULT_SELECTED_LANGUAGE) ??
    languageOptions[0]
  );
}

function getNextLanguageId(currentLanguageId: string): string {
  const uniqueLanguages = languageOptions.filter((language, index, options) => {
    return options.findIndex((option) => option.label === language.label) === index;
  });
  const currentIndex = uniqueLanguages.findIndex((language) => language.id === currentLanguageId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % uniqueLanguages.length : 0;
  return uniqueLanguages[nextIndex].id;
}

function getAudioSamplesForLanguage(samples: AudioSample[], languageId: string): AudioSample[] {
  const languageSamples = samples.filter((sample) => sample.languageId === languageId);
  if (languageSamples.length > 0) return languageSamples;

  return samples.filter((sample) => sample.languageId === '*');
}

function getRandomAudioSample(
  samples: AudioSample[],
  languageId: string,
  excludeSampleId?: string,
): AudioSample {
  const languageSamples = getAudioSamplesForLanguage(samples, languageId);
  const samplePool =
    languageSamples.length > 1 && excludeSampleId
      ? languageSamples.filter((sample) => sample.id !== excludeSampleId)
      : languageSamples;
  const randomIndex = Math.floor(Math.random() * Math.max(1, samplePool.length));

  return samplePool[randomIndex] ?? samples[0];
}

function PlaybackWave({
  animate,
  voiceLevel,
  amplitudeScale,
}: {
  animate: boolean;
  voiceLevel: number;
  amplitudeScale: number;
}) {
  const { interactive } = useWebflowContext();
  const sceneHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UnicornSceneInstance | null>(null);
  const variables = useMemo(
    () => getPlaybackUnicornVariables(voiceLevel, amplitudeScale),
    [amplitudeScale, voiceLevel],
  );
  const latestVariablesRef = useRef(variables);
  const [sceneReady, setSceneReady] = useState(false);
  const [posterSrc, setPosterSrc] = useState('');

  useEffect(() => {
    latestVariablesRef.current = variables;
    applyUnicornVariables(sceneRef.current, variables);
  }, [variables]);

  useEffect(() => {
    setPosterSrc(sceneHostRef.current?.dataset.posterSrc?.trim() ?? '');
  }, []);

  useEffect(() => {
    const element = sceneHostRef.current;
    if (!element || !animate || !interactive) {
      setSceneReady(false);
      return;
    }

    let disposed = false;
    let initializationId = 0;
    let initializing = false;
    let intersectionObserver: IntersectionObserver | null = null;
    let teardownTimeout: number | null = null;
    let canvasWait: ReturnType<typeof waitForUnicornCanvas> | null = null;

    setSceneReady(false);

    const cancelTeardown = () => {
      if (teardownTimeout === null) return;
      window.clearTimeout(teardownTimeout);
      teardownTimeout = null;
    };

    const destroyScene = (updateReadyState: boolean) => {
      initializationId += 1;
      initializing = false;
      cancelTeardown();
      canvasWait?.cancel();
      canvasWait = null;
      sceneRef.current?.destroy?.();
      sceneRef.current = null;
      clearUnicornHost(element);
      if (updateReadyState) setSceneReady(false);
    };

    const initializeScene = () => {
      cancelTeardown();
      if (disposed || initializing || sceneRef.current) return;

      const currentInitializationId = ++initializationId;
      initializing = true;
      setSceneReady(false);

      loadUnicornStudio()
        .then((studio) => {
          if (disposed || currentInitializationId !== initializationId) return null;

          if (!studio.addScene) {
            throw new Error('Unicorn Studio SDK addScene method is unavailable.');
          }

          clearUnicornHost(element);
          return studio.addScene({
            projectId: UNICORN_PROJECT_ID,
            element,
            scale: UNICORN_SCALE,
            dpi: UNICORN_DPI,
            fps: UNICORN_FPS,
            initialVariables: latestVariablesRef.current,
            ariaLabel: 'Phonic voice sample wave',
          });
        })
        .then((scene) => {
          if (!scene) return null;

          if (disposed || currentInitializationId !== initializationId) {
            scene.destroy?.();
            return null;
          }

          sceneRef.current = scene;
          applyUnicornVariables(scene, latestVariablesRef.current);
          canvasWait = waitForUnicornCanvas(element);
          return canvasWait.promise;
        })
        .then((canvasReady) => {
          if (
            canvasReady === null ||
            disposed ||
            currentInitializationId !== initializationId
          ) {
            return;
          }

          canvasWait = null;
          setSceneReady(true);
        })
        .catch(() => {
          if (disposed || currentInitializationId !== initializationId) return;

          sceneRef.current?.destroy?.();
          sceneRef.current = null;
          clearUnicornHost(element);
          setSceneReady(false);
        })
        .finally(() => {
          if (currentInitializationId === initializationId) {
            initializing = false;
          }
        });
    };

    const scheduleTeardown = () => {
      if (
        UNICORN_LOADING_PRIORITY === 'eager' ||
        teardownTimeout !== null ||
        (!initializing && !sceneRef.current)
      ) {
        return;
      }

      teardownTimeout = window.setTimeout(() => {
        teardownTimeout = null;
        if (!disposed) destroyScene(true);
      }, UNICORN_TEARDOWN_DELAY_MS);
    };

    if (
      UNICORN_LOADING_PRIORITY === 'eager' ||
      typeof window.IntersectionObserver !== 'function'
    ) {
      initializeScene();
    } else {
      intersectionObserver = new window.IntersectionObserver(
        (entries) => {
          const entry = entries.find((candidate) => candidate.target === element);
          if (!entry) return;

          if (entry.isIntersecting) {
            initializeScene();
          } else {
            scheduleTeardown();
          }
        },
        {
          rootMargin: UNICORN_PREWARM_ROOT_MARGIN,
          threshold: 0,
        }
      );
      intersectionObserver.observe(element);
    }

    return () => {
      disposed = true;
      intersectionObserver?.disconnect();
      destroyScene(false);
    };
  }, [animate, interactive]);

  return (
    <div className="pmlp__wave" aria-hidden="true">
      {posterSrc ? (
        <img
          className={`pmlp__poster${sceneReady ? ' is-hidden' : ''}`}
          src={posterSrc}
          alt=""
          aria-hidden="true"
          loading={UNICORN_LOADING_PRIORITY === 'eager' ? 'eager' : 'lazy'}
          fetchPriority={UNICORN_LOADING_PRIORITY === 'eager' ? 'high' : 'low'}
          decoding="async"
        />
      ) : (
        <div
          className={`pmlp__posterPlaceholder${sceneReady ? ' is-hidden' : ''}`}
          aria-hidden="true"
          data-poster-required="Add data-poster-src to the Unicorn scene host"
        />
      )}
      <div
        ref={sceneHostRef}
        className={`pmlp__unicorn${sceneReady ? ' is-ready' : ''}`}
        data-us-project={UNICORN_PROJECT_ID}
        data-us-scale={String(UNICORN_SCALE)}
        data-us-dpi={String(UNICORN_DPI)}
        data-us-fps={String(UNICORN_FPS)}
        data-us-vars={JSON.stringify(variables)}
        data-poster-src="https://cdn.prod.website-files.com/6a26780bad2144a03e65dcec/6a69f4e721e69c67cde55e34_multi-language-playback-poster.webp"
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M9.167 15.833a6.667 6.667 0 1 0 0-13.333 6.667 6.667 0 0 0 0 13.333ZM14.167 14.167 17.5 17.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function LanguageRowCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM10.5744 16.4884L16.4073 9.35925L14.8594 8.09277L10.4259 13.5115L8.50015 11.5858L7.08594 13L10.5744 16.4884Z"
        fill="#FE531D"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.2 3.3v9.4M10.8 3.3v9.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="pmlp__playIcon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.2 2.1 13.9 8l-9.7 5.9V2.1Z" fill="currentColor" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg viewBox="0 0 12.2917 11.125" fill="none" aria-hidden="true">
      <path
        d="M0.75 9.17187H1.94907L8.625 2.5H11.1042M0.75 1.91667H1.91667L4.10417 4.10417M11.1042 8.57031H8.54398L7.02083 7.02083M9.79167 0.75L11.5417 2.5L9.79167 4.25M9.74306 6.76562L11.5417 8.57031L9.74306 10.375"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg className="pmlp__volumeIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9.3v5.4h3.2l4.1 3.1V6.2L7.2 9.3H4Z" fill="currentColor" />
      <path
        d="M15.2 8.2a5.5 5.5 0 0 1 0 7.6M17.8 5.7a9 9 0 0 1 0 12.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function FlagIcon({ code }: { code: FlagCode }) {
  return (
    <span className="pmlp__flag" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <rect width="24" height="24" fill="#fff" />
        {renderFlag(code)}
        <circle cx="12" cy="12" r="12" fill="none" stroke="rgba(20, 17, 17, 0.08)" />
      </svg>
    </span>
  );
}

function renderFlag(code: FlagCode) {
  if (code === 'en') return <UnionJackFlag />;
  if (code === 'el') return <GreekFlag />;
  if (code === 'in') return <IndianFlag />;

  const visual = flagVisuals[code] ?? flagVisuals.en;
  const bandSize = 24 / visual.bands.length;
  const crossCenterX = visual.cross?.cx ?? 12;
  const crossCenterY = visual.cross?.cy ?? 12;

  return (
    <>
      {visual.bands.map((color, index) =>
        visual.direction === 'vertical' ? (
          <rect
            key={`${color}-${index}`}
            x={index * bandSize}
            width={bandSize}
            height="24"
            fill={color}
          />
        ) : (
          <rect
            key={`${color}-${index}`}
            y={index * bandSize}
            width="24"
            height={bandSize}
            fill={color}
          />
        ),
      )}
      {visual.canton && (
        <rect width={visual.canton.width} height={visual.canton.height} fill={visual.canton.fill} />
      )}
      {visual.triangle && <path d="M0 0 12.5 12 0 24Z" fill={visual.triangle.fill} />}
      {visual.cross?.outlineFill && (
        <>
          <rect
            x={crossCenterX - visual.cross.outlineWidth / 2}
            width={visual.cross.outlineWidth}
            height="24"
            fill={visual.cross.outlineFill}
          />
          <rect
            y={crossCenterY - visual.cross.outlineWidth / 2}
            width="24"
            height={visual.cross.outlineWidth}
            fill={visual.cross.outlineFill}
          />
        </>
      )}
      {visual.cross && (
        <>
          <rect
            x={crossCenterX - visual.cross.width / 2}
            width={visual.cross.width}
            height="24"
            fill={visual.cross.fill}
          />
          <rect
            y={crossCenterY - visual.cross.width / 2}
            width="24"
            height={visual.cross.width}
            fill={visual.cross.fill}
          />
        </>
      )}
      {visual.circle && (
        <circle
          cx={visual.circle.cx ?? 12}
          cy={visual.circle.cy ?? 12}
          r={visual.circle.r ?? 3}
          fill={visual.circle.fill}
        />
      )}
      {visual.star && (
        <path
          d={getStarPath(visual.star.cx ?? 12, visual.star.cy ?? 12, visual.star.size ?? 2.6)}
          fill={visual.star.fill}
        />
      )}
    </>
  );
}

function UnionJackFlag() {
  return (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M-1 -1 25 25M25 -1 -1 25" stroke="#ffffff" strokeWidth="5.4" />
      <path
        d="M-1 1.1 9.6 11.7M14.4 12.3 25 22.9M25 1.1 14.4 11.7M9.6 12.3 -1 22.9"
        stroke="#c8102e"
        strokeLinecap="butt"
        strokeWidth="2.25"
      />
      <rect x="8" width="8" height="24" fill="#ffffff" />
      <rect y="8" width="24" height="8" fill="#ffffff" />
      <rect x="10.15" width="3.7" height="24" fill="#c8102e" />
      <rect y="10.15" width="24" height="3.7" fill="#c8102e" />
    </>
  );
}

function GreekFlag() {
  const stripeHeight = 24 / 9;
  const cantonSize = stripeHeight * 5;
  const crossWidth = stripeHeight;
  const blue = '#0d5eaf';

  return (
    <>
      {Array.from({ length: 9 }).map((_, index) => (
        <rect
          key={`greek-stripe-${index}`}
          y={index * stripeHeight}
          width="24"
          height={stripeHeight}
          fill={index % 2 === 0 ? blue : '#ffffff'}
        />
      ))}
      <rect width={cantonSize} height={cantonSize} fill={blue} />
      <rect
        x={cantonSize / 2 - crossWidth / 2}
        width={crossWidth}
        height={cantonSize}
        fill="#ffffff"
      />
      <rect
        y={cantonSize / 2 - crossWidth / 2}
        width={cantonSize}
        height={crossWidth}
        fill="#ffffff"
      />
    </>
  );
}

function IndianFlag() {
  const chakraSpokes = Array.from({ length: 12 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 12;
    return {
      x: 12 + Math.cos(angle) * 2.15,
      y: 12 + Math.sin(angle) * 2.15,
    };
  });

  return (
    <>
      <rect width="24" height="8" fill="#ff9933" />
      <rect y="8" width="24" height="8" fill="#ffffff" />
      <rect y="16" width="24" height="8" fill="#138808" />
      <circle cx="12" cy="12" r="2.35" fill="none" stroke="#000080" strokeWidth="0.55" />
      {chakraSpokes.map((spoke, index) => (
        <line
          key={`chakra-spoke-${index}`}
          x1="12"
          y1="12"
          x2={spoke.x}
          y2={spoke.y}
          stroke="#000080"
          strokeWidth="0.24"
        />
      ))}
      <circle cx="12" cy="12" r="0.42" fill="#000080" />
    </>
  );
}

function getStarPath(cx: number, cy: number, radius: number): string {
  const points: string[] = [];

  for (let index = 0; index < 10; index++) {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const pointRadius = index % 2 === 0 ? radius : radius * 0.42;
    const x = cx + Math.cos(angle) * pointRadius;
    const y = cy + Math.sin(angle) * pointRadius;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }

  return `M${points.join('L')}Z`;
}

function PhonicMultiLanguagePlayback({
  firstStepLabel = '01',
  languageHeading = 'Choose from 50+ languages',
  secondStepLabel = '02',
  playbackHeading = 'Play voice sample',
  selectedLanguage = 'Spanish',
  searchPlaceholder = 'Search languages',
  shuffleButtonLabel = 'Shuffle sample',
  voiceName,
  timestamp = '0:04 / 0:12',
  animateWave = true,
  volumeLevel: initialVolumeLevel = DEFAULT_VOLUME_LEVEL,
}: PhonicMultiLanguagePlaybackProps) {
  const selectedLanguageId = useMemo(() => resolveLanguageId(selectedLanguage), [selectedLanguage]);
  const audioSamples = hostedAudioSamples;
  const resolvedInitialVolumeLevel = useMemo(
    () => clampVolumeLevel(initialVolumeLevel),
    [initialVolumeLevel],
  );
  const [activeLanguageId, setActiveLanguageId] = useState(selectedLanguageId);
  const [currentAudioSample, setCurrentAudioSample] = useState(() =>
    getRandomAudioSample(audioSamples, selectedLanguageId),
  );
  const [volumeLevel, setVolumeLevel] = useState(resolvedInitialVolumeLevel);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(DEFAULT_AUDIO_DURATION_SECONDS);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageScrollState, setLanguageScrollState] = useState({
    canScrollUp: false,
    canScrollDown: false,
  });
  const [waveAmplitudeScale, setWaveAmplitudeScale] = useState(WAVE_REDUCED_AMPLITUDE_SCALE);
  const componentRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const voiceLevelFrameRef = useRef<number | null>(null);
  const voiceLevelDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const voiceLevelSamplesRef = useRef<{ time: number; level: number }[]>([]);
  const displayedVoiceLevelRef = useRef(0);
  const loadedAudioSampleIdRef = useRef<string | null>(null);
  const languageMaskRef = useRef<HTMLDivElement>(null);
  const activeLanguageButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setActiveLanguageId(selectedLanguageId);
    setCurrentAudioSample((currentSample) =>
      getRandomAudioSample(audioSamples, selectedLanguageId, currentSample.id),
    );
  }, [audioSamples, selectedLanguageId]);

  useEffect(() => {
    setVolumeLevel(resolvedInitialVolumeLevel);
  }, [resolvedInitialVolumeLevel]);

  useEffect(() => {
    const component = componentRef.current;
    if (!component) return;

    const updateScale = () => {
      const nextScale = getWaveAmplitudeScale(component.getBoundingClientRect().width);
      setWaveAmplitudeScale((currentScale) =>
        Math.abs(currentScale - nextScale) < 0.01 ? currentScale : nextScale,
      );
    };

    updateScale();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateScale);
      return () => window.removeEventListener('resize', updateScale);
    }

    const resizeObserver = new ResizeObserver(updateScale);
    resizeObserver.observe(component);

    return () => resizeObserver.disconnect();
  }, []);

  const activeLanguage = getLanguageById(activeLanguageId);
  const voiceLabel = `${activeLanguage.label} - ${voiceName?.trim() || activeLanguage.voice}`;
  const normalizedSearchQuery = useMemo(() => normalizeLanguageSearch(searchQuery), [searchQuery]);
  const displayedLanguageOptions = useMemo(() => {
    if (!normalizedSearchQuery) return languageOptions;

    return languageOptions.filter((language) => {
      const normalizedLabel = normalizeLanguageSearch(language.label);
      return (
        normalizedLabel.includes(normalizedSearchQuery) ||
        language.id.toLowerCase().includes(normalizedSearchQuery)
      );
    });
  }, [normalizedSearchQuery]);
  const playbackTimestamp =
    playbackDuration > 0
      ? `${formatPlaybackTime(playbackCurrentTime)} / ${formatPlaybackTime(playbackDuration)}`
      : timestamp;

  const stopVoiceLevelMeter = useCallback(() => {
    if (voiceLevelFrameRef.current != null) {
      window.cancelAnimationFrame(voiceLevelFrameRef.current);
      voiceLevelFrameRef.current = null;
    }
  }, []);

  const ensureAudioGraph = useCallback(() => {
    const audio = audioRef.current;
    const playbackWindow = getPlaybackWindow();
    if (!audio || !playbackWindow) return null;

    const AudioContextConstructor =
      playbackWindow.AudioContext ?? playbackWindow.webkitAudioContext;
    if (!AudioContextConstructor) return null;

    const audioContext =
      audioContextRef.current ?? new AudioContextConstructor({ latencyHint: 'interactive' });
    audioContextRef.current = audioContext;

    if (!audioSourceRef.current) {
      const source = audioContext.createMediaElementSource(audio);
      const analyser = audioContext.createAnalyser();
      const gain = audioContext.createGain();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      gain.gain.value = clampVolumeLevel(volumeLevel) / 100;

      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(audioContext.destination);

      audioSourceRef.current = source;
      analyserRef.current = analyser;
      gainRef.current = gain;
    }

    return audioContext;
  }, [volumeLevel]);

  const startVoiceLevelMeter = useCallback(() => {
    stopVoiceLevelMeter();

    const analyser = analyserRef.current;
    if (!analyser) return;

    if (!voiceLevelDataRef.current || voiceLevelDataRef.current.length !== analyser.fftSize) {
      voiceLevelDataRef.current = new Uint8Array(analyser.fftSize);
    }

    const tick = () => {
      const audio = audioRef.current;
      const data = voiceLevelDataRef.current;

      if (!audio || !data || audio.paused || audio.ended) {
        voiceLevelSamplesRef.current = [];
        const nextLevel = displayedVoiceLevelRef.current * 0.82;
        displayedVoiceLevelRef.current = nextLevel;
        setVoiceLevel(nextLevel < 0.01 ? 0 : nextLevel);

        if (nextLevel >= 0.01) {
          voiceLevelFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          voiceLevelFrameRef.current = null;
        }
        return;
      }

      analyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let index = 0; index < data.length; index++) {
        const centeredSample = (data[index] - 128) / 128;
        sum += centeredSample * centeredSample;
      }

      const rms = Math.sqrt(sum / data.length);
      const rawLevel = Math.min(1, rms * 10);
      const measuredLevel = rawLevel < 0.015 ? 0 : Math.pow(rawLevel, PLAYBACK_VOICE_LEVEL_CURVE);
      const now = performance.now();
      const samples = voiceLevelSamplesRef.current;
      samples.push({ time: now, level: measuredLevel });

      while (samples.length > 0 && now - samples[0].time > PLAYBACK_VOICE_AVERAGE_WINDOW_MS) {
        samples.shift();
      }

      const averagedLevel =
        samples.reduce((total, sample) => total + sample.level, 0) / Math.max(1, samples.length);
      const peakLevel = samples.reduce(
        (highestLevel, sample) => Math.max(highestLevel, sample.level),
        0,
      );
      const targetLevel = Math.max(
        PLAYBACK_VOICE_IDLE_FLOOR,
        averagedLevel * (1 - PLAYBACK_VOICE_PEAK_WEIGHT) + peakLevel * PLAYBACK_VOICE_PEAK_WEIGHT,
      );
      const currentLevel = displayedVoiceLevelRef.current;
      const smoothing =
        targetLevel > currentLevel ? PLAYBACK_VOICE_RISE_SMOOTHING : PLAYBACK_VOICE_FALL_SMOOTHING;
      const nextLevel = currentLevel + (targetLevel - currentLevel) * smoothing;
      const settledLevel = Math.abs(nextLevel - targetLevel) < 0.002 ? targetLevel : nextLevel;

      displayedVoiceLevelRef.current = settledLevel;
      setVoiceLevel(settledLevel);
      voiceLevelFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  }, [stopVoiceLevelMeter]);

  const startAudioPlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioContext = ensureAudioGraph();
    gainRef.current?.gain.setTargetAtTime(
      clampVolumeLevel(volumeLevel) / 100,
      audioContext?.currentTime ?? 0,
      0.015,
    );

    if (audioContext?.state === 'suspended') {
      await audioContext.resume();
    }

    try {
      await audio.play();
      setIsPlaying(true);
      startVoiceLevelMeter();
    } catch {
      setIsPlaying(false);
    }
  }, [ensureAudioGraph, startVoiceLevelMeter, volumeLevel]);

  const pauseAudioPlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    if (!gainRef.current || !audioContextRef.current) return;

    gainRef.current.gain.setTargetAtTime(
      clampVolumeLevel(volumeLevel) / 100,
      audioContextRef.current.currentTime,
      0.015,
    );
  }, [volumeLevel]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setPlaybackCurrentTime(audio.currentTime || 0);
    const updateDuration = () => {
      setPlaybackDuration(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : DEFAULT_AUDIO_DURATION_SECONDS,
      );
    };
    const handlePlay = () => {
      setIsPlaying(true);
      startVoiceLevelMeter();
    };
    const handlePause = () => {
      setIsPlaying(false);
      startVoiceLevelMeter();
    };
    const handleEnded = () => {
      setIsPlaying(false);
      voiceLevelSamplesRef.current = [];
      startVoiceLevelMeter();
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [startVoiceLevelMeter, stopVoiceLevelMeter]);

  const loadAudioSample = useCallback(
    (sample: AudioSample, shouldPlay = false) => {
      const audio = audioRef.current;
      if (!audio) return;

      loadedAudioSampleIdRef.current = sample.id;
      audio.pause();
      audio.src = sample.src;
      audio.currentTime = 0;
      audio.load();

      setPlaybackCurrentTime(0);
      setPlaybackDuration(DEFAULT_AUDIO_DURATION_SECONDS);
      setIsPlaying(false);
      displayedVoiceLevelRef.current = 0;
      voiceLevelSamplesRef.current = [];
      setVoiceLevel(0);
      stopVoiceLevelMeter();

      if (shouldPlay) {
        void startAudioPlayback();
      }
    },
    [startAudioPlayback, stopVoiceLevelMeter],
  );

  useEffect(() => {
    if (loadedAudioSampleIdRef.current === currentAudioSample.id) return;
    loadAudioSample(currentAudioSample);
  }, [currentAudioSample, loadAudioSample]);

  useEffect(() => {
    const audio = audioRef.current;

    return () => {
      stopVoiceLevelMeter();
      audio?.pause();
      audio?.removeAttribute('src');
      audio?.load();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      audioSourceRef.current = null;
      analyserRef.current = null;
      gainRef.current = null;
      voiceLevelSamplesRef.current = [];
      loadedAudioSampleIdRef.current = null;
    };
  }, [stopVoiceLevelMeter]);

  const updateLanguageScrollState = useCallback(() => {
    const languageMask = languageMaskRef.current;
    if (!languageMask) return;

    const maxScrollTop = Math.max(0, languageMask.scrollHeight - languageMask.clientHeight);
    const nextScrollState = {
      canScrollUp: languageMask.scrollTop > 1,
      canScrollDown: languageMask.scrollTop < maxScrollTop - 1,
    };

    setLanguageScrollState((currentScrollState) =>
      currentScrollState.canScrollUp === nextScrollState.canScrollUp &&
      currentScrollState.canScrollDown === nextScrollState.canScrollDown
        ? currentScrollState
        : nextScrollState,
    );
  }, []);

  useEffect(() => {
    const languageMask = languageMaskRef.current;
    if (!languageMask) return;

    if (normalizedSearchQuery) {
      languageMask.scrollTop = 0;
    } else {
      const activeLanguageButton = activeLanguageButtonRef.current;

      if (activeLanguageButton) {
        const maxScrollTop = Math.max(0, languageMask.scrollHeight - languageMask.clientHeight);
        const centeredScrollTop =
          activeLanguageButton.offsetTop -
          (languageMask.clientHeight - activeLanguageButton.offsetHeight) / 2;

        languageMask.scrollTop = Math.min(Math.max(0, centeredScrollTop), maxScrollTop);
      }
    }

    const frame = window.requestAnimationFrame(updateLanguageScrollState);
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeLanguageId,
    displayedLanguageOptions.length,
    normalizedSearchQuery,
    updateLanguageScrollState,
  ]);

  useEffect(() => {
    const languageMask = languageMaskRef.current;
    if (!languageMask || typeof ResizeObserver === 'undefined') return;

    const resizeObserver = new ResizeObserver(() => updateLanguageScrollState());
    resizeObserver.observe(languageMask);

    return () => resizeObserver.disconnect();
  }, [updateLanguageScrollState]);

  const selectLanguageForPlayback = useCallback(
    (languageId: string) => {
      const nextSample = getRandomAudioSample(audioSamples, languageId, currentAudioSample.id);
      setActiveLanguageId(languageId);
      setCurrentAudioSample(nextSample);
      loadAudioSample(nextSample);
    },
    [audioSamples, currentAudioSample.id, loadAudioSample],
  );

  const shuffleSample = useCallback(() => {
    const nextSample = getRandomAudioSample(audioSamples, activeLanguageId, currentAudioSample.id);
    setCurrentAudioSample(nextSample);
    loadAudioSample(nextSample, true);
  }, [activeLanguageId, audioSamples, currentAudioSample.id, loadAudioSample]);

  const changeVolumeLevel = useCallback((nextVolumeLevel: number) => {
    setVolumeLevel(clampVolumeLevel(nextVolumeLevel));
  }, []);

  const toggleAudioPlayback = useCallback(() => {
    if (isPlaying) {
      pauseAudioPlayback();
      return;
    }

    void startAudioPlayback();
  }, [isPlaying, pauseAudioPlayback, startAudioPlayback]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setSearchQuery('');
        return;
      }

      if (event.key === 'Enter' && displayedLanguageOptions.length > 0) {
        event.preventDefault();
        selectLanguageForPlayback(displayedLanguageOptions[0].id);
      }
    },
    [displayedLanguageOptions, selectLanguageForPlayback],
  );

  const languageMaskClassName = [
    'pmlp__languageMask',
    languageScrollState.canScrollUp ? 'can-scroll-up' : '',
    languageScrollState.canScrollDown ? 'can-scroll-down' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="pmlp" ref={componentRef}>
      <style>{styles}</style>

      <section className="pmlp__section pmlp__section--languages" aria-label={languageHeading}>
        <StepHeading label={firstStepLabel} title={languageHeading} />
        <div className="pmlp__shell pmlp__shell--languages">
          <div className="pmlp__card pmlp__card--languages">
            <label className="pmlp__search">
              <SearchIcon />
              <input
                className="pmlp__searchInput"
                type="search"
                value={searchQuery}
                placeholder={searchPlaceholder}
                onChange={(event) => setSearchQuery(event.currentTarget.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="Search languages"
              />
            </label>
            <div
              className={languageMaskClassName}
              ref={languageMaskRef}
              onScroll={updateLanguageScrollState}
            >
              <div className="pmlp__languageList" role="listbox" aria-label="Languages">
                {displayedLanguageOptions.length === 0 && (
                  <div className="pmlp__empty" role="presentation">
                    No languages found
                  </div>
                )}
                {displayedLanguageOptions.map((language) => {
                  const isSelected = language.id === activeLanguageId;
                  const isMuted = !isSelected;

                  return (
                    <button
                      key={language.id}
                      ref={isSelected ? activeLanguageButtonRef : undefined}
                      className={[
                        'pmlp__languageRow',
                        isSelected ? 'is-selected' : '',
                        isMuted ? 'is-muted' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectLanguageForPlayback(language.id)}
                    >
                      <FlagIcon code={language.flag} />
                      <span className="pmlp__languageText">{language.label}</span>
                      <span className="pmlp__check">
                        <LanguageRowCheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pmlp__section pmlp__section--player" aria-label={playbackHeading}>
        <StepHeading label={secondStepLabel} title={playbackHeading} />
        <div className="pmlp__shell pmlp__shell--player">
          <div className="pmlp__card pmlp__card--player">
            <div className="pmlp__playerStage">
              <div className="pmlp__playerTop">
                <div className="pmlp__voice">
                  <FlagIcon code={activeLanguage.flag} />
                  <span className="pmlp__voiceText">{voiceLabel}</span>
                </div>
                <ShuffleButton
                  className="pmlp__shuffle--top"
                  label={shuffleButtonLabel}
                  onClick={shuffleSample}
                />
              </div>

              <PlaybackWave
                animate={animateWave}
                voiceLevel={voiceLevel}
                amplitudeScale={waveAmplitudeScale}
              />

              <PlayerControls
                timestamp={playbackTimestamp}
                isPlaying={isPlaying}
                volumeLevel={volumeLevel}
                onTogglePlayback={toggleAudioPlayback}
                onVolumeChange={changeVolumeLevel}
              />
            </div>

            <ShuffleButton
              className="pmlp__shuffle--bottom"
              label={shuffleButtonLabel}
              onClick={shuffleSample}
            />
            <audio ref={audioRef} className="pmlp__audio" preload="auto" crossOrigin="anonymous" />
          </div>
        </div>
      </section>
    </div>
  );
}

function StepHeading({ label, title }: { label: string; title: string }) {
  return (
    <div className="pmlp__headingWrap">
      <div className="pmlp__heading">
        <span className="pmlp__step">{label}</span>
        <p className="pmlp__title">{title}</p>
      </div>
    </div>
  );
}

function ShuffleButton({
  className,
  label,
  onClick,
}: {
  className: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`pmlp__shuffle ${className}`} type="button" onClick={onClick}>
      <span className="pmlp__shuffleText">{label}</span>
      <ShuffleIcon />
    </button>
  );
}

function PlayerControls({
  timestamp,
  isPlaying,
  volumeLevel,
  onTogglePlayback,
  onVolumeChange,
}: {
  timestamp: string;
  isPlaying: boolean;
  volumeLevel: number;
  onTogglePlayback: () => void;
  onVolumeChange: (volumeLevel: number) => void;
}) {
  const sliderStyle = {
    '--pmlp-volume': `${volumeLevel}%`,
  } as CSSProperties;

  return (
    <div className="pmlp__controls">
      <div className="pmlp__timeGroup">
        <button
          className="pmlp__play"
          type="button"
          aria-label={isPlaying ? 'Pause sample' : 'Play sample'}
          onClick={onTogglePlayback}
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="pmlp__time">{timestamp}</span>
      </div>
      <div className="pmlp__volumeGroup">
        <VolumeIcon />
        <div className="pmlp__slider" style={sliderStyle}>
          <input
            className="pmlp__sliderInput"
            type="range"
            min={0}
            max={100}
            value={volumeLevel}
            onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
            aria-label="Volume"
          />
          <span className="pmlp__sliderTrack" />
          <span className="pmlp__sliderProgress" />
          <span className="pmlp__sliderHandle" />
        </div>
      </div>
    </div>
  );
}

export const Component = PhonicMultiLanguagePlayback;

export default declareComponent(PhonicMultiLanguagePlayback, {
  name: 'Phonic Multi Language Playback',
  description: 'Responsive language picker and voice sample playback component.',
  group: 'Interactive',
  props: {
    firstStepLabel: props.Text({
      name: 'First step label',
      defaultValue: '01',
    }),
    languageHeading: props.Text({
      name: 'Language heading',
      defaultValue: 'Choose from 50+ languages',
    }),
    secondStepLabel: props.Text({
      name: 'Second step label',
      defaultValue: '02',
    }),
    playbackHeading: props.Text({
      name: 'Playback heading',
      defaultValue: 'Play voice sample',
    }),
    selectedLanguage: props.Variant({
      name: 'Selected language',
      options: selectedLanguageOptions,
      defaultValue: 'Spanish',
    }),
    searchPlaceholder: props.Text({
      name: 'Search placeholder',
      defaultValue: 'Search languages',
    }),
    shuffleButtonLabel: props.Text({
      name: 'Shuffle button label',
      defaultValue: 'Shuffle sample',
    }),
    voiceName: props.Text({
      name: 'Voice name override',
      defaultValue: '',
    }),
    timestamp: props.Text({
      name: 'Timestamp',
      defaultValue: '0:04 / 0:12',
    }),
    animateWave: props.Boolean({
      name: 'Animate Unicorn wave',
      defaultValue: true,
      trueLabel: 'Animate',
      falseLabel: 'Static',
    }),
    volumeLevel: props.Number({
      name: 'Initial volume',
      defaultValue: DEFAULT_VOLUME_LEVEL,
      min: 0,
      max: 100,
      decimals: 0,
      tooltip: 'Sets the starting slider value. The Unicorn wave follows the selected audio level.',
    }),
  },
  options: {
    applyTagSelectors: false,
    ssr: false,
  },
});
