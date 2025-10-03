/* Tiny SPA with: list + inwork + archive, autosave, kebab actions, localStorage */
const $  = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const state = {
  route: 'list',
  tickets: [
    { id:'63 753', date:'19.01.25', type:'Газовий котел', address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем', status:'Нова' },
    { id:'63 754', date:'19.01.25', type:'Бойлер',         address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем', status:'Нова' },
    { id:'63 755', date:'19.01.25', type:'Газовий котел',  address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем', status:'Нова' },
  ],
  ui: { search:'', filter:'all' }
};

// Persistence
const STORAGE_KEY = 'olx-sc-state';
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ tickets: state.tickets })); }catch{} }
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && Array.isArray(parsed.tickets)) state.tickets = parsed.tickets;
  }catch{}
}
// normalize existing items (ensure .status)
function normalizeTickets(){ state.tickets = state.tickets.map(t => ({...t, status: t.status || 'Нова'})); }

// init
loadState();
normalizeTickets();

/* Router */
function navigate(route){
  state.route = route;
  window.history.replaceState({}, '', '#'+route);
  render();
  highlightNav(route);
}
function highlightNav(route){
  $$('.nav__item').forEach(b=>{
    const on = b.dataset.route===route;
    b.classList.toggle('is-active', on);
    if(on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  $$('.tab').forEach(b=>b.classList.toggle('is-active', b.dataset.route===route));
}

/* Render helpers */
function getFilteredTickets({ status } = {}){
  const q = state.ui.search;
  const f = state.ui.filter;
  return state.tickets.filter(tk=>{
    const byStatus = status ? (tk.status === status) : true;
    const byType   = (f==='all') || (tk.type === f);
    const blob     = `${tk.id} ${tk.date} ${tk.type} ${tk.address} ${tk.phone} ${tk.person}`.toLowerCase();
    const bySearch = !q || blob.includes(q);
    return byStatus && byType && bySearch;
  });
}

function renderTicketsPage({ title, statusFilter, showNewButton }){
  const app = $('#app');
  const t = (id)=>document.querySelector(`#${id}`).content.cloneNode(true);
  const view = t('tpl-list');
  const body = view.querySelector('#rows');

  // Заголовок и счетчик
  const titleEl = view.querySelector('#l-title');
  if(titleEl) titleEl.firstChild.nodeValue = title + ' ';
  const count = getFilteredTickets({ status: statusFilter }).length;
  const chip = view.querySelector('.chip'); if(chip) chip.textContent = '+'+count;
  // update sidebar badge to always show number of NEW ('Нова') tickets
  const sideBtn = document.querySelector('.nav__item[data-route="list"]');
  if(sideBtn){
    const sideBadge = sideBtn.querySelector('.badge');
    if(sideBadge){
      const newCount = getFilteredTickets({ status: 'Нова' }).length;
      sideBadge.textContent = String(newCount);
    }
  }

  // Контролы
  const searchEl = view.querySelector('#search');
  const filterEl = view.querySelector('#filter-device');
  searchEl.value = state.ui.search;
  filterEl.value = state.ui.filter;

  const list = getFilteredTickets({ status: statusFilter });
  list.forEach((tk)=>{
    const r   = t('tpl-row');
    const row = r.querySelector('.row');
    const c   = row.children;

    c[0].textContent = tk.id;
    c[1].textContent = tk.date;
    c[2].querySelector('[data-kind="type"]').textContent = tk.type;
    c[3].textContent = tk.address || '—';
    c[4].innerHTML   = `<a class="link" href="tel:+380961458554">${tk.phone || '—'}</a>`;
    c[5].textContent = tk.person || '—';

    // три точки
    row.querySelector('[data-action="more"]').addEventListener('click', (e)=>{
      e.stopPropagation(); toggleRowMenu(row, null);
    });

    // view
    row.querySelector('[data-action="view"]').addEventListener('click', (e)=>{
      e.stopPropagation(); closeAllMenus(); openDetail(tk, false, state.route);
    });

    // edit
    row.querySelector('[data-action="edit"]').addEventListener('click', (e)=>{
      e.stopPropagation(); closeAllMenus();
      // если мы редактируем из "Нові заявки", то переносим пользователя на маршрут #inwork,
      // но статус НЕ меняем автоматически — он поменяется в форме, если пользователь так выберет.
      if(state.route === 'list'){
        state.route = 'inwork';
        window.history.replaceState({}, '', '#inwork');
        openDetail(tk, true, 'inwork');
      } else {
        openDetail(tk, true, state.route);
      }
    });

    // delete
    row.querySelector('[data-action="del"]').addEventListener('click', (e)=>{
      e.stopPropagation();
      if(confirm('Видалити заявку '+tk.id+'?')){
        const idx = state.tickets.findIndex(x=>x.id===tk.id);
        state.tickets.splice(idx,1);
        saveState();
        render();
        toast('Заявку видалено');
      }
    });

    // закрыть поповер
    row.querySelector('[data-action="close"]').addEventListener('click', (e)=>{
      e.stopPropagation(); toggleRowMenu(row, false);
    });

    // клик по строке — просмотр
    row.addEventListener('click', ()=>openDetail(tk, false, state.route));

    // Mobile long-press to show kebab (hide button by default in CSS)
    // Активируется только на экранах < 881px и для touch-взаимодействий
    let pressTimer; let longShown = false;
    const isMobile = () => window.matchMedia('(max-width:880px)').matches;
    function startPress(e){
      if(!isMobile()) return; if(e.type==='mousedown') return; // игнорируем мышь
      clearTimeout(pressTimer);
      pressTimer = setTimeout(()=>{
        row.classList.add('show-kebab');
        longShown = true;
      }, 420); // 420ms hold
    }
    function cancelPress(){ clearTimeout(pressTimer); }
    function maybeHide(){ if(!isMobile()) return; if(longShown){ setTimeout(()=>{ row.classList.remove('show-kebab'); longShown=false; }, 3000); } }
    row.addEventListener('touchstart', startPress, {passive:true});
    row.addEventListener('touchmove', cancelPress, {passive:true});
    row.addEventListener('touchend', (e)=>{ cancelPress(); if(!longShown) { /* обычный tap уже откроет detail через click */ } else { e.preventDefault(); maybeHide(); }}, {passive:false});
    row.addEventListener('touchcancel', cancelPress, {passive:true});

    // Mobile layout transformation: build stacked lines
    if(window.matchMedia('(max-width:880px)').matches){
      row.classList.add('m-card');
      const lines = document.createElement('div');
      lines.className = 'm-lines';
      lines.innerHTML = `
          <div class="m-line m-line-top">
            <span class="m-id"><img class="m-ico" src="assets/number.png" alt=""/> ${tk.id}</span>
            <span class="m-date"><img class="m-ico" src="assets/calendar.png" alt=""/> ${tk.date}</span>
            <span class="m-tag"><img class="m-ico" src="assets/settings.png" alt=""/> ${tk.type}</span>
          </div>
          <div class="m-line m-address"><img class="m-ico" src="assets/house.png" alt=""/> ${tk.address || '—'}</div>
          <div class="m-line m-contact">
            <span class="m-phone"><img class="m-ico" src="assets/ring.png" alt=""/> <a class="link" href="tel:${tk.phone.replace(/\s+/g,'')}">${tk.phone || '—'}</a></span>
            <span class="m-person"><img class="m-ico" src="assets/person.png" alt=""/> ${tk.person || '—'}</span>
          </div>
      `;
      const actionsCell = row.querySelector('.row__actions');
      row.insertBefore(lines, actionsCell);
    }
    body.appendChild(r);
  });

  // события поиска/фильтра
  searchEl.addEventListener('input', (e)=>{ state.ui.search = e.target.value.trim().toLowerCase(); render(); });
  filterEl.addEventListener('change', (e)=>{ state.ui.filter = e.target.value; render(); });

  // кнопка "Нова заявка"
  const newBtn = view.querySelector('.btn.icon[title="Нова заявка"]');
  if(newBtn) newBtn.style.display = showNewButton ? '' : 'none';
  if(showNewButton) newBtn.addEventListener('click', createNewTicket);

  app.appendChild(view);
}

function render(){
  const app = $('#app');

  // сохранить фокус (чтобы поиск не терял каретку)
  const prevActive = document.activeElement;
  const preserve = (prevActive && prevActive.id &&
    (prevActive.tagName==='INPUT'||prevActive.tagName==='TEXTAREA'||prevActive.tagName==='SELECT'))
    ? { id: prevActive.id, start: prevActive.selectionStart, end: prevActive.selectionEnd } : null;

  app.innerHTML = '';

  if(state.route === 'list'){
    renderTicketsPage({ title: 'Нові заявки', statusFilter: 'Нова', showNewButton: true });
  } else if(state.route === 'inwork'){
    renderTicketsPage({ title: 'Заявки у роботі', statusFilter: 'У роботі', showNewButton: false });
  } else if(state.route === 'archive'){
    renderTicketsPage({ title: 'Архів заявок', statusFilter: 'Виконана', showNewButton: false });
  } else {
    app.innerHTML = '<section class="panel empty"><p>Сторінка у розробці.</p></section>';
  }

  // восстановить фокус
  if(preserve){
    const restored = document.getElementById(preserve.id) || app.querySelector('#'+preserve.id);
    if(restored){
      try{ restored.focus(); if(typeof preserve.start==='number' && restored.setSelectionRange){ restored.setSelectionRange(preserve.start, preserve.end||preserve.start); } }catch{}
    } else { app.focus(); }
  } else { app.focus(); }
}

/* Popover helpers */
function toggleRowMenu(row, forceOpen=null){
  const open = forceOpen===null ? !row.classList.contains('show-actions') : forceOpen;
  closeAllMenus();
  if(open){
    row.classList.add('show-actions');
    const btn = row.querySelector('[data-action="more"]');
    if(btn) btn.setAttribute('aria-expanded','true');
  }
}
function closeAllMenus(){
  $$('.row.show-actions').forEach(r=>{
    r.classList.remove('show-actions');
    const btn = r.querySelector('[data-action="more"]');
    if(btn) btn.setAttribute('aria-expanded','false');
  });
}
document.addEventListener('click', (e)=>{
  if(!e.target.closest('.row__actions')) closeAllMenus();
});
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape') closeAllMenus();
});

/* New ticket */
function createNewTicket(){
  const newId = generateTicketId();
  const newTicket = {
    id: newId,
    date: new Date().toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit', year:'2-digit'}),
    type: 'Газовий котел',
    address: '',
    phone: '',
    person: '',
    status: 'Нова'
  };
  openNewTicketForm(newTicket);
}
function generateTicketId(){
  const lastId = Math.max(...state.tickets.map(t => parseInt(t.id.replace(' ', ''))));
  return (lastId + 1).toString().replace(/(\d{2})(\d{3})/, '$1 $2');
}
function openNewTicketForm(tk){
  const app = $('#app');
  app.innerHTML = '';
  const view = document.querySelector('#tpl-new-ticket').content.cloneNode(true);
  view.querySelector('#new-ticket-id').textContent = tk.id;

  view.querySelector('[data-route="list"]').addEventListener('click', (e)=>{
    e.preventDefault(); navigate('list');
  });

  view.querySelector('#new-ticket-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(e.target);
    const newTicket = {
      id: tk.id,
      date: tk.date,
      type: fd.get('device') || 'Газовий котел',
      address: fd.get('address') || 'Не вказано',
      phone: fd.get('phone') || 'Не вказано',
      person: fd.get('client') || 'Не вказано',
      status: 'Нова'
    };
    state.tickets.unshift(newTicket);
    saveState();
    toast('Нову заявку створено ✔');
    navigate('list');
  });

  app.appendChild(view);
  highlightNav(null);
}

/* Detail */
function openDetail(tk, edit=false, backTo=state.route){
  closeAllMenus();
  const app  = $('#app');
  app.innerHTML = '';
  const view = document.querySelector('#tpl-detail').content.cloneNode(true);

  view.querySelector('#ticket-id').textContent = tk.id;
  view.querySelector('#s-what').textContent   = tk.type.includes('котел') ? 'Газовий котел' : 'Бойлер';
  view.querySelector('#s-address').textContent = (tk.address ? 'Одеса, '+tk.address : '');
  view.querySelector('#s-phone').textContent   = (tk.phone||'') + (tk.person ? ', '+tk.person : '');

  const form = view.querySelector('#ticket-form');

  // Photo picker wiring: file input, add button and preview
  const fileInput = view.querySelector('#photoInput');
  const addBtn = view.querySelector('#addPhotoBtn');
  const preview = view.querySelector('#photoPreview');
  if(addBtn && fileInput){
    addBtn.addEventListener('click', ()=> fileInput.click());
    fileInput.addEventListener('change', e=>{
      const f = e.target.files?.[0];
      if(!f) return;
      const reader = new FileReader();
      reader.onload = ev => { if(preview) preview.style.backgroundImage = `url(${ev.target.result})`; };
      reader.readAsDataURL(f);
    });
  }

  // Заполнить текущими значениями (status и т.д.)
  [...form.querySelectorAll('[name]')].forEach(el=>{
    const name = el.name;
    if(!name || el.type === 'file') return;
    const val = tk[name];
    if(val === undefined || val === null) return;
    try{ el.value = String(val); }catch{}
  });

  // Назад
  view.querySelector('[data-route="list"]').addEventListener('click', (e)=>{
    e.preventDefault(); navigate(backTo || 'list');
  });

  // debounce
  const debounce = (fn, wait=400)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  // autosave
  const autosave = debounce(()=>{
    const fd = new FormData(form);
    const updated = { ...tk };
    for(const [key, val] of fd.entries()){
      if(['partsCost','worksCost','totalCost'].includes(key)){
        const n = parseFloat(val); updated[key] = Number.isFinite(n) ? n : 0;
      } else {
        updated[key] = val;
      }
    }
    const idx = state.tickets.findIndex(x=>x.id===tk.id);
    if(idx>-1){ state.tickets[idx] = updated; saveState(); tk = updated; }
    // апдейт мини-резюме
    const sumWhat   = view.querySelector('#s-what');
    const sumAddr   = view.querySelector('#s-address');
    const sumPhone  = view.querySelector('#s-phone');
    if(sumWhat)  sumWhat.textContent  = updated.type || '';
    if(sumAddr)  sumAddr.textContent  = updated.address ? 'Одеса, '+updated.address : '';
    if(sumPhone) sumPhone.textContent = (updated.phone||'') + (updated.person ? ', '+updated.person : '');
  }, 350);

  form.addEventListener('input',  autosave);
  form.addEventListener('change', autosave);

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    autosave();
    toast('Збережено ✔');
    // возвращаемся туда, откуда пришли (в т.ч. в "Заявки у роботі")
    navigate(backTo || 'list');
  });

  app.appendChild(view);
  highlightNav(null);
}

/* Toast */
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  setTimeout(()=>t.classList.remove('is-show'), 1800);
}

/* Router mounts */
document.addEventListener('click', (e)=>{
  const r = e.target.closest('[data-route]');
  if(r){ e.preventDefault(); navigate(r.dataset.route); }
});
window.addEventListener('hashchange', ()=>{
  const r = location.hash.replace('#','') || 'list';
  state.route = r;
  render();
  highlightNav(r);
});

/* initial */
navigate((location.hash||'#list').replace('#',''));
