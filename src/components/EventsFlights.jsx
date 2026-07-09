import React from 'react';
import { events } from '../lib/apis.js';
import { runSeasonal, runFlights } from '../lib/gemini.js';
import { Loading, Err, EstNote, Stamp, useTabData } from './common.jsx';

export function Events({ place, trip }) {
  const live = useTabData(() => events(place, trip.start, trip.end), [place.placeId, trip.start, trip.end]);
  const seasonal = useTabData(
    () => runSeasonal(place, trip.start ? `${trip.start} to ${trip.end || '?'}` : ''), [place.placeId]);

  return (
    <div>
      <h3><span className="tier-label">In your window {trip.start ? `(${trip.start} → ${trip.end || '…'})` : '(set trip dates above for a tighter list)'}</span></h3>
      {live.loading ? <Loading text="Checking listings…" /> :
        live.data?.unavailable ? <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Live listings unavailable (Ticketmaster key not set or no coverage here). Seasonal guide below still applies.</p> :
        live.data?.events?.length ? live.data.events.map((e, i) => (
          <div className="event-row" key={i}>
            <div className="date">{e.date}{e.time ? ` ${e.time.slice(0, 5)}` : ''}</div>
            <div>
              <div className="name"><a href={e.url} target="_blank" rel="noreferrer">{e.name}</a></div>
              <div className="venue">{e.venue}{e.genre ? ` · ${e.genre}` : ''}</div>
            </div>
          </div>
        )) : <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>No ticketed events found for this window.</p>}

      <h3 style={{ marginTop: 26 }}><span className="tier-label">Seasonal festivals & holidays</span></h3>
      <EstNote />
      {seasonal.loading ? <Loading /> : seasonal.error ? <Err error={seasonal.error} retry={seasonal.retry} /> : (
        <div className="cards">
          {(seasonal.data?.seasonal || []).map((s, i) => (
            <div className="place-card" key={i}>
              <div className="pc-name">{s.name}</div>
              <div className="pc-side">
                <Stamp rank={s.attendOrAvoid === 'attend' ? 'must' : s.attendOrAvoid === 'avoid' ? 'skip' : 'solid'}
                       label={s.attendOrAvoid === 'attend' ? 'Plan around' : s.attendOrAvoid === 'avoid' ? 'Avoid crowds' : 'Depends'} />
              </div>
              <div className="pc-why">{s.when} — {s.why}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Flights({ place, homeAirport, onOpenSettings }) {
  const { loading, data, error, retry } = useTabData(
    () => runFlights(place, homeAirport), [place.placeId, homeAirport]);

  const dest = data?.nearestAirports?.[0]?.code || place.city || place.name;
  const gf = `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights from ${homeAirport || ''} to ${dest}`)}`;
  const kiwi = `https://www.kiwi.com/en/search/results/${encodeURIComponent(homeAirport || 'anywhere')}/${encodeURIComponent(dest)}`;

  return (
    <div>
      {!homeAirport && (
        <p className="est-note">No home airport set — guidance below assumes the US Midwest. <button className="add-btn" onClick={onOpenSettings}>Set home airport</button></p>
      )}
      {loading ? <Loading text="Researching routes…" /> : error ? <Err error={error} retry={retry} /> : data && (
        <div className="ov-grid">
          <div className="ov-block">
            <h4>Route</h4>
            <p className="big-fact">{homeAirport || 'Home'} → {(data.nearestAirports || []).map(a => a.code).join(' / ')}</p>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{(data.nearestAirports || []).map(a => `${a.code} — ${a.name}`).join(' · ')}</p>
            <p>Typical round trip: <strong>{data.typicalRoundTripUSD}</strong></p>
          </div>
          <div className="ov-block">
            <h4>When to fly</h4>
            <p><strong>Cheapest:</strong> {data.cheapestMonths}</p>
            <p><strong>Priciest:</strong> {data.priciestMonths}</p>
          </div>
          <div className="ov-block">
            <h4>Booking tips</h4>
            <ul>{(data.bookingTips || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
          <div className="ov-block">
            <h4>Live prices</h4>
            <p>Price trends above are AI-researched. For live fares:</p>
            <p><a href={gf} target="_blank" rel="noreferrer">Search Google Flights →</a></p>
            <p><a href={kiwi} target="_blank" rel="noreferrer">Search Kiwi.com →</a></p>
          </div>
        </div>
      )}
    </div>
  );
}
