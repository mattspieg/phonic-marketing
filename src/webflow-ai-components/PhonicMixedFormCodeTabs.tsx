import { declareComponent } from '@webflow/react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

type Tab = {
  id: string;
  label: string;
  type: 'form' | 'code';
  language?: 'typescript' | 'python';
  code?: string;
};

type SelectField = {
  label: string;
  value: string;
  options: string[];
  tooltip?: ReactNode;
};

type SliderField = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
};

const styles = `
:host {
  font-family: inherit;
}

.pmfc {
  --pmfc-bg: #f9f7f5;
  --pmfc-surface: #fff;
  --pmfc-accent: #fe531d;
  --pmfc-text-high: #211f1e;
  --pmfc-text-low: rgba(20, 17, 17, 0.5);
  --pmfc-border-subtle: rgba(20, 17, 17, 0.03);
  --pmfc-control-border: rgba(10, 10, 10, 0.1);
  --pmfc-mono: "JetBrains Mono", "Roboto Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  background: var(--pmfc-bg);
  box-sizing: border-box;
  color: var(--pmfc-text-high);
  display: flex;
  flex-direction: column;
  font-family: inherit;
  height: 100%;
  isolation: isolate;
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  position: relative;
  width: 100%;
}

.pmfc *, .pmfc *::before, .pmfc *::after { box-sizing: border-box; }

.pmfc button,
.pmfc input,
.pmfc select,
.pmfc optgroup,
.pmfc textarea,
.pmfc kbd {
  font-family: inherit;
}

.pmfc__toolbar {
  align-items: center;
  display: flex;
  flex: 0 0 34px;
  gap: 8px;
  height: 34px;
  margin-bottom: -1px;
  padding: 0 8px;
  position: relative;
  width: 100%;
  z-index: 2;
}

.pmfc__windowButtons {
  align-items: center;
  display: flex;
  flex: 0 0 52px;
  gap: 8px;
  height: 100%;
  padding-bottom: 4px;
}

.pmfc__windowButtons span {
  background: #e9e7e4;
  border-radius: 999px;
  display: block;
  height: 12px;
  width: 12px;
}

.pmfc__tabScroller {
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  scrollbar-width: none;
}

.pmfc__tabScroller::-webkit-scrollbar { display: none; }

.pmfc__tabList {
  align-items: center;
  display: flex;
  height: 100%;
  min-width: max-content;
  position: relative;
}

.pmfc__tab {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 1px solid transparent;
  border-bottom: 0;
  color: var(--pmfc-text-low);
  cursor: pointer;
  display: flex;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 500;
  line-height: 19px;
  height: 34px;
  justify-content: center;
  letter-spacing: 0;
  margin: 0;
  padding: 9px 20px 11px 12px;
  position: relative;
  text-align: left;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.pmfc__tab.has-separator::after {
  background: rgba(20, 17, 17, 0.08);
  content: "";
  height: 16px;
  pointer-events: none;
  position: absolute;
  right: 0;
  top: 9px;
  width: 1px;
}

.pmfc__tab.is-active {
  background: var(--pmfc-surface);
  border-color: var(--pmfc-border-subtle);
  color: var(--pmfc-text-high);
}

.pmfc__tab:focus-visible {
  outline: 2px solid rgba(254, 83, 29, 0.45);
  outline-offset: -2px;
}

.pmfc__dot {
  background: transparent;
  border-radius: 999px;
  display: block;
  flex: 0 0 0;
  height: 6px;
  margin-right: 0;
  min-width: 0;
  transition: flex-basis 180ms ease, margin-right 180ms ease, min-width 180ms ease, width 180ms ease;
  visibility: hidden;
  width: 0;
}

.pmfc__tab.is-active .pmfc__dot {
  background: var(--pmfc-accent);
  flex: 0 0 6px;
  margin-right: 12px;
  min-width: 6px;
  visibility: visible;
  width: 6px;
}

.pmfc__tabLabel {
  display: block;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pmfc__panelFrame {
  background: var(--pmfc-surface);
  border: 1px solid var(--pmfc-border-subtle);
  border-bottom: 0;
  box-shadow: 0 1px 3px rgba(20, 17, 17, 0.03);
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  position: relative;
  width: 100%;
  z-index: 1;
}

.pmfc__panel {
  background: var(--pmfc-surface);
  inset: 0;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  transition: opacity 220ms ease, visibility 0ms linear 220ms;
  visibility: hidden;
}

.pmfc__panel.is-active {
  opacity: 1;
  pointer-events: auto;
  transition: opacity 260ms ease 40ms, visibility 0ms linear 0ms;
  visibility: visible;
}

.pmfc__formPanel {
  height: 100%;
  overflow: hidden;
  width: 100%;
}

.pmfc__formContent {
  align-content: start;
  display: grid;
  gap: 20px;
  height: 100%;
  overflow: hidden;
  padding: 16px;
  width: 100%;
}

.pmfc__formGrid {
  display: grid;
  gap: 20px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.pmfc__divider {
  background: rgba(20, 17, 17, 0.1);
  height: 1px;
  width: 100%;
}

.pmfc__formStack {
  display: grid;
  gap: 16px;
  min-width: 0;
  width: 100%;
}

.pmfc__field {
  color: var(--pmfc-text-high);
  display: grid;
  gap: 6px;
  min-width: 0;
}

.pmfc__label,
.pmfc__rangeLabel {
  color: #262626;
  font-size: 13px;
  font-weight: 500;
  line-height: 19px;
  letter-spacing: 0;
}

.pmfc__label {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  justify-self: start;
  min-width: 0;
  position: relative;
}

.pmfc__tooltipWrap {
  display: inline-flex;
  line-height: 1;
}

.pmfc__tooltipTrigger {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 1.5px solid currentColor;
  border-radius: 999px;
  color: #211f1e;
  cursor: help;
  display: inline-flex;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  height: 15px;
  justify-content: center;
  margin: 0;
  padding: 0;
  width: 15px;
}

.pmfc__tooltipTrigger:focus-visible {
  outline: 2px solid rgba(254, 83, 29, 0.45);
  outline-offset: 2px;
}

.pmfc__tooltipBubble {
  background: #ffffff;
  border: 1px solid rgba(10, 10, 10, 0.1);
  border-radius: 5px;
  box-shadow: 0 10px 24px rgba(10, 10, 10, 0.12), 0 3px 8px rgba(10, 10, 10, 0.08);
  color: var(--pmfc-text-high);
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  left: 0;
  letter-spacing: 0;
  max-width: min(280px, calc(100vw - 32px));
  opacity: 0;
  overflow-wrap: anywhere;
  padding: 10px 12px;
  pointer-events: none;
  position: absolute;
  text-align: left;
  top: calc(100% + 7px);
  transform: translateY(-2px);
  transition: opacity 140ms ease, transform 140ms ease, visibility 0ms linear 140ms;
  visibility: hidden;
  white-space: normal;
  width: max-content;
  z-index: 50;
}

.pmfc__tooltipBubble code {
  background: rgba(20, 17, 17, 0.06);
  border-radius: 3px;
  font-family: var(--pmfc-mono);
  font-size: 12px;
  padding: 1px 4px;
}

.pmfc__tooltipWrap:hover .pmfc__tooltipBubble,
.pmfc__tooltipTrigger:focus-visible + .pmfc__tooltipBubble {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0ms;
  visibility: visible;
}

.pmfc__rangeLabel {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  width: 100%;
}

.pmfc__rangeLabel span:last-child {
  color: var(--pmfc-text-low);
  white-space: nowrap;
}

.pmfc__select {
  position: relative;
}

.pmfc__select::after {
  border-bottom: 2px solid #211f1e;
  border-right: 2px solid #211f1e;
  content: "";
  height: 7px;
  pointer-events: none;
  position: absolute;
  right: 14px;
  top: 21px;
  transform: translateY(-65%) rotate(45deg);
  width: 7px;
}

.pmfc__selectTrigger,
.pmfc__textDisplay {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid var(--pmfc-control-border);
  border-radius: 4px;
  box-shadow: 0 1px 1px rgba(10, 10, 10, 0.03);
  color: var(--pmfc-text-high);
  font-size: 13px;
  font-weight: 400;
  line-height: 19px;
  letter-spacing: 0;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.pmfc__selectTrigger {
  align-items: center;
  appearance: none;
  cursor: pointer;
  display: flex;
  height: 42px;
  justify-content: space-between;
  padding: 10px 40px 10px 10px;
  text-align: left;
  width: 100%;
}

.pmfc__selectTrigger span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pmfc__selectTrigger:hover,
.pmfc__selectTrigger:focus-visible,
.pmfc__textDisplay:hover {
  border-color: rgba(10, 10, 10, 0.18);
}

.pmfc__selectTrigger:focus-visible {
  outline: none;
}

.pmfc__selectMenu {
  background: #ffffff;
  border: 1px solid rgba(10, 10, 10, 0.1);
  border-radius: 6px;
  box-shadow: 0 14px 28px rgba(10, 10, 10, 0.1), 0 4px 10px rgba(10, 10, 10, 0.06);
  display: grid;
  gap: 2px;
  left: 0;
  max-height: 190px;
  overflow-y: auto;
  padding: 4px;
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
}

.pmfc__selectOption {
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: var(--pmfc-text-high);
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  line-height: 19px;
  min-height: 34px;
  padding: 8px 10px;
  text-align: left;
  transition: background-color 120ms ease, color 120ms ease;
  width: 100%;
}

.pmfc__selectOption:hover,
.pmfc__selectOption:focus-visible {
  background: rgba(20, 17, 17, 0.06);
  outline: none;
}

.pmfc__selectOption.is-selected {
  background: rgba(20, 17, 17, 0.08);
  color: var(--pmfc-text-high);
  font-weight: 500;
}

.pmfc__selectOption.is-selected:hover,
.pmfc__selectOption.is-selected:focus-visible {
  background: rgba(20, 17, 17, 0.1);
}

.pmfc__range {
  --pmfc-range-progress: 66%;
  appearance: none;
  background: linear-gradient(to right, var(--pmfc-accent) 0 var(--pmfc-range-progress), rgba(20, 17, 17, 0.1) var(--pmfc-range-progress) 100%);
  border-radius: 999px;
  cursor: pointer;
  height: 6px;
  margin: 16px 0 13px;
  width: 100%;
}

.pmfc__range:focus-visible {
  outline: 2px solid rgba(254, 83, 29, 0.45);
  outline-offset: 6px;
}

.pmfc__range::-webkit-slider-thumb {
  appearance: none;
  background: #ffffff;
  border: 1.333px solid var(--pmfc-accent);
  border-radius: 999px;
  box-shadow: 0 2.667px 4px -0.667px rgba(10, 13, 18, 0.1), 0 1.333px 2.667px -1.333px rgba(10, 13, 18, 0.06);
  height: 18px;
  width: 18px;
}

.pmfc__range::-moz-range-thumb {
  background: #ffffff;
  border: 1.333px solid var(--pmfc-accent);
  border-radius: 999px;
  box-shadow: 0 2.667px 4px -0.667px rgba(10, 13, 18, 0.1), 0 1.333px 2.667px -1.333px rgba(10, 13, 18, 0.06);
  height: 18px;
  width: 18px;
}

.pmfc__variableButton {
  align-items: center;
  appearance: none;
  background: transparent;
  border: 0;
  border-radius: 4px;
  color: #0a0a0a;
  cursor: pointer;
  display: inline-flex;
  font-size: 13px;
  font-weight: 500;
  line-height: 19px;
  gap: 7px;
  justify-self: start;
  margin: 0;
  padding: 0;
  transition: color 160ms ease;
}

.pmfc__variableButton:hover,
.pmfc__variableButton:focus-visible {
  color: var(--pmfc-accent);
  outline: none;
}

.pmfc__variableIcon {
  font: 600 12px / 1 var(--pmfc-mono);
}

.pmfc__variableButton kbd {
  align-items: center;
  background: #f5f5f5;
  border: 1px solid rgba(10, 10, 10, 0.07);
  border-radius: 2px;
  box-shadow: 0 1px 1px rgba(10, 10, 10, 0.03);
  color: rgba(10, 10, 10, 0.4);
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  height: 16px;
  justify-content: center;
  min-width: 16px;
  padding: 0 4px;
}

.pmfc__textDisplay {
  align-items: center;
  display: flex;
  min-height: 42px;
  overflow: hidden;
  padding: 10px;
  width: 100%;
}

.pmfc__textDisplay--system {
  align-items: flex-start;
  height: 118px;
  padding: 14px 12px;
}

.pmfc__systemText {
  background: linear-gradient(174deg, #211f1e 16%, #fe531d 35%, #ff9f38 48%, #fcc08f 64%, rgba(252, 192, 143, 0) 92%);
  background-clip: text;
  color: transparent;
  font-size: 13px;
  font-weight: 400;
  line-height: 19px;
  margin: 0;
  max-height: 100%;
  max-width: 100%;
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 30px), transparent 100%);
  overflow: hidden;
  -webkit-background-clip: text;
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - 30px), transparent 100%);
  -webkit-text-fill-color: transparent;
}

.pmfc__promptVariable {
  align-items: center;
  background: #fed8cd;
  border: 1px solid rgba(10, 10, 10, 0.1);
  border-radius: 2px;
  color: var(--pmfc-accent);
  display: inline-flex;
  font-size: 11px;
  font-weight: 500;
  line-height: 13px;
  gap: 4px;
  margin: 0 4px;
  padding: 2px 6px;
  vertical-align: 1px;
  -webkit-text-fill-color: var(--pmfc-accent);
}

.pmfc__promptVariableIcon {
  background: linear-gradient(var(--pmfc-accent), var(--pmfc-accent)) 1px 2px / 8px 1.5px no-repeat, linear-gradient(var(--pmfc-accent), var(--pmfc-accent)) 3px 5px / 6px 1.5px no-repeat, linear-gradient(var(--pmfc-accent), var(--pmfc-accent)) 1px 8px / 8px 1.5px no-repeat;
  display: inline-block;
  height: 11px;
  width: 11px;
}

.pmfc__codePanel {
  height: 100%;
  overflow: hidden;
  padding: 0;
  width: 100%;
}

.pmfc__codeShell {
  align-items: start;
  background: #ffffff;
  color: #2e383c;
  display: grid;
  font: 500 12px / 17px var(--pmfc-mono);
  gap: 20px;
  grid-template-columns: auto minmax(0, 1fr);
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 10px;
  position: relative;
  scrollbar-color: rgba(20, 17, 17, 0.22) transparent;
  scrollbar-width: thin;
  white-space: nowrap;
  width: 100%;
}

.pmfc__codeShell::-webkit-scrollbar,
.pmfc__codeScroller::-webkit-scrollbar {
  height: 8px;
  width: 8px;
}

.pmfc__codeShell::-webkit-scrollbar-thumb,
.pmfc__codeScroller::-webkit-scrollbar-thumb {
  background: rgba(20, 17, 17, 0.22);
  border-radius: 999px;
}

.pmfc__codeShell::-webkit-scrollbar-track,
.pmfc__codeScroller::-webkit-scrollbar-track { background: transparent; }

.pmfc__lineNumbers {
  align-items: flex-end;
  background: #ffffff;
  color: #e0e2e5;
  display: flex;
  flex-direction: column;
  font: 500 12px / 17px var(--pmfc-mono);
  min-width: 24px;
  position: sticky;
  left: 0;
  text-align: right;
  user-select: none;
  z-index: 2;
}

.pmfc__lineNumbers span {
  display: block;
  height: 17px;
  line-height: 17px;
}

.pmfc__codeScroller {
  min-width: 0;
  overflow-x: auto;
  overflow-y: visible;
  padding-bottom: 8px;
}

.pmfc__codeLine {
  display: block;
  height: 17px;
  line-height: 17px;
  white-space: pre;
}

.pmfc__tokKeyword { color: #fe531d; }
.pmfc__tokString { color: #1da0fe; }
.pmfc__tokNumber { color: #ba1dfe; }
.pmfc__tokIdent { color: #428a7b; }
.pmfc__tokComment { color: #9ca3a8; }
.pmfc__tokBase { color: #2e383c; }

@media (max-width: 767px) {
  .pmfc__toolbar { padding-left: 0; padding-right: 8px; }
  .pmfc__windowButtons { display: none; }
  .pmfc__tab { padding-left: 12px; padding-right: 20px; }
  .pmfc__formContent { gap: 20px; padding: 16px; }
  .pmfc__desktopOnly { display: none; }
  .pmfc__formGrid { gap: 20px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pmfc__selectTrigger,
  .pmfc__textDisplay { height: 42px; }
  .pmfc__textDisplay--system { height: 164px; }
}

@media (prefers-reduced-motion: reduce) {
  .pmfc__dot,
  .pmfc__panel,
  .pmfc__tab { transition: none; }
  .pmfc__tabScroller { scroll-behavior: auto; }
}
`;

const webhooksCode = `import { Hono } from "hono";
import { Webhook } from "svix";

const app = new Hono();

app.post("/webhooks/phonic", async (c) => {
  if (!process.env.PHONIC_WEBHOOK_SECRET) {
    return c.text("Bad Request", 400);
  }

  const wh = new Webhook(process.env.PHONIC_WEBHOOK_SECRET);
  const rawBody = await c.req.text();

  try {
    const payload = wh.verify(rawBody, {
      "svix-id": c.req.header("svix-id") ?? "",
      "svix-timestamp": c.req.header("svix-timestamp") ?? "",
      "svix-signature": c.req.header("svix-signature") ?? "",
    });

    console.log(JSON.stringify(payload, null, 2));

    return c.text("OK", 200);
  } catch (error) {
    console.error("Failed to verify webhook:", error);

    return c.text("Bad Request", 400);
  }
});

export default app;`;

const webSocketCode = `// Also available in Phython

import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import type { WSContext } from "hono/ws";
import { PhonicClient } from "phonic";
import { phonicApiKey } from "./env-vars";

const app = new Hono();
const phonicClient = new PhonicClient({
  apiKey: phonicApiKey,
});

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  "/ws",
  upgradeWebSocket(() => {
    let phonicSocket: Awaited<
      ReturnType<typeof phonicClient.conversations.connect>
    > | null = null;
    let streamSid: string | null = null;

    const sendToTwilio = (ws: WSContext, data: unknown) => {
      ws.send(JSON.stringify(data));
    };

    return {
      async onOpen(_, ws) {
        phonicSocket = await phonicClient.conversations.connect();

        phonicSocket.on("message", (message) => {
          if (streamSid && message.type === "audio_chunk") {
            sendToTwilio(ws, {
              event: "media",
              streamSid: streamSid,
              media: {
                payload: message.audio,
              },
            });
          }
        });
      },
    };
  }),
);`;

const liveKitCode = `# Also available in Phython

import asyncio
import logging

from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    cli,
    function_tool,
)
from livekit.plugins.phonic.realtime import RealtimeModel

logger = logging.getLogger("phonic-agent")

load_dotenv()


class MyAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="You are a helpful voice AI assistant named Sabrina.",
            llm=RealtimeModel(
                voice="sabrina",
                audio_speed=1.2,
            ),
        )

    @function_tool(
        description="Toggle a light on or off. Available lights are A05, A06, A07, and A08."
    )
    async def toggle_light(self, light_id: str, state: str) -> str:
        """Called when the user asks to toggle a light on or off.

        Args:
            light_id: The ID of the light to toggle
            state: The requested state
        """
        logger.info("Toggling %s to %s", light_id, state)
        return f"{light_id} is now {state}"`;

const tabs: Tab[] = [
  { id: 'no-code', label: 'No code', type: 'form' },
  {
    id: 'webhooks',
    label: 'Webhooks',
    type: 'code',
    language: 'typescript',
    code: webhooksCode,
  },
  {
    id: 'websocket',
    label: 'WebSocket',
    type: 'code',
    language: 'typescript',
    code: webSocketCode,
  },
  {
    id: 'livekit',
    label: 'LiveKit',
    type: 'code',
    language: 'python',
    code: liveKitCode,
  },
];

const phoneNumberOptions = [
  'Assign automatically',
  '+1 (415) 555-0134',
  '+1 (646) 555-0198',
  '+1 (212) 555-0147',
  '+1 (312) 555-0173',
  '+44 20 7946 0958',
  '+61 2 8015 6002',
];

const timezoneOptions = `(GMT-11) Pacific/Midway
(GMT-11) Pacific/Niue
(GMT-11) Pacific/Pago Pago
(GMT-10) Pacific/Honolulu
(GMT-10) Pacific/Rarotonga
(GMT-10) Pacific/Tahiti
(GMT-9) America/Adak
(GMT-9) Pacific/Gambier
(GMT-9:30) Pacific/Marquesas
(GMT-8) America/Anchorage
(GMT-8) America/Juneau
(GMT-8) America/Metlakatla
(GMT-8) America/Nome
(GMT-8) America/Sitka
(GMT-8) America/Yakutat
(GMT-8) Pacific/Pitcairn
(GMT-7) America/Creston
(GMT-7) America/Dawson
(GMT-7) America/Dawson Creek
(GMT-7) America/Fort Nelson
(GMT-7) America/Hermosillo
(GMT-7) America/Los Angeles
(GMT-7) America/Mazatlan
(GMT-7) America/Phoenix
(GMT-7) America/Tijuana
(GMT-7) America/Vancouver
(GMT-7) America/Whitehorse
(GMT-6) America/Bahia Banderas
(GMT-6) America/Belize
(GMT-6) America/Boise
(GMT-6) America/Cambridge Bay
(GMT-6) America/Chihuahua
(GMT-6) America/Ciudad Juarez
(GMT-6) America/Costa Rica
(GMT-6) America/Denver
(GMT-6) America/Edmonton
(GMT-6) America/El Salvador
(GMT-6) America/Guatemala
(GMT-6) America/Inuvik
(GMT-6) America/Managua
(GMT-6) America/Merida
(GMT-6) America/Mexico City
(GMT-6) America/Monterrey
(GMT-6) America/Regina
(GMT-6) America/Swift Current
(GMT-6) America/Tegucigalpa
(GMT-6) Pacific/Easter
(GMT-6) Pacific/Galapagos
(GMT-5) America/Bogota
(GMT-5) America/Cancun
(GMT-5) America/Cayman
(GMT-5) America/Chicago
(GMT-5) America/Coral Harbour
(GMT-5) America/Eirunepe
(GMT-5) America/Guayaquil
(GMT-5) America/Indiana/Knox
(GMT-5) America/Indiana/Tell City
(GMT-5) America/Jamaica
(GMT-5) America/Lima
(GMT-5) America/Matamoros
(GMT-5) America/Menominee
(GMT-5) America/North Dakota/Beulah
(GMT-5) America/North Dakota/Center
(GMT-5) America/North Dakota/New Salem
(GMT-5) America/Ojinaga
(GMT-5) America/Panama
(GMT-5) America/Rankin Inlet
(GMT-5) America/Resolute
(GMT-5) America/Rio Branco
(GMT-5) America/Winnipeg
(GMT-4) America/Anguilla
(GMT-4) America/Antigua
(GMT-4) America/Aruba
(GMT-4) America/Barbados
(GMT-4) America/Blanc-Sablon
(GMT-4) America/Boa Vista
(GMT-4) America/Campo Grande
(GMT-4) America/Caracas
(GMT-4) America/Cuiaba
(GMT-4) America/Curacao
(GMT-4) America/Detroit
(GMT-4) America/Dominica
(GMT-4) America/Grand Turk
(GMT-4) America/Grenada
(GMT-4) America/Guadeloupe
(GMT-4) America/Guyana
(GMT-4) America/Havana
(GMT-4) America/Indiana/Marengo
(GMT-4) America/Indiana/Petersburg
(GMT-4) America/Indiana/Vevay
(GMT-4) America/Indiana/Vincennes
(GMT-4) America/Indiana/Winamac
(GMT-4) America/Indianapolis
(GMT-4) America/Iqaluit
(GMT-4) America/Kentucky/Monticello
(GMT-4) America/Kralendijk
(GMT-4) America/La Paz
(GMT-4) America/Louisville
(GMT-4) America/Lower Princes
(GMT-4) America/Manaus
(GMT-4) America/Marigot
(GMT-4) America/Martinique
(GMT-4) America/Montserrat
(GMT-4) America/Nassau
(GMT-4) America/New York
(GMT-4) America/Port-au-Prince
(GMT-4) America/Port of Spain
(GMT-4) America/Porto Velho
(GMT-4) America/Puerto Rico
(GMT-4) America/Santiago
(GMT-4) America/Santo Domingo
(GMT-4) America/St Barthelemy
(GMT-4) America/St Kitts
(GMT-4) America/St Lucia
(GMT-4) America/St Thomas
(GMT-4) America/St Vincent
(GMT-4) America/Toronto
(GMT-4) America/Tortola
(GMT-3) America/Araguaina
(GMT-3) America/Argentina/La Rioja
(GMT-3) America/Argentina/Rio Gallegos
(GMT-3) America/Argentina/Salta
(GMT-3) America/Argentina/San Juan
(GMT-3) America/Argentina/San Luis
(GMT-3) America/Argentina/Tucuman
(GMT-3) America/Argentina/Ushuaia
(GMT-3) America/Asuncion
(GMT-3) America/Bahia
(GMT-3) America/Belem
(GMT-3) America/Buenos Aires
(GMT-3) America/Catamarca
(GMT-3) America/Cayenne
(GMT-3) America/Cordoba
(GMT-3) America/Fortaleza
(GMT-3) America/Glace Bay
(GMT-3) America/Goose Bay
(GMT-3) America/Halifax
(GMT-3) America/Jujuy
(GMT-3) America/Maceio
(GMT-3) America/Mendoza
(GMT-3) America/Moncton
(GMT-3) America/Montevideo
(GMT-3) America/Paramaribo
(GMT-3) America/Punta Arenas
(GMT-3) America/Recife
(GMT-3) America/Santarem
(GMT-3) America/Sao Paulo
(GMT-3) America/Thule
(GMT-3) Antarctica/Palmer
(GMT-3) Antarctica/Rothera
(GMT-3) Atlantic/Bermuda
(GMT-3) Atlantic/Stanley
(GMT-2) America/Miquelon
(GMT-2) America/Noronha
(GMT-2) Atlantic/South Georgia
(GMT-2:30) America/St Johns
(GMT-1) America/Godthab
(GMT-1) America/Scoresbysund
(GMT-1) Atlantic/Cape Verde
(GMT+0) Africa/Abidjan
(GMT+0) Africa/Accra
(GMT+0) Africa/Bamako
(GMT+0) Africa/Banjul
(GMT+0) Africa/Bissau
(GMT+0) Africa/Conakry
(GMT+0) Africa/Dakar
(GMT+0) Africa/Freetown
(GMT+0) Africa/Lome
(GMT+0) Africa/Monrovia
(GMT+0) Africa/Nouakchott
(GMT+0) Africa/Ouagadougou
(GMT+0) Africa/Sao Tome
(GMT+0) America/Danmarkshavn
(GMT+0) Atlantic/Azores
(GMT+0) Atlantic/Reykjavik
(GMT+0) Atlantic/St Helena
(GMT+0) UTC
(GMT+1) Africa/Algiers
(GMT+1) Africa/Bangui
(GMT+1) Africa/Brazzaville
(GMT+1) Africa/Casablanca
(GMT+1) Africa/Douala
(GMT+1) Africa/El Aaiun
(GMT+1) Africa/Kinshasa
(GMT+1) Africa/Lagos
(GMT+1) Africa/Libreville
(GMT+1) Africa/Luanda
(GMT+1) Africa/Malabo
(GMT+1) Africa/Ndjamena
(GMT+1) Africa/Niamey
(GMT+1) Africa/Porto-Novo
(GMT+1) Africa/Tunis
(GMT+1) Atlantic/Canary
(GMT+1) Atlantic/Faeroe
(GMT+1) Atlantic/Madeira
(GMT+1) Europe/Dublin
(GMT+1) Europe/Guernsey
(GMT+1) Europe/Isle of Man
(GMT+1) Europe/Jersey
(GMT+1) Europe/Lisbon
(GMT+1) Europe/London
(GMT+2) Africa/Blantyre
(GMT+2) Africa/Bujumbura
(GMT+2) Africa/Ceuta
(GMT+2) Africa/Gaborone
(GMT+2) Africa/Harare
(GMT+2) Africa/Johannesburg
(GMT+2) Africa/Juba
(GMT+2) Africa/Khartoum
(GMT+2) Africa/Kigali
(GMT+2) Africa/Lubumbashi
(GMT+2) Africa/Lusaka
(GMT+2) Africa/Maputo
(GMT+2) Africa/Maseru
(GMT+2) Africa/Mbabane
(GMT+2) Africa/Tripoli
(GMT+2) Africa/Windhoek
(GMT+2) Antarctica/Troll
(GMT+2) Arctic/Longyearbyen
(GMT+2) Europe/Amsterdam
(GMT+2) Europe/Andorra
(GMT+2) Europe/Belgrade
(GMT+2) Europe/Berlin
(GMT+2) Europe/Bratislava
(GMT+2) Europe/Brussels
(GMT+2) Europe/Budapest
(GMT+2) Europe/Busingen
(GMT+2) Europe/Copenhagen
(GMT+2) Europe/Gibraltar
(GMT+2) Europe/Kaliningrad
(GMT+2) Europe/Ljubljana
(GMT+2) Europe/Luxembourg
(GMT+2) Europe/Madrid
(GMT+2) Europe/Malta
(GMT+2) Europe/Monaco
(GMT+2) Europe/Oslo
(GMT+2) Europe/Paris
(GMT+2) Europe/Podgorica
(GMT+2) Europe/Prague
(GMT+2) Europe/Rome
(GMT+2) Europe/San Marino
(GMT+2) Europe/Sarajevo
(GMT+2) Europe/Skopje
(GMT+2) Europe/Stockholm
(GMT+2) Europe/Tirane
(GMT+2) Europe/Vaduz
(GMT+2) Europe/Vatican
(GMT+2) Europe/Vienna
(GMT+2) Europe/Warsaw
(GMT+2) Europe/Zagreb
(GMT+2) Europe/Zurich
(GMT+3) Africa/Addis Ababa
(GMT+3) Africa/Asmera
(GMT+3) Africa/Cairo
(GMT+3) Africa/Dar es Salaam
(GMT+3) Africa/Djibouti
(GMT+3) Africa/Kampala
(GMT+3) Africa/Mogadishu
(GMT+3) Africa/Nairobi
(GMT+3) Antarctica/Syowa
(GMT+3) Asia/Aden
(GMT+3) Asia/Amman
(GMT+3) Asia/Baghdad
(GMT+3) Asia/Bahrain
(GMT+3) Asia/Beirut
(GMT+3) Asia/Damascus
(GMT+3) Asia/Famagusta
(GMT+3) Asia/Gaza
(GMT+3) Asia/Hebron
(GMT+3) Asia/Jerusalem
(GMT+3) Asia/Kuwait
(GMT+3) Asia/Nicosia
(GMT+3) Asia/Qatar
(GMT+3) Asia/Riyadh
(GMT+3) Europe/Athens
(GMT+3) Europe/Bucharest
(GMT+3) Europe/Chisinau
(GMT+3) Europe/Helsinki
(GMT+3) Europe/Istanbul
(GMT+3) Europe/Kiev
(GMT+3) Europe/Kirov
(GMT+3) Europe/Mariehamn
(GMT+3) Europe/Minsk
(GMT+3) Europe/Moscow
(GMT+3) Europe/Riga
(GMT+3) Europe/Simferopol
(GMT+3) Europe/Sofia
(GMT+3) Europe/Tallinn
(GMT+3) Europe/Vilnius
(GMT+3) Europe/Volgograd
(GMT+3) Indian/Antananarivo
(GMT+3) Indian/Comoro
(GMT+3) Indian/Mayotte
(GMT+3:30) Asia/Tehran
(GMT+4) Asia/Baku
(GMT+4) Asia/Dubai
(GMT+4) Asia/Muscat
(GMT+4) Asia/Tbilisi
(GMT+4) Asia/Yerevan
(GMT+4) Europe/Astrakhan
(GMT+4) Europe/Samara
(GMT+4) Europe/Saratov
(GMT+4) Europe/Ulyanovsk
(GMT+4) Indian/Mahe
(GMT+4) Indian/Mauritius
(GMT+4) Indian/Reunion
(GMT+4:30) Asia/Kabul
(GMT+5) Antarctica/Mawson
(GMT+5) Antarctica/Vostok
(GMT+5) Asia/Almaty
(GMT+5) Asia/Aqtau
(GMT+5) Asia/Aqtobe
(GMT+5) Asia/Ashgabat
(GMT+5) Asia/Atyrau
(GMT+5) Asia/Dushanbe
(GMT+5) Asia/Karachi
(GMT+5) Asia/Oral
(GMT+5) Asia/Qostanay
(GMT+5) Asia/Qyzylorda
(GMT+5) Asia/Samarkand
(GMT+5) Asia/Tashkent
(GMT+5) Asia/Yekaterinburg
(GMT+5) Indian/Kerguelen
(GMT+5) Indian/Maldives
(GMT+5:30) Asia/Calcutta
(GMT+5:30) Asia/Colombo
(GMT+5:45) Asia/Katmandu
(GMT+6) Asia/Bishkek
(GMT+6) Asia/Dhaka
(GMT+6) Asia/Omsk
(GMT+6) Asia/Thimphu
(GMT+6) Asia/Urumqi
(GMT+6) Indian/Chagos
(GMT+6:30) Asia/Rangoon
(GMT+6:30) Indian/Cocos
(GMT+7) Antarctica/Davis
(GMT+7) Asia/Bangkok
(GMT+7) Asia/Barnaul
(GMT+7) Asia/Hovd
(GMT+7) Asia/Jakarta
(GMT+7) Asia/Krasnoyarsk
(GMT+7) Asia/Novokuznetsk
(GMT+7) Asia/Novosibirsk
(GMT+7) Asia/Phnom Penh
(GMT+7) Asia/Pontianak
(GMT+7) Asia/Saigon
(GMT+7) Asia/Tomsk
(GMT+7) Asia/Vientiane
(GMT+7) Indian/Christmas
(GMT+8) Antarctica/Casey
(GMT+8) Asia/Brunei
(GMT+8) Asia/Hong Kong
(GMT+8) Asia/Irkutsk
(GMT+8) Asia/Kuala Lumpur
(GMT+8) Asia/Kuching
(GMT+8) Asia/Macau
(GMT+8) Asia/Makassar
(GMT+8) Asia/Manila
(GMT+8) Asia/Shanghai
(GMT+8) Asia/Singapore
(GMT+8) Asia/Taipei
(GMT+8) Asia/Ulaanbaatar
(GMT+8) Australia/Perth
(GMT+8:45) Australia/Eucla
(GMT+9) Asia/Chita
(GMT+9) Asia/Dili
(GMT+9) Asia/Jayapura
(GMT+9) Asia/Khandyga
(GMT+9) Asia/Pyongyang
(GMT+9) Asia/Seoul
(GMT+9) Asia/Tokyo
(GMT+9) Asia/Yakutsk
(GMT+9) Pacific/Palau
(GMT+9:30) Australia/Adelaide
(GMT+9:30) Australia/Broken Hill
(GMT+9:30) Australia/Darwin
(GMT+10) Antarctica/DumontDUrville
(GMT+10) Antarctica/Macquarie
(GMT+10) Asia/Ust-Nera
(GMT+10) Asia/Vladivostok
(GMT+10) Australia/Brisbane
(GMT+10) Australia/Hobart
(GMT+10) Australia/Lindeman
(GMT+10) Australia/Melbourne
(GMT+10) Australia/Sydney
(GMT+10) Pacific/Guam
(GMT+10) Pacific/Port Moresby
(GMT+10) Pacific/Saipan
(GMT+10) Pacific/Truk
(GMT+10:30) Australia/Lord Howe
(GMT+11) Asia/Magadan
(GMT+11) Asia/Sakhalin
(GMT+11) Asia/Srednekolymsk
(GMT+11) Pacific/Bougainville
(GMT+11) Pacific/Efate
(GMT+11) Pacific/Guadalcanal
(GMT+11) Pacific/Kosrae
(GMT+11) Pacific/Norfolk
(GMT+11) Pacific/Noumea
(GMT+11) Pacific/Ponape
(GMT+12) Antarctica/McMurdo
(GMT+12) Asia/Anadyr
(GMT+12) Asia/Kamchatka
(GMT+12) Pacific/Auckland
(GMT+12) Pacific/Fiji
(GMT+12) Pacific/Funafuti
(GMT+12) Pacific/Kwajalein
(GMT+12) Pacific/Majuro
(GMT+12) Pacific/Nauru
(GMT+12) Pacific/Tarawa
(GMT+12) Pacific/Wake
(GMT+12) Pacific/Wallis
(GMT+12:45) Pacific/Chatham
(GMT+13) Pacific/Apia
(GMT+13) Pacific/Enderbury
(GMT+13) Pacific/Fakaofo
(GMT+13) Pacific/Tongatapu
(GMT+14) Pacific/Kiritimati`
  .trim()
  .split('\n');

const backgroundNoiseOptions = ['None', 'Office', 'Call Center', 'Coffee Shop'];

const selectFields = {
  phoneNumber: {
    label: 'Phone number',
    value: 'Assign automatically',
    options: phoneNumberOptions,
    tooltip:
      'Used to accept phone calls. Agents without a phone number can be used via WebSockets.',
  },
  timezone: {
    label: 'Timezone',
    value: '(GMT-7) America/Los Angeles',
    options: timezoneOptions,
    tooltip: (
      <>
        Used to format system variables like <code>{'{{system_time}}'}</code>. To set the timezone
        per conversation, override <code>system_conversation_timezone</code> in template variables.
      </>
    ),
  },
  voice: {
    label: 'Voice',
    value: 'Sabrina',
    options: ['Sabrina', 'Grant', 'Virginia', 'Eleanor', 'Landon', 'Nolan', 'Shelby', 'Sandeep'],
  },
  backgroundNoise: {
    label: 'Background noise',
    value: 'Office',
    options: backgroundNoiseOptions,
  },
  audioFormat: {
    label: 'Audio format',
    value: 'pcm_44100',
    options: ['pcm_44100', 'pcm_24000', 'mulaw_8000'],
  },
} satisfies Record<string, SelectField>;

const audioSpeedField: SliderField = {
  label: 'Audio speed',
  value: 1.2,
  min: 0.5,
  max: 1.5,
  step: 0.1,
};

const systemPrompt =
  "You are a conversational AI voice agent handling live customer support calls for a delivery company. Your goal is to resolve issues clearly while demonstrating empathy, emotional awareness, and calm confidence, especially when the customer is frustrated or stressed.\n\nDemonstrate empathy explicitly. Acknowledge the customer's feelings before moving to problem solving. Avoid sounding robotic or rushed. Reassure them that you are here to help.";

export function PhonicMixedFormCodeTabs() {
  const reactId = useId();
  const rootId = useMemo(() => sanitizeId(`pmfc-${reactId}`), [reactId]);
  const rootRef = useRef<HTMLElement | null>(null);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTabId(tab.id);
      queueRootTabClusterScroll(rootRef.current, getTabId(rootId, tab.id));
    },
    [rootId],
  );

  return (
    <section className="pmfc" ref={rootRef} data-component="phonic-mixed-form-code-tabs">
      <style>{styles}</style>

      <div className="pmfc__toolbar">
        <div className="pmfc__windowButtons" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="pmfc__tabScroller">
          <div className="pmfc__tabList" role="tablist" aria-label="Phonic examples">
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTab.id;
              const nextTab = tabs[index + 1];

              return (
                <button
                  key={tab.id}
                  id={getTabId(rootId, tab.id)}
                  className={[
                    'pmfc__tab',
                    isActive ? 'is-active' : '',
                    !isActive && nextTab?.id !== activeTab.id && index < tabs.length - 1
                      ? 'has-separator'
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={getPanelId(rootId, tab.id)}
                  onClick={() => handleTabClick(tab)}
                >
                  <span className="pmfc__dot" aria-hidden="true" />
                  <span className="pmfc__tabLabel">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pmfc__panelFrame">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab.id;

          return (
            <div
              key={tab.id}
              id={getPanelId(rootId, tab.id)}
              className={['pmfc__panel', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
              role="tabpanel"
              aria-labelledby={getTabId(rootId, tab.id)}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
            >
              {tab.type === 'form' ? (
                <FormPanel />
              ) : (
                <CodePanel code={tab.code ?? ''} language={tab.language ?? 'typescript'} />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FormPanel() {
  const [selectValues, setSelectValues] = useState(() => ({
    phoneNumber: selectFields.phoneNumber.value,
    timezone: selectFields.timezone.value,
    voice: selectFields.voice.value,
    backgroundNoise: selectFields.backgroundNoise.value,
    audioFormat: selectFields.audioFormat.value,
  }));
  const [audioSpeed, setAudioSpeed] = useState(audioSpeedField.value);

  const updateSelect = useCallback((key: keyof typeof selectValues, value: string) => {
    setSelectValues((current) => ({ ...current, [key]: value }));
  }, []);

  return (
    <div className="pmfc__formPanel">
      <div className="pmfc__formContent">
        <div className="pmfc__formGrid pmfc__desktopOnly">
          <SelectControl
            field={selectFields.phoneNumber}
            value={selectValues.phoneNumber}
            onChange={(value) => updateSelect('phoneNumber', value)}
          />
          <SelectControl
            field={selectFields.timezone}
            value={selectValues.timezone}
            onChange={(value) => updateSelect('timezone', value)}
          />
        </div>

        <div className="pmfc__divider pmfc__desktopOnly" />

        <div className="pmfc__formGrid">
          <SelectControl
            field={selectFields.voice}
            value={selectValues.voice}
            onChange={(value) => updateSelect('voice', value)}
          />
          <SelectControl
            field={selectFields.backgroundNoise}
            value={selectValues.backgroundNoise}
            onChange={(value) => updateSelect('backgroundNoise', value)}
          />
          <SelectControl
            field={selectFields.audioFormat}
            value={selectValues.audioFormat}
            onChange={(value) => updateSelect('audioFormat', value)}
          />
          <RangeControl value={audioSpeed} onChange={setAudioSpeed} />
        </div>

        <div className="pmfc__divider" />

        <div className="pmfc__formStack">
          <button className="pmfc__variableButton" type="button">
            <span className="pmfc__variableIcon" aria-hidden="true">
              {'{}'}
            </span>
            <span>Insert Variable</span>
            <kbd>/</kbd>
          </button>

          <div className="pmfc__field">
            <span className="pmfc__label">Welcome message</span>
            <div className="pmfc__textDisplay">Hey there! How can I help you?</div>
          </div>

          <div className="pmfc__field">
            <span className="pmfc__label">System prompt</span>
            <div className="pmfc__textDisplay pmfc__textDisplay--system">
              <SystemPromptText />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectControl({
  field,
  value,
  onChange,
}: {
  field: SelectField;
  value: string;
  onChange: (value: string) => void;
}) {
  const fieldId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const chooseOption = useCallback(
    (option: string) => {
      onChange(option);
      setIsOpen(false);
    },
    [onChange],
  );

  return (
    <div className="pmfc__field" ref={rootRef}>
      <span className="pmfc__label">
        <span id={`${fieldId}-label`}>{field.label}</span>
        {field.tooltip ? (
          <FieldTooltip id={`${fieldId}-tooltip`} label={field.label}>
            {field.tooltip}
          </FieldTooltip>
        ) : null}
      </span>
      <div className="pmfc__select">
        <button
          className="pmfc__selectTrigger"
          type="button"
          role="combobox"
          aria-controls={`${fieldId}-listbox`}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={`${fieldId}-label`}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span>{value}</span>
        </button>

        {isOpen && (
          <div
            className="pmfc__selectMenu"
            id={`${fieldId}-listbox`}
            role="listbox"
            aria-labelledby={`${fieldId}-label`}
          >
            {field.options.map((option) => {
              const isSelected = option === value;

              return (
                <button
                  key={option}
                  className={['pmfc__selectOption', isSelected ? 'is-selected' : '']
                    .filter(Boolean)
                    .join(' ')}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => chooseOption(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldTooltip({ children, id, label }: { children: ReactNode; id: string; label: string }) {
  return (
    <span className="pmfc__tooltipWrap">
      <button
        className="pmfc__tooltipTrigger"
        type="button"
        aria-describedby={id}
        aria-label={`${label} help`}
      >
        i
      </button>
      <span className="pmfc__tooltipBubble" id={id} role="tooltip">
        {children}
      </span>
    </span>
  );
}

function RangeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const inputId = useId();
  const progress =
    ((value - audioSpeedField.min) /
      Math.max(audioSpeedField.max - audioSpeedField.min, audioSpeedField.step)) *
    100;

  return (
    <label className="pmfc__field" htmlFor={inputId}>
      <span className="pmfc__rangeLabel">
        <span>{audioSpeedField.label}</span>
        <span>{value.toFixed(1)}x</span>
      </span>
      <input
        id={inputId}
        className="pmfc__range"
        type="range"
        min={audioSpeedField.min}
        max={audioSpeedField.max}
        step={audioSpeedField.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ '--pmfc-range-progress': `${progress}%` } as CSSProperties}
      />
    </label>
  );
}

function SystemPromptText() {
  const insertionPoint = 'You are a conversational';

  return (
    <p className="pmfc__systemText">
      {insertionPoint}{' '}
      <span className="pmfc__promptVariable">
        <span className="pmfc__promptVariableIcon" aria-hidden="true" />
        Example variable here
      </span>
      {systemPrompt.slice(insertionPoint.length)}
    </p>
  );
}

function CodePanel({ code, language }: { code: string; language: 'typescript' | 'python' }) {
  const lines = useMemo(() => code.split(/\r\n|\r|\n/), [code]);

  return (
    <div className="pmfc__codePanel">
      <div className="pmfc__codeShell">
        <div className="pmfc__lineNumbers" aria-hidden="true">
          {lines.map((_, index) => (
            <span key={index}>{index + 1}</span>
          ))}
        </div>
        <div className="pmfc__codeScroller">
          {lines.map((line, index) => (
            <span className="pmfc__codeLine" key={`${index}-${line}`}>
              {highlightLine(line, language)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function highlightLine(line: string, language: 'typescript' | 'python') {
  if (/^\s*(\/\/|#)/.test(line)) {
    return <span className="pmfc__tokComment">{line || ' '}</span>;
  }

  const tokenPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|from|const|let|var|new|async|await|return|if|try|catch|export|default|type|class|def|self|None|null|true|false)\b|\b\d+(?:\.\d+)?\b|\b(?:Hono|Webhook|PhonicClient|RealtimeModel|Agent|JSON|console|process)\b)/g;
  const parts: ReactNode[] = [];
  let cursor = 0;

  line.replace(tokenPattern, (match, _token, index: number) => {
    if (index > cursor) {
      parts.push(
        <span className="pmfc__tokBase" key={`${index}-base`}>
          {line.slice(cursor, index)}
        </span>,
      );
    }

    const className = getTokenClassName(match, language);
    parts.push(
      <span className={className} key={`${index}-${match}`}>
        {match}
      </span>,
    );
    cursor = index + match.length;
    return match;
  });

  if (cursor < line.length) {
    parts.push(
      <span className="pmfc__tokBase" key="tail">
        {line.slice(cursor)}
      </span>,
    );
  }

  return parts.length > 0 ? parts : ' ';
}

function getTokenClassName(token: string, language: 'typescript' | 'python') {
  if (/^["'`]/.test(token)) return 'pmfc__tokString';
  if (/^\d/.test(token)) return 'pmfc__tokNumber';

  const keywords =
    language === 'python'
      ? ['import', 'from', 'class', 'def', 'return', 'async', 'await', 'None']
      : [
          'import',
          'from',
          'const',
          'let',
          'var',
          'new',
          'async',
          'await',
          'return',
          'if',
          'try',
          'catch',
          'export',
          'default',
          'type',
          'null',
          'true',
          'false',
        ];

  return keywords.includes(token) ? 'pmfc__tokKeyword' : 'pmfc__tokIdent';
}

function queueRootTabClusterScroll(rootElement: HTMLElement | null, tabElementId: string) {
  window.requestAnimationFrame(() => {
    const activeButton = document.getElementById(tabElementId);

    if (
      rootElement &&
      activeButton instanceof HTMLButtonElement &&
      rootElement.contains(activeButton)
    ) {
      scrollTabClusterIntoView(activeButton);
    }
  });
}

function scrollTabClusterIntoView(activeButton: HTMLButtonElement) {
  const scroller = activeButton.closest<HTMLElement>('.pmfc__tabScroller');
  if (!scroller) return;

  const buttons = Array.from(scroller.querySelectorAll<HTMLButtonElement>('.pmfc__tab'));
  const activeIndex = buttons.indexOf(activeButton);
  const neighborButton = buttons[activeIndex + 1] ?? buttons[activeIndex - 1];
  const targetLeft = Math.min(
    activeButton.offsetLeft,
    neighborButton?.offsetLeft ?? activeButton.offsetLeft,
  );
  const targetRight = Math.max(
    activeButton.offsetLeft + activeButton.offsetWidth,
    neighborButton
      ? neighborButton.offsetLeft + neighborButton.offsetWidth
      : activeButton.offsetLeft + activeButton.offsetWidth,
  );
  const edgePadding = 8;
  const visibleLeft = scroller.scrollLeft;
  const visibleRight = scroller.scrollLeft + scroller.clientWidth;
  let nextScrollLeft = scroller.scrollLeft;

  if (targetLeft < visibleLeft + edgePadding) {
    nextScrollLeft = targetLeft - edgePadding;
  } else if (targetRight > visibleRight - edgePadding) {
    nextScrollLeft = targetRight - scroller.clientWidth + edgePadding;
  }

  if (nextScrollLeft !== scroller.scrollLeft) {
    scroller.scrollLeft = Math.max(0, nextScrollLeft);
  }
}

function getTabId(rootId: string, tabId: string) {
  return `${rootId}-tab-${sanitizeId(tabId)}`;
}

function getPanelId(rootId: string, tabId: string) {
  return `${rootId}-panel-${sanitizeId(tabId)}`;
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export const Component = PhonicMixedFormCodeTabs;

export default declareComponent(PhonicMixedFormCodeTabs, {
  name: 'Phonic Mixed Form Code Tabs',
  description: 'Interactive no-code form tab mixed with code tabs for Phonic examples.',
  group: 'Interactive',
  options: {
    applyTagSelectors: false,
    ssr: true,
  },
});
