import { useId } from 'react';
import { useStates, useLgas, useAdvertLocations } from './useLocations.js';

/**
 * State → LGA → city.
 *
 * The LGA field is a dropdown when the reference list for that state is loaded,
 * and a typed field with suggestions when it is not. That keeps the form usable
 * before the 774-row LGA list is seeded, without ever forcing a wrong choice.
 */
export const LocationFields = ({ value, onChange, errors = {}, requireLga = true }) => {
  const states = useStates();
  const lgas = useLgas(value.stateCode);
  const locations = useAdvertLocations();
  const listId = useId();

  const knownLgas = locations.find((entry) => entry.code === value.stateCode)?.lgas?.map((l) => l.name) ?? [];

  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <label className="label" htmlFor={`${listId}-state`}>State</label>
        <select
          id={`${listId}-state`}
          className="field"
          value={value.stateCode ?? ''}
          aria-invalid={errors.state ? 'true' : undefined}
          onChange={(event) => {
            const code = event.target.value;
            const name = states.find((state) => state.code === code)?.name ?? '';
            set({ stateCode: code, state: name, lga: '' });
          }}
        >
          <option value="">Choose state</option>
          {states.map((state) => (
            <option key={state.code} value={state.code}>{state.name}</option>
          ))}
        </select>
        {errors.state && <p className="error">{errors.state}</p>}
      </div>

      <div>
        <label className="label" htmlFor={`${listId}-lga`}>
          Local government{!requireLga && <span className="font-normal text-ink-faint"> (optional)</span>}
        </label>
        {lgas.length > 0 ? (
          <select
            id={`${listId}-lga`}
            className="field"
            value={value.lga ?? ''}
            disabled={!value.stateCode}
            aria-invalid={errors.lga ? 'true' : undefined}
            onChange={(event) => set({ lga: event.target.value })}
          >
            <option value="">{value.stateCode ? 'Choose LGA' : 'Choose a state first'}</option>
            {lgas.map((lga) => (
              <option key={lga.id} value={lga.name}>{lga.name}</option>
            ))}
          </select>
        ) : (
          <>
            <input
              id={`${listId}-lga`}
              className="field"
              list={`${listId}-lga-list`}
              value={value.lga ?? ''}
              disabled={!value.stateCode}
              placeholder={value.stateCode ? 'e.g. Ikeja' : 'Choose a state first'}
              autoComplete="off"
              aria-invalid={errors.lga ? 'true' : undefined}
              onChange={(event) => set({ lga: event.target.value })}
            />
            <datalist id={`${listId}-lga-list`}>
              {knownLgas.map((name) => <option key={name} value={name} />)}
            </datalist>
          </>
        )}
        {errors.lga && <p className="error">{errors.lga}</p>}
      </div>

      <div>
        <label className="label" htmlFor={`${listId}-city`}>
          Area or town <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <input
          id={`${listId}-city`}
          className="field"
          value={value.city ?? ''}
          placeholder="e.g. Allen Avenue"
          onChange={(event) => set({ city: event.target.value })}
        />
      </div>
    </div>
  );
};

export default LocationFields;
