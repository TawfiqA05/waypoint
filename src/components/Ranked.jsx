import React from 'react';
import { osmPlaces } from '../lib/apis.js';
import { runStay, runEat, runSeeDo, markVerified } from '../lib/gemini.js';
import { Loading, Err, EstNote, TierSections, PlaceCard, useTabData } from './common.jsx';

async function withOsm(place, run, filterCats) {
  const osm = await osmPlaces(place);
  const relevant = osm.filter(o => filterCats.includes(o.category));
  const sample = relevant.slice(0, 60).map(o => o.name).join('; ') || 'none found nearby';
  const data = await run(place, sample);
  return { data, osm: relevant.length ? relevant : osm };
}

export function Stay({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runStay, ['hotel']), [place.placeId]);
  if (loading) return <Loading text="Researching places to stay…" />;
  if (error) return <Err error={error} retry={retry} />;
  const hotels = markVerified(data.data.hotels || [], data.osm);
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
    </div>
  );
}

export function Eat({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runEat, ['restaurant', 'cafe']), [place.placeId]);
  if (loading) return <Loading text="Researching where to eat…" />;
  if (error) return <Err error={error} retry={retry} />;
  const items = markVerified(data.data.restaurants || [], data.osm);
  return (
    <div>
      <EstNote />
      <TierSections items={items} category="Eat" onAdd={onAdd} inTrip={inTrip}
                    render={r => [r.cuisine, r.dish && `Order: ${r.dish}`]} />
    </div>
  );
}

export function SeeDo({ place, onAdd, inTrip }) {
  const { loading, data, error, retry } = useTabData(
    () => withOsm(place, runSeeDo, ['attraction', 'museum', 'viewpoint']), [place.placeId]);
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
      {section('Sightseeing, ranked', mk(d.sightseeing))}
      {section('Outdoors & hikes', mk(d.outdoors), it => [it.type, it.difficulty && `Difficulty: ${it.difficulty}`])}
      {section('Day trips', mk(d.dayTrips), it => [it.travelTime])}
    </div>
  );
}
