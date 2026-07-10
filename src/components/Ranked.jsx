import React from 'react';
import { osmPlaces } from '../lib/apis.js';
import { runStay, runEat, runSeeDo, runMore, markVerified } from '../lib/gemini.js';
import { Loading, Err, EstNote, TierSections, PlaceCard, useTabData } from './common.jsx';

async function withOsm(place, run, filterCats) {
  const osm = await osmPlaces(place);
  const relevant = osm.filter(o => filterCats.includes(o.category));
  const sample = relevant.slice(0, 60).map(o => o.name).join('; ') || 'none found nearby';
  const data = await run(place, sample);
  return { data, osm: relevant.length ? relevant : osm };
}

// Shared "More..." behavior: fetch another AI batch that excludes what's
// already on screen, verify against OSM, and append.
function useMore(kind, place, baseItems, osm) {
  const [extra, setExtra] = React.useState([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState(null);
  React.useEffect(() => { setExtra([]); setError(null); }, [place.placeId]);
  const loadMore = async () => {
    setBusy(true); setError(null);
    try {
      const names = [...baseItems, ...extra].map(i => i.name);
      const items = await runMore(kind, place, names);
      setExtra(e => [...e, ...markVerified(items, osm || [])]);
    } catch (e) { setError(e); }
    setBusy(false);
  };
  return { extra, busy, error, loadMore };
}

function MoreButton({ busy, error, onClick }) {
  return (
    <div style={{ marginTop: 18, textAlign: 'center' }}>
      {error && <div className="err" style={{ marginBottom: 10, textAlign: 'left' }}>{String(error.message || error)}</div>}
      <button className="add-btn" style={{ fontSize: 14, padding: '9px 22px' }}
              onClick={onClick} disabled={busy}>
        {busy ? 'Researching more…' : 'More…'}
      </button>
    </div>
  );
}

export function Stay({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runStay, ['hotel']), [place.placeId]);
  const base = loading || error ? [] : markVerified(data.data.hotels || [], data.osm);
  const more = useMore('stay', place, base, data?.osm);
  if (loading) return <Loading text="Researching places to stay…" />;
  if (error) return <Err error={error} retry={retry} />;
  const hotels = [...base, ...more.extra];
  return (
    <div>
      <EstNote />
      <h3><span className="tier-label">Where to stay — neighborhoods</span></h3>
      <div className="cards">
        {(data.data.neighborhoods || []).map((n, i) => (
          <div className="place-card" key={i}>
            <div className="pc-name">{n.name}</div>
            <div className="pc-why">{n.why}</div>
          </div>
        ))}
      </div>
      <TierSections items={hotels} category="Stay" onAdd={onAdd} inTrip={inTrip}
                    render={h => [h.pricePerNightUSD && `~${h.pricePerNightUSD}/night`, h.neighborhood]} />
      <MoreButton busy={more.busy} error={more.error} onClick={more.loadMore} />
    </div>
  );
}

export function Eat({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runEat, ['restaurant', 'cafe']), [place.placeId]);
  const base = loading || error ? [] : markVerified(data.data.restaurants || [], data.osm);
  const more = useMore('eat', place, base, data?.osm);
  if (loading) return <Loading text="Researching where to eat…" />;
  if (error) return <Err error={error} retry={retry} />;
  const items = [...base, ...more.extra];
  return (
    <div>
      <EstNote />
      <TierSections items={items} category="Eat" onAdd={onAdd} inTrip={inTrip}
                    render={r => [r.cuisine, r.dish && `Order: ${r.dish}`]} />
      <MoreButton busy={more.busy} error={more.error} onClick={more.loadMore} />
    </div>
  );
}

export function SeeDo({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runSeeDo, ['attraction', 'museum', 'viewpoint']), [place.placeId]);
  const baseSights = loading || error ? [] : markVerified(data.data.sightseeing || [], data.osm);
  const more = useMore('seedo', place, baseSights, data?.osm);
  if (loading) return <Loading text="Researching sights…" />;
  if (error) return <Err error={error} retry={retry} />;
  const d = data.data;
  const mk = arr => markVerified(arr || [], data.osm);
  const section = (title, items, render) => !!items.length && (
    <>
      <h3><span className="tier-label">{title}</span></h3>
      <div className="cards">
        {items.map((it, i) => (
          <PlaceCard key={it.name + i} item={it} category="See & Do"
                     onAdd={onAdd} added={inTrip(it.name)} meta={render ? render(it) : []} />
        ))}
      </div>
    </>
  );
  return (
    <div>
      <EstNote />
      {section('Iconic & landmark', mk(d.iconic), it => [it.timeNeeded && `Time: ${it.timeNeeded}`])}
      {section('Sightseeing, ranked', [...baseSights, ...more.extra])}
      {section('Outdoors & hikes', mk(d.outdoors), it => [it.type, it.difficulty && `Difficulty: ${it.difficulty}`])}
      {section('Day trips', mk(d.dayTrips), it => [it.travelTime])}
      <MoreButton busy={more.busy} error={more.error} onClick={more.loadMore} />
    </div>
  );
}
