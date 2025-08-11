(function(){
  const $ = sel => document.querySelector(sel);

  // THEME
  function injectThemeStyles(){
    if(document.getElementById('readbook-theme-styles')) return;
    const css = `
@media (prefers-color-scheme: light){
  :root:not([data-theme]){
    --bg: #f7f9fc;
    --panel: #ffffff;
    --muted: #52607a;
    --text: #0b1220;
    --accent: #7c5cff;
    --accent-2: #23c9a9;
    --danger: #e11d48;
    --warning: #b7791f;
    --ok: #16a34a;
    --shadow: 0 10px 30px rgba(0,0,0,.08);
  }
  :root:not([data-theme]) body{ background: #f7f9fc; }
  :root:not([data-theme]) textarea,
  :root:not([data-theme]) .drop,
  :root:not([data-theme]) .slider,
  :root:not([data-theme]) .chip,
  :root:not([data-theme]) .pill,
  :root:not([data-theme]) .kbd,
  :root:not([data-theme]) .cast-item { background:#ffffff; border-color: rgba(0,0,0,.08); color: #0b1220; }
  :root:not([data-theme]) .ghost{ background: transparent; border-color: rgba(0,0,0,.12); }
  :root:not([data-theme]) progress::-webkit-progress-bar{ background: #e5e7eb; }
}
:root[data-theme="dark"]{
  --bg: #0b0e14;
  --panel: #121826;
  --muted: #8b95a7;
  --text: #e6eefc;
  --accent: #7c5cff;
  --accent-2: #23c9a9;
  --danger: #ff6b6b;
  --warning: #ffce57;
  --ok: #22c55e;
  --shadow: 0 10px 30px rgba(0,0,0,.35);
}
:root[data-theme="dark"] body{ background: radial-gradient(1200px 600px at 20% -10%, #1a2338 0%, rgba(26,35,56,0) 60%), radial-gradient(1000px 500px at 120% 10%, #1f153e 0%, rgba(31,21,62,0) 60%), var(--bg); }
:root[data-theme="dark"] textarea,
:root[data-theme="dark"] .drop,
:root[data-theme="dark"] .slider,
:root[data-theme="dark"] .chip,
:root[data-theme="dark"] .pill,
:root[data-theme="dark"] .kbd,
:root[data-theme="dark"] .cast-item { background:#0f1422; border-color: rgba(255,255,255,.08); color: var(--text); }
:root[data-theme="light"]{
  --bg: #f7f9fc;
  --panel: #ffffff;
  --muted: #52607a;
  --text: #0b1220;
  --accent: #7c5cff;
  --accent-2: #23c9a9;
  --danger: #e11d48;
  --warning: #b7791f;
  --ok: #16a34a;
  --shadow: 0 10px 30px rgba(0,0,0,.08);
}
:root[data-theme="light"] body{ background: #f7f9fc; }
:root[data-theme="light"] textarea,
:root[data-theme="light"] .drop,
:root[data-theme="light"] .slider,
:root[data-theme="light"] .chip,
:root[data-theme="light"] .pill,
:root[data-theme="light"] .kbd,
:root[data-theme="light"] .cast-item { background:#ffffff; border-color: rgba(0,0,0,.08); color: #0b1220; }
:root[data-theme="light"] .ghost{ background: transparent; border-color: rgba(0,0,0,.12); }
:root[data-theme="light"] progress::-webkit-progress-bar{ background: #e5e7eb; }
`;
    const style = document.createElement('style');
    style.id = 'readbook-theme-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }
  function applyTheme(theme){
    const root = document.documentElement;
    const meta = document.querySelector('meta[name="theme-color"]') || (function(){ const m=document.createElement('meta'); m.name='theme-color'; document.head.appendChild(m); return m; })();
    if(theme === 'auto'){ root.removeAttribute('data-theme'); localStorage.setItem('theme','auto'); }
    else { root.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0b0e14';
    meta.setAttribute('content', bg);
  }
  function mountThemeToggle(){
    injectThemeStyles();
    const sel = document.querySelector('#themeSelect');
    if(!sel) return;
    const saved = localStorage.getItem('theme') || 'auto';
    sel.value = saved;
    sel.addEventListener('change', ()=> applyTheme(sel.value));
    applyTheme(saved);
  }

  // PWA
  function registerSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); } }

  // CORE
  const $q = s => document.querySelector(s);
  const els = {
    text: $q('#inputText'), file: $q('#fileInput'), drop: $q('#dropZone'),
    play: $q('#btnPlay'), pause: $q('#btnPause'), resume: $q('#btnResume'), stop: $q('#btnStop'),
    preview: $q('#btnPreview'),
    rate: $q('#rate'), pitch: $q('#pitch'), volume: $q('#volume'),
    rateVal: $q('#rateVal'), pitchVal: $q('#pitchVal'), volumeVal: $q('#volumeVal'),
    voice: $q('#voiceSelect'),
    wordCount: $q('#wordCount'),
    progress: $q('#progress'), now: $q('#nowReading'), estimates: $q('#estimates'), langHint: $q('#langHint'),
    exportBtn: $q('#btnExport'), resetBtn: $q('#btnReset'), live: $q('#live'), supportNote: $q('#supportNote'),
    castList: $q('#castList'), castCount: $q('#castCount'), btnAddChar: $q('#btnAddChar'), btnAutoDetect: $q('#btnAutoDetect'),
    tagBar: $q('#tagBar'), applyTagSelect: $q('#applyTagSelect'), applyTagBtn: $q('#applyTagBtn'),
    btnSelfCheck: $q('#btnSelfCheck'), domStatus: $q('#domStatus'), themeSelect: $q('#themeSelect')
  };

  const supports = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if(!supports){
    if(els.supportNote) els.supportNote.innerHTML = 'Tu navegador no soporta Web Speech API. Prueba con Chrome/Edge/Brave en escritorio.';
    ['play','pause','resume','stop','preview','voice','rate','pitch','volume'].forEach(k=>{ const b = els[k]; if(b) b.disabled = true; });
    mountThemeToggle(); registerSW(); return;
  }

  const state = { voices: [], langPreferred: navigator.language||'es-ES', queue:[], idx:0, speaking:false, paused:false, canceling:false, wpmBase:160, cast:[], idc:0 };
  const COLORS = ['#7c5cff','#23c9a9','#ff6b6b','#ffce57','#22c55e','#60a5fa','#f472b6','#f59e0b','#10b981','#a78bfa'];

  function save(){ try{ localStorage.setItem('tts_text', els.text.value); localStorage.setItem('tts_voiceURI', els.voice.value||''); localStorage.setItem('tts_rate', els.rate.value); localStorage.setItem('tts_pitch', els.pitch.value); localStorage.setItem('tts_volume', els.volume.value); localStorage.setItem('tts_cast', JSON.stringify(state.cast)); }catch{} }
  function load(){ try{ const t=localStorage.getItem('tts_text'); if(t) els.text.value=t; const r=localStorage.getItem('tts_rate'); if(r) els.rate.value=r; const p=localStorage.getItem('tts_pitch'); if(p) els.pitch.value=p; const v=localStorage.getItem('tts_volume'); if(v) els.volume.value=v; const cast=localStorage.getItem('tts_cast'); if(cast){ state.cast = JSON.parse(cast); } updateSliderLabels(); updateCounts(); }catch{} }

  const norm = (s='') => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const uniqueId = () => (crypto?.randomUUID?.() || ('id_'+Date.now()+'_'+(++state.idc)));
  function formatTime(mins){ if(!isFinite(mins)) return '–'; const total=Math.max(0, Math.round(mins*60)); const h=Math.floor(total/3600); const m=Math.floor((total%3600)/60); const s=total%60; return h>0?`${h}h ${m}m`:(m>0?`${m}m ${s}s`:`${s}s`); }
  function estimate(){ const words=(els.text.value.trim().match(/\S+/g)||[]).length; const wpm=state.wpmBase*(parseFloat(els.rate.value)||1); const mins=words/Math.max(1,wpm); els.estimates.textContent = words?`≈ ${formatTime(mins)} • ${words.toLocaleString()} palabras`:'–'; }
  function updateCounts(){ const words=(els.text.value.trim().match(/\S+/g)||[]).length; els.wordCount.textContent = `${words.toLocaleString()} palabra${words===1?'':'s'}`; estimate(); }
  function updateSliderLabels(){ els.rateVal.textContent=Number(els.rate.value).toFixed(1); els.pitchVal.textContent=Number(els.pitch.value).toFixed(1); els.volumeVal.textContent=Number(els.volume.value).toFixed(2); }
  function normalizeText(t){ return t.replace(/[\r\t]/g,' ').replace(/\u00A0/g,' ').replace(/\s{2,}/g,' ').replace(/\n{2,}/g,'\n\n').trim(); }

  function chunkText(t, maxLen=180){
    const sentences = t.split(/(?<=[\.!?¿¡…\n])\s+/).map(s=>s.trim()).filter(Boolean);
    const out = [];
    for(const s of sentences){
      if(s.length<=maxLen){ out.push(s); continue; }
      const parts = s.split(/[,;:\u2014\u2013\-]\s+/);
      for(const p of parts){
        if(p.length<=maxLen){ out.push(p); continue; }
        let buf=''; p.split(/\s+/).forEach(w=>{ if((buf+' '+w).trim().length>maxLen){ out.push(buf.trim()); buf=w; } else { buf=(buf?buf+' ':'')+w; } });
        if(buf.trim()) out.push(buf.trim());
      }
    }
    return out.filter(Boolean);
  }

  function populateVoices(){
    const all = speechSynthesis.getVoices();
    const esFirst = v => (v.lang||'').toLowerCase().startsWith('es') ? 0 : 1;
    state.voices = all.slice().sort((a,b)=>{ const ea=esFirst(a)-esFirst(b); if(ea!==0) return ea; const la=(a.lang||'').localeCompare(b.lang||''); if(la!==0) return la; return (a.name||'').localeCompare(b.name||''); });

    els.voice.innerHTML='';
    state.voices.forEach(v=>{ const opt=document.createElement('option'); opt.value=v.voiceURI; opt.textContent=`${v.name} — ${v.lang}${v.default?' (predeterminada)':''}`; opt.dataset.lang=v.lang||''; els.voice.appendChild(opt); });

    const saved = localStorage.getItem('tts_voiceURI');
    let idx = state.voices.findIndex(v => v.voiceURI===saved);
    if(idx===-1){ idx = state.voices.findIndex(v => (v.lang||'').toLowerCase().startsWith('es')); }
    if(idx===-1){ idx = 0; }
    els.voice.selectedIndex = Math.max(0, idx);
    const v = state.voices[els.voice.selectedIndex];
    els.langHint.textContent = v ? (v.lang||'—') : '—';

    renderCast(); renderTagBar(); bindEditorDnD();
  }
  function getSelectedVoice(){ const uri=els.voice.value; return state.voices.find(v=>v.voiceURI===uri)||state.voices[0]; }
  function pickDefaultVoice(){ return state.voices.find(v => (v.lang||'').toLowerCase().startsWith('es')) || state.voices[0]; }

  function renderCast(){
    els.castList.innerHTML='';
    state.cast.forEach((c,i)=>{
      const wrap=document.createElement('div'); wrap.className='cast-item';
      const name=document.createElement('div'); name.className='cast-name';
      const dot=document.createElement('span'); dot.className='dot'; dot.style.background=c.color||['#7c5cff','#23c9a9','#ff6b6b','#ffce57','#22c55e'][i%5];
      const input=document.createElement('input'); input.value=c.name||''; input.placeholder='Nombre del personaje'; input.style.width='100%'; input.className='input'; input.oninput=()=>{ c.name=input.value; save(); };
      name.append(dot,input);

      const voiceSel=document.createElement('select');
      state.voices.forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.textContent=`${v.name} — ${v.lang}${v.default?' (predeterminada)':''}`; voiceSel.appendChild(o); });
      if(!state.voices.some(v=>v.voiceURI===c.voiceURI)){ c.voiceURI=pickDefaultVoice()?.voiceURI; }
      voiceSel.value=c.voiceURI||pickDefaultVoice()?.voiceURI||'';
      voiceSel.onchange=()=>{ c.voiceURI=voiceSel.value; save(); };

      const mini=document.createElement('div'); mini.className='mini';
      mini.innerHTML=`
        <div><label>Vel <span>${(c.rate??1).toFixed(1)}</span></label><input type="range" min="0.5" max="1.8" step="0.1" value="${c.rate??1}"></div>
        <div><label>Tono <span>${(c.pitch??1).toFixed(1)}</span></label><input type="range" min="0.5" max="2" step="0.1" value="${c.pitch??1}"></div>
        <div><label>Vol <span>${(c.volume??1).toFixed(2)}</span></label><input type="range" min="0" max="1" step="0.05" value="${c.volume??1}"></div>`;
      const [rateEl,pitchEl,volEl]=mini.querySelectorAll('input'); const [rLbl,pLbl,vLbl]=mini.querySelectorAll('label span');
      rateEl.oninput=()=>{ c.rate=parseFloat(rateEl.value)||1; rLbl.textContent=c.rate.toFixed(1); save(); };
      pitchEl.oninput=()=>{ c.pitch=parseFloat(pitchEl.value)||1; pLbl.textContent=c.pitch.toFixed(1); save(); };
      volEl.oninput=()=>{ c.volume=parseFloat(volEl.value)||1; vLbl.textContent=c.volume.toFixed(2); save(); };

      const actions=document.createElement('div'); actions.className='cast-actions';
      const btnApply=document.createElement('button'); btnApply.textContent='🏷️ Asignar sel.'; btnApply.className='ghost'; btnApply.dataset.assign='1'; btnApply.title='Aplicar a selección'; btnApply.disabled=true;
      btnApply.onclick=()=>{ const hasSel=(els.text.selectionEnd-els.text.selectionStart)>0; if(!c.name){ els.live.textContent='Pon nombre al personaje antes de asignar.'; return; } if(!hasSel){ els.live.textContent='Selecciona un trozo de texto en el editor.'; return; } wrapSelectionWithTag(c.name); };
      const btnPara=document.createElement('button'); btnPara.textContent='🧩 Párrafo'; btnPara.className='ghost'; btnPara.title='Aplicar al párrafo actual'; btnPara.onclick=()=>{ if(!c.name){ els.live.textContent='Pon nombre al personaje antes de asignar.'; return; } wrapParagraphWithTag(c.name); };
      const btnTest=document.createElement('button'); btnTest.textContent='🔊 Prueba'; btnTest.onclick=()=> previewCharacter(c);
      const btnDel=document.createElement('button'); btnDel.textContent='🗑️'; btnDel.className='danger'; btnDel.title='Eliminar'; btnDel.onclick=()=>{ state.cast=state.cast.filter(x=>x.id!==c.id); els.live.textContent=`Eliminado ${c.name||'personaje'}.`; save(); renderCast(); };
      actions.append(btnApply,btnPara,btnTest,btnDel);

      wrap.append(name,voiceSel,mini,actions);
      els.castList.appendChild(wrap);
    });
    els.castCount.textContent = `${state.cast.length} personaje${state.cast.length===1?'':'s'}`;
  }

  function addCharacter(name=''){ state.cast.push({id:uniqueId(), name, voiceURI:pickDefaultVoice()?.voiceURI, rate:1, pitch:1, volume:1, color: COLORS[state.cast.length % COLORS.length]}); save(); renderCast(); }
  function previewCharacter(c){ const v=state.voices.find(v=>v.voiceURI===c.voiceURI)||pickDefaultVoice(); const sample=(v?.lang||'').toLowerCase().startsWith('es')?`${c.name||'Personaje'}: esta es una prueba.`:`${c.name||'Character'}: this is a test.`; const u=new SpeechSynthesisUtterance(sample); if(v) u.voice=v; u.lang=v?.lang; u.rate=c.rate||1; u.pitch=c.pitch||1; u.volume=c.volume||1; speechSynthesis.speak(u); }
  function currentSettingsForSpeaker(name){ if(!name) return null; const c=state.cast.find(x=>norm(x.name)===norm(name)); if(!c) return null; const v=state.voices.find(v=>v.voiceURI===c.voiceURI)||pickDefaultVoice(); return {voice:v, rate:c.rate||1, pitch:c.pitch||1, volume:c.volume||1}; }

  function convertVozBlocks(str){ return str.replace(/\[voz=([^\]]+)\]([\s\S]*?)\[\/voz\]/gi, (_,name,inner)=> `[[${(name||'').trim()}]]${inner}[[/${(name||'').trim()}]]`); }
  function parseScript(t){
    t = convertVozBlocks(t).replace(/\r/g,'');
    const out=[]; const re=/\[\[([^\]]+)\]\]([\s\s]*?)\[\[\/\1\]\]/g; let last=0, m;
    while((m=re.exec(t))){
      if(m.index>last){ const outside=t.slice(last,m.index).trim(); if(outside) out.push({speaker:null,text:outside}); }
      out.push({speaker:(m[1]||'').trim(), text:(m[2]||'').trim()}); last=re.lastIndex;
    }
    if(last<t.length){ const tail=t.slice(last).trim(); if(tail) out.push({speaker:null, text:tail}); }
    const flat=[];
    for(const seg of out.length? out : [{speaker:null, text:t}]){
      if(seg.speaker){ flat.push(seg); continue; }
      const lines=seg.text.split(/\n+/);
      for(const line of lines){
        const mm=line.match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s*(.+)$/);
        if(mm){ flat.push({speaker:mm[1].trim(), text:mm[2].trim()}); }
        else if(line.trim()){ flat.push({speaker:null, text: line.trim()}); }
      }
    }
    const queue=[];
    for(const seg of flat){ const parts=chunkText(seg.text); for(const p of parts){ queue.push({text:p, speaker:seg.speaker||null}); } }
    return queue;
  }

  function ensureCastForUsedSpeakers(used){
    const narratorURI=getSelectedVoice()?.voiceURI;
    const sameLang=state.voices.filter(v=>v.lang===getSelectedVoice()?.lang)||state.voices;
    let rr=parseInt(localStorage.getItem('tts_rr_idx')||'0',10);
    const have=new Set(state.cast.map(c=>norm(c.name)));
    used.forEach(nm=>{
      if(have.has(norm(nm))) return;
      const newC={id:uniqueId(), name:nm, voiceURI:narratorURI, rate:1, pitch:1, volume:1, color: COLORS[state.cast.length % COLORS.length]};
      const candidates=sameLang.filter(v=>v.voiceURI!==narratorURI);
      if(candidates.length){ const pick=candidates[rr % candidates.length]; rr++; newC.voiceURI=pick.voiceURI; }
      state.cast.push(newC);
    });
    localStorage.setItem('tts_rr_idx', String(rr));
    save(); renderCast(); renderTagBar();
  }

  function start(){
    const textRaw=normalizeText(els.text.value);
    if(!textRaw){ els.live.textContent='No hay texto para leer.'; return; }
    state.queue=parseScript(textRaw);
    state.idx=0; state.speaking=true; state.paused=false; state.canceling=false;
    els.progress.value=0; els.now.textContent='Iniciando…'; disableEditing(true);

    const used=Array.from(new Set(state.queue.map(q=>q.speaker).filter(Boolean)));
    ensureCastForUsedSpeakers(used);
    const missing=used.filter(nm=>!currentSettingsForSpeaker(nm));
    if(missing.length){ els.live.textContent=`Sin voz asignada: ${missing.join(', ')}. Uso voz por defecto.`; }
    speakNext();
  }
  function speakNext(){
    if(state.idx>=state.queue.length){ finish(); return; }
    const item=state.queue[state.idx];
    const who=item.speaker || 'Narrador';
    els.now.textContent=`Leyendo (${who}): ${item.text.slice(0,100)}${item.text.length>100?'…':''}`;
    const u=new SpeechSynthesisUtterance(item.text);
    const defV=getSelectedVoice();
    const settings=currentSettingsForSpeaker(item.speaker);
    const v=settings?.voice || defV;
    if(v) u.voice=v;
    u.lang=v?.lang || (defV?.lang) || 'es-ES';
    u.rate=settings?.rate ?? (parseFloat(els.rate.value)||1);
    u.pitch=settings?.pitch ?? (parseFloat(els.pitch.value)||1);
    u.volume=settings?.volume ?? (parseFloat(els.volume.value)||1);
    u.onend=()=>{ if(state.canceling) return; state.idx++; els.progress.value=Math.round((state.idx/state.queue.length)*100); requestAnimationFrame(speakNext); };
    u.onerror=(e)=>{ console.error('TTS error', e); els.live.textContent='Error al sintetizar voz.'; finish(); };
    speechSynthesis.speak(u);
  }
  function pause(){ if(speechSynthesis.speaking && !speechSynthesis.paused){ speechSynthesis.pause(); state.paused=true; els.live.textContent='Pausado.'; } }
  function resume(){ if(speechSynthesis.paused){ speechSynthesis.resume(); state.paused=false; els.live.textContent='Reanudando…'; } else if(!state.speaking){ start(); } }
  function stop(){ state.canceling=true; speechSynthesis.cancel(); finish(); }
  function finish(){ state.speaking=false; state.paused=false; state.idx=0; state.queue=[]; els.now.textContent='Listo.'; els.progress.value=0; disableEditing(false); }
  function disableEditing(dis){ els.text.readOnly=dis; [els.file,els.drop,els.voice,els.rate,els.pitch,els.volume,els.btnAddChar,els.btnAutoDetect].forEach(el=>{ if(el) el.disabled=dis; }); }
  function preview(){ const v=getSelectedVoice(); const sample=(v?.lang||'').toLowerCase().startsWith('es')?'Hola, ésta es una prueba de voz.':'Hello, this is a quick voice test.'; const u=new SpeechSynthesisUtterance(sample); if(v) u.voice=v; u.lang=v?.lang || state.langPreferred; u.rate=1; u.pitch=1; u.volume=parseFloat(els.volume.value)||1; speechSynthesis.speak(u); }

  function autoDetect(){
    const t=els.text.value||''; const names=new Set();
    let mb, mv, ml;
    const reB=/\[\[([^\]]+)\]\][\s\s]*?\[\[\/\1\]\]/g; while((mb=reB.exec(t))){ names.add((mb[1]||'').trim()); }
    const reV=/\[voz=([^\]]+)\][\s\S]*?\[\/voz\]/gi; while((mv=reV.exec(t))){ names.add((mv[1]||'').trim()); }
    const reL=/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s+.+$/gm; while((ml=reL.exec(t))){ names.add((ml[1]||'').trim()); }
    const existing=new Set(state.cast.map(c=>norm(c.name))); let added=0;
    names.forEach(nm=>{ if(!existing.has(norm(nm))){ addCharacter(nm); added++; } });
    els.live.textContent = added===0 ? 'No se encontraron nombres nuevos.' : `Añadidos ${added} personaje(s).`;
  }

  function readFile(file){ if(!file) return; const r=new FileReader(); r.onload=()=>{ els.text.value=normalizeText(String(r.result||'')); save(); updateCounts(); }; r.onerror=()=>{ els.live.textContent='No se pudo leer el archivo.'; }; r.readAsText(file); }
  function exportTxt(){ const blob=new Blob([els.text.value||''], {type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='texto_para_leer.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000); }

  function runSelfCheck(){
    const esc=(window.CSS && CSS.escape)?CSS.escape:(s=>String(s).replace(/[^a-zA-Z0-9_-]/g,'\\$&'));
    const issues=[]; const must=['inputText','voiceSelect','btnPlay','btnPause','btnResume','btnStop','progress','castList','applyTagBtn','applyTagSelect','tagBar'];
    must.forEach(id=>{ const n=document.querySelectorAll('#'+esc(id)).length; if(n===0) issues.push(`Falta #${id}`); if(n>1) issues.push(`ID duplicado #${id} (${n})`); });
    const toolbar=document.querySelector('.controls .toolbar');
    if(!toolbar){ issues.push('No existe toolbar bajo el editor'); }
    else { const btns=toolbar.querySelectorAll('button'); if(btns.length<4) issues.push('Toolbar con menos de 4 botones'); btns.forEach(b=>{ const txt=(b.textContent||'').trim(); if(txt.includes('<')||txt.includes('>')) issues.push(`Botón con texto sospechoso: ${b.id||txt.slice(0,20)+'…'}`); if(!b.querySelector('.kbd')) issues.push(`Botón sin marcador de atajo (.kbd): ${b.id||txt.slice(0,20)+'…'}`); }); }
    const msg=issues.length?`Autotest: ${issues.length} problema(s): ${issues.join(' • ')}`:'Autotest: OK ✅';
    if(els.live) els.live.textContent=msg; if(els.domStatus) els.domStatus.textContent=issues.length?`Autotest: ${issues.length}`:'Autotest: OK ✅';
    return issues;
  }

  function buildTagOptions(){ const names=['Narrador', ...state.cast.map(c=>c.name).filter(Boolean)]; const sel=els.applyTagSelect; if(!sel) return; sel.innerHTML=''; names.forEach(nm=>{ const o=document.createElement('option'); o.value=nm; o.textContent=nm; sel.appendChild(o); }); }
  function renderTagBar(){
    const bar=els.tagBar; if(!bar) return; bar.innerHTML='';
    const items=[{name:'Narrador',color:'#64748b'}, ...state.cast.map((c,i)=>({name:c.name||`P${i+1}`, color:c.color}))];
    items.forEach(it=>{ const b=document.createElement('button'); b.className='chip'; b.draggable=true; b.title=`Arrastra para etiquetar como ${it.name}`; const d=document.createElement('span'); d.className='dot'; d.style.background=it.color||'#64748b'; const t=document.createElement('span'); t.textContent=it.name; b.append(d,t); b.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/x-speaker', it.name); e.dataTransfer.effectAllowed='copyMove'; }); bar.appendChild(b); });
    buildTagOptions();
  }
  function wrapSelectionWithTag(name){
    const el=els.text; el.focus();
    const start=el.selectionStart??0, end=el.selectionEnd??0;
    const value=el.value, open=`[[${name}]]`, close=`[[/${name}]]`;
    if(end>start){ const before=value.slice(0,start), sel=value.slice(start,end), after=value.slice(end); el.value=before+open+' '+sel+' '+close+after; const pos=(before+open+' '+sel+' ').length; el.setSelectionRange(pos,pos); }
    else { const before=value.slice(0,start), after=value.slice(start); el.value=before+open+' '+close+after; const caret=(before+open+' ').length; el.setSelectionRange(caret,caret); }
    save(); updateCounts();
  }
  function getParagraphBounds(value, start, end){ const len=value.length; let s=Math.max(0,start|0), e=Math.max(s,end|0); const left=value.lastIndexOf('\n\n', s); const bStart0=left>=0?left+2:0; const right=value.indexOf('\n\n', e); const bEnd0=right>=0?right:len; let bStart=bStart0, bEnd=bEnd0; while(bStart<bEnd && /\s/.test(value[bStart])) bStart++; while(bEnd>bStart && /\s/.test(value[bEnd-1])) bEnd--; return {start:bStart,end:bEnd}; }
  function wrapParagraphWithTag(name){ const el=els.text; if(!el) return; el.focus(); const start=el.selectionStart??0; const end=el.selectionEnd??start; const {start:s,end:e}=getParagraphBounds(el.value,start,end); const inner=el.value.slice(s,e); if(!inner.trim()){ els.live.textContent='Párrafo vacío o solo espacios.'; return; } if(inner.includes('[[')&&inner.includes(']]')){ els.live.textContent='Ese párrafo ya tiene etiquetas. Usa "Asignar sel." o limpia antes.'; return; } const before=el.value.slice(0,s), after=el.value.slice(e); const open=`[[${name}]] `, close=` [[/${name}]]`; el.value=before+open+inner+close+after; const caret=(before+open).length; el.setSelectionRange(caret,caret); save(); updateCounts(); }

  function updateApplyEnabled(){ const el=els.text; const hasSel=(el.selectionEnd-el.selectionStart)>0; if(els.applyTagBtn) els.applyTagBtn.disabled=!hasSel; document.querySelectorAll('button[data-assign=\"1\"]').forEach(b=>{ b.disabled=!hasSel; }); }
  function bindEditorDnD(){ const el=els.text; ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev,e=>{ const spk=e.dataTransfer?.types?.includes('text/x-speaker'); if(spk){ e.preventDefault(); el.classList.add('drop-active'); }})); ['dragleave','drop','dragend'].forEach(ev=> el.addEventListener(ev,e=>{ el.classList.remove('drop-active'); })); el.addEventListener('drop', e=>{ const spk=e.dataTransfer?.getData('text/x-speaker'); if(!spk) return; e.preventDefault(); wrapSelectionWithTag(spk); }); el.addEventListener('mouseup', updateApplyEnabled); el.addEventListener('keyup', updateApplyEnabled); el.addEventListener('select', updateApplyEnabled); }

  load();
  mountThemeToggle();
  registerSW();
  document.addEventListener('visibilitychange', ()=>{});
  els.text.addEventListener('input', ()=>{ save(); updateCounts(); });

  ['dragenter','dragover'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.add('dragover'); }); });
  ['dragleave','drop'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.remove('dragover'); }); });
  els.drop.addEventListener('drop', e=>{ const f=e.dataTransfer?.files?.[0]; readFile(f); });
  els.file.addEventListener('change', e=>{ const f=e.target.files?.[0]; readFile(f); e.target.value=''; });

  els.play.addEventListener('click', start); els.pause.addEventListener('click', pause); els.resume.addEventListener('click', resume); els.stop.addEventListener('click', stop);
  els.preview.addEventListener('click', preview);
  els.exportBtn.addEventListener('click', exportTxt);
  els.resetBtn.addEventListener('click', ()=>{ els.text.value=''; save(); updateCounts(); });
  if(els.btnSelfCheck) els.btnSelfCheck.addEventListener('click', runSelfCheck); updateCounts();
  if(els.btnAddChar) els.btnAddChar.addEventListener('click', ()=> addCharacter(''));
  if(els.btnAutoDetect) els.btnAutoDetect.addEventListener('click', autoDetect);
  if(els.applyTagBtn) els.applyTagBtn.addEventListener('click', ()=>{ const name=els.applyTagSelect?.value || 'Narrador'; wrapSelectionWithTag(name); });
  if(els.applyTagSelect) els.applyTagSelect.addEventListener('change', ()=>{});

  [els.rate,els.pitch,els.volume].forEach(sl=> sl && sl.addEventListener('input', ()=>{ updateSliderLabels(); save(); estimate(); }));

  els.voice.addEventListener('change', ()=>{ save(); const v=getSelectedVoice(); els.langHint.textContent=v? (v.lang||'—'):'—'; });

  document.addEventListener('keydown', e=>{
    if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA')) return;
    if(e.code==='Space'){ e.preventDefault(); if(speechSynthesis.speaking && !speechSynthesis.paused) pause(); else resume(); }
    if(e.key==='s' || e.key==='S'){ stop(); }
    if(e.key==='r' || e.key==='R'){ resume(); }
  });

  function makeIcon(size):
      pass;

  function convertVozBlocksShim(){}

  function convertVozBlocksShim2(){}

  function speechShim(){}

  populateVoices();
  speechSynthesis.onvoiceschanged = ()=>{ populateVoices(); };
  setTimeout(runSelfCheck, 50);
})();