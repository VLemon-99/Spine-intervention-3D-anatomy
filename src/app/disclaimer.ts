// Training disclaimer (docs/SPEC.md F0.2). main.ts shows it until the learner
// has accepted it once (remembered in the browser, F12.1). It covers the whole app until the learner
// clicks or taps 'I understand'.
//
// Other zones can check whether it is still shown — e.g. so page-wide
// keyboard shortcuts ignore keys meanwhile — with isDisclaimerShown(), or by
// reading the attribute data-disclaimer="shown" on the <html> element.

const ATTRIBUTE = 'data-disclaimer';

/** The disclaimer wording (docs/DECISIONS.md, 2026-11-10). The About page shows the same text. */
export const DISCLAIMER_TEXT =
  'For training only — not for clinical use. This simulator approximates fluoroscopic images and needle behaviour for practice. Never use it to plan or guide treatment of a real patient.';

/** True while the disclaimer is on screen. */
export function isDisclaimerShown(): boolean {
  return document.documentElement.getAttribute(ATTRIBUTE) === 'shown';
}

/** Show the disclaimer over everything in `parent`. Calls onAccept once it is dismissed. */
export function showDisclaimer(parent: HTMLElement, onAccept?: () => void): void {
  const overlay = document.createElement('div');
  overlay.dataset.testid = 'disclaimer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'disclaimer-title');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    boxSizing: 'border-box',
    background: '#10151c',
    color: '#f2f4f7',
    fontFamily: 'system-ui, sans-serif',
  } satisfies Partial<CSSStyleDeclaration>);

  const card = document.createElement('div');
  Object.assign(card.style, { maxWidth: '560px', textAlign: 'center', lineHeight: '1.5' });

  const title = document.createElement('h1');
  title.id = 'disclaimer-title';
  title.textContent = 'Spine Fluoro Trainer';

  const text = document.createElement('p');
  text.textContent = DISCLAIMER_TEXT;

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'disclaimer-accept';
  button.textContent = 'I understand';
  Object.assign(button.style, { minWidth: '160px', minHeight: '48px', fontSize: '18px', cursor: 'pointer' });

  // Everything else in `parent` is made inert while the disclaimer is shown,
  // so the keyboard (Tab, Enter, space) cannot reach the app behind it either.
  const madeInert = [...parent.children].filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !child.inert,
  );
  for (const child of madeInert) child.inert = true;

  button.addEventListener('click', () => {
    for (const child of madeInert) child.inert = false;
    overlay.remove();
    document.documentElement.removeAttribute(ATTRIBUTE);
    onAccept?.();
  });

  card.append(title, text, button);
  overlay.append(card);
  document.documentElement.setAttribute(ATTRIBUTE, 'shown');
  parent.append(overlay);
  button.focus();
}
