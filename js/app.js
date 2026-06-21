const DATA = {
  books: [], stories: [], characters: [], bibleIndex: {}
};

const state = {
  view: 'home',
  currentReader: null,
  utterance: null,
  bookFilter: 'Todos',
  storyFilter: 'Todos',
  characterFilter: 'Todos',
  activeBookId: null
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





// ===== Bíblia completa com seletor de versão estável =====
// Fase 5: as versões principais agora vêm de arquivos JSON públicos no GitHub (damarals/biblias),
// evitando o erro de limite da ABíbliaDigital. A Almeida antiga do GetBible fica como reserva.
const BIBLE_VERSIONS = {
  jfaa: {
    id: 'jfaa',
    label: 'Almeida Atualizada — JFAA',
    short: 'JFAA',
    source: 'github',
    code: 'JFAA',
    note: 'Opção mais limpa para leitura: Almeida Atualizada carregada por arquivo JSON público.'
  },
  acf: {
    id: 'acf',
    label: 'Almeida Corrigida Fiel — ACF',
    short: 'ACF',
    source: 'github',
    code: 'ACF',
    note: 'Almeida Corrigida Fiel carregada por arquivo JSON público.'
  },
  ara: {
    id: 'ara',
    label: 'Almeida Revista e Atualizada — ARA',
    short: 'ARA',
    source: 'github',
    code: 'ARA',
    note: 'ARA carregada de fonte JSON pública. Verifique permissões antes de uso amplo.'
  },
  blivre: {
    id: 'blivre',
    label: 'Bíblia Livre — BLIVRE',
    short: 'BLIVRE',
    source: 'github',
    code: 'BLIVRE',
    note: 'Bíblia Livre, boa alternativa gratuita para leitura.'
  },
  tb: {
    id: 'tb',
    label: 'Tradução Brasileira — TB',
    short: 'TB',
    source: 'github',
    code: 'TB',
    note: 'Tradução Brasileira em domínio público segundo a fonte do pacote.'
  },
  nvi: {
    id: 'nvi',
    label: 'NVI — fonte pública',
    short: 'NVI',
    source: 'github',
    code: 'NVI',
    note: 'NVI em arquivo JSON público. Use com cuidado quanto a permissões/licença.'
  },
  almeida: {
    id: 'almeida',
    label: 'Almeida antiga — GetBible',
    short: 'Almeida antiga',
    source: 'getbible',
    code: 'almeida',
    note: 'Versão antiga e livre, usada como reserva quando outra fonte falhar.'
  }
};

const GETBIBLE_API = 'https://api.getbible.net/v2/almeida';
const GITHUB_BIBLE_RAW = 'https://raw.githubusercontent.com/damarals/biblias/main/data/canonical';

const GITHUB_BOOK_CODES = {
  genesis:'GEN', exodo:'EXO', levitico:'LEV', numeros:'NUM', deuteronomio:'DEU', josue:'JOS', juizes:'JDG', rute:'RUT',
  '1samuel':'1SA', '2samuel':'2SA', '1reis':'1KI', '2reis':'2KI', '1cronicas':'1CH', '2cronicas':'2CH',
  esdras:'EZR', neemias:'NEH', ester:'EST', jo:'JOB', salmos:'PSA', proverbios:'PRO', eclesiastes:'ECC', canticos:'SNG',
  isaias:'ISA', jeremias:'JER', lamentacoes:'LAM', ezequiel:'EZK', daniel:'DAN', oseias:'HOS', joel:'JOL', amos:'AMO',
  obadias:'OBA', jonas:'JON', miqueias:'MIC', naum:'NAM', habacuque:'HAB', sofonias:'ZEP', ageu:'HAG', zacarias:'ZEC', malaquias:'MAL',
  mateus:'MAT', marcos:'MRK', lucas:'LUK', joao:'JHN', atos:'ACT', romanos:'ROM', '1corintios':'1CO', '2corintios':'2CO',
  galatas:'GAL', efesios:'EPH', filipenses:'PHP', colossenses:'COL', '1tessalonicenses':'1TH', '2tessalonicenses':'2TH',
  '1timoteo':'1TI', '2timoteo':'2TI', tito:'TIT', filemom:'PHM', hebreus:'HEB', tiago:'JAS', '1pedro':'1PE', '2pedro':'2PE',
  '1joao':'1JN', '2joao':'2JN', '3joao':'3JN', judas:'JUD', apocalipse:'REV'
};

function currentBibleVersionId(){ return storage.get('bibleVersion', 'jfaa'); }
function currentBibleVersion(){ return BIBLE_VERSIONS[currentBibleVersionId()] || BIBLE_VERSIONS.jfaa; }
function currentBibleVersionLabel(){ return currentBibleVersion().label; }
function apiToken(){ return storage.get('abibliaToken', ''); }

function getBookNumber(bookId){
  const idx = DATA.books.findIndex(b => b.id === bookId);
  return idx >= 0 ? idx + 1 : null;
}
function getGithubBookCode(bookId){ return GITHUB_BOOK_CODES[bookId] || null; }

function cacheKeyChapter(bookId, chapter){ return `chapter_v5_${currentBibleVersionId()}_${bookId}_${chapter}`; }
function cacheKeyBook(bookId){ return `book_cache_v5_${currentBibleVersionId()}_${bookId}`; }

function stripHtml(txt=''){
  const div = document.createElement('div');
  div.innerHTML = String(txt);
  return (div.textContent || div.innerText || '').replace(/\s+/g,' ').trim();
}

function normalizeChapterResponse(raw){
  let arr = null;
  if(Array.isArray(raw)) arr = raw;
  else if(Array.isArray(raw?.verses)) arr = raw.verses;
  else if(Array.isArray(raw?.chapter?.verses)) arr = raw.chapter.verses;
  else if(Array.isArray(raw?.data?.verses)) arr = raw.data.verses;
  else if(raw?.verses && typeof raw.verses === 'object') arr = Object.values(raw.verses);

  if(!arr) return [];
  return arr.map((v, i) => {
    if(typeof v === 'string') return { n: i + 1, t: stripHtml(v) };
    return {
      n: Number(v.number || v.verse || v.verse_nr || v.nr || v.v || i + 1),
      t: stripHtml(v.text || v.verse_text || v.scripture || v.t || v.content || '')
    };
  }).filter(v => v.t);
}

async function fetchFromGithubBible(bookId, chapter, version){
  const bookCode = getGithubBookCode(bookId);
  if(!bookCode) throw new Error('Código do livro não encontrado para esta fonte.');
  const url = `${GITHUB_BIBLE_RAW}/${version.code}/${bookCode}.json`;
  const res = await fetch(url, { cache: 'force-cache' });
  if(!res.ok) throw new Error('Não foi possível carregar esta versão agora.');
  const raw = await res.json();
  const chapterObj = (raw.chapters || []).find(c => Number(c.number) === Number(chapter));
  const verses = normalizeChapterResponse(chapterObj || {});
  if(!verses.length) throw new Error('O capítulo veio sem versículos reconhecidos.');
  return { version: version.label, source: url, title: raw.name || '', verses, savedAt: new Date().toISOString() };
}

async function fetchFromGetBible(bookId, chapter){
  const bookNumber = getBookNumber(bookId);
  if(!bookNumber) throw new Error('Livro não encontrado.');
  const url = `${GETBIBLE_API}/${bookNumber}/${chapter}.json`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Não foi possível carregar o capítulo da Bíblia agora.');
  const raw = await res.json();
  const verses = normalizeChapterResponse(raw);
  if(!verses.length) throw new Error('O capítulo veio sem versículos reconhecidos.');
  return { version: BIBLE_VERSIONS.almeida.label, source: url, title: raw.name || raw.chapter_name || '', verses, savedAt: new Date().toISOString() };
}

async function fetchBibleChapter(bookId, chapter, opts = {}){
  const cached = storage.get(cacheKeyChapter(bookId, chapter), null);
  if(!opts.force && cached?.verses?.length) return cached;

  const selected = currentBibleVersion();
  let payload;

  if(selected.source === 'github') {
    payload = await fetchFromGithubBible(bookId, chapter, selected);
  } else {
    payload = await fetchFromGetBible(bookId, chapter);
  }

  payload.selectedVersionId = selected.id;
  payload.selectedVersionShort = selected.short;
  storage.set(cacheKeyChapter(bookId, chapter), payload);

  let cachedChapters = storage.get(cacheKeyBook(bookId), []);
  if(!cachedChapters.includes(chapter)){
    cachedChapters.push(chapter);
    cachedChapters.sort((a,b)=>a-b);
    storage.set(cacheKeyBook(bookId), cachedChapters);
  }

  return payload;
}

async function downloadBookOffline(bookId){
  const b = DATA.books.find(x=>x.id===bookId); if(!b) return;
  const v = currentBibleVersion();
  toast(`Baixando ${b.name} em ${v.short}...`);
  const failed = [];
  for(let ch=1; ch<=Number(b.chapters); ch++){
    try { await fetchBibleChapter(bookId, ch); }
    catch(e){ failed.push(ch); console.warn(e); }
  }
  if(failed.length){ toast(`Alguns capítulos falharam: ${failed.slice(0,5).join(', ')}${failed.length>5?'...':''}`); }
  else { toast(`${b.name} salvo para leitura offline em ${v.short}.`); }
  openBook(bookId);
}
window.downloadBookOffline = downloadBookOffline;

function cachedChapterList(bookId){ return storage.get(cacheKeyBook(bookId), []); }

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
  const vs = $('versionSelect');
  if(vs) vs.value = currentBibleVersionId();
  document.documentElement.style.setProperty('--readerFont', storage.get('font', 19) + 'px');
}

function bindEvents(){
  document.querySelectorAll('[data-go]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.go)));
  $('versionSelect').addEventListener('change', e => {
    storage.set('bibleVersion', e.target.value);
    toast('Versão bíblica alterada para ' + currentBibleVersion().short);
    if(state.currentReader?.type === 'chapter' && state.currentReader.bookId){
      openChapter(state.currentReader.bookId, state.currentReader.chapter, true);
      return;
    }
    if(state.view === 'books') renderBooks();
    if(state.activeBookId) openBook(state.activeBookId);
  });
  $('apiTokenBtn').addEventListener('click', setApiToken);
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
  $('reloadChapterBtn').addEventListener('click', reloadCurrentChapter);
  $('notesArea').addEventListener('input', saveNote);
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeReader(); });
}

function setApiToken(){
  const ok = confirm('Na Fase 5 as versões principais não dependem mais de token. Deseja limpar o cache bíblico salvo neste aparelho para forçar recarregar a versão escolhida?');
  if(!ok) return;
  Object.keys(localStorage).forEach(k => { if(k.startsWith('bibliaflix_chapter_') || k.startsWith('bibliaflix_book_cache_')) localStorage.removeItem(k); });
  toast('Cache bíblico limpo. Abra o capítulo novamente.');
}
function reloadCurrentChapter(){
  const p = state.currentReader;
  if(!p || p.type !== 'chapter' || !p.bookId) { toast('Abra um capítulo primeiro.'); return; }
  openChapter(p.bookId, p.chapter, true);
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
  state.activeBookId = null;
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
        <p>Livros, histórias, personagens, favoritos, anotações, voz narrada pelo celular e progresso salvo no aparelho. Agora com seletor de versão bíblica: NVI, ACF e Almeida.</p>
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
  state.activeBookId = id;
  const b = DATA.books.find(x=>x.id===id); if(!b) return;
  const cached = cachedChapterList(id);
  const buttons = Array.from({length:b.chapters},(_,i)=>i+1).map(n => `<button class="chapterBtn ${cached.includes(n)?'hasText':''}" onclick="openChapter('${id}',${n})">Cap. ${n}${cached.includes(n)?' ✓':''}</button>`).join('');
  main.innerHTML = `<section class="bookScreen"><aside class="sidePoster" style="background-image:url('${cover(b.cover)}')"></aside><div class="details"><span class="badge">${b.testament}</span><h1 class="detailTitle">${b.name}</h1><div class="infoPanel"><strong>Tema:</strong> ${esc(b.theme)}<br><strong>Capítulos:</strong> ${b.chapters}<br><strong>Texto bíblico:</strong> livro completo disponível capítulo por capítulo na versão <strong>${currentBibleVersionLabel()}</strong>.<br><strong>Offline:</strong> ${cached.length} capítulo(s) já salvo(s) neste aparelho nesta versão.<br><strong>Observação:</strong> ${esc(currentBibleVersion().note)}</div><div class="btnRow" style="margin-bottom:18px"><button class="pillBtn primary" onclick="openChapter('${id}',1)">▶ Ler do capítulo 1</button><button class="pillBtn" onclick="downloadBookOffline('${id}')">⬇ Baixar livro offline</button><button class="pillBtn" onclick="toggleFav('book','${id}')">⭐ Salvar livro</button><button class="pillBtn" onclick="go('books')">← Voltar aos livros</button></div><h2>Capítulos</h2><div class="chapters">${buttons}</div><p class="sourceNote">Ao abrir um capítulo pela primeira vez, o app busca o texto completo online e salva no aparelho. Depois de salvo, ele abre mais rápido.</p></div></section>`;
};

window.openChapter = async function(bookId, chapter, force = false){
  const b = DATA.books.find(x=>x.id===bookId); if(!b) return;
  const cached = storage.get(cacheKeyChapter(bookId, chapter), null);
  openReader({type:'chapter', id:`${bookId}-${chapter}`, title:`${b.name} ${chapter}`, sub: cached ? 'Abrindo capítulo salvo...' : `Carregando texto bíblico completo em ${currentBibleVersion().short}...`, cover:b.cover, badge:'Capítulo', paragraphs:['Aguarde um instante. O app está carregando o capítulo completo.']});
  try {
    const chapterData = await fetchBibleChapter(bookId, chapter, { force });
    openReader({
      type:'chapter',
      id:`${bookId}-${chapter}`,
      title:`${b.name} ${chapter}`,
      sub:`${chapterData.version} • ${chapterData.verses.length} versículo(s)`,
      cover:b.cover,
      badge:'Capítulo completo',
      verses:chapterData.verses,
      paragraphs:[chapterData.warning || `Fonte: ${chapterData.version}. Capítulo carregado completo e salvo em cache neste aparelho.`],
      bookId, chapter, progress:{type:'chapter',bookId,chapter,title:`${b.name} ${chapter}`,sub:`${chapterData.version}`,cover:b.cover}
    });
  } catch (err) {
    console.error(err);
    openReader({
      type:'chapter', id:`${bookId}-${chapter}`, title:`${b.name} ${chapter}`, sub:'Não foi possível carregar agora', cover:b.cover, badge:'Erro ao carregar',
      paragraphs:[
        `Não consegui carregar este capítulo na versão ${currentBibleVersion().short}. Se apareceu a mesma versão antiga antes, era porque o app caía automaticamente na Almeida; agora ele não troca escondido.`,
        'Verifique a internet, o limite da API ou salve um token grátis pelo botão 🔑 no topo. Você também pode escolher Almeida para usar a reserva livre.'
      ]
    });
  }
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
