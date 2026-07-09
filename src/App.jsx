import React from 'react';
import { geocode, photo } from './lib/apis.js';
import { addHistory, getTrip, saveTrip, getSettings, saveSettings } from './lib/storage.js';
import Overview from './components/Overview.jsx';
import { Stay, Eat, SeeDo } from './components/Ranked.jsx';
import { Events, Flights } from './components/EventsFlights.jsx';
import { History, MyTrip, SharedView, decodeShare } from './components/HistoryTrip.jsx';

const TABS = ['Overview', 'Stay', 'Eat', 'See & Do', 'Events', 'Flights', 'History', 'My Trip'];

function daysBetween(a, b) {
  if (!a || !b) return null;
  const d = Math.round((new Date(b) - new Date(a)) / 86400000);
  return d > 0 ? d : null;
}

export default function App() {
  const [query, setQuery] = React.useState('');
  const [place, setPlace] = React.useState(null);
  const [pic, setPic] = React.useState(null);
  const [tab, setTab] = React.useState('Overview');
  const [busy, setBusy] = React.useState(false);
  const [searchError, setSearchError] = React.useState(null);
  const [settings, setSettings] = React.useState(getSettings());
  const [showSettings, setShowSettings] = React.useState(false);
  const [tripMeta, setTripMeta] = React.useState({ start: '', end: '', style: 'general' });
  const [shared, setShared] = React.useState(() => decodeShare(location.hash));
  const [, force] = React.useReducer(x => x + 1, 0); // re-render after trip adds

  const trip = { ...tripMeta, days: daysBetween(tripMeta.start, tripMeta.end) };

  async function search(q, presetTab) {
    const text = (q ?? query).trim();
    if (!text) return;
    setBusy(true); setSearchError(null);
    try {
      const p = await geocode(text);
      if (!p) { setSearchError(`Couldn't find "${text}". Try adding a country or being more specific.`); return; }
      setPlace(p);
      setTab(presetTab || 'Overview');
      addHistory(p);
      setPic(null);
      photo(p).then(r => setPic(r.photo));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setSearchError('Search failed: ' + e.message);
    } finally { setBusy(false); }
  }

  function openFromHistory(h) {
    setQuery(h.name);
    setPlace(h); setTab('Overview'); setPic(null);
    photo(h).then(r => setPic(r.photo));
  }

  // Add-to-trip used by Stay/Eat/See & Do
  const addToTrip = (item, category) => {
    if (!place) return;
    const t = getTrip(place.placeId);
    t.days[0] = [...t.days[0], { name: item.name, category }];
    saveTrip(place.placeId, t);
    force();
  };
  const inTrip = (name) => place
    ? getTrip(place.placeId).days.some(d => d.some(i => i.name === name))
    : false;

  if (shared) {
    return (
      <div className="shell">
        <div className="masthead"><h1>Way<span>point</span></h1><span className="tag">shared trip</span></div>
        <SharedView data={shared} onClose={() => { history.replaceState(null, '', location.pathname); setShared(null); }} />
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="masthead">
        <h1>Way<span>point</span></h1>
        <span className="tag">personal travel dossiers</span>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>
          {settings.homeAirport ? `Home: ${settings.homeAirport}` : 'Set home airport'}
        </button>
      </div>

      <div className="search-row">
        <input value={query} onChange={e => setQuery(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && search()}
               placeholder="City, state, country, or address — where to?"
               aria-label="Destination search" />
        <button onClick={() => search()} disabled={busy}>{busy ? 'Locating…' : 'Research'}</button>
      </div>
      <div className="trip-meta">
        <label>From <input type="date" value={tripMeta.start} onChange={e => setTripMeta(m => ({ ...m, start: e.target.value }))} /></label>
        <label>To <input type="date" value={tripMeta.end} onChange={e => setTripMeta(m => ({ ...m, end: e.target.value }))} /></label>
        <label>Style
          <select value={tripMeta.style} onChange={e => setTripMeta(m => ({ ...m, style: e.target.value }))}>
            <option value="general">General</option>
            <option value="outdoorsy">Outdoorsy</option>
            <option value="food-first">Food-first</option>
            <option value="family">Family</option>
            <option value="business + leisure">Work + play</option>
          </select>
        </label>
        {trip.days && <span className="tag">{trip.days} days</span>}
      </div>

      {searchError && <div className="err" style={{ marginTop: 14 }}>{searchError}</div>}

      {place ? (
        <>
          <div className="dossier">
            {pic?.url && (
              <>
                <img className="dossier-photo" src={pic.url} alt={place.name} />
                <span className="photo-credit">Photo: <a href={pic.link} target="_blank" rel="noreferrer">{pic.credit}</a> / Unsplash</span>
              </>
            )}
            <div className="dossier-body">
              <h2>{place.name}</h2>
              <div className="coords">
                <span>{place.displayName.split(',').slice(1).join(',').trim() || place.country}</span>
                <span>{place.lat.toFixed(3)}°, {place.lon.toFixed(3)}°</span>
                {place.countryCode && <span>{place.countryCode}</span>}
              </div>
            </div>
          </div>

          <nav className="tabbar" role="tablist" aria-label="Destination sections">
            {TABS.map(t => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </nav>
          <div className="panel" role="tabpanel">
            {tab === 'Overview' && <Overview place={place} trip={trip} />}
            {tab === 'Stay' && <Stay place={place} onAdd={addToTrip} inTrip={inTrip} />}
            {tab === 'Eat' && <Eat place={place} onAdd={addToTrip} inTrip={inTrip} />}
            {tab === 'See & Do' && <SeeDo place={place} onAdd={addToTrip} inTrip={inTrip} />}
            {tab === 'Events' && <Events place={place} trip={trip} />}
            {tab === 'Flights' && <Flights place={place} homeAirport={settings.homeAirport} onOpenSettings={() => setShowSettings(true)} />}
            {tab === 'History' && <History onOpen={openFromHistory} />}
            {tab === 'My Trip' && <MyTrip place={place} />}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 18 }}>
          <div className="panel" style={{ borderRadius: 10 }}>
            {getHistoryPreview(openFromHistory)}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="dialog-backdrop" onClick={e => e.target === e.currentTarget && setShowSettings(false)}>
          <div className="dialog" role="dialog" aria-label="Settings">
            <h3>Settings</h3>
            <label htmlFor="home-airport">Home airport (IATA code, e.g. IND)</label>
            <input id="home-airport" defaultValue={settings.homeAirport} maxLength={4}
                   onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                   onBlur={e => {
                     const v = e.target.value.toUpperCase().trim();
                     saveSettings({ homeAirport: v });
                     setSettings(getSettings());
                   }} />
            <div className="trip-actions"><button onClick={() => setShowSettings(false)}>Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function getHistoryPreview(onOpen) {
  return (
    <>
      <h3><span className="tier-label">Recent dossiers</span></h3>
      <History onOpen={onOpen} />
    </>
  );
}
