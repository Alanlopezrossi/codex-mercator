// Favorites stored in this browser only.
import { store } from './env.js';

const KEY = 'cm-favs';
export const favs = () => store.get(KEY, []);
export const isFav = (id) => favs().some((f) => f.id === id);
export function toggleFav(item) {
  const list = favs();
  const i = list.findIndex((f) => f.id === item.id);
  if (i >= 0) list.splice(i, 1);
  else list.unshift({ id: item.id, n: item.n, ic: item.ic, r: item.r });
  store.set(KEY, list.slice(0, 200));
  return i < 0;
}
