import { describe, expect, it } from 'vitest';
import { filterItems, normalizeText } from '@/features/liveClaim/utils/filters';
import { entry, item } from './factories';

const items = [
  item({ id: 'a', title: 'Pikachu ex' }),
  item({ id: 'b', title: 'Pokémon Mew', status: 'sold' }),
  item({ id: 'c', title: 'GARDEVOIR', leader_entry_id: 'x' }),
  item({ id: 'd', title: 'Eevee', status: 'withdrawn' }),
];
const ids = (list: typeof items) => list.map((i) => i.id);

describe('filterItems', () => {
  it('normaliza acentos y mayúsculas', () => {
    expect(normalizeText('  Pokémon ÉX ')).toBe('pokemon ex');
    expect(ids(filterItems(items, { filter: 'all', query: 'pokemon', entries: [] }))).toEqual(['b']);
    expect(ids(filterItems(items, { filter: 'all', query: 'gardevoir', entries: [] }))).toEqual(['c']);
    expect(ids(filterItems(items, { filter: 'all', query: 'POKÉMON', entries: [] }))).toEqual(['b']);
  });

  it('por estado', () => {
    expect(ids(filterItems(items, { filter: 'available', query: '', entries: [] }))).toEqual(['a', 'c']);
    expect(ids(filterItems(items, { filter: 'sold', query: '', entries: [] }))).toEqual(['b']);
    expect(ids(filterItems(items, { filter: 'all', query: '', entries: [] }))).toHaveLength(4);
  });

  it('mis intentos y combinación con búsqueda', () => {
    const entries = [entry({ item_id: 'a' }), entry({ id: 'e2', item_id: 'b' })];
    expect(ids(filterItems(items, { filter: 'mine', query: '', entries }))).toEqual(['a', 'b']);
    expect(ids(filterItems(items, { filter: 'mine', query: 'mew', entries }))).toEqual(['b']);
  });

  it('un intento retirado o rechazado ya no es "mío"', () => {
    const entries = [
      entry({ item_id: 'a', status: 'withdrawn' }),
      entry({ id: 'e2', item_id: 'b', status: 'rejected' }),
      entry({ id: 'e3', item_id: 'c', status: 'accepted' }),
    ];
    expect(ids(filterItems(items, { filter: 'mine', query: '', entries }))).toEqual(['c']);
  });
});
