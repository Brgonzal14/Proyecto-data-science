const qs = (s, el=document) => el.querySelector(s);

function formatPrice(v, currency='CLP'){
  try{
    const locale = 'es-CL';
    if (currency === 'UF') return `${v} UF`;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(v);
  }catch{
    return `${v} ${currency}`;
  }
}
function escapeHtml(str=''){
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function getId(){
  // Soporta /p/:id y ?id=...
  const fromQuery = new URLSearchParams(location.search).get('id');
  if (fromQuery) return Number(fromQuery);
  const m = location.pathname.match(/\/p\/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

async function load(){
  const id = getId();
  if (!id) {
    qs('#title').textContent = 'Propiedad no encontrada';
    return;
  }

  // Detalle
  const res = await fetch(`/api/properties/${id}`);
  if (!res.ok){
    qs('#title').textContent = 'Propiedad no encontrada';
    return;
  }
  const p = await res.json();

  qs('#title').textContent = p.title;
  qs('#h2').textContent    = p.title;
  qs('#price').textContent = formatPrice(p.price, p.currency);
  qs('#address').textContent = `${p.address || ''} ${p.comuna ? '· ' + p.comuna : ''}`;

  qs('#meta').innerHTML = `
    <span class="badge">🛏 ${p.rooms ?? '—'} hab.</span>
    <span class="badge">🛁 ${p.baths ?? '—'} baños</span>
    <span class="badge">📐 ${p.m2 ?? '—'} m²</span>
    ${p.parking ? `<span class="badge">🅿️ ${p.parking}</span>` : ''}
    <span class="badge">💱 ${escapeHtml(p.currency || 'CLP')}</span>
  `;

  // (placeholder de imagen)
  qs('#thumb').setAttribute('aria-label', `Vista de ${p.title}`);

  // Lista de info rápida
  qs('#infoList').innerHTML = `
    <ul class="bullets">
      <li><strong>Habitaciones:</strong> ${p.rooms ?? '—'}</li>
      <li><strong>Baños:</strong> ${p.baths ?? '—'}</li>
      <li><strong>Superficie:</strong> ${p.m2 ?? '—'} m²</li>
      <li><strong>Estacionamientos:</strong> ${p.parking ?? 0}</li>
      <li><strong>Moneda:</strong> ${escapeHtml(p.currency || 'CLP')}</li>
    </ul>
  `;

  // Similares (si configuraste el endpoint)
  try{
    const simRes = await fetch(`/api/properties/${id}/similar`);
    if (simRes.ok){
      const { items } = await simRes.json();
      renderSimilar(items);
    }
  }catch{}
}

function renderSimilar(items){
  const el = qs('#similar');
  if (!items || !items.length){ el.innerHTML = '<div class="summary">No se encontraron similares.</div>'; return; }
  el.innerHTML = items.map(it => `
    <article class="card">
      <a class="card-link" href="/p/${it.id}" aria-label="Ver detalle de ${escapeHtml(it.title)}"></a>
      <div class="thumb" role="img" aria-label="Vista de la propiedad"></div>
      <div class="body">
        <h3>${escapeHtml(it.title)}</h3>
        <div class="meta">
          <span class="badge">📍 ${escapeHtml(it.comuna || '—')}</span>
          <span class="badge">🛏 ${it.rooms ?? '—'}</span>
          <span class="badge">🛁 ${it.baths ?? '—'}</span>
          <span class="badge">📐 ${it.m2 ?? '—'} m²</span>
        </div>
        <div class="price">${formatPrice(it.price, it.currency)}</div>
      </div>
    </article>
  `).join('');
}

load();
