const qs = (sel, el=document) => el.querySelector(sel);
const qsa = (sel, el=document) => Array.from(el.querySelectorAll(sel));


const state = {
    page: 1,
    pageSize: 12,
    lastQuery: {}
};

async function search(page=1){
    const form = qs('#searchForm');
    const params = new URLSearchParams();


    const comuna = normalize(form.comuna.value);
    const roomsMin = form.roomsMin.value.trim();
    const bathsMin = form.bathsMin.value.trim();
    const minM2 = form.minM2.value.trim();
    const maxM2 = form.maxM2.value.trim();
    const sort = form.sort.value;

    if (comuna) params.set('comuna', comuna);
    if (roomsMin !== '') params.set('roomsMin', roomsMin);
    if (bathsMin !== '') params.set('bathsMin', bathsMin);
    if (minM2 !== '') params.set('minM2', minM2);
    if (maxM2 !== '') params.set('maxM2', maxM2);
    if (sort) params.set('sort', sort);
    params.set('page', page);
    params.set('pageSize', state.pageSize);

    state.lastQuery = Object.fromEntries(params.entries());


    const url = `/api/properties?${params.toString()}`;
    const resultsEl = qs('#results');
    const summaryEl = qs('#summary');
    const pagerEl = qs('#pager');
    resultsEl.innerHTML = '<div class="summary">Buscando…</div>';

    try {
        const res = await fetch(url);
        const data = await res.json();


        renderResults(data.items);
        const from = (data.page - 1)*data.pageSize + 1;
        const to = Math.min(data.page*data.pageSize, data.total);
        summaryEl.textContent = `${data.total} resultados · mostrando ${from}-${to}`;
        setupPager(data);
    }   catch (err) {
        resultsEl.innerHTML = `<div class="summary">Error al buscar: ${err}</div>`;
        pagerEl.hidden = true;
    }
}

function renderResults(items){
    const resultsEl = qs('#results');
    if (!items.length){
        resultsEl.innerHTML = '<div class="summary">No se encontraron resultados con esos filtros.</div>';
        return;
}
  const html = items.map(it => `
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
          ${it.parking ? `<span class="badge">🅿️ ${it.parking}</span>` : ''}
        </div>
        <div class="price">${formatPrice(it.price, 'UF')}</div>
      </div>
    </article>
  `).join('');
  resultsEl.innerHTML = html;
}

function setupPager({page, pageSize, total}){
    const pager = qs('#pager');
    pager.hidden = total <= pageSize;
    if (pager.hidden) return;
    qs('#pageInfo').textContent = `Página ${page} de ${Math.max(1, Math.ceil(total/pageSize))}`;
    qs('#prevPage').disabled = page <= 1;
    qs('#nextPage').disabled = page >= Math.ceil(total/pageSize);


    qs('#prevPage').onclick = () => {
        state.page = Math.max(1, page - 1);
        search(state.page);
    };
    qs('#nextPage').onclick = () => {
        state.page = Math.min(Math.ceil(total/state.pageSize), page + 1);
        search(state.page);
    };
}

function formatPrice(v, currency = 'UF') {
    try {
        const locale = 'es-CL';

        if (currency === 'UF') {
            return `UF ${Number(v).toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
        }

        return new Intl.NumberFormat(locale, { 
            style: 'currency', 
            currency: 'CLP', 
            maximumFractionDigits: 0 
        }).format(v);

    } catch {
        return `${v} ${currency}`;
    }
}

function normalize(str = "") {
    return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Elimina tildes (á → a, ú → u)
        .trim();
}


function escapeHtml(str=''){
    return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
}


qs('#searchForm').addEventListener('submit', ev => {
    ev.preventDefault();
    state.page = 1;
    search(1);
});


// primera búsqueda por defecto
search(1);

const btnLimpiar = document.getElementById('btnLimpiar');
if (btnLimpiar){
  btnLimpiar.addEventListener('click', () => {
    const form = document.getElementById('searchForm');
    form.reset();
    ['comuna','roomsMin','bathsMin','minM2','maxM2'].forEach(id => {
      if (form[id]) form[id].value = '';
    });
    state.page = 1;
    search(1);
  });
}
