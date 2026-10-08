import { useEffect, useState } from 'react';
import { endpoints } from '../../lib/api.js';

/**
 * States, LGAs for the chosen state, and the places that already have adverts.
 *
 * States change never and LGAs almost never, so both are cached for the life of
 * the tab — opening the editor twice should not refetch 37 rows.
 */
let statesCache = null;
const lgaCache = new Map();

export const useStates = () => {
  const [states, setStates] = useState(statesCache ?? []);
  useEffect(() => {
    if (statesCache) return;
    endpoints.adverts
      .states()
      .then((rows) => {
        statesCache = rows ?? [];
        setStates(statesCache);
      })
      .catch(() => setStates([]));
  }, []);
  return states;
};

export const useLgas = (stateCode) => {
  const [lgas, setLgas] = useState(() => (stateCode ? lgaCache.get(stateCode) ?? [] : []));
  useEffect(() => {
    if (!stateCode) return setLgas([]);
    if (lgaCache.has(stateCode)) return setLgas(lgaCache.get(stateCode));
    let alive = true;
    endpoints.adverts
      .lgas(stateCode)
      .then((rows) => {
        lgaCache.set(stateCode, rows ?? []);
        if (alive) setLgas(rows ?? []);
      })
      .catch(() => alive && setLgas([]));
    return () => {
      alive = false;
    };
  }, [stateCode]);
  return lgas;
};

/** Places with live adverts, with counts — powers filter suggestions. */
export const useAdvertLocations = () => {
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    endpoints.adverts.locations().then((rows) => setLocations(rows ?? [])).catch(() => {});
  }, []);
  return locations;
};
