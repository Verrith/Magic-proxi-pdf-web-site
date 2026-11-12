const $ = s => document.querySelector(s);
let deck = [],
  deckName = 'Deck',
  localImages = [],
  selectedCard = null,
  customBackImage = '';

const defaultCardBack = 'https://drive.google.com/thumbnail?id=1LrVX0pUcye9n_0RtaDNVl2xPrQgn7CYf&sz=w2000';

const exampleXml = `<order>
  <details><quantity>5</quantity><bracket>18</bracket><stock>(S30) Standard Smooth</stock><foil>false</foil></details>
  <fronts>
    <card><id>1goKmY1CthmHueDbR6qxp5VmKcnC6Pdml</id><slots>0</slots><name>Swamp (Piotr Dura).jpg</name><query>swamp</query></card>
    <card><id>1h05re_7o4ZUfHmsngpskpQhZPXghQ2Pd</id><slots>1</slots><name>Island (Johannes Voss).jpg</name><query>island</query></card>
    <card><id>1cUj_XiS8NG4FOVItS0SeD6xiPCZ6S7BY</id><slots>2</slots><name>Mountain (Sam Burley).jpg</name><query>mountain</query></card>
    <card><id>1hSp4UCO6ZEMJiEE2kTIwFDUuxn5b0RyB</id><slots>3</slots><name>Forest (Sam Burley).jpg</name><query>forest</query></card>
    <card><id>1geEVjn8SK5fy7BI89b5XUxzQd9eJv21y</id><slots>4</slots><name>Plains (Piotr Dura).jpg</name><query>plains</query></card>
  </fronts>
  <cardback>1LrVX0pUcye9n_0RtaDNVl2xPrQgn7CYf</cardback>
</order>`;

function text(el, names) {
  for (const n of names) {
    const x = el.getElementsByTagName(n)[0];
    if (x && x.textContent.trim()) return x.textContent.trim()
  }
  return ''
}

function slots(el) {
  let s = text(el, ['slots', 'slot']);
  const m = s.match(/\d+/g);
  return m ? m.map(Number) : []
}

function idToUrl(id) {
  if (!id) return '';
  if (/^https?:\/\//i.test(id)) return id;
  return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w2000'
}

function parse(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('Le fichier XML est invalide.');
  const root = doc.documentElement;
  if (root.tagName.toLowerCase() !== 'order') throw Error(
    'Ce XML ne semble pas être un ordre MPC : élément <order> absent.');
  const sides = ['fronts', 'backs'].map(tag => {
    const section = root.getElementsByTagName(tag)[0];
    const map = new Map();
    if (section)
      for (const c of [...section.getElementsByTagName('card')]) {
        const image = text(c, ['id', 'url', 'image', 'imageUrl']);
        const name = text(c, ['name', 'query']) || 'Carte';
        const ss = slots(c);
        for (const s of ss) map.set(s, {
          url: idToUrl(image),
          imageId: image,
          name
        })
      }
    return map
  });
  const fs = sides[0],
    bs = sides[1],
    backId = text(root, ['cardback']),
    cardback = idToUrl(backId);
  const ids = [...new Set([...fs.keys(), ...bs.keys()])].sort((a, b) => a - b);
  if (!ids.length) throw Error(
    'Aucune carte trouvée. Le fichier doit contenir des cartes avec leurs slots.');
  return ids.map(slot => {
    const uniqueBack = bs.get(slot)?.url || '';
    return {
      slot,
      name: fs.get(slot)?.name || bs.get(slot)?.name || 'Carte ' + slot,
      front: fs.get(slot)?.url || '',
      frontId: fs.get(slot)?.imageId || '',
      back: uniqueBack || cardback,
      backId: bs.get(slot)?.imageId || backId,
      backKind: uniqueBack ? 'unique' : cardback ? 'common' : 'missing',
      sourceType: 'xml'
    }
  });
}

function status(msg) {
  $('#status').textContent = msg
}

function effectiveBack(card) {
  if (card?.backKind === 'unique') return card.back || '';
  if (!$('#commonBacks').checked) return '';
  return customBackImage || (card?.backKind === 'common' && card.back ? card.back : defaultCardBack)
}

function render() {
  const host = $('#cards');
  host.innerHTML = '';
  deck.forEach((c, index) => {
    const e = document.createElement('div');
    e.className = 'card';
    e.tabIndex = 0;
    e.setAttribute('role', 'button');
    e.setAttribute('aria-label', `Voir le recto et le verso de ${c.name}`);
    const open = () => showDetail(c);
    e.addEventListener('click', open);
    e.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open()
      }
    });
    const im = document.createElement('img');
    im.src = c.front || c.back || '';
    im.alt = c.name;
    const t = document.createElement('span');
    t.textContent = index + 1 + '. ' + c.name;
    e.append(im, t);
    host.append(e)
  });
  $('#print').disabled = !deck.length;
  $('#printFallback').disabled = !deck.length
}

function showDetail(card) {
  selectedCard = card;
  $('#detailName').textContent = card.name;
  for (const [side, key] of [
      ['front', 'Front'],
      ['back', 'Back']
    ]) {
    const img = $(`#detail${key}`);
    const empty = $(`#empty${key}`);
    const imageSrc = side === 'back' ? effectiveBack(card) : card[side] || '';
    img.src = imageSrc;
    img.alt = `${card.name} — ${side === 'front' ? 'recto' : 'verso'}`;
    img.hidden = !imageSrc;
    empty.hidden = !!imageSrc
  }
  $('#cardModal').hidden = false;
  $('#closeDetail').focus()
}

function closeDetail() {
  $('#cardModal').hidden = true;
  selectedCard = null
}

$('#closeDetail').addEventListener('click', closeDetail);
$('#commonBacks').addEventListener('change', () => {
  if (selectedCard) showDetail(selectedCard)
});
$('#backImage').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    status('Choisis un fichier image pour le dos.');
    event.target.value = '';
    return
  }
  try {
    customBackImage = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(Error('Impossible de lire cette image.'));
      reader.readAsDataURL(file)
    });
    $('#commonBacks').checked = true;
    $('#resetBackImage').disabled = false;
    if (selectedCard) showDetail(selectedCard);
    status('Image personnalisée appliquée aux dos communs seulement.')
  } catch (err) {
    status(err.message || 'Impossible de charger cette image.')
  }
});
$('#resetBackImage').addEventListener('click', () => {
  customBackImage = '';
  $('#backImage').value = '';
  $('#resetBackImage').disabled = true;
  if (selectedCard) showDetail(selectedCard);
  status('Dos de base rétabli.')
});
$('#deleteCard').addEventListener('click', () => {
  if (!selectedCard) return;
  const index = deck.indexOf(selectedCard);
  if (index < 0) return closeDetail();
  const name = selectedCard.name;
  deck.splice(index, 1);
  closeDetail();
  render();
  status(`« ${name} » supprimée du deck. Elle ne sera pas dans le PDF.`)
});
$('#cardModal').addEventListener('click', event => {
  if (event.target === $('#cardModal')) closeDetail()
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#cardModal').hidden) closeDetail()
});
$('#xmlFile').addEventListener('change', async e => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    deck = parse(await f.text());
    deckName = f.name.replace(/\.[^.]+$/, '') || 'Deck';
    render();
    status(
      `${deck.length} carte(s) chargée(s). Les images apparaissent au fur et à mesure du chargement.`
    )
  } catch (err) {
    deck = [];
    render();
    status(err.message)
  }
});

function moxfieldId(value) {
  try {
    const url = new URL(value.trim());
    if (!['moxfield.com', 'www.moxfield.com'].includes(url.hostname)) return '';
    return url.pathname.match(/^\/decks\/([\w-]+)/i)?.[1] || ''
  } catch {
    return ''
  }
}

function scryfallPrintImage(scryfallId, face = 'front') {
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(scryfallId || '')) return '';
  const id = scryfallId.toLowerCase();
  return `https://cards.scryfall.io/normal/${face}/${id[0]}/${id[1]}/${id}.jpg`
}

function moxfieldImage(card, entryId, face = 'front', faceIndex = 0) {
  const id = faceIndex > 0
    ? card.card_faces?.[faceIndex]?.uniqueCardId || card.card_faces?.[faceIndex]?.id || card.uniqueCardId || entryId
    : card.uniqueCardId || entryId || card.id;
  return scryfallPrintImage(card.scryfall_id || card.scryfallId, face) ||
    (id ? `https://assets.moxfield.net/cards/card-${encodeURIComponent(id)}-normal.webp` : '')
}

function archidektId(value) {
  try {
    const url = new URL(value.trim());
    if (!['archidekt.com', 'www.archidekt.com'].includes(url.hostname.toLowerCase())) return '';
    return url.pathname.match(/^\/decks\/(\d+)(?:\/|$)/)?.[1] || ''
  } catch {
    return ''
  }
}

function archidektCard(entry, section) {
  const print = entry.card || {};
  const oracle = print.oracleCard || {};
  const name = oracle.name || print.displayName || 'Carte';
  const image = scryfallPrintImage(print.uid);
  if (!image) throw Error(`Image introuvable pour « ${name} » sur Archidekt.`);
  const layout = String(oracle.layout || '').toLowerCase();
  const hasBack = ['transform', 'modal_dfc', 'reversible_card', 'double_faced_token', 'flip'].includes(layout);
  const back = hasBack ? scryfallPrintImage(print.uid, 'back') : '';
  return {
    name,
    image,
    back,
    backKind: back ? 'unique' : 'missing',
    quantity: Math.max(1, Number(entry.quantity) || 1),
    section,
    type: [...(oracle.types || []), ...(oracle.subTypes || [])].join(' ')
  }
}

$('#loadArchidekt').addEventListener('click', async () => {
  const id = archidektId($('#archidektUrl').value);
  if (!id) {
    status('Colle un lien valide vers un deck Archidekt.');
    return
  }
  const button = $('#loadArchidekt');
  button.disabled = true;
  try {
    status('Récupération du deck Archidekt…');
    const requestJson = async endpoint => {
      const target = `https://archidekt.com/api/decks/${encodeURIComponent(id)}/${endpoint}`;
      const response = await fetch(`https://cors.tools/proxy?url=${encodeURIComponent(target)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(25000)
      });
      let payload;
      try { payload = await response.json() } catch { payload = null }
      if (!response.ok) {
        const detail = typeof payload?.detail === 'string' ? payload.detail : '';
        throw Error(detail || `Archidekt a répondu HTTP ${response.status}.`)
      }
      return payload
    };
    const data = await requestJson('');
    deckName = data.name || data.deckName || `Archidekt-${id}`;
    const tokenResult = await requestJson('tokens/').catch(() => []);
    const cards = [];
    const categories = new Map((data.categories || []).map(category => [String(category.name).toLowerCase(), category]));
    for (const entry of data.cards || []) {
      const names = (entry.categories || []).map(name => String(name).toLowerCase());
      if (names.some(name => categories.has(name) && categories.get(name).includedInDeck === false)) continue;
      const section = names.includes('commander') ? 'Commander'
        : names.includes('companion') || entry.companion ? 'Companion'
          : names.includes('sideboard') ? 'Sideboard' : 'Mainboard';
      const imported = archidektCard(entry, section);
      for (let i = 0; i < imported.quantity; i++) cards.push({
        slot: cards.length,
        name: imported.name,
        front: imported.image,
        frontId: '',
        back: imported.back,
        backId: '',
        backKind: imported.backKind
      })
    }
    const tokenPrints = Array.isArray(tokenResult) ? tokenResult : [];
    const seenTokens = new Set();
    for (const print of tokenPrints) {
      const oracle = print.oracleCard || {};
      const types = (oracle.types || []).map(type => String(type).toLowerCase());
      const layout = String(oracle.layout || '').toLowerCase();
      if (!oracle.name || (!types.includes('token') && !['token', 'double_faced_token'].includes(layout))) continue;
      const tokenKey = String(oracle.id || print.uid || print.id);
      if (seenTokens.has(tokenKey)) continue;
      seenTokens.add(tokenKey);
      const imported = archidektCard({ card: print, quantity: 1 }, 'Tokens');
      cards.push({
        slot: cards.length,
        name: imported.name,
        front: imported.image,
        frontId: '',
        back: imported.back,
        backId: '',
        backKind: imported.backKind
      })
    }
    if (!cards.length) throw Error('Aucune carte trouvée. Vérifie que le deck Archidekt est public et contient une liste.');
    deck = cards;
    render();
    status(`${deck.length} carte(s) importée(s) depuis Archidekt avec les impressions choisies.`)
  } catch (err) {
    status(err?.name === 'TimeoutError'
      ? 'Le service Archidekt met trop de temps à répondre. Réessaie dans un instant.'
      : err instanceof TypeError
        ? 'Le service de lecture Archidekt est momentanément inaccessible. Réessaie plus tard.'
        : err.message || 'Import Archidekt impossible.');
  } finally {
    button.disabled = false
  }
});

const importTabs = [...document.querySelectorAll('[data-import-mode]')];
function selectImportMode(mode, moveFocus = false) {
  for (const tab of importTabs) {
    const selected = tab.dataset.importMode === mode;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
    if (selected && moveFocus) tab.focus();
  }
}
importTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectImportMode(tab.dataset.importMode));
  tab.addEventListener('keydown', event => {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % importTabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + importTabs.length) % importTabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = importTabs.length - 1;
    else return;
    event.preventDefault();
    selectImportMode(importTabs[next].dataset.importMode, true);
  });
});

$('#loadMoxfield').addEventListener('click', async () => {
  const id = moxfieldId($('#moxfieldUrl').value);
  if (!id) {
    status('Colle un lien valide vers un deck Moxfield.');
    return
  }
  const button = $('#loadMoxfield');
  button.disabled = true;
  try {
    status('Récupération du deck Moxfield…');
    const apiUrl = `https://api2.moxfield.com/v3/decks/all/${encodeURIComponent(id)}`;
    const response = await fetch(`https://cors.tools/proxy?url=${encodeURIComponent(apiUrl)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(25000)
    });
    let data;
    try { data = await response.json() } catch { data = null }
    if (!response.ok) {
      const upstreamError = typeof data?.error === 'string' ? data.error : data?.error?.message;
      throw Error(upstreamError || `Impossible de lire ce deck (HTTP ${response.status}). Vérifie qu’il est public.`)
    }
    data = data?.deck || data;
    deckName = data.name || data.deckName || `Moxfield-${id}`;
    const boards = data.boards || {};
    const entries = ['commanders', 'mainboard', 'companions', 'sideboard', 'maybeboard'].flatMap(board =>
      Object.entries(boards[board]?.cards || {}).map(([entryId, entry]) => ({ entryId, ...entry })));
    if (!entries.length) throw Error('Aucune carte trouvée dans le deck Moxfield.');
    const imported = [];
    for (const entry of entries) {
      const card = entry.card || {};
      const name = card.name || entry.name || 'Carte';
      const count = Math.max(1, Number(entry.quantity || entry.qty) || 1);
      const image = moxfieldImage(card, entry.entryId);
      if (!image) throw Error(`Image introuvable pour « ${name} ».`);
      const layout = String(card.layout || '').toLowerCase();
      const hasBack = ['transform', 'modal_dfc', 'reversible_card', 'double_faced_token', 'flip'].includes(layout);
      const back = hasBack ? moxfieldImage(card, entry.entryId, 'back', 1) : '';
      for (let i = 0; i < count; i++) imported.push({
        slot: imported.length,
        name,
        front: image,
        frontId: '',
        back,
        backId: '',
        backKind: back ? 'unique' : 'missing'
      });
    }
    deck = imported;
    render();
    status(`${deck.length} carte(s) importée(s) depuis Moxfield avec les impressions choisies.`)
  } catch (err) {
    status(err?.name === 'TimeoutError'
      ? 'Le service d’import met trop de temps à répondre. Réessaie dans un instant.'
      : err instanceof TypeError
        ? 'Le service de lecture du deck est momentanément inaccessible. Réessaie plus tard.'
        : err.message || 'Import Moxfield impossible.');
  } finally {
    button.disabled = false
  }
});


function pipglyphId(value) {
  try {
    const url = new URL(value.trim());
    if (!['pipglyph.com', 'www.pipglyph.com'].includes(url.hostname.toLowerCase())) return '';
    return url.pathname.match(/^\/deck\/([\w-]+)\/?$/i)?.[1] || '';
  } catch { return ''; }
}

function pipglyphCards(markup) {
  const doc = new DOMParser().parseFromString(markup, 'text/html');
  const pageDeckName = doc.querySelector('h1')?.textContent.trim() || doc.title.replace(/\s*[·|—-]\s*PipGlyph.*$/i, '').trim();
  const cards = [];
  for (const entry of doc.querySelectorAll('[data-deck-entry]')) {
    const image = entry.querySelector('img[src]');
    const label = entry.getAttribute('aria-label') || '';
    const quantityMatch = label.match(/,\s*(\d+)\s+copies?\b/i);
    const quantity = Math.max(1, Number(quantityMatch?.[1]) || 1);
    const nameFromLabel = quantityMatch ? label.slice(0, quantityMatch.index).trim() : label.split(',')[0].trim();
    const name = image?.alt?.trim() || nameFromLabel || 'Carte PipGlyph';
    if (!image) throw Error(`Image introuvable pour « ${name} » sur PipGlyph.`);
    const front = new URL(image.getAttribute('src'), 'https://www.pipglyph.com').href;
    for (let i = 0; i < quantity; i++) cards.push({
      slot: cards.length, name, front, frontId: '', back: '', backId: '', backKind: 'missing'
    });
  }
  if (!cards.length) throw Error('Aucune carte image trouvée. Vérifie que le deck PipGlyph est public et contient des cartes.');
  deckName = pageDeckName || 'PipGlyph';
  return cards;
}

$('#loadPipglyph').addEventListener('click', async () => {
  const slug = pipglyphId($('#pipglyphUrl').value);
  if (!slug) { status('Colle un lien valide vers un deck PipGlyph.'); return; }
  const button = $('#loadPipglyph');
  button.disabled = true;
  try {
    status('Récupération des cartes PipGlyph…');
    const target = `https://www.pipglyph.com/deck/${encodeURIComponent(slug)}`;
    const response = await fetch(`https://cors.tools/proxy?url=${encodeURIComponent(target)}`, {
      headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw Error(`PipGlyph a répondu HTTP ${response.status}. Vérifie que le deck est public.`);
    const imported = pipglyphCards(await response.text());
    deck = imported;
    render();
    status(`${deck.length} carte(s) importée(s) depuis PipGlyph avec leurs images.`);
  } catch (err) {
    status(err?.name === 'TimeoutError'
      ? 'PipGlyph met trop de temps à répondre. Réessaie dans un instant.'
      : err instanceof TypeError
        ? 'Le service de lecture PipGlyph est momentanément inaccessible. Réessaie plus tard.'
        : err.message || 'Import PipGlyph impossible.');
  } finally { button.disabled = false; }
});

function pdfFileTimestamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function pdfFileName() {
  const safeName = String(deckName || 'Deck')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '_').trim().replace(/[._]+$/, '').slice(0, 80);
  return `${pdfFileTimestamp()} “${safeName || 'Deck'}”.pdf`;
}

async function printSheets() {
  if (!deck.length) return;
  const root = $('#printRoot');
  root.innerHTML = '';
  const commonBacks = $('#commonBacks').checked;
  const uniqueBacks = commonBacks ? [] : deck.filter(card => card.backKind === 'unique' && card.back);
  let placedBacks = 0;
  const appendSheet = (cards, side, sourceStart, alignedBacks = false, trailingBacks = []) => {
    const sheet = document.createElement('div'); sheet.className = 'printSheet'; let hasImage = false;
    const frontCount = Math.min(9, cards.length - sourceStart);
    for (let cell = 0; cell < 9; cell++) {
      const row = Math.floor(cell / 3), col = cell % 3, sourceCol = alignedBacks ? 2 - col : col,
        mainCard = cards[sourceStart + row * 3 + sourceCol], tailIndex = cell - frontCount,
        isTrailingBack = !mainCard && tailIndex >= 0 && tailIndex < trailingBacks.length,
        card = mainCard || (isTrailingBack ? trailingBacks[tailIndex] : null),
        imageUrl = !card ? '' : (side === 'back' || isTrailingBack) ? effectiveBack(card) : card.front,
        box = document.createElement('div');
      box.className = 'printCard';
      if (imageUrl) { const image = document.createElement('img'); if (card.sourceType === 'xml') { image.crossOrigin = 'anonymous'; image.dataset.trimDarkMargins = 'true'; image.src = corsImageUrl(imageUrl); } else image.src = imageUrl; image.alt = card.name + ((side === 'back' || isTrailingBack) ? ' verso' : ' recto'); box.append(image); hasImage = true; }
      sheet.append(box);
    }
    if (hasImage) root.append(sheet);
  };
  for (let start = 0; start < deck.length; start += 9) {
    const frontCount = Math.min(9, deck.length - start), isLastFrontSheet = start + 9 >= deck.length,
      trailingBacks = !commonBacks && isLastFrontSheet ? uniqueBacks.slice(0, 9 - frontCount) : [];
    appendSheet(deck, 'front', start, false, trailingBacks); placedBacks += trailingBacks.length;
    if (commonBacks) appendSheet(deck, 'back', start, true);
  }
  if (!commonBacks) for (let start = placedBacks; start < uniqueBacks.length; start += 9) appendSheet(uniqueBacks, 'back', start);
  status('Préparation des feuilles A4…');
  await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? Promise.resolve() : new Promise(resolve => { img.onload = resolve; img.onerror = resolve; })));
  await Promise.all([...root.querySelectorAll('img[data-trim-dark-margins]')].map(async image => {
    try { image.src = trimDarkMarginDataUrl(image); if (image.decode) await image.decode(); } catch { /* keep the original if image cropping is blocked */ }
  }));
  status('Dans la fenêtre d’impression, choisis « Enregistrer au format PDF ».');
  const previousTitle = document.title;
  document.title = pdfFileName().replace(/\.pdf$/i, '');
  try { window.print(); } finally { document.title = previousTitle; }
}
$('#printFallback').onclick = printSheets;

$('#demo').onclick = () => {
  try {
    deck = parse(exampleXml);
    deckName = 'Exemple';
    deck.forEach(card => {
      card.name = card.name.replace(/ \([^)]*\)\.jpg$/i, '')
    });
    render();
    status('Exemple chargé depuis le XML fourni : cinq terrains de base et un dos commun.')
  } catch (err) {
    status(err.message)
  }
};

function corsImageUrl(url) {
  return url.startsWith('data:') ? url : 'https://images.weserv.nl/?url=' + encodeURIComponent(
    url) + '&w=2000&output=jpg'
}

function darkMarginBounds(image) {
  const sampleWidth = 180, sampleHeight = 252, sample = document.createElement('canvas');
  sample.width = sampleWidth; sample.height = sampleHeight;
  const sampleContext = sample.getContext('2d', { willReadFrequently: true });
  sampleContext.drawImage(image, 0, 0, sampleWidth, sampleHeight);
  const pixels = sampleContext.getImageData(0, 0, sampleWidth, sampleHeight).data;
  const visibleRow = y => {
    let visible = 0;
    for (let x = 0; x < sampleWidth; x++) {
      const i = (y * sampleWidth + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 54) visible++;
    }
    return visible / sampleWidth > .035;
  };
  const visibleColumn = x => {
    let visible = 0;
    for (let y = 0; y < sampleHeight; y++) {
      const i = (y * sampleWidth + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) > 54) visible++;
    }
    return visible / sampleHeight > .035;
  };
  let left = 0, right = sampleWidth - 1, top = 0, bottom = sampleHeight - 1;
  while (left < sampleWidth * .2 && !visibleColumn(left)) left++;
  while (right > sampleWidth * .8 && !visibleColumn(right)) right--;
  while (top < sampleHeight * .2 && !visibleRow(top)) top++;
  while (bottom > sampleHeight * .8 && !visibleRow(bottom)) bottom--;
  const padding = 2;
  left = Math.max(0, left - padding); right = Math.min(sampleWidth - 1, right + padding);
  top = Math.max(0, top - padding); bottom = Math.min(sampleHeight - 1, bottom + padding);
  const sx = Math.floor(left / sampleWidth * image.naturalWidth),
    sy = Math.floor(top / sampleHeight * image.naturalHeight),
    ex = Math.ceil((right + 1) / sampleWidth * image.naturalWidth),
    ey = Math.ceil((bottom + 1) / sampleHeight * image.naturalHeight),
    totalMargin = sx + sy + image.naturalWidth - ex + image.naturalHeight - ey;
  if (totalMargin / (image.naturalWidth + image.naturalHeight) < .025)
    return { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight };
  return { x: sx, y: sy, width: ex - sx, height: ey - sy };
}

function trimDarkMarginDataUrl(image) {
  const crop = darkMarginBounds(image), canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 1397;
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', .94);
}

function loadJpeg(url, trimDarkMargins = false) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    if (url.startsWith('http')) im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 1397;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const crop = trimDarkMargins ? darkMarginBounds(im) : { x: 0, y: 0, width: im.naturalWidth, height: im.naturalHeight };
        ctx.drawImage(im, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
        const data = atob(canvas.toDataURL('image/jpeg', .94).split(',')[1]),
          bytes = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i);
        resolve({
          bytes,
          width: canvas.width,
          height: canvas.height
        })
      } catch (e) {
        reject(Error('Impossible de préparer une image pour le PDF : ' + (e.message ||
          'accès bloqué.')))
      }
    };
    im.onerror = () => reject(Error(
      'Une image n’a pas pu être récupérée. Vérifie son partage Google Drive et réessaie.'));
    im.src = corsImageUrl(url)
  })
}

function pdfBytes(pages) {
  const enc = s => new TextEncoder().encode(s),
    join = parts => {
      const size = parts.reduce((n, p) => n + p.length, 0),
        out = new Uint8Array(size);
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length
      }
      return out
    };
  const objs = [];
  objs[1] = [enc('<< /Type /Catalog /Pages 2 0 R >>')];
  const pageIds = pages.map((_, i) => 3 + i * 2),
    kids = pageIds.map(id => `${id} 0 R`).join(' ');
  objs[2] = [enc(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)];
  const pw = 210 / 25.4 * 72,
    ph = 297 / 25.4 * 72,
    cw = 63 / 25.4 * 72,
    ch = 88 / 25.4 * 72,
    gap = 2 / 25.4 * 72,
    mx = (pw - (3 * cw + 2 * gap)) / 2,
    my = (ph - (3 * ch + 2 * gap)) / 2,
    r = 3 / 25.4 * 72,
    k = .55228475 * r;
  let nextId = 3 + pages.length * 2;
  pages.forEach((entries, i) => {
    const pid = pageIds[i],
      cid = pid + 1;
    let stream = '',
      xobj = '';
    const imageObjects = [];
    for (const ent of entries) {
      if (!ent.image) continue;
      const {
        x,
        y
      } = ent, name = `Im${ent.cell}`, iid = nextId++;
      xobj += ` /${name} ${iid} 0 R`;
      stream +=
        `q ${x+r} ${y} m ${x+cw-r} ${y} l ${x+cw-r+k} ${y} ${x+cw} ${y+r-k} ${x+cw} ${y+r} c ${x+cw} ${y+ch-r} l ${x+cw} ${y+ch-r+k} ${x+cw-r+k} ${y+ch} ${x+cw-r} ${y+ch} c ${x+r} ${y+ch} l ${x+r-k} ${y+ch} ${x} ${y+ch-r+k} ${x} ${y+ch-r} c ${x} ${y+r} l ${x} ${y+r-k} ${x+r-k} ${y} ${x+r} ${y} c h W n ${cw} 0 0 ${ch} ${x} ${y} cm /${name} Do Q\n`;
      imageObjects.push({
        id: iid,
        image: ent.image
      })
    }
    // Straight cut guides run across the sheet along both edges of every card.
    stream += '0.55 G 0.4 w\n';
    for (const x of [mx, mx + cw, mx + cw + gap, mx + 2 * cw + gap, mx + 2 * cw + 2 * gap, mx + 3 * cw + 2 * gap])
      stream += `${x} 0 m ${x} ${ph} l S\n`;
    for (const y of [my, my + ch, my + ch + gap, my + 2 * ch + gap, my + 2 * ch + 2 * gap, my + 3 * ch + 2 * gap])
      stream += `0 ${y} m ${pw} ${y} l S\n`;
    objs[pid] = [enc(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject <<${xobj} >> >> /Contents ${cid} 0 R >>`
    )];
    const sb = enc(stream);
    objs[cid] = [enc(`<< /Length ${sb.length} >>\nstream\n`), sb, enc('\nendstream')];
    for (const it of imageObjects) objs[it.id] = [enc(
      `<< /Type /XObject /Subtype /Image /Width ${it.image.width} /Height ${it.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${it.image.bytes.length} >>\nstream\n`
    ), it.image.bytes, enc('\nendstream')]
  });
  const parts = [enc('%PDF-1.4\n%âãÏÓ\n')],
    offsets = [0];
  let pos = parts[0].length;
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = pos;
    const head = enc(`${i} 0 obj\n`),
      tail = enc('\nendobj\n');
    parts.push(head, ...objs[i], tail);
    pos += head.length + objs[i].reduce((n, p) => n + p.length, 0) + tail.length
  }
  const xref = pos;
  let table = 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (let i = 1; i < objs.length; i++) table += String(offsets[i]).padStart(10, '0') +
    ' 00000 n \n';
  parts.push(enc(table +
    `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return join(parts)
}
$('#print').onclick = async () => {
  if (deck.some(c => !c.front && !c.back)) {
    status('Certaines cartes n’ont aucune image associée. Vérifie le XML.');
    return
  }
  const button = $('#print');
  button.disabled = true;
  try {
    const images = new Map(),
      getUrl = url => url ? corsImageUrl(url) : '';
    for (let i = 0; i < deck.length; i++) {
      status(`Téléchargement des images… ${i+1}/${deck.length}`);
      for (const side of ['front', 'back']) {
        if (side === 'back' && deck[i].backKind !== 'unique' && !$('#commonBacks').checked)
          continue;
        const source = side === 'back' ? effectiveBack(deck[i]) : deck[i][side],
          key = getUrl(source);
        if (key && !images.has(key)) images.set(key, await loadJpeg(source, deck[i].sourceType === 'xml'))
      }
    }
    const pages = [],
      per = 9,
      cols = 3,
      cw = 63 / 25.4 * 72,
      ch = 88 / 25.4 * 72,
      pw = 210 / 25.4 * 72,
      ph = 297 / 25.4 * 72,
      gap = 2 / 25.4 * 72,
      mx = (pw - (3 * cw + 2 * gap)) / 2,
      my = (ph - (3 * ch + 2 * gap)) / 2;
    const commonBacks = $('#commonBacks').checked;
    const appendEntries = (cards, start, side, compact = false) => {
      const entries = [];
      for (let cell = 0; cell < per; cell++) {
        const row = Math.floor(cell / cols),
          col = cell % cols,
          sourceCol = compact ? col : side === 'back' ? cols - 1 - col : col,
          card = cards[start + row * cols + sourceCol];
        if (!card) continue;
        const key = getUrl(side === 'back' ? effectiveBack(card) : card.front);
        if (!key) continue;
        entries.push({
          cell,
          x: mx + col * (cw + gap),
          y: ph - my - ch - row * (ch + gap),
          image: images.get(key)
        })
      }
      if (entries.length) pages.push(entries)
    };

    if (commonBacks) {
      for (let start = 0; start < deck.length; start += per) for (const side of ['front', 'back']) {
        const entries = [];
        for (let cell = 0; cell < per; cell++) {
          const row = Math.floor(cell / cols), col = cell % cols, sourceCol = side === 'back' ? cols - 1 - col : col, card = deck[start + row * cols + sourceCol];
          if (!card) continue; const key = getUrl(side === 'back' ? effectiveBack(card) : card.front); if (!key) continue;
          entries.push({ cell, x: mx + col * (cw + gap), y: ph - my - ch - row * (ch + gap), image: images.get(key) });
        }
        if (entries.length) pages.push(entries);
      }
    } else {
      const uniqueBacks = deck.filter(card => card.backKind === 'unique' && card.back); let placedBacks = 0;
      for (let start = 0; start < deck.length; start += per) {
        const frontCount = Math.min(per, deck.length - start), trailingCount = start + per >= deck.length ? Math.min(per - frontCount, uniqueBacks.length) : 0, entries = [];
        for (let cell = 0; cell < per; cell++) {
          const row = Math.floor(cell / cols), col = cell % cols, frontCard = deck[start + cell], trailingIndex = cell - frontCount,
            isTrailingBack = !frontCard && trailingIndex >= 0 && trailingIndex < trailingCount,
            card = frontCard || (isTrailingBack ? uniqueBacks[placedBacks + trailingIndex] : null), key = getUrl(!card ? '' : isTrailingBack ? effectiveBack(card) : card.front);
          if (!key) continue; entries.push({ cell, x: mx + col * (cw + gap), y: ph - my - ch - row * (ch + gap), image: images.get(key) });
        }
        if (entries.length) pages.push(entries); placedBacks += trailingCount;
      }
      for (let start = placedBacks; start < uniqueBacks.length; start += per) {
        const entries = [];
        for (let cell = 0; cell < per; cell++) {
          const row = Math.floor(cell / cols), col = cell % cols, card = uniqueBacks[start + cell], key = card ? getUrl(effectiveBack(card)) : ''; if (!key) continue;
          entries.push({ cell, x: mx + col * (cw + gap), y: ph - my - ch - row * (ch + gap), image: images.get(key) });
        }
        if (entries.length) pages.push(entries);
      }
    }
    const blob = new Blob([pdfBytes(pages)], {
        type: 'application/pdf'
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = pdfFileName();
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status(`PDF téléchargé : ${deck.length} carte(s), ${pages.length} pages A4.`)
  } catch (e) {
    status(e.message || 'Création du PDF impossible. Essaie le bouton Imprimer / enregistrer.')
  } finally {
    button.disabled = false
  }
};
