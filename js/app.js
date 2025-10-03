/* Tiny SPA Router + improved interactions, search, filter + kebab actions */
const $ = (sel, ctx=document) => ctx.querySelector(sel);
const $$ = (sel, ctx=document) => [...ctx.querySelectorAll(sel)];

const state = {
  route: 'list',
  tickets: [
    { id:'63 753', date:'19.01.25', type:'Газовий котел', address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем' },
    { id:'63 754', date:'19.01.25', type:'Бойлер',         address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем' },
    { id:'63 755', date:'19.01.25', type:'Газовий котел',  address:'Вул. Чорноморського Козацтва, 806', phone:'096 145 85 54', person:'Поздняков Артем' },
  ],
  ui: { search:'', filter:'all' }
};

// Persistence helpers (localStorage)
const STORAGE_KEY = 'olx-sc-state';
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ tickets: state.tickets })); }catch(e){}
}
function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const parsed = JSON.parse(raw);
    if(parsed && Array.isArray(parsed.tickets)) state.tickets = parsed.tickets;
  }catch(e){}
}

// load persisted state on script init
loadState();

function navigate(route) {
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

function render(){
  const app = $('#app');
  // preserve focused input (id and caret) so fast re-renders (e.g. on search input)
  const prevActive = document.activeElement;
  const preserve = (prevActive && prevActive.id && (prevActive.tagName==='INPUT' || prevActive.tagName==='TEXTAREA' || prevActive.tagName==='SELECT'))
    ? { id: prevActive.id, start: prevActive.selectionStart, end: prevActive.selectionEnd }
    : null;

  app.innerHTML = '';
  const t = (id)=>document.querySelector(`#${id}`).content.cloneNode(true);

  if(state.route==='list'){
    const view = t('tpl-list');
    const body = view.querySelector('#rows');

    // controls
    const searchEl = view.querySelector('#search');
    const filterEl = view.querySelector('#filter-device');
    searchEl.value = state.ui.search;
    filterEl.value = state.ui.filter;

    const list = getFilteredTickets();
    list.forEach((tk)=>{
      const r = t('tpl-row');
      const row = r.querySelector('.row');
      const cells = row.children;

      cells[0].textContent = tk.id;
      cells[1].textContent = tk.date;
      cells[2].querySelector('[data-kind="type"]').textContent = tk.type;
      cells[3].textContent = tk.address;
      cells[4].innerHTML = `<a class="link" href="tel:+380961458554">${tk.phone}</a>`;
      cells[5].textContent = tk.person;

      // menu: три точки
      const moreBtn = row.querySelector('[data-action="more"]');
      moreBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        // toggle open/close on repeated clicks
        toggleRowMenu(row, null);
      });

      // actions inside popover
      row.querySelector('[data-action="view"]').addEventListener('click', (e)=>{ 
        e.stopPropagation(); closeAllMenus(); openDetail(tk); 
      });
      row.querySelector('[data-action="edit"]').addEventListener('click', (e)=>{ 
        e.stopPropagation(); closeAllMenus(); openDetail(tk, true); 
      });
      row.querySelector('[data-action="del"]').addEventListener('click', (e)=>{
        e.stopPropagation();
        if(confirm('Видалити заявку '+tk.id+'?')){
          const idxInState = state.tickets.findIndex(x=>x.id===tk.id);
          state.tickets.splice(idxInState,1);
          saveState();
          render();
          toast('Заявку видалено');
        }
      });
      row.querySelector('[data-action="close"]').addEventListener('click', (e)=>{
        e.stopPropagation(); toggleRowMenu(row, false);
      });

      // click row -> open detail
      row.addEventListener('click', ()=>openDetail(tk));
      body.appendChild(r);
    });

    // events: поиск/фильтр
    searchEl.addEventListener('input', (e)=>{
      state.ui.search = e.target.value.trim().toLowerCase();
      render();
    });
    filterEl.addEventListener('change', (e)=>{
      state.ui.filter = e.target.value;
      render();
    });

    // "Нова заявка"
    view.querySelector('.btn.icon[title="Нова заявка"]').addEventListener('click', createNewTicket);

    app.appendChild(view);
  }
  else if(state.route==='inwork'){
    app.appendChild(t('tpl-inwork'));
  }
  else {
    app.innerHTML = '<section class="panel empty"><p>Сторінка у розробці.</p></section>';
  }

  // restore focus if user was typing in an input (search); otherwise focus main for a11y
  if(preserve){
    // try to find the new element with same id inside the freshly rendered app
    const restored = document.getElementById(preserve.id) || app.querySelector('#'+preserve.id);
    if(restored){
      try{ restored.focus();
        if(typeof preserve.start === 'number' && typeof restored.setSelectionRange === 'function'){
          restored.setSelectionRange(preserve.start, preserve.end || preserve.start);
        }
      }catch(e){ /* ignore focus errors */ }
    } else {
      app.focus();
    }
  } else {
    app.focus();
  }
}

/* helpers for menu */
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

function getFilteredTickets(){
  const q = state.ui.search;
  const f = state.ui.filter;
  return state.tickets.filter(tk=>{
    const matchFilter = (f==='all') || (tk.type === f);
    const blob = `${tk.id} ${tk.date} ${tk.type} ${tk.address} ${tk.phone} ${tk.person}`.toLowerCase();
    const matchSearch = !q || blob.includes(q);
    return matchFilter && matchSearch;
  });
}

function createNewTicket(){
  const newId = generateTicketId();
  const newTicket = {
    id: newId,
    date: new Date().toLocaleDateString('uk-UA', {day:'2-digit', month:'2-digit', year:'2-digit'}),
    type: 'Газовий котел',
    address: '',
    phone: '',
    person: ''
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
    const formData = new FormData(e.target);
    const newTicket = {
      id: tk.id,
      date: tk.date,
      type: formData.get('device') || 'Газовий котел',
      address: formData.get('address') || 'Не вказано',
      phone: formData.get('phone') || 'Не вказано',
      person: formData.get('client') || 'Не вказано'
    };
    state.tickets.unshift(newTicket);
    saveState();
    toast('Нову заявку створено ✔');
    navigate('list');
  });

  app.appendChild(view);
  highlightNav(null);
}

function openDetail(tk, edit=false){
  closeAllMenus();
  const app = $('#app');
  app.innerHTML = '';
  const view = document.querySelector('#tpl-detail').content.cloneNode(true);
  view.querySelector('#ticket-id').textContent = tk.id;
  view.querySelector('#s-what').textContent = tk.type.includes('котел') ? 'Газовий котел' : 'Бойлер';
  view.querySelector('#s-address').textContent = 'Одеса, ' + tk.address;
  view.querySelector('#s-phone').textContent = tk.phone + ', ' + tk.person;

  view.querySelector('[data-route="list"]').addEventListener('click', (e)=>{
    e.preventDefault(); navigate('list');
  });

  view.querySelector('#ticket-form').addEventListener('submit', (e)=>{
    e.preventDefault();
    // collect values and persist changes back to state
    const form = e.target;
    const fd = new FormData(form);
    const updated = {
      id: tk.id,
      date: fd.get('date') || tk.date,
      type: fd.get('device') || tk.type,
      address: fd.get('address') || tk.address,
      phone: fd.get('phone') || tk.phone,
      person: fd.get('client') || tk.person
    };
    const idx = state.tickets.findIndex(x=>x.id===tk.id);
    if(idx>-1){ state.tickets[idx] = updated; saveState(); }
    toast('Збережено ✔');
    navigate('list');
  });

  app.appendChild(view);
  highlightNav(null);
}

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  setTimeout(()=>t.classList.remove('is-show'), 1800);
}

/* Router mounts */
document.addEventListener('click', (e)=>{
  const routeEl = e.target.closest('[data-route]');
  if(routeEl){
    e.preventDefault();
    navigate(routeEl.dataset.route);
  }
});
window.addEventListener('hashchange', ()=>{
  const r = location.hash.replace('#','') || 'list';
  state.route = r;
  render();
  highlightNav(r);
});

/* initial */
navigate((location.hash||'#list').replace('#',''));
