import type { CharacterId } from './art/character';

// ponytail: the wallet lives in localStorage, so it is per-device and trivially editable.
// Fine for a game; before pizza points are worth real coupons they must move to a server.
const KEY = 'pizza-run-v1';
export interface Save { wallet: number; best: number; char: CharacterId; muted: boolean }
const fresh: Save = { wallet: 0, best: 0, char: 'rider', muted: false };

export function load(): Save {
  try {
    return { ...fresh, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...fresh };
  }
}

export function store(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private mode or full storage: the run still works, it just isn't remembered
  }
}
