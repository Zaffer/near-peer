// Near Peer — runs the computer player (ai.js) off the page's main thread (see versus.js).
// Message in: { id, level, state, history }. Message out: { id, actions }.
import { choose } from './ai.js';

self.onmessage = ({ data: { id, level, state, history } }) => {
  self.postMessage({ id, actions: choose(state, { level, history }) });
};
