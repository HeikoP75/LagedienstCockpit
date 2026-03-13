/* ============================================================
   Whisky Imperium – 1925
   Browser-based economy game
   ============================================================ */

'use strict';

// ============================================================
// DATA DEFINITIONS
// ============================================================

const CITIES = [
  { id: 'london',    name: 'London',        travelDays: 0  },
  { id: 'glasgow',   name: 'Glasgow',        travelDays: 2  },
  { id: 'hamburg',   name: 'Hamburg',        travelDays: 4  },
  { id: 'newyork',   name: 'New York',       travelDays: 14 },
  { id: 'bombay',    name: 'Bombay',         travelDays: 21 },
  { id: 'rio',       name: 'Rio de Janeiro', travelDays: 18 },
  { id: 'shanghai',  name: 'Shanghai',       travelDays: 28 },
];

// basePrice is in £, volatility is 0..1 (how much prices fluctuate)
const COMMODITIES = [
  { id: 'tea',     name: 'Tee',       basePrice: 30,  volatility: 0.25, origin: 'bombay'   },
  { id: 'coffee',  name: 'Kaffee',    basePrice: 22,  volatility: 0.30, origin: 'rio'      },
  { id: 'sugar',   name: 'Zucker',    basePrice: 15,  volatility: 0.35, origin: 'rio'      },
  { id: 'cotton',  name: 'Baumwolle', basePrice: 18,  volatility: 0.20, origin: 'newyork'  },
  { id: 'spices',  name: 'Gewürze',   basePrice: 50,  volatility: 0.40, origin: 'bombay'   },
  { id: 'cocoa',   name: 'Kakao',     basePrice: 25,  volatility: 0.30, origin: 'rio'      },
];

const WHISKY_DISTILLERIES = [
  { id: 'glenfar',   name: 'Glenfarclas',    region: 'Speyside',   prestige: 3 },
  { id: 'laphroaig', name: 'Laphroaig',       region: 'Islay',      prestige: 4 },
  { id: 'macallan',  name: 'The Macallan',    region: 'Speyside',   prestige: 5 },
  { id: 'talisker',  name: 'Talisker',        region: 'Skye',       prestige: 3 },
  { id: 'highland',  name: 'Highland Park',   region: 'Orkney',     prestige: 4 },
];

// Auctions appear every N turns; pool of possible items
const AUCTION_INTERVAL = 5; // every 5 turns an auction fires

// ============================================================
// GAME STATE
// ============================================================

const state = {
  year:      1925,
  turn:      0,
  money:     5000,
  location:  'london',
  cargo:     {},      // { commodityId: quantity }
  cargoMax:  100,
  whisky:    [],      // [{ distilleryId, age, rarity, purchaseYear, bottleCount }]
  eventLog:  [],
  auction:   null,    // current auction object or null
  prices:    {},      // { cityId: { commodityId: price } }
  prevPrices:{},      // for trend arrows
  travelTarget: null, // pending travel city id
};

// ============================================================
// PRICE ENGINE
// ============================================================

function initPrices() {
  for (const city of CITIES) {
    state.prices[city.id] = {};
    for (const com of COMMODITIES) {
      state.prices[city.id][com.id] = randomPrice(city.id, com);
    }
  }
  state.prevPrices = deepCopy(state.prices);
}

function randomPrice(cityId, com) {
  // Goods are cheaper at their origin city
  const isOrigin = com.origin === cityId;
  const factor = isOrigin ? (0.5 + Math.random() * 0.3) : (0.9 + Math.random() * 0.6);
  return Math.round(com.basePrice * factor);
}

function updatePrices() {
  state.prevPrices = deepCopy(state.prices);
  for (const city of CITIES) {
    for (const com of COMMODITIES) {
      const current = state.prices[city.id][com.id];
      const change = (Math.random() - 0.5) * 2 * com.volatility;
      const newPrice = Math.max(3, Math.round(current * (1 + change)));
      state.prices[city.id][com.id] = newPrice;
    }
  }
}

// ============================================================
// CARGO HELPERS
// ============================================================

function cargoTotal() {
  return Object.values(state.cargo).reduce((s, q) => s + q, 0);
}

function cargoSpace() {
  return state.cargoMax - cargoTotal();
}

// ============================================================
// WHISKY ENGINE
// ============================================================

function generateWhiskyBarrel() {
  const d = WHISKY_DISTILLERIES[Math.floor(Math.random() * WHISKY_DISTILLERIES.length)];
  const age = Math.floor(Math.random() * 12) + 3; // 3..14 years old
  const rarity = Math.floor(Math.random() * 3) + 1; // 1..3
  const bottleCount = rarity === 1 ? 200 : rarity === 2 ? 60 : 12;
  return {
    id: uid(),
    distilleryId: d.id,
    distilleryName: d.name,
    region: d.region,
    prestige: d.prestige,
    age,
    rarity,
    bottleCount,
    purchaseYear: state.year,
  };
}

function whiskyValue(w) {
  // Value formula: base prestige * age bonus * rarity bonus
  const ageYears = (state.year - w.purchaseYear) + w.age;
  const ageFactor = 1 + (ageYears / 10) * 0.4;
  const rarityFactor = w.rarity === 1 ? 1 : w.rarity === 2 ? 2.5 : 6;
  const base = w.prestige * 80;
  return Math.round(base * ageFactor * rarityFactor * w.bottleCount / 12);
}

function whiskyShortDesc(w) {
  const stars = '★'.repeat(w.rarity) + '☆'.repeat(3 - w.rarity);
  return `${w.distilleryName} ${w.age}J. ${stars} (${w.bottleCount} Fl.)`;
}

// ============================================================
// AUCTION ENGINE
// ============================================================

function triggerAuction() {
  const barrel = generateWhiskyBarrel();
  // Occasionally a "collection" or a rare closed distillery single cask
  const isRare = Math.random() < 0.25;
  if (isRare) {
    barrel.rarity = 3;
    barrel.bottleCount = 6;
    barrel.age = barrel.age + Math.floor(Math.random() * 10) + 5;
  }

  const startingPrice = Math.round(whiskyValue(barrel) * (0.4 + Math.random() * 0.3));
  const competitors = Math.floor(Math.random() * 3) + 1; // 1..3 AI bidders

  state.auction = {
    item: barrel,
    startingPrice,
    currentBid: startingPrice,
    currentBidder: 'AI',
    competitors,
    round: 0,
    maxRounds: 5,
    log: [],
    ended: false,
  };
  // AI makes initial bid
  state.auction.log.push(`Auktionator: Startgebot £ ${fmt(startingPrice)}`);
}

function playerBid(amount) {
  const a = state.auction;
  if (!a || a.ended) return;
  if (amount <= a.currentBid) {
    logEvent(`Ihr Gebot muss höher als £ ${fmt(a.currentBid)} sein.`, 'ev-bad');
    return;
  }
  if (amount > state.money) {
    logEvent('Nicht genug Kapital für dieses Gebot.', 'ev-bad');
    return;
  }
  a.currentBid    = amount;
  a.currentBidder = 'player';
  a.log.push(`Sie bieten: £ ${fmt(amount)}`);
  a.round++;
  advanceAuction();
}

function playerPass() {
  const a = state.auction;
  if (!a || a.ended) return;
  a.log.push('Sie passen.');
  a.round++;
  advanceAuction();
}

function advanceAuction() {
  const a = state.auction;
  // AI counter-bidding
  if (!a.ended && a.currentBidder === 'player') {
    const aiBidChance = Math.max(0.1, 0.8 - a.round * 0.12);
    if (Math.random() < aiBidChance) {
      const aiBid = Math.round(a.currentBid * (1.05 + Math.random() * 0.1));
      a.currentBid    = aiBid;
      a.currentBidder = 'AI';
      a.log.push(`Mitbieter erhöht auf: £ ${fmt(aiBid)}`);
    } else {
      a.log.push('Kein weiteres Gebot der Mitbieter.');
      endAuction(true);
      return;
    }
  }

  if (a.round >= a.maxRounds) {
    endAuction(a.currentBidder === 'player');
  }

  renderAuction();
}

function endAuction(playerWon) {
  const a = state.auction;
  a.ended = true;
  if (playerWon) {
    state.money -= a.currentBid;
    state.whisky.push(a.item);
    a.log.push(`Zuschlag! Sie erhalten ${whiskyShortDesc(a.item)} für £ ${fmt(a.currentBid)}.`);
    logEvent(`Auktion gewonnen: ${whiskyShortDesc(a.item)} für £ ${fmt(a.currentBid)}`, 'ev-good');
  } else {
    a.log.push('Auktion verloren – Zuschlag an Mitbieter.');
    logEvent('Auktion verloren.', 'ev-bad');
  }
  renderAll();
}

// ============================================================
// TRAVEL
// ============================================================

function travelTo(cityId) {
  if (cityId === state.location) return;
  const city = CITIES.find(c => c.id === cityId);
  state.location = cityId;
  const days = city.travelDays;
  // Advance time: each 7 days = 1 "turn" of price fluctuation
  const turns = Math.max(1, Math.floor(days / 7));
  for (let i = 0; i < turns; i++) updatePrices();
  state.turn += turns;
  state.year  = 1925 + Math.floor(state.turn / 12);

  logEvent(`Gereist nach ${city.name} (${days} Tage, ${turns} Runden).`, 'ev-info');
  checkAuction();
  renderAll();
}

// ============================================================
// TRADE
// ============================================================

function buyCommodity(comId, qty) {
  if (qty <= 0) return;
  const price = state.prices[state.location][comId];
  const cost  = price * qty;
  if (cost > state.money)        { logEvent('Zu wenig Kapital.', 'ev-bad'); return; }
  if (qty > cargoSpace())        { logEvent('Zu wenig Laderaum.', 'ev-bad'); return; }

  state.money -= cost;
  state.cargo[comId] = (state.cargo[comId] || 0) + qty;
  const com = COMMODITIES.find(c => c.id === comId);
  logEvent(`Gekauft: ${qty}× ${com.name} für £ ${fmt(cost)}`, 'ev-info');
  renderAll();
}

function sellCommodity(comId, qty) {
  if (qty <= 0) return;
  const held = state.cargo[comId] || 0;
  if (qty > held) { logEvent('Nicht genug Ware im Laderaum.', 'ev-bad'); return; }

  const price   = state.prices[state.location][comId];
  const revenue = price * qty;
  state.money            += revenue;
  state.cargo[comId]     -= qty;
  if (state.cargo[comId] === 0) delete state.cargo[comId];

  const com = COMMODITIES.find(c => c.id === comId);
  logEvent(`Verkauft: ${qty}× ${com.name} für £ ${fmt(revenue)}`, 'ev-good');
  renderAll();
}

// ============================================================
// TURN / EVENTS
// ============================================================

function nextTurn() {
  updatePrices();
  state.turn++;
  state.year = 1925 + Math.floor(state.turn / 12);

  // Age whisky
  // (whisky age advances with game years; purchaseYear + stored age combo handles it)

  // Random market event
  randomMarketEvent();

  checkAuction();
  renderAll();
}

function checkAuction() {
  if (state.turn > 0 && state.turn % AUCTION_INTERVAL === 0 && !state.auction) {
    triggerAuction();
    logEvent('Eine Auktion beginnt!', 'ev-good');
  }
  if (state.auction && state.auction.ended) {
    state.auction = null;
  }
}

function randomMarketEvent() {
  const events = [
    {
      chance: 0.12,
      msg: 'Teeernte in Indien – Teepreise sinken.',
      effect: () => { CITIES.forEach(c => { state.prices[c.id]['tea'] = Math.round(state.prices[c.id]['tea'] * 0.75); }); },
      cls: 'ev-info',
    },
    {
      chance: 0.10,
      msg: 'Schlechte Kaffeeernte – Kaffeepreise steigen.',
      effect: () => { CITIES.forEach(c => { state.prices[c.id]['coffee'] = Math.round(state.prices[c.id]['coffee'] * 1.35); }); },
      cls: 'ev-bad',
    },
    {
      chance: 0.08,
      msg: 'Prohibition in den USA – Whiskypreise steigen stark!',
      effect: () => {
        state.whisky.forEach(w => { w.prestige = Math.min(5, w.prestige + 1); });
      },
      cls: 'ev-good',
    },
    {
      chance: 0.08,
      msg: 'Sturm auf See – Transport dauert länger.',
      effect: () => { logEvent('Routen verzögert.', 'ev-bad'); },
      cls: 'ev-bad',
    },
    {
      chance: 0.07,
      msg: 'Börsenaufschwung – Kapitalmarkt boomt.',
      effect: () => {
        const bonus = Math.floor(state.money * 0.03);
        state.money += bonus;
        logEvent(`Zinsertrag: +£ ${fmt(bonus)}`, 'ev-good');
      },
      cls: 'ev-good',
    },
    {
      chance: 0.06,
      msg: 'Zuckerpreise in der Karibik kollabieren.',
      effect: () => { CITIES.forEach(c => { state.prices[c.id]['sugar'] = Math.round(state.prices[c.id]['sugar'] * 0.60); }); },
      cls: 'ev-info',
    },
  ];

  for (const ev of events) {
    if (Math.random() < ev.chance) {
      ev.effect();
      logEvent(ev.msg, ev.cls);
      break;
    }
  }
}

// ============================================================
// WEALTH CALCULATION
// ============================================================

function totalWealth() {
  const whiskyVal = state.whisky.reduce((s, w) => s + whiskyValue(w), 0);
  const cargoVal  = Object.entries(state.cargo)
    .reduce((s, [id, qty]) => s + (state.prices[state.location][id] || 0) * qty, 0);
  return { money: state.money, cargoVal, whiskyVal, total: state.money + cargoVal + whiskyVal };
}

// ============================================================
// LOGGING
// ============================================================

function logEvent(msg, cls = 'ev-info') {
  state.eventLog.unshift({ msg, cls });
  if (state.eventLog.length > 50) state.eventLog.pop();
}

// ============================================================
// RENDERING
// ============================================================

function renderAll() {
  renderHeader();
  renderCityList();
  renderCargo();
  renderWhisky();
  renderMarket();
  renderAuction();
  renderEventLog();
  renderWealth();
}

function renderHeader() {
  document.getElementById('display-year').textContent     = state.year;
  document.getElementById('display-money').textContent    = `£ ${fmt(state.money)}`;
  document.getElementById('display-location').textContent = CITIES.find(c => c.id === state.location).name;
  document.getElementById('display-cargo').textContent    = `${cargoTotal()} / ${state.cargoMax}`;
}

function renderCityList() {
  const el = document.getElementById('city-list');
  el.innerHTML = '';
  for (const city of CITIES) {
    const btn = document.createElement('button');
    btn.className = 'city-btn' + (city.id === state.location ? ' active' : '');
    btn.textContent = city.id === state.location
      ? `▶ ${city.name}`
      : `${city.name} (${city.travelDays}T)`;
    if (city.id !== state.location) {
      btn.addEventListener('click', () => openTravelModal(city));
    }
    el.appendChild(btn);
  }
}

function renderCargo() {
  const el = document.getElementById('cargo-list');
  const entries = Object.entries(state.cargo);
  if (!entries.length) { el.innerHTML = '<em>Leer</em>'; return; }
  el.innerHTML = '';
  for (const [id, qty] of entries) {
    const com = COMMODITIES.find(c => c.id === id);
    const div = document.createElement('div');
    div.className = 'cargo-item';
    div.innerHTML = `${com.name} <span>${qty} Stk.</span>`;
    el.appendChild(div);
  }
}

function renderWhisky() {
  const el = document.getElementById('whisky-list');
  if (!state.whisky.length) { el.innerHTML = '<em>Leer</em>'; return; }
  el.innerHTML = '';
  for (const w of state.whisky) {
    const div = document.createElement('div');
    div.className = 'whisky-item';
    const val = whiskyValue(w);
    div.innerHTML = `${whiskyShortDesc(w)}<br><span>≈ £ ${fmt(val)}</span>`;
    el.appendChild(div);
  }
}

function renderMarket() {
  const city = CITIES.find(c => c.id === state.location);
  document.getElementById('market-city-name').textContent = `Markt – ${city.name}`;

  const tbody = document.getElementById('market-body');
  tbody.innerHTML = '';

  for (const com of COMMODITIES) {
    const price = state.prices[state.location][com.id];
    const prev  = state.prevPrices[state.location]?.[com.id] ?? price;
    const trend = price > prev ? '▲' : price < prev ? '▼' : '–';
    const cls   = price > prev ? 'trend-up' : price < prev ? 'trend-down' : 'trend-flat';
    const held  = state.cargo[com.id] || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${com.name}</td>
      <td>£ ${fmt(price)}</td>
      <td class="${cls}">${trend}</td>
      <td>
        <div class="qty-control">
          <button data-com="${com.id}" data-act="buy-dec">−</button>
          <input type="number" id="buy-qty-${com.id}" value="1" min="1" max="${Math.max(1, Math.min(cargoSpace(), Math.floor(state.money / price)))}">
          <button data-com="${com.id}" data-act="buy-inc">+</button>
          <button class="btn-buy" data-com="${com.id}" data-act="buy">Kaufen</button>
        </div>
      </td>
      <td>
        <div class="qty-control">
          <button data-com="${com.id}" data-act="sell-dec">−</button>
          <input type="number" id="sell-qty-${com.id}" value="${held > 0 ? held : 1}" min="1" max="${Math.max(1, held)}">
          <button data-com="${com.id}" data-act="sell-inc">+</button>
          <button class="btn-sell" data-com="${com.id}" data-act="sell" ${held === 0 ? 'disabled' : ''}>Verkaufen</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderAuction() {
  const section = document.getElementById('auction-section');
  if (!state.auction) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  const a = state.auction;
  const itemDisplay = document.getElementById('auction-item-display');
  const w = a.item;
  const estVal = whiskyValue(w);

  itemDisplay.innerHTML = `
    <strong>${w.distilleryName}</strong> – ${w.region}<br>
    Alter: <strong>${w.age} Jahre</strong> &nbsp;|&nbsp;
    Flaschen: <strong>${w.bottleCount}</strong> &nbsp;|&nbsp;
    Seltenheit: ${'★'.repeat(w.rarity)}${'☆'.repeat(3 - w.rarity)}<br>
    Schätzwert: <strong>£ ${fmt(estVal)}</strong><br>
    <br>
    Aktuelles Gebot: <strong>£ ${fmt(a.currentBid)}</strong>
    (${a.currentBidder === 'player' ? 'Sie führen' : 'Mitbieter führt'})
    ${a.ended ? '<br><em>Auktion beendet.</em>' : ''}
  `;

  document.getElementById('btn-bid').disabled  = a.ended;
  document.getElementById('btn-pass').disabled = a.ended;

  const logEl = document.getElementById('auction-log');
  logEl.innerHTML = a.log.slice(-6).map(l => `<p>${l}</p>`).join('');
}

function renderEventLog() {
  const el = document.getElementById('event-log');
  el.innerHTML = state.eventLog.slice(0, 15)
    .map(e => `<p class="${e.cls}">${e.msg}</p>`)
    .join('');
}

function renderWealth() {
  const { money, cargoVal, whiskyVal, total } = totalWealth();
  document.getElementById('wealth-summary').innerHTML = `
    <div class="w-row"><span>Kapital</span><span>£ ${fmt(money)}</span></div>
    <div class="w-row"><span>Waren</span><span>£ ${fmt(cargoVal)}</span></div>
    <div class="w-row"><span>Whisky</span><span>£ ${fmt(whiskyVal)}</span></div>
    <div class="w-row w-total"><span>Gesamt</span><span>£ ${fmt(total)}</span></div>
  `;
}

// ============================================================
// MODALS
// ============================================================

function openTravelModal(city) {
  state.travelTarget = city.id;
  document.getElementById('travel-modal-title').textContent = `Reisen nach ${city.name}`;
  document.getElementById('travel-modal-desc').textContent  =
    `Die Reise dauert ${city.travelDays} Tage. Marktpreise können sich ändern.`;
  document.getElementById('travel-modal-overlay').classList.remove('hidden');
}

function openBidModal() {
  const a = state.auction;
  if (!a || a.ended) return;
  const minBid = a.currentBid + 1;
  document.getElementById('modal-title').textContent = 'Gebot abgeben';
  document.getElementById('modal-desc').textContent  =
    `Aktuelles Gebot: £ ${fmt(a.currentBid)}. Ihr Mindestgebot: £ ${fmt(minBid)}.`;
  const input = document.getElementById('modal-input');
  input.min   = minBid;
  input.value = Math.min(state.money, Math.round(a.currentBid * 1.1));
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initListeners() {
  // Next Turn
  document.getElementById('btn-next-turn').addEventListener('click', nextTurn);

  // Market table: buy/sell
  document.getElementById('market-body').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const com = btn.dataset.com;
    const act = btn.dataset.act;

    const buyInput  = document.getElementById(`buy-qty-${com}`);
    const sellInput = document.getElementById(`sell-qty-${com}`);

    if (act === 'buy')       buyCommodity(com, parseInt(buyInput.value)  || 1);
    if (act === 'sell')      sellCommodity(com, parseInt(sellInput.value) || 1);
    if (act === 'buy-inc')   buyInput.value  = Math.max(1, parseInt(buyInput.value)  + 1);
    if (act === 'buy-dec')   buyInput.value  = Math.max(1, parseInt(buyInput.value)  - 1);
    if (act === 'sell-inc')  sellInput.value = Math.max(1, parseInt(sellInput.value) + 1);
    if (act === 'sell-dec')  sellInput.value = Math.max(1, parseInt(sellInput.value) - 1);
  });

  // Auction buttons
  document.getElementById('btn-bid').addEventListener('click', openBidModal);
  document.getElementById('btn-pass').addEventListener('click', () => { playerPass(); });

  // Bid modal
  document.getElementById('modal-confirm').addEventListener('click', () => {
    const val = parseInt(document.getElementById('modal-input').value);
    document.getElementById('modal-overlay').classList.add('hidden');
    if (!isNaN(val)) playerBid(val);
  });
  document.getElementById('modal-cancel').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
  });

  // Travel modal
  document.getElementById('travel-confirm').addEventListener('click', () => {
    document.getElementById('travel-modal-overlay').classList.add('hidden');
    if (state.travelTarget) travelTo(state.travelTarget);
    state.travelTarget = null;
  });
  document.getElementById('travel-cancel').addEventListener('click', () => {
    document.getElementById('travel-modal-overlay').classList.add('hidden');
    state.travelTarget = null;
  });
}

// ============================================================
// UTILITIES
// ============================================================

function fmt(n) {
  return n.toLocaleString('de-DE');
}

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

let _uidCounter = 0;
function uid() { return 'w' + (++_uidCounter); }

// ============================================================
// INIT
// ============================================================

function init() {
  initPrices();
  logEvent('Willkommen, Händler. Das Jahr ist 1925.', 'ev-info');
  logEvent('Kaufen und verkaufen Sie Waren zwischen den Städten.', 'ev-info');
  logEvent('Bauen Sie Ihr Whisky-Imperium auf.', 'ev-good');
  initListeners();
  renderAll();
}

init();
