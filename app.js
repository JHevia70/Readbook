// Readbook / app.js v1.3.5 — Export audio + Colores + QuickCast + autodetector fix
(function(){
  const $ = s => document.querySelector(s);
  const els = {
    // texto
    text: $('#inputText'),
    visual: $('#editorVisual'),
    file: $('#fileInput'),
    drop: $('#dropZone'),
    wordCount: $('#wordCount'),
    estimates: $('#estimates'),
    // lector
    play: $('#btnPlay'),
    pause: $('#btnPause'),
    resume: $('#btnResume'),
    stop: $('#btnStop'),
    progress: $('#progress'),
    now: $('#nowReading'),
    live: $('#live'),
    // narrador (voz por defecto)
    voiceSel: $('#voiceSelect'),
    rate: $('#rate'), pitch: $('#pitch'), volume: $('#volume'),
    rateVal: $('#rateVal'), pitchVal: $('#pitchVal'), volumeVal: $('#volumeVal'),
    langHint: $('#langHint'),
    preview: $('#btnPreview'),
    // personajes
    castList: $('#castList'),
    castCount: $('#castCount'),
    btnAdd: $('#btnAddChar'),
    btnAuto: $('#btnAutoDetect'),
    // chips
    tagBar: $('#tagBar'),
    applyTagSelect: $('#applyTagSelect'),
    applyTagBtn: $('#applyTagBtn'),
    // export & view
    rec: $('#btnRec'),
    recFormat: $('#recFormat'),
    toggleView: $('#btnToggleView'),
    // quick cast
    quickCast: $('#quickCastList'),
    // misc
    exportBtn: $('#btnExport'),
    resetBtn: $('#btnReset'),
    selfCheck: $('#btnSelfCheck'),
    domStatus: $('#domStatus'),
  };

  const supportsTTS = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  // ===== STATE =====
  const state = {
    voices: [],
    cast: [],
    queue: [],
    idx: 0,
    speaking: false,
    paused: false,
    canceling: false,
    idc: 0,
    view: localStorage.getItem('view_mode') || 'text'
  };
  const COLORS = ['#7c5cff','#23c9a9','#ff6b6b','#ffce57','#22c55e','#60a5fa','#f472b6','#f59e0b','#10b981','#a78bfa'];
  const norm = (s='')=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const uid = ()=> 'id_'+Date.now()+'_'+(++state.idc);
  const save = ()=>{ try{ localStorage.setItem('tts_text', els.text?.value||''); localStorage.setItem('tts_cast', JSON.stringify(state.cast)); localStorage.setItem('view_mode', state.view); }catch{} };
  const load = ()=>{ try{ const t=localStorage.getItem('tts_text'); if(t && els.text) els.text.value=t; const c=localStorage.getItem('tts_cast'); if(c) state.cast=JSON.parse(c); }catch{} updateCounts(); };

  // ===== VOICES =====
  function populateVoices(){
    const list = speechSynthesis.getVoices() || [];
    state.voices = list.slice().sort((a,b)=>{
      const aEs=(a.lang||'').toLowerCase().startsWith('es'), bEs=(b.lang||'').toLowerCase().startsWith('es');
      if(aEs!==bEs) return aEs ? -1 : 1;
      const la=(a.lang||'').localeCompare(b.lang||''); if(la!==0) return la;
      return (a.name||'').localeCompare(b.name||'');
    });
    renderVoiceSelect();
    ensureNarrator();
    renderCast(); renderTagBar(); renderQuickCast();
    if(state.view==='color') renderVisual();
  }
  function pickDefaultVoice(){
    return state.voices.find(v => (v.lang||'').toLowerCase().startsWith('es')) || state.voices[0];
  }
  function renderVoiceSelect(){
    if(!els.voiceSel) return;
    els.voiceSel.innerHTML = '';
    state.voices.forEach(v=>{
      const o=document.createElement('option');
      o.value=v.voiceURI;
      o.textContent=`${v.name} — ${v.lang}${v.default?' (pred.)':''}`;
      els.voiceSel.appendChild(o);
    });
    const def = pickDefaultVoice();
    if(def) els.voiceSel.value = def.voiceURI;
    if(els.langHint) els.langHint.textContent = def?.lang || '–';
  }
  function narratorSettings(){
    const v = state.voices.find(v=>v.voiceURI===els.voiceSel?.value) || pickDefaultVoice();
    return {
      voice: v,
      rate: parseFloat(els.rate?.value||'1')||1,
      pitch: parseFloat(els.pitch?.value||'1')||1,
      volume: parseFloat(els.volume?.value||'1')||1,
    };
  }

  // ===== CAST =====
  function ensureNarrator(){
    const has = state.cast.some(c => norm(c.name)==='narrador');
    if(!has){
      const v = pickDefaultVoice();
      state.cast.unshift({
        id: uid(), name: 'Narrador',
        voiceURI: v?.voiceURI, rate: 1, pitch: 1, volume: 1,
        color: '#64748b', locked: true
      });
      save();
    }
  }
  function addCharacter(name=''){
    state.cast.push({
      id: uid(), name,
      voiceURI: pickDefaultVoice()?.voiceURI,
      rate: 1, pitch: 1, volume: 1,
      color: COLORS[state.cast.length % COLORS.length]
    });
    save(); renderCast(); renderTagBar(); renderQuickCast();
  }
  function renderCast(){
    if(!els.castList) return;
    els.castList.innerHTML = '';
    state.cast.forEach((c,i)=>{
      const row = document.createElement('div');
      row.className = 'cast-item' + (c.locked ? ' locked' : '');

      const name = document.createElement('div');
      name.className = 'cast-name';
      const dot = document.createElement('span');
      dot.className = 'dot'; dot.style.background = c.color || COLORS[i%COLORS.length];
      const input = document.createElement('input');
      input.value = c.name || ''; input.placeholder = 'Nombre del personaje'; input.style.width='100%';
      input.oninput = ()=>{ c.name = input.value; save(); renderTagBar(); renderQuickCast(); if(state.view==='color') renderVisual(); };
      name.append(dot, input);

      const voiceSel = document.createElement('select');
      state.voices.forEach(v=>{ const o=document.createElement('option'); o.value=v.voiceURI; o.textContent=`${v.name} — ${v.lang}${v.default?' (pred.)':''}`; voiceSel.appendChild(o); });
      if(!state.voices.some(v=>v.voiceURI===c.voiceURI)) c.voiceURI = pickDefaultVoice()?.voiceURI;
      voiceSel.value = c.voiceURI || '';
      voiceSel.onchange = ()=>{ c.voiceURI = voiceSel.value; save(); };

      const mini = document.createElement('div');
      mini.className='mini';
      mini.innerHTML = `
        <div><label>Vel <span>${(c.rate??1).toFixed(1)}</span></label><input class="rate" type="range" min="0.5" max="1.8" step="0.1" value="${c.rate??1}"></div>
        <div><label>Tono <span>${(c.pitch??1).toFixed(1)}</span></label><input class="pitch" type="range" min="0.5" max="2" step="0.1" value="${c.pitch??1}"></div>
        <div><label>Vol <span>${(c.volume??1).toFixed(2)}</span></label><input class="vol" type="range" min="0" max="1" step="0.05" value="${c.volume??1}"></div>
      `;
      const [r,p,v] = mini.querySelectorAll('input');
      const [rl,pl,vl] = mini.querySelectorAll('label span');
      r.oninput=()=>{ c.rate=parseFloat(r.value)||1; rl.textContent=c.rate.toFixed(1); save(); };
      p.oninput=()=>{ c.pitch=parseFloat(p.value)||1; pl.textContent=c.pitch.toFixed(1); save(); };
      v.oninput=()=>{ c.volume=parseFloat(v.value)||1; vl.textContent=c.volume.toFixed(2); save(); };

      const actions = document.createElement('div'); actions.className='cast-actions';
      const bSel = document.createElement('button'); bSel.textContent='🏷️ Asignar sel.'; bSel.className='ghost'; bSel.onclick=()=> wrapSelectionWithTag(c.name||'');
      const bPar = document.createElement('button'); bPar.textContent='🧩 Párr'; bPar.className='ghost'; bPar.onclick=()=> wrapParagraphWithTag(c.name||'');
      const bTest = document.createElement('button'); bTest.textContent='🔊 Prueba'; bTest.onclick=()=> previewCharacter(c);
      const bDel = document.createElement('button'); bDel.textContent='🗑️'; bDel.className='danger'; if(c.locked) bDel.style.display='none'; bDel.onclick=()=>{ state.cast=state.cast.filter(x=>x.id!==c.id); save(); renderCast(); renderTagBar(); renderQuickCast(); };
      actions.append(bSel,bPar,bTest,bDel);

      row.append(name, voiceSel, mini, actions);
      els.castList.appendChild(row);
    });
    if(els.castCount) els.castCount.textContent = `${state.cast.length} personaje${state.cast.length===1?'':'s'}`;
  }
  function renderQuickCast(){
    if(!els.quickCast) return;
    els.quickCast.innerHTML='';
    state.cast.forEach((c,i)=>{
      if(!c.name) return;
      const row=document.createElement('div');
      row.className='qc-row';
      row.innerHTML=`
        <div class="who">
          <span class="dot" style="background:${c.color||COLORS[i%COLORS.length]}"></span>
          <span class="name">${c.name}</span>
        </div>
        <div class="actions">
          <button class="ghost sel">🏷️ Sel.</button>
          <button class="ghost par">🧩 Párr</button>
          <button class="ghost test">🔊</button>
        </div>`;
      row.querySelector('.sel').onclick  = ()=> wrapSelectionWithTag(c.name);
      row.querySelector('.par').onclick  = ()=> wrapParagraphWithTag(c.name);
      row.querySelector('.test').onclick = ()=> previewCharacter(c);
      els.quickCast.appendChild(row);
    });
  }
  function previewCharacter(c){
    const s = currentSettingsForSpeaker(c.name||'');
    const u=new SpeechSynthesisUtterance(`${c.name||'Personaje'}: esta es una prueba.`);
    if(s?.voice) u.voice=s.voice; u.rate=s?.rate||1; u.pitch=s?.pitch||1; u.volume=s?.volume||1; u.lang=s?.voice?.lang || 'es-ES';
    speechSynthesis.speak(u);
  }

  // ===== CHIPS + DnD =====
  function buildTagOptions(){ const names=state.cast.map(c=>c.name).filter(Boolean); if(!els.applyTagSelect) return; els.applyTagSelect.innerHTML=''; names.forEach(nm=>{ const o=document.createElement('option'); o.value=nm; o.textContent=nm; els.applyTagSelect.appendChild(o); }); }
  function renderTagBar(){
    if(!els.tagBar) return;
    els.tagBar.innerHTML='';
    state.cast.forEach((c,i)=>{
      if(!c.name) return;
      const b=document.createElement('button'); b.className='chip'; b.draggable=true; b.title=`Arrastra: ${c.name}`;
      const d=document.createElement('span'); d.className='dot'; d.style.background=c.color||COLORS[i%COLORS.length];
      const t=document.createElement('span'); t.textContent=c.name;
      b.append(d,t);
      b.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/x-speaker', c.name); e.dataTransfer.effectAllowed='copyMove'; });
      els.tagBar.appendChild(b);
    });
    buildTagOptions();
  }
  function wrapSelectionWithTag(name){
    const el=els.text; if(!el) return;
    if(!name){ toast('Pon nombre al personaje.'); return; }
    el.focus();
    const start=el.selectionStart||0, end=el.selectionEnd||0;
    const open=`[[${name}]]`, close=`[[/${name}]]`;
    const v=el.value;
    if(end>start){
      el.value = v.slice(0,start) + open + ' ' + v.slice(start,end) + ' ' + close + v.slice(end);
      el.setSelectionRange((v.slice(0,start)+open+' ').length,(v.slice(0,start)+open+' ').length);
    }else{
      el.value = v.slice(0,start) + open + ' ' + close + v.slice(start);
      el.setSelectionRange((v.slice(0,start)+open+' ').length,(v.slice(0,start)+open+' ').length);
    }
    save(); updateCounts(); if(state.view==='color') renderVisual();
  }
  function getParagraphBounds(value,start,end){
    const len=value.length; let s=Math.max(0,start|0), e=Math.max(s,end|0);
    const left=value.lastIndexOf('\n\n', s); const bStart0=left>=0?left+2:0;
    const right=value.indexOf('\n\n', e); const bEnd0=right>=0?right:len;
    let bStart=bStart0, bEnd=bEnd0;
    while(bStart<bEnd && /\s/.test(value[bStart])) bStart++;
    while(bEnd>bStart && /\s/.test(value[bEnd-1])) bEnd--;
    return {start:bStart,end:bEnd};
  }
  function wrapParagraphWithTag(name){
    const el=els.text; if(!el) return;
    if(!name){ toast('Pon nombre al personaje.'); return; }
    const start=el.selectionStart||0, end=el.selectionEnd||start;
    const {start:s,end:e}=getParagraphBounds(el.value,start,end);
    const inside=el.value.slice(s,e);
    if(!inside.trim()){ toast('Párrafo vacío.'); return; }
    if(inside.includes('[[')&&inside.includes(']]')){ toast('Ese párrafo ya tiene etiquetas.'); return; }
    const open=`[[${name}]] `, close=` [[/${name}]]`;
    el.value = el.value.slice(0,s) + open + inside + close + el.value.slice(e);
    el.setSelectionRange((el.value.slice(0,s)+open).length,(el.value.slice(0,s)+open).length);
    save(); updateCounts(); if(state.view==='color') renderVisual();
  }

  function bindEditorDnD(){
    const el=els.text; if(!el) return;
    const upd=()=>{ const has=(el.selectionEnd-el.selectionStart)>0; if(els.applyTagBtn) els.applyTagBtn.disabled=!has; };
    ['mouseup','keyup','select'].forEach(ev=> el.addEventListener(ev, upd));
    ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev, e=>{ const ok=e.dataTransfer?.types?.includes('text/x-speaker'); if(ok){ e.preventDefault(); el.classList.add('drop-active'); }}));
    ['dragleave','dragend','drop'].forEach(ev=> el.addEventListener(ev, e=> el.classList.remove('drop-active')));
    el.addEventListener('drop', e=>{ const spk=e.dataTransfer?.getData('text/x-speaker'); if(!spk) return; e.preventDefault(); wrapSelectionWithTag(spk); });
  }

  // ===== PARSER + LECTOR =====
  const convertVozBlocks = str => str.replace(/\[voz=([^\]]+)\]([\s\S]*?)\[\/voz\]/gi,(_,n,inn)=>`[[${(n||'').trim()}]]${inn}[[/${(n||'').trim()}]]`);
  function chunkText(t,maxLen=180){
    const sentences=t.split(/(?<=[\.!?¿¡…\n])\s+/).map(s=>s.trim()).filter(Boolean);
    const out=[];
    for(const s of sentences){
      if(s.length<=maxLen){ out.push(s); continue; }
      const parts=s.split(/[,;:\u2014\u2013\-]\s+/);
      for(const p of parts){
        if(p.length<=maxLen){ out.push(p); continue; }
        let buf=''; p.split(/\s+/).forEach(w=>{ if((buf+' '+w).trim().length>maxLen){ out.push(buf.trim()); buf=w; } else { buf=(buf?buf+' ':'')+w; } });
        if(buf.trim()) out.push(buf.trim());
      }
    }
    return out.filter(Boolean);
  }
  function parseScript(t){
    t = convertVozBlocks((t||'').replace(/\r/g,''));
    const out=[]; const re=/\[\[([^\]]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g; let last=0, m;
    while((m=re.exec(t))){
      if(m.index>last){ const outside=t.slice(last,m.index).trim(); if(outside) out.push({speaker:null, text:outside}); }
      out.push({speaker:(m[1]||'').trim(), text:(m[2]||'').trim()});
      last=re.lastIndex;
    }
    if(last<t.length){ const tail=t.slice(last).trim(); if(tail) out.push({speaker:null, text:tail}); }
    const flat=[];
    for(const seg of out.length?out:[{speaker:null,text:t}]){
      if(seg.speaker){ flat.push(seg); continue; }
      const lines=seg.text.split(/\n+/);
      for(const line of lines){
        const mm=line.match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s*(.+)$/);
        if(mm) flat.push({speaker:mm[1].trim(), text:mm[2].trim()});
        else if(line.trim()) flat.push({speaker:null, text:line.trim()});
      }
    }
    const queue=[];
    for(const seg of flat){ const parts=chunkText(seg.text); for(const p of parts){ queue.push({text:p, speaker:seg.speaker||null}); } }
    return queue;
  }

  function start(){
    if(!supportsTTS){ toast('Tu navegador no soporta Web Speech API.'); return; }
    const raw=(els.text?.value||'').trim();
    if(!raw){ toast('No hay texto.'); return; }
    state.queue = parseScript(raw); state.idx=0; state.speaking=true; state.paused=false; state.canceling=false;
    if(els.progress) els.progress.value=0; if(els.now) els.now.textContent='Iniciando…';
    speakNext();
  }
  function speakNext(){
    if(state.idx>=state.queue.length){ finish(); return; }
    const item=state.queue[state.idx];
    const who=item.speaker || 'Narrador';
    if(els.now) els.now.textContent = `Leyendo (${who}): ${item.text.slice(0,100)}${item.text.length>100?'…':''}`;
    const u=new SpeechSynthesisUtterance(item.text);
    const s = item.speaker ? currentSettingsForSpeaker(item.speaker) : narratorSettings();
    if(s?.voice) u.voice=s.voice; u.lang=s?.voice?.lang || 'es-ES'; u.rate=s?.rate||1; u.pitch=s?.pitch||1; u.volume=s?.volume||1;
    u.onend=()=>{ if(state.canceling) return; state.idx++; if(els.progress) els.progress.value=Math.round((state.idx/state.queue.length)*100); requestAnimationFrame(speakNext); };
    u.onerror=(e)=>{ console.error('TTS error', e); toast('Error al sintetizar voz.'); finish(); };
    speechSynthesis.speak(u);
  }
  function currentSettingsForSpeaker(name){
    const c = state.cast.find(x=>norm(x.name)===norm(name));
    if(!c) return null;
    const v = state.voices.find(v=>v.voiceURI===c.voiceURI) || pickDefaultVoice();
    return { voice:v, rate:c.rate||1, pitch:c.pitch||1, volume:c.volume||1 };
  }
  function pause(){ if(speechSynthesis.speaking && !speechSynthesis.paused){ speechSynthesis.pause(); state.paused=true; toast('Pausado.'); } }
  function resume(){ if(speechSynthesis.paused){ speechSynthesis.resume(); state.paused=false; toast('Reanudando…'); } else if(!state.speaking){ start(); } }
  function stop(){ state.canceling=true; try{ speechSynthesis.cancel(); }catch{} finish(); }
  function finish(){ state.speaking=false; state.paused=false; state.idx=0; state.queue=[]; if(els.now) els.now.textContent='Listo.'; if(els.progress) els.progress.value=0; }

  // ===== VISUAL (Colores) =====
  const esc = (s)=> s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function colorFor(name, idx){ const c = state.cast.find(x => norm(x.name)===norm(name))?.color; return c || COLORS[idx % COLORS.length]; }
  function renderVisual(){
    if(!els.visual) return;
    const raw=(els.text?.value||''); if(!raw.trim()){ els.visual.innerHTML=''; return; }
    const t = convertVozBlocks(raw);
    const out=[]; const re=/\[\[([^\]]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g; let last=0, m, idx=0;
    while((m=re.exec(t))){ if(m.index>last){ const outside=t.slice(last,m.index); if(outside) out.push({speaker:null, text:outside}); } out.push({speaker:(m[1]||'').trim(), text:(m[2]||'')}); last=re.lastIndex; }
    if(last<t.length) out.push({speaker:null, text:t.slice(last)});
    const parts=[];
    for(const seg of out.length?out:[{speaker:null,text:t}]){
      if(seg.speaker){ parts.push(seg); continue; }
      const lines=seg.text.split(/(\n+)/);
      for(const line of lines){
        if(!line) continue; if(line.match(/^\n+$/)){ parts.push({speaker:null, text:line}); continue; }
        const mm=line.match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s*(.+)$/);
        if(mm) parts.push({speaker:mm[1].trim(), text:mm[2]}); else parts.push({speaker:null, text:line});
      }
    }
    let html=''; let ci=0;
    for(const p of parts){
      if(p.speaker){ const col=colorFor(p.speaker, ci++); html += `<span class="seg" style="background:${col}20;border:1px solid ${col}55">${esc(p.text)}</span>`; }
      else html += esc(p.text);
    }
    els.visual.innerHTML=html;
  }
  function setView(mode){
    state.view=mode;
    if(mode==='color'){ els.text.hidden=true; els.visual.hidden=false; renderVisual(); els.toggleView.textContent='🏷️ Etiquetas'; }
    else { els.visual.hidden=true; els.text.hidden=false; els.toggleView.textContent='🎨 Colores'; }
    save();
  }

  // ===== EXPORT AUDIO =====
  const rec = { recording:false, mr:null, stream:null, chunks:[] };
  function guessMime(){ const prefs=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg']; for(const m of prefs){ if(MediaRecorder.isTypeSupported(m)) return m; } return ''; }
  async function startExport(){
    if(rec.recording) return;
    try{
      rec.stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
      const mimeType = guessMime();
      rec.mr = new MediaRecorder(rec.stream, mimeType? {mimeType}: {});
      rec.chunks = []; rec.recording = true;
      rec.mr.ondataavailable = e => { if(e.data && e.data.size) rec.chunks.push(e.data); };
      rec.mr.onstop = async () => { await processExport(); cleanupStream(); };
      rec.mr.start(200);
      els.rec.textContent='⏹️ Detener';
      els.live && (els.live.textContent='Grabando… Selecciona ESTA pestaña + Compartir audio.');
    }catch(e){
      console.error(e); els.live && (els.live.textContent='No se pudo iniciar la exportación (permiso/navegador).');
    }
  }
  function stopExport(){ if(!rec.recording) return; try{ rec.mr?.stop(); }catch{} rec.recording=false; els.rec.textContent='⏺️ Exportar audio'; }
  async function processExport(){
    const blob = new Blob(rec.chunks, {type: rec.mr?.mimeType || 'audio/webm'});
    const fmt = els.recFormat?.value || 'wav';
    if(fmt==='webm'){ downloadBlob(blob, 'readbook.webm'); els.live&&(els.live.textContent='Exportado WEBM/Opus.'); return; }
    try{
      const arrayBuf = await blob.arrayBuffer();
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuf = await ac.decodeAudioData(arrayBuf.slice(0));
      if(fmt==='wav'){ const wav=encodeWAV(audioBuf); downloadBlob(wav, 'readbook.wav'); els.live&&(els.live.textContent='Exportado WAV.'); return; }
      if(fmt==='mp3'){
        try{ await loadLame(); const mp3=encodeMP3(audioBuf); downloadBlob(mp3, 'readbook.mp3'); els.live&&(els.live.textContent='Exportado MP3 (beta).'); return; }
        catch(e){ console.warn('MP3 falló', e); const wav=encodeWAV(audioBuf); downloadBlob(wav, 'readbook.wav'); els.live&&(els.live.textContent='MP3 no disponible, exportado WAV.'); }
      }
    }catch(e){
      console.error('decode/export failed', e); downloadBlob(blob, 'readbook.webm'); els.live&&(els.live.textContent='No pude convertir; exporté WEBM/Opus.');
    }
  }
  function cleanupStream(){ rec.stream?.getTracks().forEach(t=>t.stop()); rec.stream=null; rec.mr=null; els.rec.textContent='⏺️ Exportar audio'; }
  function downloadBlob(blob, name){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000); }
  function loadLame(){ if(window.lamejs) return Promise.resolve(); return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src='https://unpkg.com/lamejs@1.2.0/lame.min.js'; s.onload=()=>res(); s.onerror=()=>rej(new Error('No lamejs')); document.head.appendChild(s); }); }
  function encodeWAV(audioBuffer){
    const numChannels = audioBuffer.numberOfChannels; const sampleRate = audioBuffer.sampleRate;
    const pcm = interleave(audioBuffer); const bps=2; const blockAlign = numChannels*bps;
    const buf = new ArrayBuffer(44 + pcm.length*bps); const view=new DataView(buf);
    writeStr(view,0,'RIFF'); view.setUint32(4,36+pcm.length*bps,true); writeStr(view,8,'WAVE'); writeStr(view,12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numChannels,true); view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate*blockAlign,true); view.setUint16(32,blockAlign,true); view.setUint16(34,bps*8,true); writeStr(view,36,'data');
    view.setUint32(40, pcm.length*bps, true); floatTo16(view, 44, pcm); return new Blob([view], {type:'audio/wav'});
  }
  function encodeMP3(audioBuffer){
    const numChannels = Math.min(2, audioBuffer.numberOfChannels);
    const sampleRate = audioBuffer.sampleRate;
    const left = audioBuffer.getChannelData(0);
    const right = numChannels>1 ? audioBuffer.getChannelData(1) : null;
    const enc = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
    const frame = 1152; const data=[];
    for(let i=0;i<left.length;i+=frame){
      const l = floatToI16(left.subarray(i, i+frame));
      const r = right? floatToI16(right.subarray(i, i+frame)) : null;
      const out = enc.encodeBuffer(l, r);
      if(out.length) data.push(new Int8Array(out));
    }
    const end = enc.flush(); if(end.length) data.push(new Int8Array(end));
    return new Blob(data, {type:'audio/mpeg'});
  }
  function interleave(audioBuffer){
    const n = Math.min(2, audioBuffer.numberOfChannels), len=audioBuffer.length;
    if(n===1) return audioBuffer.getChannelData(0).slice(0);
    const L=audioBuffer.getChannelData(0), R=audioBuffer.getChannelData(1);
    const out=new Float32Array(len*2); let j=0; for(let i=0;i<len;i++){ out[j++]=L[i]; out[j++]=R[i]; } return out;
  }
  function floatTo16(view, offset, input){
    for(let i=0;i<input.length;i++, offset+=2){ let s=Math.max(-1, Math.min(1, input[i])); view.setInt16(offset, s<0 ? s*0x8000 : s*0x7FFF, true); }
  }
  function floatToI16(f32){
    const out=new Int16Array(f32.length);
    for(let i=0;i<f32.length;i++){ let s=Math.max(-1, Math.min(1, f32[i])); out[i]= s<0 ? s*0x8000 : s*0x7FFF; }
    return out;
  }
  function writeStr(view, offset, str){ for(let i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); }

  // ===== AUTODETECT =====
  function autodetectNames(t){
    const names=new Set();
    const re1=/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:/gm; // linea
    let m; while((m=re1.exec(t))) names.add(m[1].trim());
    const re2=/\[\[(?!\/)([^\]]+)\]\]/g; // solo etiquetas de apertura [[NOMBRE]]
    while((m=re2.exec(t))){ const nm=(m[1]||'').trim().replace(/^\//,''); if(nm) names.add(nm); }
    return Array.from(names).filter(n=>n && n.length<=30);
  }

  // ===== INIT / HOOKS =====
  function updateCounts(){
    const words=(els.text?.value.trim().match(/\S+/g)||[]).length;
    if(els.wordCount) els.wordCount.textContent = `${words.toLocaleString()} palabra${words===1?'':'s'}`;
    const wpm = 160 * (parseFloat(els.rate?.value||'1')||1);
    const mins=words/Math.max(1,wpm);
    if(els.estimates) els.estimates.textContent = words? `≈ ${formatTime(mins)} • ${words.toLocaleString()} palabras` : '–';
  }
  function formatTime(mins){ if(!isFinite(mins)) return '–'; const total=Math.max(0,Math.round(mins*60)); const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60; return h>0?`${h}h ${m}m`:(m>0?`${m}m ${s}s`:`${s}s`); }
  function toast(msg){ if(els.live){ els.live.textContent = msg; setTimeout(()=>{ if(els.live.textContent===msg) els.live.textContent=''; }, 3000); } }

  function readFile(file){ if(!file) return; const reader=new FileReader(); reader.onload=()=>{ if(els.text){ els.text.value=String(reader.result||''); save(); updateCounts(); if(state.view==='color') renderVisual(); } }; reader.readAsText(file); }

  function bindBasics(){
    if(els.text) els.text.addEventListener('input', ()=>{ save(); updateCounts(); if(state.view==='color') renderVisual(); });
    if(els.file) els.file.addEventListener('change', e=>{ const f=e.target.files?.[0]; readFile(f); e.target.value=''; });
    if(els.drop){
      ['dragenter','dragover'].forEach(ev=> els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.add('dragover'); }));
      ['dragleave','drop'].forEach(ev=> els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.remove('dragover'); }));
      els.drop.addEventListener('drop', e=>{ const f=e.dataTransfer?.files?.[0]; readFile(f); });
    }
    if(els.btnAdd) els.btnAdd.addEventListener('click', ()=> addCharacter(''));
    if(els.btnAuto) els.btnAuto.addEventListener('click', ()=>{
      const names=autodetectNames(els.text?.value||''); let added=0;
      names.forEach(n=>{ if(!state.cast.some(c=>norm(c.name)===norm(n))){ addCharacter(n); added++; } });
      toast(added? `Añadidos ${added} personaje(s).` : 'Nada nuevo que añadir.');
    });
    if(els.applyTagBtn) els.applyTagBtn.addEventListener('click', ()=>{ const nm=els.applyTagSelect?.value; wrapSelectionWithTag(nm); });
    bindEditorDnD();

    // lector
    if(els.play) els.play.addEventListener('click', start);
    if(els.pause) els.pause.addEventListener('click', pause);
    if(els.resume) els.resume.addEventListener('click', resume);
    if(els.stop) els.stop.addEventListener('click', stop);
    document.addEventListener('keydown', e=>{ if(e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return; if(e.code==='Space'){ e.preventDefault(); if(speechSynthesis.speaking && !speechSynthesis.paused) pause(); else resume(); } if(e.key==='s'||e.key==='S'){ stop(); } if(e.key==='r'||e.key==='R'){ resume(); } });

    // narrador sliders -> numeritos
    const upd=()=>{ if(els.rateVal) els.rateVal.textContent=(+els.rate.value).toFixed(1); if(els.pitchVal) els.pitchVal.textContent=(+els.pitch.value).toFixed(1); if(els.volumeVal) els.volumeVal.textContent=(+els.volume.value).toFixed(2); updateCounts(); };
    ['input','change'].forEach(ev=>{ els.rate?.addEventListener(ev,upd); els.pitch?.addEventListener(ev,upd); els.volume?.addEventListener(ev,upd); });
    els.preview?.addEventListener('click', ()=>{ const s=narratorSettings(); const u=new SpeechSynthesisUtterance('Prueba de narrador.'); if(s.voice) u.voice=s.voice; u.lang=s.voice?.lang||'es-ES'; u.rate=s.rate; u.pitch=s.pitch; u.volume=s.volume; speechSynthesis.speak(u); });

    // export audio + toggle view
    els.rec?.addEventListener('click', ()=>{ (rec.recording? stopExport() : startExport()); });
    els.toggleView?.addEventListener('click', ()=> setView(state.view==='text' ? 'color' : 'text'));

    // export .txt simple
    els.exportBtn?.addEventListener('click', ()=>{ const blob=new Blob([els.text?.value||''],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='texto_para_leer.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); });

    // self check
    els.selfCheck?.addEventListener('click', ()=>{
      const issues=[];
      if(!els.rec) issues.push('Falta #btnRec');
      if(!els.toggleView) issues.push('Falta #btnToggleView');
      if(!els.quickCast) issues.push('Falta #quickCastList');
      if(!els.visual) issues.push('Falta #editorVisual');
      els.domStatus && (els.domStatus.textContent = issues.length? `Autotest: ${issues.length}` : 'Autotest: OK ✅');
      toast(issues.length? `Autotest: ${issues.join(' • ')}` : 'Autotest: OK ✅');
    });
  }

  function init(){
    load();
    if(supportsTTS){
      populateVoices();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.onvoiceschanged = populateVoices;
    } else {
      toast('Tu navegador no soporta Web Speech API.');
    }
    bindBasics();
    ensureNarrator();
    renderCast(); renderTagBar(); renderQuickCast();
    if(state.view==='color') setView('color'); else setView('text');
    updateCounts();
  }

  document.addEventListener('DOMContentLoaded', init);
})();