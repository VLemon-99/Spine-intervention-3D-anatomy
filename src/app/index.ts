// App shell zone (disclaimer, layout; home, modes, history and About come in F12).
// mount() builds the main layout: four panel slots that main.ts hands to the
// render, carm, needle and view3d zones, plus a slot for zones without a panel.

export interface AppLayout {
  fluoro: HTMLElement;
  carm: HTMLElement;
  needle: HTMLElement;
  view3d: HTMLElement;
  /** For zones that have no main panel yet (their markers live here). */
  other: HTMLElement;
}

let layout: AppLayout | null = null;

/** The slots created by the last mount(), or null before mounting. */
export function getLayout(): AppLayout | null {
  return layout;
}

export function mount(element: HTMLElement): void {
  const style = document.createElement('style');
  style.textContent = `
    html, body { margin: 0; height: 100%; background: #10151c; color: #e6e9ee; font-family: system-ui, sans-serif; }
    #app { height: 100%; }
    .app-layout { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 8px;
      height: 100vh; padding: 8px; box-sizing: border-box; }
    .app-slot { min-width: 0; min-height: 0; display: flex; }
    .app-slot > .panel { flex: 1; min-width: 0; min-height: 0; border: 1px solid #2c3542; border-radius: 6px;
      background: #18202a; padding: 8px; box-sizing: border-box; overflow: hidden; }
    .panel-title { margin: 0 0 8px; font-size: 16px; font-weight: 600; }
  `;

  const root = document.createElement('div');
  root.className = 'app-layout';
  const marker = document.createElement('div');
  marker.dataset.testid = 'zone-app';
  marker.hidden = true;

  const slot = (name: string): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'app-slot';
    el.dataset.slot = name;
    return el;
  };
  const fluoro = slot('fluoro');
  const carm = slot('carm');
  const needle = slot('needle');
  const view3d = slot('view3d');
  const other = document.createElement('div');
  other.hidden = true;

  root.append(fluoro, carm, needle, view3d);
  element.append(style, marker, root, other);
  layout = { fluoro, carm, needle, view3d, other };
}
