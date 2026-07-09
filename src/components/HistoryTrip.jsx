import React from 'react';
import { getHistory, removeHistory, getTrip, saveTrip } from '../lib/storage.js';

export function History({ onOpen }) {
  const [filter, setFilter] = React.useState('');
  const [rows, setRows] = React.useState(getHistory());
  const shown = rows.filter(r =>
    r.displayName.toLowerCase().includes(filter.toLowerCase()) ||
    (r.searchedAt || '').slice(0, 10).includes(filter)
  );
  return (
    <div>
      <input className="filter-input" placeholder="Filter by name or date (YYYY-MM-DD)…"
             value={filter} onChange={e => setFilter(e.target.value)} />
      {shown.length ? shown.map(r => (
        <div className="hist-row" key={r.placeId}>
          <button className="open" onClick={() => onOpen(r)}>{r.name}
            <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}> — {r.displayName.split(',').slice(1, 3).join(',')}</span>
          </button>
          <span className="when">{(r.searchedAt || '').slice(0, 10)}</span>
          <button className="del" aria-label={`Remove ${r.name}`}
                  onClick={() => { removeHistory(r.placeId); setRows(getHistory()); }}>×</button>
        </div>
      )) : (
        <div className="empty-state">
          <span className="glyph">⌖</span>
          {rows.length ? 'Nothing matches that filter.' : 'No searches yet. Every destination you look up is saved here automatically.'}
        </div>
      )}
    </div>
  );
}

// ---------- My Trip ----------
export function encodeShare(place, trip) {
  const payload = { n: place.name, d: place.displayName, days: trip.days, notes: trip.notes };
  return location.origin + location.pathname + '#share=' +
    btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
export function decodeShare(hash) {
  try {
    const m = hash.match(/#share=(.+)/);
    if (!m) return null;
    return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  } catch { return null; }
}

export function MyTrip({ place }) {
  const [trip, setTrip] = React.useState(() => getTrip(place.placeId));
  const [copied, setCopied] = React.useState(false);
  const dragItem = React.useRef(null);
  const [overDay, setOverDay] = React.useState(null);

  React.useEffect(() => { setTrip(getTrip(place.placeId)); }, [place.placeId]);
  const update = (t) => { setTrip(t); saveTrip(place.placeId, t); };

  const move = (toDay) => {
    if (!dragItem.current) return;
    const { day, idx } = dragItem.current;
    const days = trip.days.map(d => [...d]);
    const [item] = days[day].splice(idx, 1);
    days[toDay].push(item);
    update({ ...trip, days });
    dragItem.current = null; setOverDay(null);
  };

  const removeItem = (day, idx) => {
    const days = trip.days.map(d => [...d]);
    days[day].splice(idx, 1);
    update({ ...trip, days });
  };

  const share = async () => {
    const url = encodeShare(place, trip);
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { prompt('Copy this link:', url); }
  };

  return (
    <div>
      <div className="trip-actions">
        <button onClick={() => update({ ...trip, days: [...trip.days, []] })}>+ Add day</button>
        <button onClick={() => trip.days.length > 1 && update({ ...trip, days: trip.days.slice(0, -1) })}>− Remove last day</button>
        <button onClick={() => window.print()}>Export PDF</button>
        <button onClick={share}>{copied ? '✓ Link copied' : 'Copy share link'}</button>
      </div>

      {trip.days.every(d => !d.length) && (
        <p className="est-note">Add places from the Stay, Eat, and See & Do tabs, then drag them between days here.</p>
      )}

      {trip.days.map((day, di) => (
        <div key={di} className={`trip-day ${overDay === di ? 'drag-over' : ''}`}
             onDragOver={e => { e.preventDefault(); setOverDay(di); }}
             onDragLeave={() => setOverDay(o => (o === di ? null : o))}
             onDrop={() => move(di)}>
          <header><h4>Day {di + 1}</h4></header>
          <ul>
            {day.length ? day.map((item, ii) => (
              <li key={ii} draggable
                  onDragStart={() => { dragItem.current = { day: di, idx: ii }; }}>
                <span className="cat">{item.category}</span> {item.name}
                <button className="rm" aria-label={`Remove ${item.name}`} onClick={() => removeItem(di, ii)}>×</button>
              </li>
            )) : <li className="trip-empty" style={{ background: 'none', border: 'none', cursor: 'default' }}>Drop places here</li>}
          </ul>
        </div>
      ))}

      <h3><span className="tier-label">Notes & wishlist</span></h3>
      <textarea className="notes-area" placeholder={`Your own thoughts on ${place.name}…`}
                value={trip.notes} onChange={e => update({ ...trip, notes: e.target.value })} />
    </div>
  );
}

export function SharedView({ data, onClose }) {
  return (
    <div className="panel" style={{ marginTop: 20, borderRadius: 10 }}>
      <h3><span className="tier-label">Shared itinerary — {data.n}</span></h3>
      <p style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{data.d}</p>
      {(data.days || []).map((day, di) => (
        <div key={di} className="trip-day">
          <header><h4>Day {di + 1}</h4></header>
          <ul>
            {day.length ? day.map((item, ii) => (
              <li key={ii} style={{ cursor: 'default' }}>
                <span className="cat">{item.category}</span> {item.name}
              </li>
            )) : <li className="trip-empty" style={{ background: 'none', border: 'none' }}>Free day</li>}
          </ul>
        </div>
      ))}
      {data.notes && <><h3><span className="tier-label">Notes</span></h3><p>{data.notes}</p></>}
      <div className="trip-actions"><button onClick={onClose}>Plan my own trip →</button></div>
    </div>
  );
}
