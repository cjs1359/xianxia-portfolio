import './style.css';
const $ = s => document.querySelector(s);
const list = $('#list'), dialog = $('#scroll');
let data, world, state = 'overview', listMode = false, opener, previousState;
function openWork(island, work, trigger) {
  if (state === 'transit' || state === 'dialog') return;
  opener = trigger || document.activeElement; previousState = state; state = 'dialog';
  $('#work-meta').textContent = island.name;
  $('#work-title').textContent = work.displayTitle || work.buildingName;
  const subtitle = $('#work-subtitle');
  subtitle.textContent = work.displaySubtitle || '';
  subtitle.hidden = !work.displaySubtitle;
  $('#work-type').textContent = `${work.buildingType} · ${work.cardType}`;
  $('#original-name').textContent = work.displayTitle ? `原卡名：${work.originalName}` : work.originalName;
  $('#original-name').classList.toggle('original-card-name', Boolean(work.displayTitle));
  const access = $('#access');
  access.hidden = !work.accessNote;
  access.textContent = work.accessNote || '';
  $('#description').textContent = work.originalDescription;
  renderLinks(work);
  dialog.showModal();
}
function renderRecords(work) {
  const section = document.createElement('section'); section.className = 'activity-records';
  const heading = document.createElement('h3'); heading.textContent = '活動影片';
  const records = document.createElement('ul'); records.className = 'record-list';
  records.tabIndex = 0; records.setAttribute('aria-label', '活動影片清單');
  for (const record of work.records) {
    const item = document.createElement('li');
    const title = document.createElement('h4'); title.textContent = record.title;
    item.append(title);
    for (const link of record.links || []) {
      const a = document.createElement('a');
      a.className = 'work-link'; a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      let youtube = false;
      try {
        const host = new URL(link.url).hostname.toLowerCase();
        youtube = host === 'youtu.be' || host.endsWith('.youtu.be') || host === 'youtube.com' || host.endsWith('.youtube.com');
      } catch {}
      a.textContent = youtube ? '觀看影片' : '閱讀報導';
      a.setAttribute('aria-label', `${a.textContent}：${record.title}`);
      item.append(a);
    }
    records.append(item);
  }
  section.append(heading, records);
  return section;
}
function renderLinks(work) {
  const box = $('#links'); box.replaceChildren();
  if (Array.isArray(work.records)) {
    box.append(renderRecords(work));
    return;
  }
  if (work.linkStatus === 'confirmed') {
    for (const link of work.links || []) {
      const a = document.createElement('a');
      a.className = 'work-link'; a.href = link.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = link.label;
      box.append(a);
    }
    if (work.requiresLogin) {
      const note = document.createElement('p'); note.className = 'pending'; note.textContent = '需登入／授權';
      box.append(note);
    }
  } else {
    const a = document.createElement('a');
    a.className = 'work-link'; a.href = data.sourceOverviewUrl; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.textContent = '查看原作品集總覽 ↗';
    const note = document.createElement('p'); note.className = 'pending'; note.textContent = '個別連結待補';
    box.append(a, note);
  }
}
$('#close').onclick = () => dialog.close();
dialog.addEventListener('close', () => { state = previousState || 'overview'; opener?.focus(); });
dialog.addEventListener('click', e => { if(e.target === dialog) dialog.close(); });
function setList(on, reason) {
  if(state === 'transit' || state === 'dialog') return;
  listMode = on; list.hidden = !on; $('#scene').hidden = on;
  document.body.classList.toggle('list-mode', on);
  $('#mode').textContent = on ? '仙域模式' : '列表模式';
  $('#mode').setAttribute('aria-pressed', String(on));
  $('#status').textContent = reason || (on ? '依島閱覽，點選作品開啟卷軸。' : '拖曳環望 · 點選浮島入境');
  world?.setActive(!on);
}
$('#mode').onclick = () => { if(!world) setList(true, '3D 場景無法使用，請以列表閱覽全部作品。'); else setList(!listMode); };
$('#back').onclick = () => { if(state !== 'island') return; state = 'overview'; world?.overview(); $('#back').hidden = true; $('#mode').focus(); document.body.classList.remove('in-island'); $('#status').textContent = '拖曳環望 · 點選浮島入境'; };
async function init() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}works.json`);
    if(!response.ok) throw new Error('作品資料載入失敗');
    data = await response.json();
    document.title = `${data.realm}｜作品集`;
    for(const island of data.islands) {
      const section = document.createElement('section'); section.className = 'island-section';
      const heading = document.createElement('h2'); heading.textContent = island.name;
      const info = document.createElement('p'); info.textContent = `${island.category} · ${island.guardian} · ${island.works.length} 卷`;
      const grid = document.createElement('div'); grid.className = 'work-grid';
      for(const work of island.works) {
        const card = document.createElement('div'); card.className = 'work-card';
        const b = document.createElement('button');
        const title = document.createElement('strong'); title.textContent = work.displayTitle || work.buildingName;
        b.append(title);
        if (work.displaySubtitle) {
          const subtitle = document.createElement('span'); subtitle.textContent = work.displaySubtitle; b.append(subtitle);
        }
        const original = document.createElement('span');
        original.textContent = work.displayTitle ? `原卡名：${work.originalName}` : work.originalName;
        b.append(original); b.onclick = () => openWork(island, work, b);
        card.append(b);
        if (Array.isArray(work.records)) card.append(renderRecords(work));
        grid.append(card);
      }
      section.append(heading, info, grid); list.append(section);
      const b = document.createElement('button'); b.textContent = island.name; b.onclick = () => enter(island); $('#island-nav').append(b);
    }
    $('#mode').disabled = false;
    try { const { createWorld } = await import('./world.js'); world = createWorld(data, { enter, openWork, getState: () => state, fail: () => { world.dispose(); world = null; state = 'overview'; setList(true, '3D 場景無法使用，已切換作品列表。'); } }); $('#status').textContent = '拖曳環望 · 點選浮島入境'; }
    catch(error) { console.error(error); setList(true, '3D 場景無法使用，已切換作品列表。'); }
  } catch(error) { $('#status').textContent = '作品資料載入失敗，請重新整理頁面再試。'; list.hidden = false; const b = document.createElement('button'); b.textContent = '重新載入'; b.onclick = () => location.reload(); list.append(b); }
}
async function enter(island) {
  if(!world || listMode || !['overview','island'].includes(state)) return;
  state = 'transit'; $('#status').textContent = `乘${island.vehicle}，前往${island.name}…`;
  $('#back').hidden = true;
  await world.travel(island);
  if(!world) return;
  state = 'island'; document.body.classList.add('in-island'); $('#back').hidden = false;
  $('#status').textContent = `${island.name} · 點選樓閣，展開作品卷軸`;
}
init();
