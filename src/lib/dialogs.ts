/**
 * FILE: dialogs.ts
 * ROLE IN KULA: Non-blocking replacements for window.alert / window.confirm.
 *
 * WHY: Native dialogs freeze the JS thread, look alien inside the Berlin
 * Analog design language, and feel broken in the iOS WebView. These helpers
 * render lightweight DOM overlays styled to the palette instead:
 *
 *   showToast('Link copied!')                  → auto-dismissing toast
 *   await confirmAction({ title, message })    → branded bottom-sheet confirm
 *
 * Implemented in plain DOM (no React) so they can be called from anywhere —
 * components, services, even firebase.ts error handlers — with no context,
 * no per-component state, and no Tailwind JIT dependency (inline styles use
 * the same hex values as the @theme tokens in index.css).
 */

const BRAND = '#5B6B56';
const TERRACOTTA = '#C86A51';
const INK = '#1c1917';      // stone-900
const PAPER = '#ffffff';

const FONT = '"Inter", ui-sans-serif, system-ui, sans-serif';

/** Auto-dismissing, non-blocking toast. type colors the accent bar. */
export function showToast(message: string, type: 'info' | 'success' | 'warning' = 'info') {
  if (typeof document === 'undefined') return;

  const accent = type === 'success' ? BRAND : type === 'warning' ? TERRACOTTA : INK;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.style.cssText = `
    position: fixed; left: 50%; bottom: calc(96px + env(safe-area-inset-bottom));
    transform: translateX(-50%) translateY(16px); opacity: 0;
    max-width: min(85vw, 360px); z-index: 9999;
    background: ${INK}; color: ${PAPER};
    border-left: 4px solid ${accent};
    padding: 12px 18px; border-radius: 18px;
    font-family: ${FONT}; font-size: 13px; font-weight: 600; line-height: 1.45;
    box-shadow: 0 12px 32px rgba(28,25,23,0.35);
    transition: transform 0.25s ease, opacity 0.25s ease;
    pointer-events: none; white-space: pre-line;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(16px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Danger styles the confirm button terracotta (destructive actions). */
  danger?: boolean;
}

/**
 * Branded bottom-sheet confirm. Drop-in for window.confirm:
 *   if (!(await confirmAction({ title, message }))) return;
 */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 9998;
      background: rgba(28,25,23,0.55); backdrop-filter: blur(6px);
      display: flex; align-items: flex-end; justify-content: center;
      opacity: 0; transition: opacity 0.2s ease;
    `;

    const sheet = document.createElement('div');
    sheet.setAttribute('role', 'alertdialog');
    sheet.style.cssText = `
      width: 100%; max-width: 448px; background: ${PAPER};
      border-radius: 40px 40px 0 0; padding: 32px 24px;
      padding-bottom: calc(32px + env(safe-area-inset-bottom));
      font-family: ${FONT}; text-align: center;
      transform: translateY(100%); transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow: 0 -16px 48px rgba(28,25,23,0.25);
    `;

    const accent = opts.danger ? TERRACOTTA : BRAND;
    sheet.innerHTML = `
      <h3 style="font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 700; color: ${INK}; margin: 0 0 10px;"></h3>
      <p style="font-size: 14px; color: #78716c; line-height: 1.6; margin: 0 0 28px;"></p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button data-kula-confirm style="
          padding: 16px; border: none; border-radius: 18px; cursor: pointer;
          background: ${accent}; color: white;
          font-family: ${FONT}; font-size: 11px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 0.15em;
        "></button>
        <button data-kula-cancel style="
          padding: 14px; border: none; border-radius: 18px; cursor: pointer;
          background: transparent; color: #a8a29e;
          font-family: ${FONT}; font-size: 11px; font-weight: 900;
          text-transform: uppercase; letter-spacing: 0.15em;
        "></button>
      </div>
    `;
    // textContent assignment keeps user-provided strings inert (no HTML injection).
    sheet.querySelector('h3')!.textContent = opts.title;
    sheet.querySelector('p')!.textContent = opts.message;
    sheet.querySelector<HTMLButtonElement>('[data-kula-confirm]')!.textContent = opts.confirmLabel || 'Confirm';
    sheet.querySelector<HTMLButtonElement>('[data-kula-cancel]')!.textContent = opts.cancelLabel || 'Never mind';

    const close = (result: boolean) => {
      overlay.style.opacity = '0';
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => overlay.remove(), 280);
      resolve(result);
    };

    sheet.querySelector('[data-kula-confirm]')!.addEventListener('click', () => close(true));
    sheet.querySelector('[data-kula-cancel]')!.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      sheet.style.transform = 'translateY(0)';
    });
  });
}
