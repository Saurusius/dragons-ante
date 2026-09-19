const DEFAULT_MARGIN = 18;
const BUTTON_SIZE = 58;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createLauncherController({
  moduleId,
  launcherId,
  positionSettingKey,
  onToggle,
  tooltip = "Ouvrir Dragon's Ante - faites glisser pour déplacer"
}) {
  async function reset() {
    await game.settings.set(moduleId, positionSettingKey, {});
    const button = document.getElementById(launcherId);
    if (!button) return;
    button.style.left = "auto";
    button.style.top = "auto";
    button.style.right = `${DEFAULT_MARGIN}px`;
    button.style.bottom = `${DEFAULT_MARGIN}px`;
  }

  function restorePosition(button) {
    const pos = game.settings.get(moduleId, positionSettingKey) || {};
    if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
    button.style.left = `${clamp(pos.left, 4, window.innerWidth - BUTTON_SIZE - 4)}px`;
    button.style.top = `${clamp(pos.top, 4, window.innerHeight - BUTTON_SIZE - 4)}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
  }

  function makeDraggable(button) {
    let drag = null;

    button.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      const rect = button.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top,
        moved: false
      };
      button.setPointerCapture(event.pointerId);
      button.classList.add("is-dragging");
    });

    button.addEventListener("pointermove", event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.hypot(dx, dy) > 5) drag.moved = true;
      if (!drag.moved) return;

      button.style.left = `${clamp(drag.left + dx, 4, window.innerWidth - button.offsetWidth - 4)}px`;
      button.style.top = `${clamp(drag.top + dy, 4, window.innerHeight - button.offsetHeight - 4)}px`;
      button.style.right = "auto";
      button.style.bottom = "auto";
    });

    const finish = async event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const wasMoved = drag.moved;
      drag = null;
      button.classList.remove("is-dragging");
      try { button.releasePointerCapture(event.pointerId); } catch (_error) {}

      if (wasMoved) {
        const rect = button.getBoundingClientRect();
        await game.settings.set(moduleId, positionSettingKey, {
          left: Math.round(rect.left),
          top: Math.round(rect.top)
        });
      } else {
        onToggle?.();
      }
    };

    button.addEventListener("pointerup", finish);
    button.addEventListener("pointercancel", () => {
      drag = null;
      button.classList.remove("is-dragging");
    });
    button.addEventListener("contextmenu", async event => {
      event.preventDefault();
      await reset();
    });
  }

  function install() {
    const existing = document.getElementById(launcherId);
    if (existing) return existing;

    const button = document.createElement("button");
    button.id = launcherId;
    button.type = "button";
    button.title = tooltip;
    button.setAttribute("aria-label", tooltip);
    button.innerHTML = `<span class="da-launcher-playing-card" aria-hidden="true"><b>A</b><i>♠</i><em>A</em></span>`;
    document.body.appendChild(button);
    restorePosition(button);
    makeDraggable(button);
    return button;
  }

  return { install, reset };
}
