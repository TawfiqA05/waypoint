import React from 'react';

const RANK_LABEL = { must: 'Must', solid: 'Solid pick', skip: 'Skip-able' };
const TIER_LABEL = { budget: 'Budget', mid: 'Mid-range', splurge: 'Splurge' };
export const TIER_ORDER = ['budget', 'mid', 'splurge'];
const RANK_ORDER = { must: 0, solid: 1, skip: 2 };

export const Stamp = ({ rank, label }) => (
  <span className={`stamp ${rank}`}>{label || RANK_LABEL[rank] || rank}</span>
);

export const SourceBadge = ({ verified }) => (
  <span className={`src-badge ${verified ? 'verified' : 'ai'}`}
        title={verified ? 'This place exists on OpenStreetMap' : 'AI-researched — double-check before booking'}>
    {verified ? '✓ verified' : '~ AI-researched'}
  </span>
);

export const Loading = ({ text }) => <div className="loading">{text || 'Researching…'}</div>;

export const Err = ({ error, retry }) => (
  <div className="err">
    {String(error.message || error)}{' '}
    {retry && <button className="add-btn" onClick={retry}>Try again</button>}
  </div>
);

export const EstNote = () => (
  <p className="est-note">~ AI-researched items are best-effort estimates. Verify hours, prices, and availability before you book.</p>
);

export function PlaceCard({ item, category, onAdd, added, meta }) {
  return (
    <div className={`place-card rank-${item.rank || ''}`}>
      <div className="pc-name">{item.name}</div>
      <div className="pc-side">
        {item.rank && <Stamp rank={item.rank} />}
        {item.unmissable === true && <Stamp rank="unmissable" label="Unmissable" />}
        {item.unmissable === false && <Stamp rank="skip" label="Optional" />}
      </div>
      {item.why && <div className="pc-why">{item.why}</div>}
      <div className="pc-meta">
        <SourceBadge verified={item.verified} />
        {(meta || []).filter(Boolean).map((m, i) => <span key={i}>{m}</span>)}
        {onAdd && (
          <button className={`add-btn ${added ? 'added' : ''}`}
                  onClick={() => onAdd(item, category)} disabled={added}>
            {added ? '✓ In trip' : '+ Add to trip'}
          </button>
        )}
      </div>
    </div>
  );
}

export function TierSections({ items, category, render, onAdd, inTrip }) {
  return TIER_ORDER.map(tier => {
    const group = (items || [])
      .filter(i => i.tier === tier)
      .sort((a, b) => (RANK_ORDER[a.rank] ?? 3) - (RANK_ORDER[b.rank] ?? 3));
    if (!group.length) return null;
    return (
      <section key={tier}>
        <h3><span className="tier-label">{TIER_LABEL[tier]}</span></h3>
        <div className="cards">
          {group.map((item, i) => (
            <PlaceCard key={item.name + i} item={item} category={category}
                       onAdd={onAdd} added={inTrip(item.name)}
                       meta={render ? render(item) : []} />
          ))}
        </div>
      </section>
    );
  });
}

// Small hook: lazy-load a tab's data once, with retry.
export function useTabData(loader, deps) {
  const [state, setState] = React.useState({ loading: true, data: null, error: null });
  const load = React.useCallback(() => {
    setState({ loading: true, data: null, error: null });
    loader().then(
      data => setState({ loading: false, data, error: null }),
      error => setState({ loading: false, data: null, error })
    );
  }, deps); // eslint-disable-line
  React.useEffect(load, [load]);
  return { ...state, retry: load };
}
