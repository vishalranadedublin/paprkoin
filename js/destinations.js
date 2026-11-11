// Curated PaprKoin destinations, and the Netflix-style rows built from them.
// Rows are personalised from the visitor's (IP) location: nearby places rank higher.
// Photos come from Wikipedia's lead image for each place, fetched in one batch for
// the whole list so the request never depends on where the visitor is.

// [id, name, wikipedia title, lat, lon, where, kind, popularity 1-10, blurb]
const RAW = [
  ['newgrange', 'Newgrange', 'Newgrange', 53.6947, -6.4755, 'Ireland', 'sacred', 7, 'A 5,200-year-old passage tomb whose inner chamber fills with light at the winter solstice.'],
  ['moher', 'Cliffs of Moher', 'Cliffs of Moher', 52.9715, -9.4309, 'Ireland', 'nature', 8, 'Sea cliffs rising 214 metres above the Atlantic on Ireland’s west coast.'],
  ['skellig', 'Skellig Michael', 'Skellig Michael', 51.7711, -10.5406, 'Ireland', 'sacred', 6, 'A monastic island where monks lived on stone terraces for six centuries.'],
  ['causeway', 'Giant’s Causeway', "Giant's Causeway", 55.2408, -6.5116, 'Northern Ireland', 'nature', 7, 'Some 40,000 basalt columns stepping down into the sea.'],
  ['stonehenge', 'Stonehenge', 'Stonehenge', 51.1789, -1.8262, 'England', 'sacred', 8, 'A ring of standing stones aligned with the midsummer sunrise.'],
  ['iona', 'Iona Abbey', 'Iona Abbey', 56.3346, -6.3926, 'Scotland', 'sacred', 4, 'A small island abbey that has drawn pilgrims since the sixth century.'],
  ['eiffel', 'Eiffel Tower', 'Eiffel Tower', 48.8584, 2.2945, 'France', 'landmark', 10, 'The iron lattice tower that became the symbol of Paris.'],
  ['msm', 'Mont-Saint-Michel', 'Mont-Saint-Michel', 48.6361, -1.5115, 'France', 'sacred', 8, 'A tidal island abbey that the sea surrounds twice a day.'],
  ['lourdes', 'Lourdes', 'Sanctuary of Our Lady of Lourdes', 43.0975, -0.0581, 'France', 'sacred', 7, 'A grotto in the Pyrenees visited by millions of pilgrims each year.'],
  ['sagrada', 'Sagrada Família', 'Sagrada Família', 41.4036, 2.1744, 'Spain', 'sacred', 9, 'Gaudí’s basilica, still rising over Barcelona more than 140 years on.'],
  ['santiago', 'Santiago de Compostela', 'Santiago de Compostela Cathedral', 42.8806, -8.5446, 'Spain', 'sacred', 7, 'The cathedral at the end of the Camino, where pilgrim roads across Europe meet.'],
  ['colosseum', 'Colosseum', 'Colosseum', 41.8902, 12.4922, 'Italy', 'landmark', 10, 'Rome’s great amphitheatre, standing for nearly two thousand years.'],
  ['stpeters', 'St. Peter’s Basilica', "St. Peter's Basilica", 41.9022, 12.4539, 'Vatican City', 'sacred', 9, 'The basilica beneath Michelangelo’s dome at the heart of Vatican City.'],
  ['matterhorn', 'Matterhorn', 'Matterhorn', 45.9763, 7.6586, 'Switzerland', 'nature', 7, 'The pyramid peak of the Alps on the Swiss–Italian border.'],
  ['brandenburg', 'Brandenburg Gate', 'Brandenburg Gate', 52.5163, 13.3777, 'Germany', 'peace', 7, 'Once the symbol of a divided city, now of a united one.'],
  ['acropolis', 'Acropolis', 'Acropolis of Athens', 37.9715, 23.7257, 'Greece', 'landmark', 9, 'The citadel of ancient Athens, crowned by the Parthenon.'],
  ['meteora', 'Meteora', 'Meteora', 39.7217, 21.6306, 'Greece', 'sacred', 6, 'Monasteries built on top of sandstone pillars in central Greece.'],
  ['hagia', 'Hagia Sophia', 'Hagia Sophia', 41.0086, 28.9802, 'Türkiye', 'sacred', 9, 'Fifteen centuries of history beneath one vast dome in Istanbul.'],
  ['lofoten', 'Lofoten', 'Lofoten', 68.2, 14.5, 'Norway', 'nature', 6, 'Arctic islands where the northern lights move over fishing villages.'],
  ['petra', 'Petra', 'Petra', 30.3285, 35.4444, 'Jordan', 'wonder', 9, 'A city carved into rose-red sandstone cliffs.'],
  ['wall', 'Western Wall', 'Western Wall', 31.7767, 35.2345, 'Jerusalem', 'sacred', 8, 'Where folded notes of prayer are tucked between ancient stones.'],
  ['giza', 'Pyramids of Giza', 'Great Pyramid of Giza', 29.9792, 31.1342, 'Egypt', 'wonder', 10, 'The last standing wonder of the ancient world.'],
  ['victoria', 'Victoria Falls', 'Victoria Falls', -17.9243, 25.8572, 'Zambia and Zimbabwe', 'nature', 8, 'Known locally as Mosi-oa-Tunya, the smoke that thunders.'],
  ['kilimanjaro', 'Kilimanjaro', 'Mount Kilimanjaro', -3.0674, 37.3556, 'Tanzania', 'nature', 8, 'Africa’s highest peak, snow-capped just south of the equator.'],
  ['serengeti', 'Serengeti', 'Serengeti National Park', -2.3333, 34.8333, 'Tanzania', 'nature', 8, 'Plains crossed each year by more than a million wildebeest.'],
  ['table', 'Table Mountain', 'Table Mountain', -33.9628, 18.4098, 'South Africa', 'nature', 7, 'A flat-topped mountain keeping watch over Cape Town.'],
  ['robben', 'Robben Island', 'Robben Island', -33.8076, 18.3712, 'South Africa', 'peace', 6, 'Where Nelson Mandela spent 18 of his 27 years in prison.'],
  ['taj', 'Taj Mahal', 'Taj Mahal', 27.1751, 78.0421, 'India', 'peace', 10, 'A marble tribute from an emperor to the wife he lost.'],
  ['golden', 'Golden Temple', 'Golden Temple', 31.62, 74.8765, 'India', 'sacred', 9, 'The gurdwara whose free kitchen feeds up to 100,000 people a day.'],
  ['varanasi', 'Varanasi', 'Varanasi', 25.3176, 82.9739, 'India', 'sacred', 8, 'One of the oldest living cities, on the stone steps of the Ganges.'],
  ['bodhgaya', 'Bodh Gaya', 'Mahabodhi Temple', 24.6959, 84.9911, 'India', 'sacred', 7, 'Where the Buddha is said to have found enlightenment.'],
  ['everest', 'Mount Everest', 'Mount Everest', 27.9881, 86.925, 'Nepal', 'nature', 9, 'The highest point on Earth, 8,849 metres above the sea.'],
  ['shwedagon', 'Shwedagon Pagoda', 'Shwedagon Pagoda', 16.7983, 96.1497, 'Myanmar', 'sacred', 6, 'A gilded stupa that glows over Yangon at dusk.'],
  ['angkor', 'Angkor Wat', 'Angkor Wat', 13.4125, 103.867, 'Cambodia', 'sacred', 9, 'The largest religious monument in the world.'],
  ['halong', 'Ha Long Bay', 'Ha Long Bay', 20.9101, 107.1839, 'Vietnam', 'nature', 8, 'Thousands of limestone islands rising from emerald water.'],
  ['borobudur', 'Borobudur', 'Borobudur', -7.6079, 110.2038, 'Indonesia', 'sacred', 7, 'A ninth-century temple holding 504 stone Buddhas.'],
  ['greatwall', 'Great Wall of China', 'Great Wall of China', 40.4319, 116.5704, 'China', 'wonder', 10, 'Thousands of kilometres of wall winding over mountain ridges.'],
  ['fuji', 'Mount Fuji', 'Mount Fuji', 35.3606, 138.7274, 'Japan', 'nature', 9, 'Japan’s sacred mountain, climbed by pilgrims for centuries.'],
  ['inari', 'Fushimi Inari', 'Fushimi Inari-taisha', 34.9671, 135.7727, 'Japan', 'sacred', 8, 'A path of thousands of vermilion gates up a Kyoto mountain.'],
  ['hiroshima', 'Hiroshima Peace Memorial', 'Hiroshima Peace Memorial', 34.3955, 132.4536, 'Japan', 'peace', 8, 'A ruined dome kept standing as a prayer for a world without nuclear weapons.'],
  ['uluru', 'Uluru', 'Uluru', -25.3444, 131.0369, 'Australia', 'sacred', 8, 'A sandstone monolith sacred to the Anangu people.'],
  ['reef', 'Great Barrier Reef', 'Great Barrier Reef', -18.2871, 147.6992, 'Australia', 'nature', 9, 'The largest living structure on Earth.'],
  ['opera', 'Sydney Opera House', 'Sydney Opera House', -33.8568, 151.2153, 'Australia', 'landmark', 9, 'White sails on Sydney Harbour.'],
  ['milford', 'Milford Sound', 'Milford Sound', -44.6414, 167.8974, 'New Zealand', 'nature', 7, 'A fiord of waterfalls and sheer cliffs in Fiordland.'],
  ['liberty', 'Statue of Liberty', 'Statue of Liberty', 40.6892, -74.0445, 'United States', 'peace', 10, 'The torch that welcomed generations arriving by sea.'],
  ['lincoln', 'Lincoln Memorial', 'Lincoln Memorial', 38.8893, -77.0502, 'United States', 'peace', 7, 'Where Martin Luther King Jr. shared his dream in 1963.'],
  ['canyon', 'Grand Canyon', 'Grand Canyon', 36.1069, -112.1129, 'United States', 'nature', 9, 'Nearly two billion years of Earth’s history, layer by layer.'],
  ['yosemite', 'Yosemite', 'Yosemite National Park', 37.8651, -119.5383, 'United States', 'nature', 8, 'Granite cliffs, giant sequoias and falling water.'],
  ['niagara', 'Niagara Falls', 'Niagara Falls', 43.0962, -79.0377, 'Canada and United States', 'nature', 8, 'Three waterfalls thundering on the border of two countries.'],
  ['banff', 'Banff', 'Banff National Park', 51.4968, -115.9281, 'Canada', 'nature', 7, 'Turquoise lakes beneath the Canadian Rockies.'],
  ['chichen', 'Chichén Itzá', 'Chichen Itza', 20.6843, -88.5678, 'Mexico', 'wonder', 9, 'A Maya city where a serpent of shadow descends the pyramid at the equinox.'],
  ['christ', 'Christ the Redeemer', 'Christ the Redeemer (statue)', -22.9519, -43.2105, 'Brazil', 'sacred', 9, 'Arms open wide over Rio de Janeiro.'],
  ['iguazu', 'Iguazú Falls', 'Iguazu Falls', -25.6953, -54.4367, 'Argentina and Brazil', 'nature', 8, 'Some 275 waterfalls along nearly three kilometres of river.'],
  ['machu', 'Machu Picchu', 'Machu Picchu', -13.1631, -72.545, 'Peru', 'wonder', 10, 'An Inca citadel high in the Andes, above the clouds.'],
  ['galapagos', 'Galápagos Islands', 'Galápagos Islands', -0.9538, -90.9656, 'Ecuador', 'nature', 8, 'The islands that set Darwin thinking.'],
  ['uyuni', 'Salar de Uyuni', 'Salar de Uyuni', -20.1338, -67.4891, 'Bolivia', 'nature', 7, 'The world’s largest salt flat, a mirror of the sky after rain.'],
  ['rapanui', 'Rapa Nui', 'Easter Island', -27.1127, -109.3497, 'Chile', 'wonder', 7, 'Nearly a thousand moai watching over a remote Pacific island.'],
  ['moon', 'The Moon', 'Moon', null, null, 'Beyond Earth', 'beyond', 10, 'The first world beyond our own to carry human footprints.'],
  ['iss', 'International Space Station', 'International Space Station', null, null, '400 km above Earth', 'beyond', 8, 'A home in orbit, circling the planet every 90 minutes.'],
  ['mars', 'Mars', 'Mars', null, null, 'Beyond Earth', 'beyond', 9, 'The red planet, explored by our robots since 1997.'],
  ['andromeda', 'Andromeda Galaxy', 'Andromeda Galaxy', null, null, '2.5 million light-years away', 'beyond', 6, 'The farthest thing you can see with the naked eye.'],
];

export const DESTS = RAW.map(([id, name, wiki, lat, lon, where, kind, pop, blurb]) => ({ id, name, wiki, lat, lon, where, kind, pop, blurb }));
export const EARTH = DESTS.filter((d) => d.kind !== 'beyond');
export const byId = (id) => DESTS.find((d) => d.id === id) || null;

export const KIND_LABEL = {
  sacred: 'Sacred place', nature: 'Natural wonder', wonder: 'Ancient wonder', landmark: 'Landmark', peace: 'Place of remembrance', beyond: 'Beyond Earth',
};

export function kmBetween(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

// popularity, pulled toward what is close to the visitor
const score = (d, from) => d.pop - kmBetween(from, d) / 400;

export function buildRows(from) {
  const place = from.city && from.city !== 'Somewhere' ? from.city : 'you';
  const ranked = [...EARTH].sort((a, b) => score(b, from) - score(a, from));
  const near = [...EARTH].sort((a, b) => kmBetween(from, a) - kmBetween(from, b));
  const of = (...kinds) => ranked.filter((d) => kinds.includes(d.kind));
  return [
    { id: 'top', title: `Top 10 near ${place} today`, items: ranked.slice(0, 10), top: true },
    { id: 'near', title: `Close to ${place === 'you' ? 'home' : place}`, chip: `Near ${place === 'you' ? 'you' : place}`, items: near.slice(0, 12) },
    { id: 'sacred', title: 'Sacred places', chip: 'Sacred places', items: of('sacred') },
    { id: 'nature', title: 'Wonders of nature', chip: 'Nature', items: of('nature') },
    { id: 'world', title: 'Wonders of the world', chip: 'Wonders of the world', items: of('wonder', 'landmark') },
    { id: 'peace', title: 'Places of peace and remembrance', chip: 'Peace and remembrance', items: of('peace') },
    { id: 'beyond', title: 'Coming soon: beyond Earth', chip: 'Beyond Earth', items: DESTS.filter((d) => d.kind === 'beyond'), soon: true },
  ];
}

// one image per destination from Wikipedia (CORS-enabled Action API)
let photos = null;
export function loadPhotos() {
  if (photos) return photos;
  const titles = DESTS.map((d) => d.wiki);
  const chunks = [];
  for (let i = 0; i < titles.length; i += 45) chunks.push(titles.slice(i, i + 45));
  photos = Promise.all(chunks.map(async (list) => {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', format: 'json', origin: '*', redirects: '1', prop: 'pageimages',
      piprop: 'thumbnail', pithumbsize: '1280', pilimit: '50', titles: list.join('|'),
    });
    const j = await (await fetch(url)).json();
    const q = j.query || {};
    const alias = new Map();
    (q.normalized || []).forEach((n) => alias.set(n.from, n.to));
    (q.redirects || []).forEach((n) => alias.set(n.from, n.to));
    const byTitle = new Map(Object.values(q.pages || {}).map((p) => [p.title, p.thumbnail?.source]));
    return list.map((t) => {
      let k = t;
      for (let i = 0; i < 3 && alias.has(k); i++) k = alias.get(k);
      return [t, byTitle.get(k) || null];
    });
  })).then((parts) => {
    const map = new Map(parts.flat());
    return new Map(DESTS.map((d) => [d.id, map.get(d.wiki) || null]));
  }).catch(() => new Map());
  return photos;
}

// Wikimedia serves standard thumbnail widths; 500px is plenty for a card.
export const cardSrc = (src) => (src ? src.replace(/\/\d+px-/, '/500px-') : null);
