// WebGL2 check (docs/SPEC.md F12.5). The simulator draws its images with
// WebGL2; without it, main.ts shows a clear message instead of a blank screen.
// Plain function: the canvas factory is handed in so it can be unit-tested.

/** The part of a canvas the check uses. */
export interface CanvasLike {
  getContext(contextId: string): unknown;
}

export const WEBGL2_MISSING_MESSAGE = "This browser can't run the simulator (WebGL2 needed)";

/** True when a canvas from `createCanvas` can give a WebGL2 context. Never throws. */
export function canUseWebgl2(createCanvas: () => CanvasLike): boolean {
  try {
    const context = createCanvas().getContext('webgl2');
    return typeof context === 'object' && context !== null;
  } catch {
    return false;
  }
}

/** Show only the 'WebGL2 needed' message, in a readable card. */
export function showWebgl2Missing(parent: HTMLElement): void {
  const screen = document.createElement('div');
  Object.assign(screen.style, {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    background: '#10151c',
    color: '#f2f4f7',
    fontFamily: 'system-ui, sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const card = document.createElement('p');
  card.dataset.testid = 'webgl2-missing';
  card.setAttribute('role', 'alert');
  card.textContent = WEBGL2_MISSING_MESSAGE;
  Object.assign(card.style, {
    maxWidth: '560px',
    margin: '0',
    padding: '24px',
    border: '1px solid #2c3542',
    borderRadius: '8px',
    background: '#18202a',
    fontSize: '20px',
    lineHeight: '1.5',
    textAlign: 'center',
  } satisfies Partial<CSSStyleDeclaration>);

  screen.append(card);
  parent.append(screen);
}
