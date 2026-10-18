/*
 * Near Peer — signals, from alien-signals (https://github.com/stackblitz/alien-signals).
 *
 * A signal holds a value: s() reads it, s(v) sets it. A computed is worked out
 * from other signals and kept until one of them changes. An effect runs once,
 * then again whenever a signal it read changes; the page draws itself this way.
 * Everything that imports signals goes through this file, so the version is
 * pinned in one place.
 */
import { signal, computed, effect, startBatch, endBatch, setActiveSub } from 'https://cdn.jsdelivr.net/npm/alien-signals@3.2.1/+esm';

export { signal, computed, effect };

// Make several changes at once: effects wait until fn is done, so the page redraws once.
export function batch(fn) {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

// Read signals without the effect that's running coming to depend on them.
export function untracked(fn) {
  const prev = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(prev);
  }
}
