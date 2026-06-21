const DATA = {
  books: [], stories: [], characters: [], bibleIndex: {}
};

const state = {
  view: 'home',
  currentReader: null,
  utterance: null,
  bookFilter: 'Todos',
  storyFilter: 'Todos',
  characterFilter: 'Todos'
};

const $ = (id) => document.getElementById(id);
const main = $('main');

const storage = {
  get(key, fallback){
    try { return JSON.parse(localStorage.getItem('bibliaflix_' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value){ localStorage.setItem('bibliaflix_' + key, JSON.stringify(value)); },
  remove(key){ localStorage.removeItem('bibliaflix_' + key); }
};

function cover(path){ return path || 'assets/covers/default.svg'; }
function esc(s=''){ return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'), 1800); }

async function loadJson(path, fallback){
  const res = await fetch(path);
  if(!res.ok) return fallback;
  return await res.json();
}

async function init(){
  main.innerHTML = '<div class="loader">Carregando Bíbliaflix...</div>';
  DATA.books = await loadJson('data/books.json', []);
  DATA.stories = await loadJson('data/stories.json', []);
  DATA.characters = await loadJson('data/characters.json', []);
  DATA.bibleIndex = await loadJson('data/bible/index.json', {});
  applySettings();
  bindEvents();
  go('home');
}

function applySettings(){
  const theme = storage.get('theme', 'dark');
  if(theme === 'light') document.body.classList.add('light');
  $('themeBtn').textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
  document.documentElement.style.setProperty('--readerFont', storage.get('font', 19) + 'px');
}

function bindEvents(){
  document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.go)));
  $('themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('light');
    storage.set('theme', document.body.classList.contains('light') ? 'light' : 'dark');
    applySettings();
  });
  $('fontPlus').addEventListener('click', () => changeFont(2));
  $('fontMinus').addEventListener('click', () => changeFont(-2));
  $('searchInput').addEventListener('input', e => liveSearch(e.target.value));
  $('closeReader').addEventListener('click', closeReader);
  $('readerModal').addEventListener('click', e => { if(e.target.id === 'readerModal') closeReader(); });
  $('speakBtn').addEventListener('click', speakReader);
  $('pauseBtn').addEventListener('click', () => speechSynthesis.pause());
  $('stopBtn').addEventListener('click', stopSpeech);
  $('favReaderBtn').addEventListener('click', favoriteReader);
  $('saveProgressBtn').addEventListener('click', () => { saveProgressFromReader(); toast('Progresso salvo.'); });
  $('notesArea').addEventListener('input', saveNote);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeReader(); });
}

function changeFont(delta){
  const next = Math.max(15, Math.min(31, Number(storage.get('font', 19)) + delta));
  storage.set('font', next);
  document.documentElement.style.setProperty('--readerFont', next + 'px');
}

function setActiveNav(view){
  document.querySelectorAll('.navBtn').forEach(b => b.classList.toggle('isActive', b.dataset.go === view));
}

function go(view){
  state.view = view;
  setActiveNav(view);
  $('searchInput').value = '';
  closeSearch();
  if(view === 'home') renderHome();
  if(view === 'books') renderBooks();
  if(view === 'stories') renderStories();
  if(view === 'characters') renderCharacters();
  if(view === 'continue') renderContinue();
  window.scrollTo({top:0, behavior:'smooth'});
}
window.go = go;

function heroBg(){ return cover('assets/covers/hero.svg'); }
function renderHome(){
  const progress = storage.get('progress', null);
  main.innerHTML = `
    <section class="hero">
      <div class="heroBg" style="background-image:url('${heroBg()}')"></div>
      <div class="heroContent">
        <span class="badge">📖 Plataforma bíblica gratuita</span>
        <h1>Uma Netflix da Bíblia, organizada para ler, ouvir e estudar.</h1>
        <p>Livros, histórias, personagens, favoritos, anotações, voz narrada pelo celular e progresso salvo no aparelho.</p>
        <div class="btnRow">
          <button class="pillBtn primary" onclick="go('books')">▶ Começar pelos livros</button>
          <button class="pillBtn" onclick="go('stories')">✨ Histórias bíblicas</button>
          <button class="pillBtn" onclick="openProgress()">📌 Continuar</button>
        </div>
      </div>
    </section>
    ${progress ? sectionContinueMini(progress) : ''}
    ${renderRail('Livros em destaque', 'Escolha um livro e veja capítulos', DATA.books.slice(0, 10).map(bookCard).join(''))}
    ${renderRail('Histórias bíblicas', 'Narrativas para leitura e ensino', DATA.stories.slice(0, 12).map(storyCard).join(''))}
    ${renderRail('Personagens', 'Conheça vidas e lições', DATA.characters.slice(0, 12).map(characterCard).join(''))}
  `;
}

function sectionContinueMini(p){
  return `<section class="section"><div class="sectionHead"><h2>Continuar lendo</h2><small>Salvo neste aparelho</small></div><div class="grid">${progressCard(p)}</div></section>`;
}
function renderRail(title, sub, html){ return `<section class="section"><div class="sectionHead"><h2>${title}</h2><small>${sub}</small></div><div class="rail">${html}</div></section>`; }

function cardBase({id,title,sub,coverPath,icon,onOpen,type}){
  const fav = isFav(type, id);
  return `<article class="card">
    <div class="poster" style="background-image:url('${cover(coverPath)}')"><div class="posterIcon">${icon || '📖'}</div></div>
    <div class="cardBody">
      <div class="cardTitle">${esc(title)}</div>
      <div class="cardSub">${esc(sub || '')}</div>
      <div class="cardActions">
        <button class="miniBtn gold" onclick="${onOpen}">Abrir</button>
        <button class="miniBtn" onclick="toggleFav('${type}','${id}')">${fav ? '★ Salvo' : '☆ Salvar'}</button>
      </div>
    </div>
  </article>`;
}
function bookCard(b){ return cardBase({id:b.id,title:b.name,sub:`${b.testament} • ${b.chapters} caps.`,coverPath:b.cover,icon:b.icon,onOpen:`openBook('${b.id}')`,type:'book'}); }
function storyCard(s){ return cardBase({id:s.id,title:s.title,sub:`${s.reference} • ${s.category}`,coverPath:s.cover,icon:s.icon,onOpen:`openStory('${s.id}')`,type:'story'}); }
function characterCard(c){ return cardBase({id:c.id,title:c.name,sub:`${c.role} • ${c.references}`,coverPath:c.cover,icon:c.icon,onOpen:`openCharacter('${c.id}')`,type:'character'}); }

function renderBooks(){
  const filters = ['Todos','Antigo Testamento','Novo Testamento'];
  const books = DATA.books.filter(b => state.bookFilter === 'Todos' || b.testament === state.bookFilter);
  main.innerHTML = `<section class="section" style="margin-top:0"><div class="sectionHead"><h2>Livros da Bíblia</h2><small>66 livros organizados</small></div>${tabs(filters, state.bookFilter, 'bookFilter')}<div class="grid">${books.map(bookCard).join('')}</div></section>`;
}
function renderStories(){
  const filters = ['Todos', ...new Set(DATA.stories.map(s=>s.category))];
  const items = DATA.stories.filter(s => state.storyFilter === 'Todos' || s.category === state.storyFilter);
  main.innerHTML = `<section class="section" style="margin-top:0"><div class="sectionHead"><h2>Histórias bíblicas</h2><small>Por tema e referência</small></div>${tabs(filters, state.storyFilter, 'storyFilter')}<div class="grid">${items.map(storyCard).join('')}</div></section>`;
}
function renderCharacters(){
  const filters = ['Todos', ...new Set(DATA.characters.map(c=>c.group))];
  const items = DATA.characters.filter(c => state.characterFilter === 'Todos' || c.group === state.characterFilter);
  main.innerHTML = `<section class="section" style="margin-top:0"><div class="sectionHead"><h2>Personagens bíblicos</h2><small>Vida, referências e lições</small></div>${tabs(filters, state.characterFilter, 'characterFilter')}<div class="grid">${items.map(characterCard).join('')}</div></section>`;
}
function tabs(filters, active, key){ return `<div class="tabs">${filters.map(f=>`<button class="tab ${f===active?'isActive':''}" onclick="setFilter('${key}','${f}')">${esc(f)}</button>`).join('')}</div>`; }
window.setFilter = (key, value) => { state[key] = value; if(key==='bookFilter') renderBooks(); if(key==='storyFilter') renderStories(); if(key==='characterFilter') renderCharacters(); };

window.openBook = function(id){
  const b = DATA.books.find(x=>x.id===id); if(!b) return;
  const available = DATA.bibleIndex[id]?.chapters || [];
  const buttons = Array.from({length:b.chapters},(_,i)=>i+1).map(n => `<button class="chapterBtn ${available.includes(n)?'hasText':''}" onclick="openChapter('${id}',${n})">Cap. ${n}${available.includes(n)?' ✓':''}</button>`).join('');
  main.innerHTML = `<section class="bookScreen"><aside class="sidePoster" style="background-image:url('${cover(b.cover)}')"></aside><div class="details"><span class="badge">${b.testament}</span><h1 class="detailTitle">${b.name}</h1><div class="infoPanel"><strong>Tema:</strong> ${esc(b.theme)}<br><strong>Capítulos:</strong> ${b.chapters}<br><strong>Status:</strong> ${available.length ? available.length + ' capítulo(s) com texto cadastrado nesta fase.' : 'estrutura pronta para receber texto.'}</div><div class="btnRow" style="margin-bottom:18px"><button class="pillBtn primary" onclick="openChapter('${id}',${available[0] || 1})">▶ Ler agora</button><button class="pillBtn" onclick="toggleFav('book','${id}')">⭐ Salvar livro</button><button class="pillBtn" onclick="go('books')">← Voltar aos livros</button></div><h2>Capítulos</h2><div class="chapters">${buttons}</div></div></section>`;
};

window.openChapter = async function(bookId, chapter){
  const b = DATA.books.find(x=>x.id===bookId); if(!b) return;
  let data = null;
  try { data = await loadJson(`data/bible/${bookId}.json`, null); } catch {}
  const chapterData = data?.chapters?.find(c => Number(c.number) === Number(chapter));
  if(!chapterData){
    openReader({
      type:'chapter', id:`${bookId}-${chapter}`, title:`${b.name} ${chapter}`, sub:'Capítulo ainda não cadastrado nesta fase', cover:b.cover,
      badge:'Capítulo',
      paragraphs:[`A estrutura de ${b.name} ${chapter} já está pronta. Nesta Fase 1, nem todos os 1.189 capítulos estão preenchidos ainda.`, 'O certo agora é ir alimentando a pasta data/bible/ com arquivos por livro, sem deixar o index gigante.']
    });
    return;
  }
  openReader({type:'chapter',id:`${bookId}-${chapter}`,title:`${b.name} ${chapter}`,sub:chapterData.title || b.theme,cover:b.cover,badge:'Capítulo',verses:chapterData.verses,paragraphs:chapterData.paragraphs,progress:{type:'chapter',bookId,chapter,title:`${b.name} ${chapter}`,sub:chapterData.title || b.theme,cover:b.cover}});
};

window.openStory = function(id){
  const s = DATA.stories.find(x=>x.id===id); if(!s) return;
  openReader({type:'story', id:s.id, title:s.title, sub:`${s.reference} • ${s.category}`, cover:s.cover, badge:'História bíblica', paragraphs:s.text, progress:{type:'story',id:s.id,title:s.title,sub:s.reference,cover:s.cover}});
};
window.openCharacter = function(id){
  const c = DATA.characters.find(x=>x.id===id); if(!c) return;
  main.innerHTML = `<section class="detailScreen"><aside class="sidePoster" style="background-image:url('${cover(c.cover)}')"></aside><div class="details"><span class="badge">${esc(c.group)}</span><h1 class="detailTitle">${esc(c.name)}</h1><div class="infoPanel"><strong>Papel:</strong> ${esc(c.role)}<br><strong>Referências:</strong> ${esc(c.references)}<br><br>${esc(c.summary)}</div><h2>Lições principais</h2><div class="infoPanel">${c.lessons.map(l=>`<p>• ${esc(l)}</p>`).join('')}</div><div class="btnRow"><button class="pillBtn primary" onclick="readCharacter('${c.id}')">🔊 Abrir leitura</button><button class="pillBtn" onclick="toggleFav('character','${c.id}')">⭐ Salvar</button><button class="pillBtn" onclick="go('characters')">← Voltar</button></div></div></section>`;
};
window.readCharacter = function(id){
  const c = DATA.characters.find(x=>x.id===id); if(!c) return;
  openReader({type:'character', id:c.id, title:c.name, sub:`${c.role} • ${c.references}`, cover:c.cover, badge:'Personagem', paragraphs:[c.summary, ...c.lessons.map(l=>'Lição: '+l)], progress:{type:'character',id:c.id,title:c.name,sub:c.role,cover:c.cover}});
};

function openReader(payload){
  stopSpeech();
  state.currentReader = payload;
  $('readerCover').style.backgroundImage = `url('${cover(payload.cover)}')`;
  $('readerBadge').textContent = payload.badge || 'Leitura';
  $('readerTitle').textContent = payload.title;
  $('readerSub').textContent = payload.sub || '';
  $('readerText').innerHTML = readerHtml(payload);
  $('notesArea').value = storage.get('note_' + payload.type + '_' + payload.id, '');
  $('readerModal').classList.add('show');
  $('readerModal').setAttribute('aria-hidden','false');
  storage.set('progress', payload.progress || {type:payload.type,id:payload.id,title:payload.title,sub:payload.sub,cover:payload.cover});
}
function readerHtml(p){
  if(p.verses?.length) return p.verses.map(v=>`<span class="verse"><span class="verseNum">${v.n}</span>${esc(v.t)}</span>`).join('') + (p.paragraphs?.map(x=>`<p>${esc(x)}</p>`).join('') || '');
  return (p.paragraphs || []).map(x=>`<p>${esc(x)}</p>`).join('');
}
function closeReader(){ stopSpeech(); saveNote(); $('readerModal').classList.remove('show'); $('readerModal').setAttribute('aria-hidden','true'); }
function saveNote(){ const p=state.currentReader; if(!p) return; storage.set('note_' + p.type + '_' + p.id, $('notesArea').value); }
function saveProgressFromReader(){ const p=state.currentReader; if(!p) return; storage.set('progress', p.progress || {type:p.type,id:p.id,title:p.title,sub:p.sub,cover:p.cover}); }
function speakReader(){
  stopSpeech();
  const text = `${$('readerTitle').textContent}. ${$('readerText').innerText}`;
  if(!text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR'; u.rate = .92; u.pitch = 1;
  state.utterance = u;
  speechSynthesis.speak(u);
}
function stopSpeech(){ speechSynthesis.cancel(); state.utterance=null; }
function favoriteReader(){ const p=state.currentReader; if(!p) return; toggleFav(p.type,p.id); }

function favs(){ return storage.get('favorites', []); }
function isFav(type,id){ return favs().some(x=>x.type===type && x.id===id); }
window.toggleFav = function(type,id){
  let f=favs();
  if(isFav(type,id)) { f=f.filter(x=>!(x.type===type && x.id===id)); toast('Removido dos favoritos.'); }
  else { f.push({type,id}); toast('Salvo nos favoritos.'); }
  storage.set('favorites', f);
  if(state.view==='books') renderBooks(); if(state.view==='stories') renderStories(); if(state.view==='characters') renderCharacters(); if(state.view==='continue') renderContinue();
};

function renderContinue(){
  const p = storage.get('progress', null);
  const favorites = favs();
  const favHtml = favorites.map(f => favToCard(f)).filter(Boolean).join('');
  main.innerHTML = `<section class="section" style="margin-top:0"><div class="sectionHead"><h2>Continuar e Favoritos</h2><small>Salvo neste aparelho</small></div>${p ? `<div class="grid">${progressCard(p)}</div>` : '<div class="empty">Nenhum progresso salvo ainda.</div>'}</section><section class="section"><div class="sectionHead"><h2>Favoritos</h2><small>${favorites.length} salvo(s)</small></div>${favHtml ? `<div class="grid">${favHtml}</div>` : '<div class="empty">Nenhum favorito ainda.</div>'}</section>`;
}
function progressCard(p){ return `<article class="card"><div class="poster" style="background-image:url('${cover(p.cover)}')"><div class="posterIcon">📌</div></div><div class="cardBody"><div class="cardTitle">${esc(p.title)}</div><div class="cardSub">${esc(p.sub || 'Continuar de onde parou')}</div><div class="cardActions"><button class="miniBtn gold" onclick="openProgress()">Continuar</button><button class="miniBtn" onclick="clearProgress()">Limpar</button></div></div></article>`; }
window.clearProgress = function(){ storage.remove('progress'); renderContinue(); };
window.openProgress = function(){
  const p=storage.get('progress',null); if(!p){ toast('Nenhum progresso salvo.'); return; }
  if(p.type==='chapter') openChapter(p.bookId,p.chapter);
  if(p.type==='story') openStory(p.id);
  if(p.type==='character') readCharacter(p.id);
};
function favToCard(f){
  if(f.type==='book'){ const x=DATA.books.find(b=>b.id===f.id); return x?bookCard(x):''; }
  if(f.type==='story'){ const x=DATA.stories.find(s=>s.id===f.id); return x?storyCard(x):''; }
  if(f.type==='character'){ const x=DATA.characters.find(c=>c.id===f.id); return x?characterCard(x):''; }
  return '';
}

function liveSearch(term){
  term = term.trim().toLowerCase();
  let box = document.querySelector('.searchResults');
  if(!box){ box = document.createElement('div'); box.className='searchResults'; document.body.appendChild(box); }
  if(!term){ closeSearch(); return; }
  const results = [];
  DATA.books.forEach(b=>{ if(`${b.name} ${b.testament} ${b.theme}`.toLowerCase().includes(term)) results.push({title:b.name,sub:`Livro • ${b.testament}`,cover:b.cover,open:`openBook('${b.id}')`}); });
  DATA.stories.forEach(s=>{ if(`${s.title} ${s.reference} ${s.category} ${s.text.join(' ')}`.toLowerCase().includes(term)) results.push({title:s.title,sub:`História • ${s.reference}`,cover:s.cover,open:`openStory('${s.id}')`}); });
  DATA.characters.forEach(c=>{ if(`${c.name} ${c.role} ${c.references} ${c.summary}`.toLowerCase().includes(term)) results.push({title:c.name,sub:`Personagem • ${c.role}`,cover:c.cover,open:`openCharacter('${c.id}')`}); });
  box.innerHTML = results.slice(0,25).map(r=>`<button class="resultItem" onclick="${r.open};closeSearch();$('searchInput').value='';"><span class="resultThumb" style="background-image:url('${cover(r.cover)}')"></span><span><strong>${esc(r.title)}</strong><span>${esc(r.sub)}</span></span></button>`).join('') || `<div class="empty">Nada encontrado.</div>`;
  box.classList.add('show');
}
window.closeSearch = closeSearch;
function closeSearch(){ const box=document.querySelector('.searchResults'); if(box) box.classList.remove('show'); }

init().catch(err => {
  console.error(err);
  main.innerHTML = '<div class="empty">Erro ao carregar dados. No computador, teste pelo Vercel ou por um servidor local, não abrindo direto como arquivo.</div>';
});
