(function(){
  const $ = s => document.querySelector(s);
  const els = {
    text: $('#inputText'),
    visual: $('#editorVisual'),
    rec: $('#btnRec'),
    recFormat: $('#recFormat'),
    toggleView: $('#btnToggleView'),
    live: $('#live')
  };

  // Quick sanity logs so sepas si attachó
  console.log('[Readbook] init 1.3.3');
  if(!els.rec) console.warn('btnRec no encontrado');
  if(!els.toggleView) console.warn('btnToggleView no encontrado');

  // Attach listeners robustos
  if(els.rec){
    els.rec.addEventListener('click', ()=>{
      console.log('click Exportar audio');
      // Mínimo feedback aunque el resto de código TTS no esté
      if(els.live) els.live.textContent = 'Intentando iniciar exportación…';
      startRec().catch(e=>{
        console.error(e);
        if(els.live) els.live.textContent = 'No se pudo iniciar la exportación (permiso/navegador).';
      });
    });
  }
  if(els.toggleView){
    els.toggleView.addEventListener('click', ()=>{
      console.log('click Toggle view');
      const toColor = els.text && !els.text.hidden;
      if(toColor){
        // Switch a vista colores (solo demo: oculta textarea y muestra div)
        els.text.hidden = true;
        els.visual.hidden = false;
        els.visual.textContent = (els.text.value||'').replace(/\[\[([^\]]+)\]\]([\s\S]*?)\[\[\/\1\]\]/g, (m,n,inner)=>`{${n}} ${inner}`);
        els.toggleView.textContent = '🏷️ Etiquetas';
      }else{
        els.visual.hidden = true;
        els.text.hidden = false;
        els.toggleView.textContent = '🎨 Colores';
      }
    });
  }

  // --- mínimo motor grabación usando getDisplayMedia ---
  async function startRec(){
    const stream = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
    const mimeType = (MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '');
    const mr = new MediaRecorder(stream, mimeType?{mimeType}:{});
    const chunks = [];
    mr.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = ()=>{
      const blob = new Blob(chunks, {type: mr.mimeType || 'audio/webm'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'readbook.webm';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
      els.rec.textContent = '⏺️ Exportar audio';
      if(els.live) els.live.textContent = 'Exportación lista (WEBM).';
      stream.getTracks().forEach(t=>t.stop());
    };
    mr.start(200);
    els.rec.textContent = '⏹️ Detener';
    if(els.live) els.live.textContent = 'Grabando… selecciona ESTA pestaña + Compartir audio.';
    // auto-stop cuando dejes de compartir
    stream.getVideoTracks()[0].addEventListener('ended', ()=>{ try{mr.stop();}catch{} });
    // click de nuevo detiene
    els.rec.onclick = ()=>{ try{ mr.stop(); }catch{} };
  }
})();