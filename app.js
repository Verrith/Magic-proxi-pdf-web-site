const $ = s => document.querySelector(s);
let deck = [],
  localImages = [];

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
      backKind: uniqueBack ? 'unique' : cardback ? 'common' : 'missing'
    }
  });
}

function status(msg) {
  $('#status').textContent = msg
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
  $('#detailName').textContent = card.name;
  for (const [side, key] of [
      ['front', 'Front'],
      ['back', 'Back']
    ]) {
    const img = $(`#detail${key}`);
    const empty = $(`#empty${key}`);
    img.src = card[side] || '';
    img.alt = `${card.name} — ${side === 'front' ? 'recto' : 'verso'}`;
    img.hidden = !card[side];
    empty.hidden = !!card[side]
  }
  $('#cardModal').hidden = false;
  $('#closeDetail').focus()
}

function closeDetail() {
  $('#cardModal').hidden = true
}

$('#closeDetail').addEventListener('click', closeDetail);
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

async function printSheets() {
  if (!deck.length) return;
  const root = $('#printRoot');
  root.innerHTML = '';
  for (let start = 0; start < deck.length; start += 9) {
    for (const side of ['front', 'back']) {
      const sheet = document.createElement('div');
      sheet.className = 'printSheet';
      for (let cell = 0; cell < 9; cell++) {
        const row = Math.floor(cell / 3),
          col = cell % 3,
          sourceCol = side === 'back' ? 2 - col : col,
          c = deck[start + row * 3 + sourceCol],
          box = document.createElement('div');
        box.className = 'printCard';
        const showBack = c && c.backKind === 'unique' || $('#commonBacks').checked;
        if (c?.[side] && (side === 'front' || showBack)) {
          const im = document.createElement('img');
          im.src = c[side];
          im.alt = c.name + ' ' + side;
          box.append(im)
        }
        sheet.append(box)
      }
      root.append(sheet)
    }
  }
  status('Préparation des feuilles A4…');
  await Promise.all([...root.querySelectorAll('img')].map(img => img.complete ? Promise
    .resolve() : new Promise(resolve => {
      img.onload = resolve;
      img.onerror = resolve
    })));
  status('Dans la fenêtre d’impression, choisis « Enregistrer au format PDF ».');
  window.print()
}
$('#printFallback').onclick = printSheets;

$('#demo').onclick = () => {
  try {
    deck = parse(exampleXml);
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

function loadJpeg(url) {
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
        ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
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
    mx = (pw - 3 * cw) / 2,
    my = (ph - 3 * ch) / 2,
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
        if (side === 'back' && deck[i].backKind === 'common' && !$('#commonBacks').checked)
          continue;
        const source = deck[i][side],
          key = getUrl(source);
        if (key && !images.has(key)) images.set(key, await loadJpeg(source))
      }
    }
    const pages = [],
      per = 9,
      cols = 3,
      cw = 63 / 25.4 * 72,
      ch = 88 / 25.4 * 72,
      pw = 210 / 25.4 * 72,
      ph = 297 / 25.4 * 72,
      mx = (pw - 3 * cw) / 2,
      my = (ph - 3 * ch) / 2;
    for (let start = 0; start < deck.length; start += per)
      for (const side of ['front', 'back']) {
        status(
          `Mise en page… feuille ${Math.floor(start/per)+1}/${Math.ceil(deck.length/per)} · ${side==='front'?'recto':'verso'}`
        );
        const entries = [];
        for (let cell = 0; cell < per; cell++) {
          const row = Math.floor(cell / cols),
            col = cell % cols,
            sourceCol = side === 'back' ? cols - 1 - col : col,
            c = deck[start + row * cols + sourceCol];
          if (!c || (side === 'back' && c.backKind === 'common' && !$('#commonBacks').checked))
            continue;
          const key = getUrl(c[side]);
          if (!key) continue;
          entries.push({
            cell,
            x: mx + col * cw,
            y: ph - my - (row + 1) * ch,
            image: images.get(key)
          })
        }
        pages.push(entries)
      }
    const blob = new Blob([pdfBytes(pages)], {
        type: 'application/pdf'
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = 'cartes-recto-verso.pdf';
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
