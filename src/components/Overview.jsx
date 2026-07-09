import React from 'react';
import { weather, countryInfo, exchangeRate } from '../lib/apis.js';
import { runOverview } from '../lib/gemini.js';
import { Loading, Err, EstNote } from './common.jsx';

const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

function weatherSummary(w) {
  if (!w?.monthly) return 'unavailable';
  return w.monthly.map(m => `${MONTHS[m.month]}:${m.highC}°C/${m.rainMm}mm`).join(' ');
}

export default function Overview({ place, trip }) {
  const [wx, setWx] = React.useState(null);
  const [country, setCountry] = React.useState(null);
  const [fx, setFx] = React.useState(null);
  const [ai, setAi] = React.useState({ loading: true, data: null, error: null });

  React.useEffect(() => {
    let alive = true;
    setAi({ loading: true, data: null, error: null });
    (async () => {
      const w = await weather(place).catch(() => null);
      if (!alive) return;
      setWx(w);
      const c = await countryInfo(place.countryCode).catch(() => null);
      if (!alive) return;
      setCountry(c);
      if (c?.currencyCode) exchangeRate(c.currencyCode).then(r => alive && setFx(r));
      try {
        const data = await runOverview(place, weatherSummary(w), trip);
        if (alive) setAi({ loading: false, data, error: null });
      } catch (error) {
        if (alive) setAi({ loading: false, data: null, error });
      }
    })();
    return () => { alive = false; };
  }, [place.placeId, trip.start, trip.days]);

  const d = ai.data;
  const maxT = wx?.monthly ? Math.max(...wx.monthly.map(m => m.highC || 0)) : 0;

  return (
    <div>
      <EstNote />
      <div className="ov-grid">
        <div className="ov-block">
          <h4>Right now</h4>
          {wx?.current ? (
            <>
              <div className="wx-now">
                <span className="t">{Math.round(wx.current.temperature_2m)}°C</span>
                <span>{Math.round(wx.current.temperature_2m * 9 / 5 + 32)}°F · wind {Math.round(wx.current.wind_speed_10m)} km/h</span>
              </div>
              {wx.monthly && (
                <>
                  <div className="wx-months" aria-label="Average monthly high temperature">
                    {wx.monthly.map(m => (
                      <div key={m.month} className="bar" style={{ height: `${Math.max(5, (m.highC / maxT) * 100)}%` }}
                           title={`${m.highC}°C high · ~${m.rainMm}mm rain/mo`}>
                        <span>{MONTHS[m.month]}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: 22, fontSize: 12, color: 'var(--ink-soft)' }}>Avg monthly highs (3-yr, Open-Meteo)</p>
                </>
              )}
            </>
          ) : <p>Weather unavailable.</p>}
        </div>

        <div className="ov-block">
          <h4>Best time to visit</h4>
          {ai.loading ? <Loading /> : d?.bestTime ? (
            <><div className="big-fact">{d.bestTime.months}</div><p>{d.bestTime.why}</p></>
          ) : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Money</h4>
          {country && (
            <p>{country.currencyName} ({country.currencyCode}{country.currencySymbol ? `, ${country.currencySymbol}` : ''})
              {fx?.rate ? <> · 1 USD ≈ <strong>{fx.rate.toFixed(2)} {fx.to}</strong></> : null}</p>
          )}
          {d?.budgetPerDayUSD && (
            <>
              <div className="budget-bands">
                {['budget', 'mid', 'splurge'].map(k => (
                  <div key={k}><span className="num">${d.budgetPerDayUSD[k]}</span><span className="lbl">{k}/day</span></div>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 6 }}>{d.budgetPerDayUSD.note}</p>
            </>
          )}
        </div>

        <div className="ov-block">
          <h4>Packing list</h4>
          {ai.loading ? <Loading /> : d?.packing ? <ul>{d.packing.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Safety — {d?.safety?.level || '…'}</h4>
          {d?.safety?.notes ? <ul>{d.safety.notes.map((n, i) => <li key={i}>{n}</li>)}</ul> : ai.loading ? <Loading /> : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Visa & entry</h4>
          {d?.visa ? <><p>{d.visa.summary}</p><p style={{ fontSize: 12, color: 'var(--amber)' }}>{d.visa.confidence}</p></> : ai.loading ? <Loading /> : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Connectivity</h4>
          {d?.connectivity ? <><p><strong>SIM/eSIM:</strong> {d.connectivity.esim}</p><p><strong>Wifi:</strong> {d.connectivity.wifi}</p></> : ai.loading ? <Loading /> : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Customs & phrases</h4>
          {d?.customs ? (
            <>
              <p><strong>Tipping:</strong> {d.customs.tipping}</p>
              <p><strong>Dress:</strong> {d.customs.dress}</p>
              <ul>{(d.customs.phrases || []).map((p, i) => <li key={i}><span className="phrase">{p.phrase}</span> — {p.meaning}</li>)}</ul>
            </>
          ) : ai.loading ? <Loading /> : <p>—</p>}
        </div>

        <div className="ov-block">
          <h4>Getting around</h4>
          {d?.gettingAround ? <><p>{d.gettingAround.summary}</p><p><strong>Airport → city:</strong> {d.gettingAround.airportTransfer}</p></> : ai.loading ? <Loading /> : <p>—</p>}
          {country && <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Drives on the {country.drivingSide} · {country.languages?.join(', ')} · {country.callingCode}</p>}
        </div>
      </div>
      {ai.error && <div style={{ marginTop: 12 }}><Err error={ai.error} retry={() => { setAi({ loading: true, data: null, error: null }); runOverview(place, weatherSummary(wx), trip).then(data => setAi({ loading: false, data, error: null }), error => setAi({ loading: false, data: null, error })); }} /></div>}
    </div>
  );
}
