(function(){
  const $ = sel => document.querySelector(sel);

  function registerSW(){ if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); } }

  const els = {
    text: $('#inputText'),
    file: $('#fileInput'), drop: $('#dropZone'),
    play: $('#btnPlay'), pause: $('#btnPause'), resume: $('#btnResume'), stop: $('#btnStop'),
    wordCount: $('#wordCount'),
    progress: $('#progress'), now: $('#nowReading'), estimates: $('#estimates'),
    exportBtn: $('#btnExport'), resetBtn: $('#btnReset'), live: $('#live'),
    supportNote: $('#supportNote'),
    castList: $('#castList'), castCount: $('#castCount'),
    btnAddChar: $('#btnAddChar'), btnAutoDetect: $('#btnAutoDetect'),
    tagBar: $('#tagBar'), applyTagSelect: $('#applyTagSelect'), applyTagBtn: $('#applyTagBtn'),
    btnSelfCheck: $('#btnSelfCheck'), domStatus: $('#domStatus'),
    quickCast: $('#quickCastList')
  };

  const supports = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if(!supports){
    els.supportNote && (els.supportNote.innerHTML = 'Tu navegador no soporta Web Speech API. Prueba con Chrome/Edge/Brave en escritorio.');
    ['play','pause','resume','stop'].forEach(k=>{ const b = els[k]; if(b) b.disabled = true; });
    registerSW(); return;
  }

  const state = { voices: [], queue:[], idx:0, speaking:false, paused:false, canceling:false, wpmBase:160, cast:[], idc:0 };
  const COLORS = ['#7c5cff','#23c9a9','#ff6b6b','#ffce57','#22c55e','#60a5fa','#f472b6','#f59e0b','#10b981','#a78bfa'];

  // storage
  function save(){ try{ localStorage.setItem('tts_text', els.text?.value||''); localStorage.setItem('tts_cast', JSON.stringify(state.cast)); }catch{} }
  function load(){ try{ const t=localStorage.getItem('tts_text'); if(t&&els.text) els.text.value=t; const cast = localStorage.getItem('tts_cast'); if(cast) state.cast=JSON.parse(cast); }catch{} updateCounts(); }

  const norm = (s='')=> s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const uniqueId = ()=> (crypto?.randomUUID?.() || ('id_'+Date.now()+'_'+(++state.idc)));
  function formatTime(mins){ if(!isFinite(mins)) return '–'; const total=Math.max(0,Math.round(mins*60)); const h=Math.floor(total/3600), m=Math.floor((total%3600)/60), s=total%60; return h>0?`${h}h ${m}m`:(m>0?`${m}m ${s}s`:`${s}s`); }

  function narrator(){ return state.cast.find(c => norm(c.name) === 'narrador'); }
  function narratorSettings(){
    const n = narrator();
    if(!n) return {voice: state.voices[0], rate:1, pitch:1, volume:1};
    const v = state.voices.find(v=>v.voiceURI===n.voiceURI) || state.voices[0];
    return {voice:v, rate:n.rate||1, pitch:n.pitch||1, volume:n.volume||1};
  }
  function estimate(){
    const words=(els.text?.value.trim().match(/\S+/g)||[]).length;
    const wpm = state.wpmBase * (narratorSettings().rate || 1);
    const mins=words/Math.max(1,wpm);
    els.estimates && (els.estimates.textContent = words?`≈ ${formatTime(mins)} • ${words.toLocaleString()} palabras`:'–');
  }
  function updateCounts(){ const words=(els.text?.value.trim().match(/\S+/g)||[]).length; els.wordCount && (els.wordCount.textContent=`${words.toLocaleString()} palabra${words===1?'':'s'}`); estimate(); }
  function normalizeText(t){ return t.replace(/[\r\t]/g,' ').replace(/\u00A0/g,' ').replace(/\s{2,}/g,' ').replace(/\n{2,}/g,'\n\n').trim(); }

  function chunkText(t,maxLen=180){ const sentences=t.split(/(?<=[\.!?¿¡…\n])\s+/).map(s=>s.trim()).filter(Boolean); const out=[]; for(const s of sentences){ if(s.length<=maxLen){ out.push(s); continue; } const parts=s.split(/[,;:\u2014\u2013\-]\s+/); for(const p of parts){ if(p.length<=maxLen){ out.push(p); continue; } let buf=''; p.split(/\s+/).forEach(w=>{ if((buf+' '+w).trim().length>maxLen){ out.push(buf.trim()); buf=w; } else { buf=(buf?buf+' ':'')+w; } }); if(buf.trim()) out.push(buf.trim()); } } return out.filter(Boolean); }

  // voices
  function populateVoices(){
    const all = speechSynthesis.getVoices();
    const esFirst=v=>(v.lang||'').toLowerCase().startsWith('es')?0:1;
    state.voices = all.slice().sort((a,b)=>{ const ea=esFirst(a)-esFirst(b); if(ea!==0) return ea; const la=(a.lang||'').localeCompare(b.lang||''); if(la!==0) return la; return (a.name||'').localeCompare(b.name||''); });

    ensureNarrator();
    renderCast(); renderTagBar(); bindEditorDnD(); renderQuickCast();
  }

  function pickDefaultVoice(){ return state.voices.find(v=>(v.lang||'').toLowerCase().startsWith('es')) || state.voices[0]; }
  function ensureNarrator(){
    if(!state.cast.some(c => norm(c.name)==='narrador')){
      const v = pickDefaultVoice();
      state.cast.unshift({ id: uniqueId(), name:'Narrador', voiceURI: v?.voiceURI, rate:1, pitch:1, volume:1, color:'#64748b', locked:true });
      save();
    }
  }

  // cast detailed
  function renderCast(){
    if(!els.castList) return;
    els.castList.innerHTML='';
    state.cast.forEach((c,i)=>{
      const wrap=document.createElement('div'); wrap.className='cast-item'+(c.locked?' locked':'');
      const name=document.createElement('div'); name.className='cast-name';
      const dot=document.createElement('span'); dot.className='dot'; dot.style.background=c.color || COLORS[i%COLORS.length];
      const input=document.createElement('input'); input.value=c.name||''; input.placeholder='Nombre del personaje'; input.style.width='100%'; input.className='input'; input.oninput=()=>{ c.name=input.value; save(); renderQuickCast(); renderTagBar(); };
      name.appendChild(dot); name.appendChild(input);

      const voiceSel=document.createElement('select');
      state.voices.forEach(v=>{ const opt=document.createElement('option'); opt.value=v.voiceURI; opt.textContent=`${v.name} — ${v.lang}${v.default?' (predeterminada)':''}`; voiceSel.appendChild(opt); });
      const have=state.voices.some(v=>v.voiceURI===c.voiceURI);
      if(!have){ const dv=pickDefaultVoice(); c.voiceURI=dv?.voiceURI; }
      voiceSel.value=c.voiceURI || pickDefaultVoice()?.voiceURI || '';
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
      const btnApply=document.createElement('button'); btnApply.textContent='🏷️ Asignar sel.'; btnApply.className='ghost'; btnApply.dataset.assign='1'; btnApply.disabled=true;
      btnApply.onclick=()=>{ const hasSel=(els.text.selectionEnd-els.text.selectionStart)>0; if(!c.name){ els.live&&(els.live.textContent='Pon nombre al personaje antes de asignar.'); return; } if(!hasSel){ els.live&&(els.live.textContent='Selecciona un trozo de texto en el editor.'); return; } wrapSelectionWithTag(c.name); };
      const btnPara=document.createElement('button'); btnPara.textContent='🧩 Párr'; btnPara.className='ghost'; btnPara.onclick=()=>{ if(!c.name){ els.live&&(els.live.textContent='Pon nombre al personaje antes de asignar.'); return; } wrapParagraphWithTag(c.name); };
      const btnTest=document.createElement('button'); btnTest.textContent='🔊 Prueba'; btnTest.onclick=()=> previewCharacter(c);
      const btnDel=document.createElement('button'); btnDel.textContent='🗑️'; btnDel.className='danger'; btnDel.onclick=()=>{ if(c.locked){ els.live&&(els.live.textContent='Narrador no se puede eliminar.'); return; } state.cast=state.cast.filter(x=>x.id!==c.id); els.live&&(els.live.textContent=`Eliminado ${c.name||'personaje'}.`); save(); renderCast(); renderQuickCast(); renderTagBar(); };
      actions.append(btnApply, btnPara, btnTest, btnDel);

      const frag=document.createDocumentFragment();
      frag.appendChild(name); frag.appendChild(voiceSel); frag.appendChild(mini); frag.appendChild(actions);
      wrap.appendChild(frag);
      els.castList.appendChild(wrap);
    });
    els.castCount && (els.castCount.textContent = `${state.cast.length} personaje${state.cast.length===1?'':'s'}`);
  }

  // quick-cast
  function renderQuickCast(){
    if(!els.quickCast) return;
    els.quickCast.innerHTML = '';
    if(!state.cast.length){
      const h = document.createElement('div'); h.className='hint'; h.textContent='Añade personajes abajo para habilitar la asignación rápida.'; els.quickCast.appendChild(h); return;
    }
    state.cast.forEach((c,i)=>{
      const row = document.createElement('div'); row.className='qc-row';
      const who = document.createElement('div'); who.className='who';
      const dot = document.createElement('span'); dot.className='dot'; dot.style.background=c.color || COLORS[i%COLORS.length];
      const nm = document.createElement('span'); nm.className='name'; nm.textContent= c.name || `P${i+1}`;
      who.append(dot, nm);
      const actions = document.createElement('div'); actions.className='actions';
      const bSel = document.createElement('button'); bSel.textContent='🏷️ Sel.'; bSel.title='Asignar a selección'; bSel.disabled = !c.name;
      bSel.onclick = ()=>{ if(!c.name){ els.live&&(els.live.textContent='Pon nombre al personaje en el panel inferior.'); return; } const hasSel=(els.text.selectionEnd-els.text.selectionStart)>0; if(!hasSel){ els.live&&(els.live.textContent='Selecciona texto en el editor.'); return; } wrapSelectionWithTag(c.name); };
      const bPar = document.createElement('button'); bPar.textContent='🧩 Párr'; bPar.title='Asignar a párrafo'; bPar.disabled = !c.name; bPar.onclick = ()=>{ if(!c.name){ els.live&&(els.live.textContent='Pon nombre al personaje en el panel inferior.'); return; } wrapParagraphWithTag(c.name); };
      const bTest = document.createElement('button'); bTest.textContent='🔊'; bTest.title='Prueba voz'; bTest.onclick = ()=> previewCharacter(c);
      actions.append(bSel,bPar,bTest);
      row.append(who, actions);
      els.quickCast.appendChild(row);
    });
    updateApplyEnabled();
  }

  // helpers
  function addCharacter(name=''){ state.cast.push({id:uniqueId(), name, voiceURI: pickDefaultVoice()?.voiceURI, rate:1, pitch:1, volume:1, color: COLORS[state.cast.length%COLORS.length]}); save(); renderCast(); renderQuickCast(); renderTagBar(); }
  function previewCharacter(c){ const v=state.voices.find(v=>v.voiceURI===c.voiceURI)||pickDefaultVoice(); const sample=(v?.lang||'').toLowerCase().startsWith('es')?`${c.name||'Personaje'}: esta es una prueba.`:`${c.name||'Character'}: this is a test.`; const u=new SpeechSynthesisUtterance(sample); if(v) u.voice=v; u.lang=v?.lang; u.rate=c.rate||1; u.pitch=c.pitch||1; u.volume=c.volume||1; speechSynthesis.speak(u); }
  function currentSettingsForSpeaker(name){ if(!name) return null; const n=norm(name); const c=state.cast.find(x=>norm(x.name)===n); if(!c) return null; const v=state.voices.find(v=>v.voiceURI===c.voiceURI)||pickDefaultVoice(); return {voice:v, rate:c.rate||1, pitch:c.pitch||1, volume:c.volume||1}; }

  function convertVozBlocks(str){ return str.replace(/\[voz=([^\]]+)\]([\s\S]*?)\[\/voz\]/gi,(_,name,inner)=>`[[${(name||'').trim()}]]${inner}[[/${(name||'').trim()}]]`); }
  function parseScript(t){
    t = convertVozBlocks(t).replace(/\r/g,'');
    const out=[]; const re=/\[\[([^\]]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g; let last=0, m;
    while((m=re.exec(t))){ if(m.index>last){ const outside=t.slice(last,m.index).trim(); if(outside) out.push({speaker:null, text:outside}); } out.push({speaker:(m[1]||'').trim(), text:(m[2]||'').trim()}); last=re.lastIndex; }
    if(last<t.length){ const tail=t.slice(last).trim(); if(tail) out.push({speaker:null, text:tail}); }
    const flat=[];
    for(const seg of out.length?out:[{speaker:null,text:t}]){
      if(seg.speaker){ flat.push(seg); continue; }
      const lines=seg.text.split(/\n+/);
      for(const line of lines){ const mm=line.match(/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s*(.+)$/); if(mm){ flat.push({speaker:mm[1].trim(), text:mm[2].trim()}); } else if(line.trim()){ flat.push({speaker:null, text:line.trim()}); } }
    }
    const queue=[]; for(const seg of flat){ const parts=chunkText(seg.text); for(const p of parts){ queue.push({text:p, speaker:seg.speaker||null}); } } return queue;
  }

  function ensureCastForUsedSpeakers(usedNames){
    const have=new Set(state.cast.map(c=>norm(c.name)));
    usedNames.forEach(nm=>{ if(have.has(norm(nm))) return; const nc={ id:uniqueId(), name:nm, voiceURI:pickDefaultVoice()?.voiceURI, rate:1, pitch:1, volume:1, color: COLORS[state.cast.length%COLORS.length]}; state.cast.push(nc); });
    save(); renderCast(); renderQuickCast(); renderTagBar();
  }

  // player
  function start(){
    const textRaw=normalizeText(els.text.value); if(!textRaw){ els.live&&(els.live.textContent='No hay texto para leer.'); return; }
    state.queue=parseScript(textRaw); state.idx=0; state.speaking=true; state.paused=false; state.canceling=false;
    els.progress&&(els.progress.value=0); els.now&&(els.now.textContent='Iniciando…'); disableEditing(true);
    const usedNames=Array.from(new Set(state.queue.map(q=>q.speaker).filter(Boolean))); ensureCastForUsedSpeakers(usedNames);
    speakNext();
  }
  function speakNext(){
    if(state.idx>=state.queue.length){ finish(); return; }
    const item=state.queue[state.idx]; const who=item.speaker || 'Narrador'; els.now&&(els.now.textContent=`Leyendo (${who}): ${item.text.slice(0,100)}${item.text.length>100?'…':''}`);
    const u=new SpeechSynthesisUtterance(item.text);
    const settings = item.speaker ? currentSettingsForSpeaker(item.speaker) : narratorSettings();
    const v = settings?.voice || narratorSettings().voice;
    if(v) u.voice=v;
    u.lang=v?.lang || 'es-ES';
    u.rate=settings?.rate ?? 1; u.pitch=settings?.pitch ?? 1; u.volume=settings?.volume ?? 1;
    u.onend=()=>{ if(state.canceling) return; state.idx++; els.progress&&(els.progress.value=Math.round((state.idx/state.queue.length)*100)); requestAnimationFrame(speakNext); };
    u.onerror=(e)=>{ console.error('TTS error', e); els.live&&(els.live.textContent='Error al sintetizar voz.'); finish(); };
    speechSynthesis.speak(u);
  }
  function pause(){ if(speechSynthesis.speaking && !speechSynthesis.paused){ speechSynthesis.pause(); state.paused=true; els.live&&(els.live.textContent='Pausado.'); } }
  function resume(){ if(speechSynthesis.paused){ speechSynthesis.resume(); state.paused=false; els.live&&(els.live.textContent='Reanudando…'); } else if(!state.speaking){ start(); } }
  function stop(){ state.canceling=true; speechSynthesis.cancel(); finish(); }
  function finish(){ state.speaking=false; state.paused=false; state.idx=0; state.queue=[]; els.now&&(els.now.textContent='Listo.'); els.progress&&(els.progress.value=0); disableEditing(false); }
  function disableEditing(dis){ if(els.text) els.text.readOnly=dis; [els.file,els.drop,els.btnAddChar,els.btnAutoDetect].forEach(el=>{ if(el) el && (el.disabled = dis); }); }

  function autoDetect(){
    const t=els.text?.value || ''; const names=new Set();
    const reB=/\[\[([^\]]+)\]\][\s\S]*?\[\[\/\1\]\]/g; let mb; while((mb=reB.exec(t))){ const nm=(mb[1]||'').trim(); if(norm(nm)!=='narrador') names.add(nm); }
    const reV=/\[voz=([^\]]+)\][\s\S]*?\[\/voz\]/gi; let mv; while((mv=reV.exec(t))){ const nm=(mv[1]||'').trim(); if(norm(nm)!=='narrador') names.add(nm); }
    const reL=/^\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9'\.\- ]{1,40})\s*:\s+.+$/gm; let ml; while((ml=reL.exec(t))){ const nm=(ml[1]||'').trim(); if(norm(nm)!=='narrador') names.add(nm); }
    const existing=new Set(state.cast.map(c=>norm(c.name))); let added=0; names.forEach(nm=>{ if(!existing.has(norm(nm))){ addCharacter(nm); added++; } });
    els.live && (els.live.textContent = added===0 ? 'No se encontraron nombres nuevos.' : `Añadidos ${added} personaje(s).`);
  }

  // tagging + DnD
  function buildTagOptions(){ const names=['Narrador', ...state.cast.filter(c=>norm(c.name)!=='narrador').map(c=>c.name).filter(Boolean)]; const sel=els.applyTagSelect; if(!sel) return; sel.innerHTML=''; names.forEach(nm=>{ const o=document.createElement('option'); o.value=nm; o.textContent=nm; sel.appendChild(o); }); }
  function renderTagBar(){ const bar=els.tagBar; if(!bar) return; bar.innerHTML=''; const items=[...state.cast.map((c,i)=>({name:c.name||`P${i+1}`, color:c.color||COLORS[i%COLORS.length]}))]; items.forEach(it=>{ const b=document.createElement('button'); b.className='chip'; b.draggable=true; b.title=`Arrastra para etiquetar como ${it.name}`; const d=document.createElement('span'); d.className='dot'; d.style.background=it.color; const t=document.createElement('span'); t.textContent=it.name; b.append(d,t); b.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/x-speaker', it.name); e.dataTransfer.effectAllowed='copyMove'; }); bar.appendChild(b); }); buildTagOptions(); }
  function wrapSelectionWithTag(name){ const el=els.text; if(!el) return; el.focus(); const start=el.selectionStart??0; const end=el.selectionEnd??0; const value=el.value; const tagOpen=`[[${name}]]`; const tagClose=`[[/${name}]]`; if(end>start){ const before=value.slice(0,start); const sel=value.slice(start,end); const after=value.slice(end); el.value=before+tagOpen+' '+sel+' '+tagClose+after; const newPos=(before+tagOpen+' '+sel+' ').length; el.setSelectionRange(newPos,newPos); } else { const before=value.slice(0,start); const after=value.slice(start); el.value=before+tagOpen+' '+tagClose+after; const caret=(before+tagOpen+' ').length; el.setSelectionRange(caret,caret); } save(); updateCounts(); }
  function getParagraphBounds(value,start,end){ const len=value.length; let s=Math.max(0,start|0); let e=Math.max(s,end|0); const left=value.lastIndexOf('\\n\\n', s); const bStart0=left>=0?left+2:0; const right=value.indexOf('\\n\\n', e); const bEnd0=right>=0?right:len; let bStart=bStart0, bEnd=bEnd0; while(bStart<bEnd && /\\s/.test(value[bStart])) bStart++; while(bEnd>bStart && /\\s/.test(value[bEnd-1])) bEnd--; return {start:bStart, end:bEnd}; }
  function wrapParagraphWithTag(name){ const el=els.text; if(!el) return; el.focus(); const start=el.selectionStart??0; const end=el.selectionEnd??start; const {start:s,end:e}=getParagraphBounds(el.value,start,end); const inner=el.value.slice(s,e); if(!inner.trim()){ els.live&&(els.live.textContent='Párrafo vacío o solo espacios.'); return; } if(inner.includes('[[')&&inner.includes(']]')){ els.live&&(els.live.textContent='Ese párrafo ya tiene etiquetas. Usa "Asignar sel." o limpia antes.'); return; } const before=el.value.slice(0,s); const after=el.value.slice(e); const open=`[[${name}]] `, close=` [[/${name}]]`; el.value=before+open+inner+close+after; const caret=(before+open).length; el.setSelectionRange(caret, caret); save(); updateCounts(); }
  function updateApplyEnabled(){ const el=els.text; if(!el) return; const hasSel=(el.selectionEnd - el.selectionStart)>0; const bSel=els.applyTagBtn; if(bSel) bSel.disabled=!hasSel; document.querySelectorAll('button[data-assign="1"]').forEach(b=>{ b.disabled=!hasSel; }); }
  function bindEditorDnD(){ const el=els.text; if(!el) return; ['dragenter','dragover'].forEach(ev=> el.addEventListener(ev, e=>{ const spk=e.dataTransfer?.types?.includes('text/x-speaker'); if(spk){ e.preventDefault(); el.classList.add('drop-active'); }})); ['dragleave','drop','dragend'].forEach(ev=> el.addEventListener(ev, e=>{ el.classList.remove('drop-active'); })); el.addEventListener('drop', e=>{ const spk=e.dataTransfer?.getData('text/x-speaker'); if(!spk) return; e.preventDefault(); wrapSelectionWithTag(spk); }); el.addEventListener('mouseup', updateApplyEnabled); el.addEventListener('keyup', updateApplyEnabled); el.addEventListener('select', updateApplyEnabled); }

  // resizer
  function installResizer(){
    const grid=document.querySelector('main .grid'); if(!grid) return;
    let res=grid.querySelector('.col-resizer');
    if(!res){ res=document.createElement('div'); res.className='col-resizer'; res.setAttribute('role','separator'); res.setAttribute('aria-orientation','vertical'); res.tabIndex=0; if(grid.children.length>=2){ grid.insertBefore(res, grid.children[1]); } else { grid.appendChild(res); } } else { if(grid.children[1]!==res){ grid.insertBefore(res, grid.children[1]); } }
    function applyCols(leftPx){ const minLeft=460, resW=10, gap=18; const rect=grid.getBoundingClientRect(); const total=rect.width; const maxLeft=Math.max(minLeft, total - (320 + resW + gap)); const left=Math.min(Math.max(leftPx, minLeft), maxLeft); grid.style.gridTemplateColumns = `${left}px ${resW}px 1fr`; localStorage.setItem('grid_left_px', String(Math.round(left))); }
    const saved=parseInt(localStorage.getItem('grid_left_px')||'0',10); if(saved){ applyCols(saved); } else { const rect=grid.getBoundingClientRect(); const initial=Math.max(560, Math.round(rect.width*0.64)); applyCols(initial); }
    let dragging=false; function onMove(clientX){ const rect=grid.getBoundingClientRect(); const x=clientX-rect.left; applyCols(x); }
    res.addEventListener('pointerdown',e=>{ dragging=true; res.setPointerCapture(e.pointerId); document.body.style.userSelect='none'; e.preventDefault(); });
    res.addEventListener('pointermove',e=>{ if(dragging) onMove(e.clientX); });
    const endDrag=e=>{ if(!dragging) return; dragging=false; try{ res.releasePointerCapture(e.pointerId); }catch{} document.body.style.userSelect=''; };
    res.addEventListener('pointerup',endDrag); res.addEventListener('pointercancel',endDrag);
    res.addEventListener('keydown',e=>{ const step=(e.shiftKey?32:16); const rect=grid.getBoundingClientRect(); const cur=parseInt(localStorage.getItem('grid_left_px')||'0',10) || Math.round(rect.width*0.64); if(e.key==='ArrowLeft'){ applyCols(cur-step); e.preventDefault(); } if(e.key==='ArrowRight'){ applyCols(cur+step); e.preventDefault(); } if(e.key==='Home'){ applyCols(480); e.preventDefault(); } if(e.key==='End'){ applyCols(rect.width - 320 - 10 - 18); e.preventDefault(); } });
    window.addEventListener('resize',()=>{ const cur=parseInt(localStorage.getItem('grid_left_px')||'0',10); if(cur) applyCols(cur); });
  }

  // init
  load(); registerSW();
  els.text && els.text.addEventListener('input', ()=>{ save(); updateCounts(); });
  els.drop && (['dragenter','dragover'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.add('dragover'); }); }), ['dragleave','drop'].forEach(ev=>{ els.drop.addEventListener(ev, e=>{ e.preventDefault(); e.stopPropagation(); els.drop.classList.remove('dragover'); }); }), els.drop.addEventListener('drop', e=>{ const f=e.dataTransfer?.files?.[0]; readFile(f); }));
  els.file && els.file.addEventListener('change', e=>{ const f=e.target.files?.[0]; readFile(f); e.target.value=''; });
  els.play && els.play.addEventListener('click', start);
  els.pause && els.pause.addEventListener('click', pause);
  els.resume && els.resume.addEventListener('click', resume);
  els.stop && els.stop.addEventListener('click', stop);
  els.exportBtn && els.exportBtn.addEventListener('click', ()=>{ const blob=new Blob([els.text?.value||''],{type:'text/plain;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='texto_para_leer.txt'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); });
  els.resetBtn && els.resetBtn.addEventListener('click', ()=>{ if(els.text){ els.text.value=''; save(); updateCounts(); } });
  els.btnSelfCheck && els.btnSelfCheck.addEventListener('click', ()=>{ const issues = runSelfCheck(); if(!issues.length) installResizer(); });
  els.btnAddChar && els.btnAddChar.addEventListener('click', ()=> addCharacter(''));
  els.btnAutoDetect && els.btnAutoDetect.addEventListener('click', autoDetect);
  els.applyTagBtn && els.applyTagBtn.addEventListener('click', ()=>{ const name=els.applyTagSelect?.value || 'Narrador'; wrapSelectionWithTag(name); });

  document.addEventListener('keydown', e=>{ if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA')) return; if(e.code==='Space'){ e.preventDefault(); if(speechSynthesis.speaking && !speechSynthesis.paused) pause(); else resume(); } if(e.key==='s'||e.key==='S'){ stop(); } if(e.key==='r'||e.key==='R'){ resume(); } });

  function runSelfCheck(){
    const issues=[]; const grid=document.querySelector('main .grid'); if(!grid) issues.push('No grid'); const res=grid?.querySelector('.col-resizer'); if(!res) issues.push('Resizer no montado'); else if(grid.children[1]!==res) issues.push('Resizer no es el 2º hijo');
    const quick = $('#quickCastList'); if(!quick) issues.push('Falta #quickCastList');
    els.live && (els.live.textContent = issues.length?`Autotest: ${issues.length} problema(s): ${issues.join(' • ')}`:'Autotest: OK ✅'); els.domStatus && (els.domStatus.textContent = issues.length? `Autotest: ${issues.length}`:'Autotest: OK ✅'); return issues;
  }

  function readFile(file){ if(!file) return; const reader=new FileReader(); reader.onload=()=>{ if(els.text){ els.text.value=normalizeText(String(reader.result||'')); save(); updateCounts(); } }; reader.onerror=()=>{ els.live&&(els.live.textContent='No se pudo leer el archivo.'); }; reader.readAsText(file); }

  populateVoices(); speechSynthesis.onvoiceschanged = ()=>{ populateVoices(); };
  setTimeout(()=>{ installResizer(); }, 50);
})();