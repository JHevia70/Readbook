(function(){
  const $ = sel => document.querySelector(sel);
  const els = {
    text: $('#inputText'),
    file: $('#fileInput'),
    drop: $('#dropZone'),
    play: $('#btnPlay'), pause: $('#btnPause'), resume: $('#btnResume'), stop: $('#btnStop'),
    preview: $('#btnPreview'),
    rate: $('#rate'), pitch: $('#pitch'), volume: $('#volume'),
    rateVal: $('#rateVal'), pitchVal: $('#pitchVal'), volumeVal: $('#volumeVal'),
    voice: $('#voiceSelect'),
    wordCount: $('#wordCount'),
    progress: $('#progress'),
    now: $('#nowReading'),
    estimates: $('#estimates'),
    langHint: $('#langHint'),
    exportBtn: $('#btnExport'),
    resetBtn: $('#btnReset'),
    live: $('#live'),
    supportNote: $('#supportNote'),
    castList: $('#castList'),
    castCount: $('#castCount'),
    btnAddChar: $('#btnAddChar'),
    btnAutoDetect: $('#btnAutoDetect'),
    tagBar: $('#tagBar'),
    applyTagSelect: $('#applyTagSelect'),
    applyTagBtn: $('#applyTagBtn'),
    btnSelfCheck: $('#btnSelfCheck'),
    domStatus: $('#domStatus')
  };

  // Feature detection
  const supports = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if(!supports){
    if(els.supportNote) els.supportNote.innerHTML = 'Tu navegador no soporta Web Speech API. Prueba con Chrome/Edge/Brave en escritorio.';
    ['play','pause','resume','stop','preview','voice','rate','pitch','volume'].forEach(k=>{
      const b = els[k]; if(b) b.disabled = true;
    });
    return;
  }

  // State
  const state = {
    voices: [],
    langPreferred: navigator.language || 'es-ES',
    queue: [], // [{text, speaker, settings}]
    idx: 0,
    speaking: false,
    paused: false,
    canceling: false,
    wpmBase: 160, // base estimada
    cast: [], // [{id, name, voiceURI, rate, pitch, volume, color}]
    idc: 0
  };

  const COLORS = ['#7c5cff','#23c9a9','#ff6b6b','#ffce57','#22c55e','#60a5fa','#f472b6','#f59e0b','#10b981','#a78bfa'];

  // Storage
  function save(){
    try{
      localStorage.setItem('tts_text', els.text.value);
      localStorage.setItem('tts_voiceURI', els.voice.value || '');
      localStorage.setItem('tts_rate', els.rate.value);
      localStorage.setItem('tts_pitch', els.pitch.value);
      localStorage.setItem('tts_volume', els.volume.value);
      localStorage.setItem('tts_cast', JSON.stringify(state.cast));
    }catch{}
  }
  function load(){
    try{
      const t = localStorage.getItem('tts_text'); if(t) els.text.value = t;
      const r = localStorage.getItem('tts_rate'); if(r) els.rate.value = r;
      const p = localStorage.getItem('tts_pitch'); if(p) els.pitch.value = p;
      const v = localStorage.getItem('tts_volume'); if(v) els.volume.value = v;
      const cast = localStorage.getItem('tts_cast'); if(cast){ state.cast = JSON.parse(cast); }
      updateSliderLabels();
      updateCounts();
    }catch{}
  }

  // Utils
  const norm = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const uniqueId = () => (window.crypto?.randomUUID?.() || ('id_'+Date.now()+'_'+(++state.idc)));

  function formatTime(mins){
    if(!isFinite(mins)) return '–';
    const total = Math.max(0, Math.round(mins*60));
    const h = Math.floor(total/3600);
    const m = Math.floor((total%3600)/60);
    const s = total%60;
    return h>0 ? `${h}h ${m}m` : (m>0 ? `${m}m ${s}s` : `${s}s`);
  }

  function estimate(){
    const words = (els.text.value.trim().match(/\S+/g) || []).length;
    const rateFactor = parseFloat(els.rate.value) || 1;
    const wpm = state.wpmBase * rateFactor; // aprox.
    const mins = words / Math.max(1, wpm);
    els.estimates.textContent = words ? `≈ ${formatTime(mins)} • ${words.toLocaleString()} palabras` : '–';
  }

  function updateCounts(){
    const words = (els.text.value.trim().match(/\S+/g) || []).length;
    els.wordCount.textContent = `${words.toLocaleString()} palabra${words===1?'':'s'}`;
    estimate();
  }

  function updateSliderLabels(){
    els.rateVal.textContent = Number(els.rate.value).toFixed(1);
    els.pitchVal.textContent = Number(els.pitch.value).toFixed(1);
    els.volumeVal.textContent = Number(els.volume.value).toFixed(2);
  }

  function normalizeText(t){
    return t
      .replace(/[\r\t]/g,' ')
      .replace(/\u00A0/g,' ')
      .replace(/\s{2,}/g,' ')
      .replace(/\n{2,}/g,'\n\n')
      .trim();
  }

  function chunkText(t, maxLen=180){
    const sentences = t.split(/(?<=[\.!?¿¡…\n])\s+/).map(s=>s.trim()).filter(Boolean);
    const out = [];
    for(const s of sentences){
      if(s.length <= maxLen){ out.push(s); continue; }
      const parts = s.split(/[,;:\u2014\u2013\-]\s+/);
      for(const p of parts){
        if(p.length <= maxLen){ out.push(p); continue; }
        let buf = '';
        p.split(/\s+/).forEach(w=>{
          if((buf + ' ' + w).trim().length > maxLen){ out.push(buf.trim()); buf = w; }
          else { buf = (buf?buf+' ':'') + w; }
        });
        if(buf.trim()) out.push(buf.trim());
      }
    }
    return out.filter(Boolean);
  }

  // Voices
  function populateVoices(){
    const all = window.speechSynthesis.getVoices();
    const esFirst = v => (v.lang||'').toLowerCase().startsWith('es') ? 0 : 1;
    state.voices = all.slice().sort((a,b)=>{
      const ea = esFirst(a) - esFirst(b); if(ea!==0) return ea;
      const la = (a.lang||'').localeCompare(b.lang||''); if(la!==0) return la;
      return (a.name||'').localeCompare(b.name||'');
    });

    els.voice.innerHTML = '';
    state.voices.forEach(v=>{
      const opt = document.createElement('option');
      opt.value = v.voiceURI; opt.textContent = `${v.name} — ${v.lang}${v.default?' (predeterminada)':''}`; opt.dataset.lang = v.lang || '';
      els.voice.appendChild(opt);
    });

    const saved = localStorage.getItem('tts_voiceURI');
    let idx = state.voices.findIndex(v => v.voiceURI === saved);
    if(idx === -1){ idx = state.voices.findIndex(v => (v.lang||'').toLowerCase().startsWith('es')); }
    if(idx === -1){ idx = 0; }
    els.voice.selectedIndex = Math.max(0, idx);

    const v = state.voices[els.voice.selectedIndex];
    els.langHint.textContent = v ? (v.lang || '—') : '—';

    // actualizar selects de cast
    renderCast();
    renderTagBar();
    bindEditorDnD();
  }

  function getSelectedVoice(){
    const uri = els.voice.value; return state.voices.find(v=>v.voiceURI===uri) || state.voices[0];
  }

  function pickDefaultVoice(){
    return state.voices.find(v => (v.lang||'').toLowerCase().startsWith('es')) || state.voices[0];
  }

  // Cast (characters)
  function renderCast(){
    els.castList.innerHTML = '';
    state.cast.forEach((c, i)=>{
      const wrap = document.createElement('div'); wrap.className='cast-item';

      // name
      const name = document.createElement('div'); name.className='cast-name';
      const dot = document.createElement('span'); dot.className='dot'; dot.style.background = c.color || COLORS[i % COLORS.length];
      const input = document.createElement('input'); input.value = c.name || ''; input.placeholder='Nombre del personaje'; input.style.width='100%'; input.className='input'; input.oninput = ()=>{ c.name = input.value; save(); };
      name.appendChild(dot); name.appendChild(input);

      // voice select
      const voiceSel = document.createElement('select');
      state.voices.forEach(v=>{
        const opt = document.createElement('option'); opt.value = v.voiceURI; opt.textContent = `${v.name} — ${v.lang}${v.default?' (predeterminada)':''}`; voiceSel.appendChild(opt);
      });
      // fallback si ya no existe la voz
      const have = state.voices.some(v => v.voiceURI === c.voiceURI);
      if(!have){ const dv = pickDefaultVoice(); c.voiceURI = dv?.voiceURI; }
      voiceSel.value = c.voiceURI || pickDefaultVoice()?.voiceURI || '';
      voiceSel.onchange = ()=>{ c.voiceURI = voiceSel.value; save(); };

      // mini sliders
      const mini = document.createElement('div'); mini.className='mini';
      mini.innerHTML = `
        <div>
          <label>Vel <span>${(c.rate??1).toFixed(1)}</span></label>
          <input type="range" min="0.5" max="1.8" step="0.1" value="${c.rate??1}">
        </div>
        <div>
          <label>Tono <span>${(c.pitch??1).toFixed(1)}</span></label>
          <input type="range" min="0.5" max="2" step="0.1" value="${c.pitch??1}">
        </div>
        <div>
          <label>Vol <span>${(c.volume??1).toFixed(2)}</span></label>
          <input type="range" min="0" max="1" step="0.05" value="${c.volume??1}">
        </div>`;
      const [rateEl,pitchEl,volEl] = mini.querySelectorAll('input');
      const [rLbl,pLbl,vLbl] = mini.querySelectorAll('label span');
      rateEl.oninput = ()=>{ c.rate = parseFloat(rateEl.value)||1; rLbl.textContent=c.rate.toFixed(1); save(); };
      pitchEl.oninput = ()=>{ c.pitch = parseFloat(pitchEl.value)||1; pLbl.textContent=c.pitch.toFixed(1); save(); };
      volEl.oninput = ()=>{ c.volume = parseFloat(volEl.value)||1; vLbl.textContent=c.volume.toFixed(2); save(); };

      // actions
      const actions = document.createElement('div'); actions.className='cast-actions';
      const btnApply = document.createElement('button'); btnApply.textContent='🏷️ Asignar sel.'; btnApply.title='Aplicar este personaje al texto seleccionado'; btnApply.className='ghost'; btnApply.dataset.assign = '1'; btnApply.disabled = true;
      btnApply.onclick = ()=>{ const hasSel = (els.text.selectionEnd - els.text.selectionStart) > 0; if(!c.name){ els.live.textContent='Pon nombre al personaje antes de asignar.'; return; } if(!hasSel){ els.live.textContent='Selecciona un trozo de texto en el editor.'; return; } wrapSelectionWithTag(c.name); };
      const btnPara = document.createElement('button'); btnPara.textContent='🧩 Párrafo'; btnPara.title='Aplicar este personaje al párrafo actual'; btnPara.className='ghost'; btnPara.onclick = ()=>{ if(!c.name){ els.live.textContent='Pon nombre al personaje antes de asignar.'; return; } wrapParagraphWithTag(c.name); };
      const btnTest = document.createElement('button'); btnTest.textContent='🔊 Prueba'; btnTest.onclick = ()=> previewCharacter(c);
      const btnDel = document.createElement('button'); btnDel.textContent='🗑️'; btnDel.className='danger'; btnDel.title='Eliminar'; btnDel.onclick = ()=>{ state.cast = state.cast.filter(x=>x.id!==c.id); els.live.textContent=`Eliminado ${c.name||'personaje'}.`; save(); renderCast(); };
      actions.append(btnApply, btnPara, btnTest, btnDel);

      const frag = document.createDocumentFragment();
      frag.appendChild(name); frag.appendChild(voiceSel); frag.appendChild(mini); frag.appendChild(actions);
      wrap.appendChild(frag);
      els.castList.appendChild(wrap);
    });
    els.castCount.textContent = `${state.cast.length} personaje${state.cast.length===1?'':'s'}`;
  }

  function addCharacter(name=''){ state.cast.push({id: uniqueId(), name, voiceURI: pickDefaultVoice()?.voiceURI, rate:1, pitch:1, volume:1, color: COLORS[state.cast.length % COLORS.length]}); save(); renderCast(); }

  function previewCharacter(c){
    const v = state.voices.find(v=>v.voiceURI===c.voiceURI) || pickDefaultVoice();
    const sample = (v?.lang||'').toLowerCase().startsWith('es') ? `${c.name||'Personaje'}: esta es una prueba.` : `${c.name||'Character'}: this is a test.`;
    const u = new SpeechSynthesisUtterance(sample);
    if(v) u.voice = v; u.lang = v?.lang; u.rate = c.rate||1; u.pitch = c.pitch||1; u.volume = c.volume||1;
    window.speechSynthesis.speak(u);
  }

  function currentSettingsForSpeaker(name){
    if(!name) return null;
    const n = norm(name);
    const c = state.cast.find(x => norm(x.name) === n);
    if(!c) return null;
    const v = state.voices.find(v=>v.voiceURI===c.voiceURI) || pickDefaultVoice();
    return {voice: v, rate: c.rate||1, pitch: c.pitch||1, volume: c.volume||1};
  }

  // Parsing script with character tagging
  function parseScript(t){
    t = t.replace(/\r/g,'');

    // 1) Blocks: [[NAME]] ... [[/NAME]]
    const out = [];
    const re = /\[\[([^\]]+)\]\]([\s\s]*?)\[\[\/\1\]\]/g; // not nested-safe
    let last = 0; let m;
    while((m = re.exec(t))){
      if(m.index > last){
        const outside = t.slice(last, m.index).trim();
        if(outside) out.push({speaker:null, text: outside});
      }
      out.push({speaker: (m[1]||'').trim(), text: (m[2]||'').trim()});
      last = re.lastIndex;
    }
    if(last < t.length){
      const tail = t.slice(last).trim(); if(tail) out.push({speaker:null, text: tail});
    }

    // 2) Inside null segments, split line-style NAME: text
    const flat = [];
    for(const seg of out.length? out : [{speaker:null, text:t}]){
      if(seg.speaker){ flat.push(seg); continue; }
      const lines = seg.text.split(/\n+/);
      for(const line of lines){
        const mm = line.match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s*(.+)$/);
        if(mm){ flat.push({speaker:mm[1].trim(), text:mm[2].trim()}); }
        else if(line.trim()){ flat.push({speaker:null, text: line.trim()}); }
      }
    }

    // 3) chunk keeping speaker
    const queue = [];
    for(const seg of flat){
      const parts = chunkText(seg.text);
      for(const p of parts){ queue.push({text:p, speaker: seg.speaker||null}); }
    }
    return queue;
  }

  function start(){
    const textRaw = normalizeText(els.text.value);
    if(!textRaw){ els.live.textContent = 'No hay texto para leer.'; return; }

    // build queue
    state.queue = parseScript(textRaw);
    state.idx = 0; state.speaking = true; state.paused = false; state.canceling = false;
    els.progress.value = 0; els.now.textContent = 'Iniciando…';
    disableEditing(true);

    // aviso de personajes sin asignar
    const usedNames = Array.from(new Set(state.queue.map(q=>q.speaker).filter(Boolean)));
    const missing = usedNames.filter(nm => !currentSettingsForSpeaker(nm));
    if(missing.length){ els.live.textContent = `Sin voz asignada: ${missing.join(', ')}. Uso voz por defecto.`; }

    speakNext();
  }

  function speakNext(){
    if(state.idx >= state.queue.length){ finish(); return; }
    const item = state.queue[state.idx];
    const who = item.speaker || 'Narrador';
    els.now.textContent = `Leyendo (${who}): ${item.text.slice(0,100)}${item.text.length>100?'…':''}`;

    const u = new SpeechSynthesisUtterance(item.text);
    const defV = getSelectedVoice();
    const settings = currentSettingsForSpeaker(item.speaker);
    const v = settings?.voice || defV;
    if(v) u.voice = v;
    u.lang = v?.lang || (defV?.lang) || 'es-ES';
    u.rate = settings?.rate ?? (parseFloat(els.rate.value)||1);
    u.pitch = settings?.pitch ?? (parseFloat(els.pitch.value)||1);
    u.volume = settings?.volume ?? (parseFloat(els.volume.value)||1);

    u.onend = () => {
      if(state.canceling) return;
      state.idx++;
      els.progress.value = Math.round((state.idx/state.queue.length)*100);
      requestAnimationFrame(speakNext);
    };
    u.onerror = (e) => { console.error('TTS error', e); els.live.textContent = 'Error al sintetizar voz.'; finish(); };

    window.speechSynthesis.speak(u);
  }

  function pause(){ if(window.speechSynthesis.speaking && !window.speechSynthesis.paused){ window.speechSynthesis.pause(); state.paused = true; els.live.textContent = 'Pausado.'; } }
  function resume(){ if(window.speechSynthesis.paused){ window.speechSynthesis.resume(); state.paused = false; els.live.textContent = 'Reanudando…'; } else if(!state.speaking){ start(); } }
  function stop(){ state.canceling = true; window.speechSynthesis.cancel(); finish(); }
  function finish(){ state.speaking = false; state.paused = false; state.idx = 0; state.queue = []; els.now.textContent = 'Listo.'; els.progress.value = 0; disableEditing(false); }
  function disableEditing(dis){ els.text.readOnly = dis; [els.file, els.drop, els.voice, els.rate, els.pitch, els.volume, els.btnAddChar, els.btnAutoDetect].forEach(el=>{ if(el) el.disabled = dis; }); }

  function preview(){
    const v = getSelectedVoice();
    const sample = (v?.lang||'').toLowerCase().startsWith('es') ? 'Hola, ésta es una prueba de voz.' : 'Hello, this is a quick voice test.';
    const u = new SpeechSynthesisUtterance(sample);
    if(v) u.voice = v; u.lang = v?.lang || state.langPreferred; u.rate = 1; u.pitch = 1; u.volume = parseFloat(els.volume.value)||1;
    window.speechSynthesis.speak(u);
  }

  // Auto-detect from text
  function autoDetect(){
    const t = els.text.value || '';
    const names = new Set();
    // from blocks [[NAME]] ... [[/NAME]]
    const reB = /\[\[([^\]]+)\]\][\s\s]*?\[\[\/\1\]\]/g; let mb; while((mb = reB.exec(t))){ names.add((mb[1]||'').trim()); }
    // from line style NAME:
    const reL = /^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s+.+$/gm; let ml; while((ml = reL.exec(t))){ names.add((ml[1]||'').trim()); }

    const existing = new Set(state.cast.map(c=>norm(c.name)));
    let added = 0;
    names.forEach(nm=>{ if(!existing.has(norm(nm))){ addCharacter(nm); added++; } });
    if(added===0){ els.live.textContent = 'No se encontraron nombres nuevos.'; } else { els.live.textContent = `Añadidos ${added} personaje(s).`; }
  }

  // File handling
  function readFile(file){ if(!file) return; const reader = new FileReader(); reader.onload = () => { els.text.value = normalizeText(String(reader.result||'')); save(); updateCounts(); }; reader.onerror = () => { els.live.textContent = 'No se pudo leer el archivo.'; }; reader.readAsText(file); }

  // Export text
  function exportTxt(){ const blob = new Blob([els.text.value||''], {type:'text/plain;charset=utf-8'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'texto_para_leer.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000); }

  // === Autocomprobación DOM mínima ===
  function runSelfCheck(){
    const esc = (window.CSS && CSS.escape) ? CSS.escape : (s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&'));
    const issues = [];
    const mustHave = ['inputText','voiceSelect','btnPlay','btnPause','btnResume','btnStop','progress','castList','applyTagBtn','applyTagSelect','tagBar'];
    mustHave.forEach(id=>{
      const n = document.querySelectorAll('#'+esc(id)).length;
      if(n===0) issues.push(`Falta #${id}`);
      if(n>1) issues.push(`ID duplicado #${id} (${n})`);
    });
    const toolbar = document.querySelector('.controls .toolbar');
    if(!toolbar){ issues.push('No existe toolbar bajo el editor'); }
    else {
      const btns = toolbar.querySelectorAll('button');
      if(btns.length < 4) issues.push('Toolbar con menos de 4 botones');
      btns.forEach(b=>{
        const txt = (b.textContent||'').trim();
        if(txt.includes('<') || txt.includes('>')) issues.push(`Botón con texto sospechoso: ${b.id||txt.slice(0,20)+'…'}`);
        if(!b.querySelector('.kbd')) issues.push(`Botón sin marcador de atajo (.kbd): ${b.id||txt.slice(0,20)+'…'}`);
      });
    }
    const msg = issues.length ? `Autotest: ${issues.length} problema(s): ${issues.join(' • ')}` : 'Autotest: OK ✅';
    if(els.live) els.live.textContent = msg;
    if(els.domStatus) els.domStatus.textContent = issues.length ? `Autotest: ${issues.length}` : 'Autotest: OK ✅';
    return issues;
  }

  // === Quick Tagging (drag & drop + apply to selection) ===
  function buildTagOptions(){
    const names = ['Narrador', ...state.cast.map(c=>c.name).filter(Boolean)];
    els.applyTagSelect.innerHTML = '';
    names.forEach(nm=>{ const o=document.createElement('option'); o.value=nm; o.textContent=nm; els.applyTagSelect.appendChild(o); });
  }

  function renderTagBar(){
    if(!els.tagBar) return; els.tagBar.innerHTML='';
    const items = [{name:'Narrador', color:'#64748b'}, ...state.cast.map((c,i)=>({name:c.name||`P${i+1}`, color:c.color}))];
    items.forEach(it=>{
      const b = document.createElement('button'); b.className='chip'; b.draggable=true; b.title = `Arrastra para etiquetar como ${it.name}`;
      const d = document.createElement('span'); d.className='dot'; d.style.background = it.color || '#64748b';
      const t = document.createElement('span'); t.textContent = it.name;
      b.append(d,t);
      b.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/x-speaker', it.name); e.dataTransfer.effectAllowed='copyMove'; });
      els.tagBar.appendChild(b);
    });
    buildTagOptions();
  }

  function wrapSelectionWithTag(name){
    const el = els.text; el.focus();
    const start = el.selectionStart ?? 0; const end = el.selectionEnd ?? 0;
    const value = el.value; const tagOpen = `[[${name}]]`; const tagClose = `[[/${name}]]`;
    if(end>start){
      const before = value.slice(0,start); const sel = value.slice(start,end); const after = value.slice(end);
      el.value = before + tagOpen + ' ' + sel + ' ' + tagClose + after;
      const newPos = (before + tagOpen + ' ' + sel + ' ').length;
      el.setSelectionRange(newPos, newPos);
    } else {
      const before = value.slice(0,start); const after = value.slice(start);
      el.value = before + tagOpen + ' ' + tagClose + after;
      const caret = (before + tagOpen + ' ').length; el.setSelectionRange(caret, caret);
    }
    save(); updateCounts();
  }

  // New: paragraph tagging helpers
  function getParagraphBounds(value, start, end){
    const len = value.length;
    let s = Math.max(0, start|0);
    let e = Math.max(s, end|0);
    const left = value.lastIndexOf('\n\n', s);
    const bStart0 = left >= 0 ? left + 2 : 0;
    const right = value.indexOf('\n\n', e);
    const bEnd0 = right >= 0 ? right : len;
    let bStart = bStart0, bEnd = bEnd0;
    while (bStart < bEnd && /\s/.test(value[bStart])) bStart++;
    while (bEnd > bStart && /\s/.test(value[bEnd-1])) bEnd--;
    return { start: bStart, end: bEnd };
  }

  function wrapParagraphWithTag(name){
    const el = els.text; if(!el) return; el.focus();
    const start = el.selectionStart ?? 0;
    const end   = el.selectionEnd ?? start;
    const {start:s, end:e} = getParagraphBounds(el.value, start, end);
    const inner = el.value.slice(s, e);
    if(!inner.trim()){ els.live.textContent = 'Párrafo vacío o solo espacios.'; return; }
    if(inner.includes('[[') && inner.includes(']]')){
      els.live.textContent = 'Ese párrafo ya tiene etiquetas. Usa "Asignar sel." o limpia antes.';
      return;
    }
    const before = el.value.slice(0, s);
    const after  = el.value.slice(e);
    const open = `[[${name}]] `, close = ` [[/${name}]]`;
    el.value = before + open + inner + close + after;
    const caret = (before + open).length;
    el.setSelectionRange(caret, caret);
    save(); updateCounts();
  }

  function applyTagToSelection(){ const name = els.applyTagSelect.value || 'Narrador'; wrapSelectionWithTag(name); }

  function updateApplyEnabled(){
    const el = els.text; const hasSel = (el.selectionEnd - el.selectionStart) > 0;
    if(els.applyTagBtn) els.applyTagBtn.disabled = !hasSel;
    document.querySelectorAll('button[data-assign="1"]').forEach(b=>{ b.disabled = !hasSel; });
  }

  // Drag & drop onto textarea
  function bindEditorDnD(){
    const el = els.text;
    ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev, e=>{ const spk = e.dataTransfer?.types?.includes('text/x-speaker'); if(spk){ e.preventDefault(); el.classList.add('drop-active'); }}));
    ['dragleave','drop','dragend'].forEach(ev=> el.addEventListener(ev, e=>{ el.classList.remove('drop-active'); }));
    el.addEventListener('drop', e=>{ const spk = e.dataTransfer?.getData('text/x-speaker'); if(!spk) return; e.preventDefault(); wrapSelectionWithTag(spk); });
    el.addEventListener('mouseup', updateApplyEnabled);
    el.addEventListener('keyup', updateApplyEnabled);
    el.addEventListener('select', updateApplyEnabled);
  }


  // Init
  load();
  document.addEventListener('visibilitychange', ()=>{ /* opcional: auto-pausa */ });
  els.text.addEventListener('input', ()=>{ save(); updateCounts(); });

  // Drag & drop
  ['dragenter','dragover'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.add('dragover'); }); });
  ['dragleave','drop'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.remove('dragover'); }); });
  els.drop.addEventListener('drop', e=>{ const f = e.dataTransfer?.files?.[0]; readFile(f); });
  els.file.addEventListener('change', e=>{ const f = e.target.files?.[0]; readFile(f); e.target.value=''; });

  // Buttons
  els.play.addEventListener('click', start);
  els.pause.addEventListener('click', pause);
  els.resume.addEventListener('click', resume);
  els.stop.addEventListener('click', stop);
  els.preview.addEventListener('click', preview);
  els.exportBtn.addEventListener('click', exportTxt);
  els.resetBtn.addEventListener('click', ()=>{ els.text.value=''; save(); updateCounts(); });
  if(els.btnSelfCheck) els.btnSelfCheck.addEventListener('click', runSelfCheck); updateCounts();
  els.btnAddChar.addEventListener('click', ()=> addCharacter(''));
  els.btnAutoDetect.addEventListener('click', autoDetect);
  els.applyTagBtn.addEventListener('click', applyTagToSelection);
  els.applyTagSelect.addEventListener('change', ()=>{/* keep */});

  // Sliders
  [els.rate, els.pitch, els.volume].forEach(sl=> sl.addEventListener('input', ()=>{ updateSliderLabels(); save(); estimate(); }));

  // Voice select
  els.voice.addEventListener('change', ()=>{ save(); const v = getSelectedVoice(); els.langHint.textContent = v? (v.lang||'—') : '—'; });

  // Keyboard shortcuts
  document.addEventListener('keydown', e=>{
    if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA')) return; // no interferir al escribir
    if(e.code==='Space'){ e.preventDefault(); if(window.speechSynthesis.speaking && !window.speechSynthesis.paused) pause(); else resume(); }
    if(e.key==='s' || e.key==='S'){ stop(); }
    if(e.key==='r' || e.key==='R'){ resume(); }
  });

  // Voices
  populateVoices();
  window.speechSynthesis.onvoiceschanged = ()=>{ populateVoices(); };
  // Ejecutar una comprobación inicial tras cargar voces
  setTimeout(runSelfCheck, 50);
})();