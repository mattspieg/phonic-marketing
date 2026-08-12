(() => {
  const DEFAULT_ENDPOINT =
    "https://phonic-session-token.mattspieg.workers.dev/api/phonic/outbound-call";
  const DEFAULT_PATIENT_INTAKE_AGENT_ID = "matt-airfoil-test";
  const TRIGGER_SELECTOR = '[data-trigger="request-a-call"]';
  const BACK_TRIGGER_SELECTOR = '[data-trigger="request-a-call-back"]';
  const LOADING_TEXT = "Calling...";
  const SUBMITTING_ATTR = "data-phonic-submitting";
  const DISABLED_CLASS_NAMES = ["is-disabled", "isDisabled"];
  const SUCCESS_ANIMATION_CLASS = "is-call-animating";
  const SUCCESS_ANIMATION_MS = 10000;
  const SUCCESS_ANIMATION_STYLE_ID = "phonic-request-call-success-animation";
  const MEDIA_BUTTON_SELECTOR = "[data-radio-media-src]";
  const successAnimationTimers = new WeakMap();
  const disabledClassNamesByTrigger = new WeakMap();
  let activeMediaButton = null;
  let activeMediaAudio = null;

  function init() {
    installSuccessAnimationStyles();
    bindMediaButtons();

    document.querySelectorAll(TRIGGER_SELECTOR).forEach((trigger) => {
      if (!(trigger instanceof HTMLElement)) return;
      if (trigger.dataset.phonicRequestCallBound === "true") return;
      trigger.dataset.phonicRequestCallBound = "true";

      const form = trigger.closest("form");
      if (!(form instanceof HTMLFormElement)) return;

      bindPhoneInputDisabledState(form, trigger);

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        submitForm(form, trigger);
      });

      form.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        if (!(event.target instanceof HTMLInputElement)) return;

        event.preventDefault();
        submitForm(form, trigger);
      });
    });

    document.querySelectorAll(BACK_TRIGGER_SELECTOR).forEach((trigger) => {
      if (!(trigger instanceof HTMLElement)) return;
      if (trigger.dataset.phonicRequestCallBackBound === "true") return;
      trigger.dataset.phonicRequestCallBackBound = "true";

      trigger.addEventListener("click", (event) => {
        event.preventDefault();

        const wrapper = trigger.closest(".w-form");
        if (!(wrapper instanceof HTMLElement)) return;

        resetFormView(wrapper);
      });
    });
  }

  function bindMediaButtons() {
    document.querySelectorAll(MEDIA_BUTTON_SELECTOR).forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.phonicMediaBound === "true") return;

      button.dataset.phonicMediaBound = "true";
      button.type = "button";
      setMediaButtonPlaying(button, false);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleMediaPlayback(button);
      });
    });
  }

  function toggleMediaPlayback(button) {
    const src = button.dataset.radioMediaSrc?.trim();
    if (!src) return;

    if (
      activeMediaButton === button &&
      activeMediaAudio instanceof HTMLAudioElement
    ) {
      if (activeMediaAudio.paused) {
        playMediaAudio(activeMediaAudio, button);
      } else {
        activeMediaAudio.pause();
      }
      return;
    }

    stopActiveMedia();

    const audio = new Audio(src);
    audio.preload = "auto";
    activeMediaButton = button;
    activeMediaAudio = audio;

    audio.addEventListener("play", () => {
      if (activeMediaAudio !== audio) return;
      setMediaButtonPlaying(button, true);
    });
    audio.addEventListener("pause", () => {
      if (activeMediaAudio !== audio) return;
      setMediaButtonPlaying(button, false);
    });
    audio.addEventListener("ended", () => {
      if (activeMediaAudio !== audio) return;
      audio.currentTime = 0;
      setMediaButtonPlaying(button, false);
    });
    audio.addEventListener("error", () => {
      if (activeMediaAudio !== audio) return;
      stopActiveMedia();
    });

    playMediaAudio(audio, button);
  }

  function playMediaAudio(audio, button) {
    audio.play().catch(() => {
      if (activeMediaAudio !== audio) return;
      setMediaButtonPlaying(button, false);
    });
  }

  function stopActiveMedia() {
    if (activeMediaAudio instanceof HTMLAudioElement) {
      activeMediaAudio.pause();
      activeMediaAudio.removeAttribute("src");
      activeMediaAudio.load();
    }
    if (activeMediaButton instanceof HTMLButtonElement) {
      setMediaButtonPlaying(activeMediaButton, false);
    }

    activeMediaAudio = null;
    activeMediaButton = null;
  }

  function setMediaButtonPlaying(button, isPlaying) {
    const playIcon = button.querySelector('[data-media-button-icon="play"]');
    const pauseIcon = button.querySelector('[data-media-button-icon="pause"]');
    const label = button.querySelector(".a11y-text");

    if (playIcon instanceof HTMLElement) playIcon.style.display = isPlaying ? "none" : "";
    if (pauseIcon instanceof HTMLElement) {
      pauseIcon.style.display = isPlaying ? "inline-block" : "none";
    }
    if (label instanceof HTMLElement) {
      label.textContent = isPlaying ? "Pause voice" : "Preview voice";
    }

    button.setAttribute("aria-pressed", String(isPlaying));
    button.setAttribute("aria-label", isPlaying ? "Pause voice" : "Preview voice");
  }

  async function submitForm(form, trigger) {
    if (form.getAttribute(SUBMITTING_ATTR) === "true") {
      return;
    }
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const phoneInput = findPhoneInput(form);
    const phoneNumber = phoneInput?.value.trim() ?? "";
    const demoInput = getCheckedInput(form, "Demo-Type");
    const voiceInput = getCheckedInput(form, "Voice-Type");
    const agentId = resolveAgentId(demoInput, voiceInput);
    const voiceId = getDataValue(voiceInput, "voiceId");
    const endpoint =
      trigger.dataset.endpoint ||
      form.dataset.phonicEndpoint ||
      DEFAULT_ENDPOINT;
    const dryRun =
      getDataValue(trigger, "dryRun") === "true" ||
      getDataValue(form, "dryRun") === "true";

    setBusy(form, trigger, true);
    hideMessages(form);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber,
          agentId,
          demoType: demoInput?.value || "",
          voiceType: voiceInput?.value || "",
          voiceId,
          pageUrl: window.location.href,
          source: "request-a-call-form",
          dryRun,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(getRequestErrorMessage(data, response.status));
      }

      showMessage(form, "success", "", {
        phoneNumber: data.toPhoneNumber || phoneNumber,
      });
      form.reset();
      syncTriggerDisabledState(form, trigger);
    } catch (error) {
      showMessage(form, "error", error instanceof Error ? error.message : "");
    } finally {
      setBusy(form, trigger, false);
    }
  }

  function findPhoneInput(form) {
    return form.querySelector('[name="Phone-Number"], input[type="tel"]');
  }

  function getCheckedInput(form, name) {
    return form.querySelector(`input[name="${name}"]:checked`);
  }

  function resolveAgentId(demoInput, voiceInput) {
    const explicitAgentId = getDataValue(demoInput, "agentId");
    if (explicitAgentId) return explicitAgentId;

    const demoType = demoInput?.value || "";
    const voiceType = voiceInput?.value || "";

    if (
      isMatchingValue(demoType, "Patient intake") &&
      isMatchingValue(voiceType, "Calm voice by Maya")
    ) {
      return DEFAULT_PATIENT_INTAKE_AGENT_ID;
    }

    return demoType;
  }

  function isMatchingValue(value, expected) {
    return value.trim().toLowerCase() === expected.toLowerCase();
  }

  function getDataValue(element, key) {
    if (!(element instanceof HTMLElement)) return "";

    const direct = element.dataset[key];
    if (direct) return direct.trim();

    const attrName = `data-${key.replace(
      /[A-Z]/g,
      (match) => `-${match.toLowerCase()}`,
    )}`;
    const parent = element.closest(`[${attrName}]`);
    if (!(parent instanceof HTMLElement)) return "";

    return (parent.getAttribute(attrName) || "").trim();
  }

  function setBusy(form, trigger, isBusy) {
    const label = trigger.querySelector("div") || trigger;

    if (isBusy) {
      form.setAttribute(SUBMITTING_ATTR, "true");
      trigger.setAttribute("aria-disabled", "true");
      trigger.dataset.originalText = label.textContent || "";
      label.textContent = trigger.dataset.loadingText || LOADING_TEXT;
      return;
    }

    form.removeAttribute(SUBMITTING_ATTR);
    trigger.removeAttribute("aria-disabled");

    if (trigger.dataset.originalText) {
      label.textContent = trigger.dataset.originalText;
      delete trigger.dataset.originalText;
    }
  }

  function bindPhoneInputDisabledState(form, trigger) {
    const phoneInput = findPhoneInput(form);
    if (!(phoneInput instanceof HTMLInputElement)) return;

    disabledClassNamesByTrigger.set(
      trigger,
      getControlledDisabledClassNames(trigger),
    );
    syncTriggerDisabledState(form, trigger);
    phoneInput.addEventListener("input", () => {
      syncTriggerDisabledState(form, trigger);
    });
  }

  function syncTriggerDisabledState(form, trigger) {
    const phoneInput = findPhoneInput(form);
    const hasPhoneNumber =
      phoneInput instanceof HTMLInputElement && phoneInput.value.trim() !== "";
    const classNames =
      disabledClassNamesByTrigger.get(trigger) || [DISABLED_CLASS_NAMES[0]];

    classNames.forEach((className) => {
      trigger.classList.toggle(className, !hasPhoneNumber);
    });
  }

  function getControlledDisabledClassNames(trigger) {
    const classNames = DISABLED_CLASS_NAMES.filter((className) =>
      trigger.classList.contains(className),
    );

    return classNames.length > 0 ? classNames : [DISABLED_CLASS_NAMES[0]];
  }

  function getRequestErrorMessage(data, status) {
    const userMessage = normalizeResponseText(data.userMessage);
    if (userMessage) return userMessage;

    const error = normalizeResponseText(data.error);
    const normalizedError = error.toLowerCase();

    if (normalizedError.includes("e.164") || normalizedError.includes("phone")) {
      return "Please enter a valid phone number with a country code, like +1 555 123 4567.";
    }

    if (normalizedError.includes("agent")) {
      return "Please choose a demo option before requesting a call.";
    }

    if (status === 403) {
      return "This form can only be submitted from an approved Phonic page.";
    }

    if (status >= 500) {
      return "We could not start the call just now. Please try again in a moment.";
    }

    return error || "We could not start the call. Please check the form and try again.";
  }

  function normalizeResponseText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function hideMessages(form) {
    const wrapper = form.closest(".w-form");
    if (!(wrapper instanceof HTMLElement)) return;

    const success = wrapper.querySelector(".w-form-done");
    const error = wrapper.querySelector(".w-form-fail");
    if (success instanceof HTMLElement) {
      deactivateSuccessState(wrapper, success);
      success.style.display = "none";
    }
    if (error instanceof HTMLElement) error.style.display = "none";
  }

  function showMessage(form, type, message = "", context = {}) {
    const wrapper = form.closest(".w-form");
    if (!(wrapper instanceof HTMLElement)) return;

    const success = wrapper.querySelector(".w-form-done");
    const error = wrapper.querySelector(".w-form-fail");

    if (type === "success") {
      lockSuccessHeight(form, wrapper, success);
      form.style.display = "none";
      if (error instanceof HTMLElement) error.style.display = "none";
      if (success instanceof HTMLElement) {
        updateSuccessPhoneNumber(success, context.phoneNumber);
        success.style.display = "block";
        activateSuccessAnimation(success);
        success.focus({ preventScroll: true });
      }
      return;
    }

    if (success instanceof HTMLElement) {
      deactivateSuccessState(wrapper, success);
      success.style.display = "none";
    }
    if (error instanceof HTMLElement) {
      const messageNode = error.querySelector("div");
      if (message && messageNode) messageNode.textContent = message;
      error.style.display = "block";
    }
  }

  function resetFormView(wrapper) {
    const form = wrapper.querySelector("form");
    const success = wrapper.querySelector(".w-form-done");
    const error = wrapper.querySelector(".w-form-fail");

    if (success instanceof HTMLElement) {
      deactivateSuccessState(wrapper, success);
      success.style.display = "none";
    }

    if (error instanceof HTMLElement) {
      error.style.display = "none";
    }

    if (form instanceof HTMLFormElement) {
      form.removeAttribute(SUBMITTING_ATTR);
      form.style.display = "";

      const phoneInput = findPhoneInput(form);
      if (phoneInput instanceof HTMLInputElement) {
        phoneInput.focus();
      }
    }
  }

  function lockSuccessHeight(form, wrapper, success) {
    if (!(success instanceof HTMLElement)) return;

    const formHeight = Math.ceil(form.getBoundingClientRect().height);
    const wrapperHeight = Math.ceil(wrapper.getBoundingClientRect().height);
    const lockedHeight = formHeight || wrapperHeight;

    if (!lockedHeight) return;

    wrapper.style.minHeight = `${lockedHeight}px`;
    success.style.boxSizing = "border-box";
    success.style.height = `${lockedHeight}px`;
    success.style.minHeight = `${lockedHeight}px`;
  }

  function clearSuccessHeight(wrapper, success) {
    wrapper.style.minHeight = "";
    success.style.boxSizing = "";
    success.style.height = "";
    success.style.minHeight = "";
  }

  function updateSuccessPhoneNumber(success, phoneNumber) {
    const target = success.querySelector('[data-bind="request-a-call-num"]');
    if (!(target instanceof HTMLElement)) return;

    target.textContent = phoneNumber ? ` ${phoneNumber} ` : " ";
  }

  function activateSuccessAnimation(success) {
    deactivateSuccessAnimation(success);
    success.classList.remove(SUCCESS_ANIMATION_CLASS);
    void success.offsetWidth;
    success.classList.add(SUCCESS_ANIMATION_CLASS);

    const timer = window.setTimeout(() => {
      success.classList.remove(SUCCESS_ANIMATION_CLASS);
      successAnimationTimers.delete(success);
    }, SUCCESS_ANIMATION_MS);

    successAnimationTimers.set(success, timer);
  }

  function deactivateSuccessAnimation(success) {
    const timer = successAnimationTimers.get(success);
    if (timer) {
      window.clearTimeout(timer);
      successAnimationTimers.delete(success);
    }

    success.classList.remove(SUCCESS_ANIMATION_CLASS);
  }

  function deactivateSuccessState(wrapper, success) {
    deactivateSuccessAnimation(success);
    clearSuccessHeight(wrapper, success);
  }

  function installSuccessAnimationStyles() {
    if (document.getElementById(SUCCESS_ANIMATION_STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = SUCCESS_ANIMATION_STYLE_ID;
    style.textContent = `
      .request-call_success:not(.${SUCCESS_ANIMATION_CLASS}) .pulse::before,
      .request-call_success:not(.${SUCCESS_ANIMATION_CLASS}) .pulse::after,
      .request-call_success:not(.${SUCCESS_ANIMATION_CLASS}) .phone-icon {
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
