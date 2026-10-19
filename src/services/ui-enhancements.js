// UI enhancements: exit confirmation dialog (Save / Don't Save / Cancel), autosave every 5s, dark mode toggle, attach mic buttons to text inputs
(function(){
  if(window.__AQL_UI_ENHANCED) return; window.__AQL_UI_ENHANCED = true;
  // graceful helpers
  const LS = window.localStorage;
  const sleep = ms=>new Promise(r=>setTimeout(r,ms));

  // --- Dark / Light toggle ---
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    LS.setItem('aql-theme', theme);
  }
  (function initTheme(){
    const t = LS.getItem('aql-theme') || 'light';
    applyTheme(t);
    // watch for header and inject toggle when available
    const mo = new MutationObserver(()=>{
      const header = document.querySelector('.top');
      if(header && !document.querySelector('#aql-theme-toggle')){
        const btn = document.createElement('button');
        btn.id='aql-theme-toggle'; btn.className='btn ghost s';
        btn.style.marginRight='8px';
        btn.textContent = t==='light'?'🌙':'☀️';
        btn.addEventListener('click', ()=>{
          const cur = document.documentElement.getAttribute('data-theme')||'light';
          const next = cur==='light'?'dark':'light'; applyTheme(next); btn.textContent = next==='light'?'🌙':'☀️';
        });
        header.querySelector('span')?.prepend(btn);
      }
    });
    mo.observe(document.body,{childList:true,subtree:true});
  })();

  // --- Custom unsaved-changes dialog ---
  function confirmLeaveDialog(){
    return new Promise(resolve=>{
      // build dialog
      const ov = document.createElement('div'); ov.style.position='fixed'; ov.style.inset='0'; ov.style.zIndex='99999';
      ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.background='rgba(0,0,0,.4)';
      const dlg = document.createElement('div'); dlg.className='card'; dlg.style.maxWidth='420px'; dlg.style.width='100%'; dlg.style.padding='16px';
      dlg.innerHTML = `<h3>Unsaved changes</h3><p>Do you want to save changes before leaving?</p>`;
      const row = document.createElement('div'); row.className='row'; row.style.gap='8px'; row.style.justifyContent='flex-end'; row.style.marginTop='12px';
      const saveBtn = document.createElement('button'); saveBtn.className='btn p'; saveBtn.textContent='Save';
      const dontBtn = document.createElement('button'); dontBtn.className='btn'; dontBtn.textContent="Don't Save";
      const cancelBtn = document.createElement('button'); cancelBtn.className='btn ghost'; cancelBtn.textContent='Cancel';
      row.append(cancelBtn,dontBtn,saveBtn); dlg.append(row); ov.append(dlg); document.body.append(ov);
      saveBtn.addEventListener('click', ()=>{ov.remove();resolve('save')});
      dontBtn.addEventListener('click', ()=>{ov.remove();resolve('dont')});
      cancelBtn.addEventListener('click', ()=>{ov.remove();resolve('cancel')});
    });
  }

  // wrap existing go function
  const origGo = window.go;
  if(typeof origGo==='function'){
    window.go = async function(x){
      try{
        if(window.dirty){
          const r = await confirmLeaveDialog();
          if(r==='cancel') return; // interrupt navigation
          if(r==='save'){
            // call save draft if available
            try{ if(typeof window.save==='function') await window.save('draft'); }
            catch(e){console.warn('autosave: save failed',e)}
            window.dirty=false;
            return origGo(x);
          }
          if(r==='dont'){
            window.dirty=false; return origGo(x);
          }
        }
      }catch(e){console.warn(e)}
      return origGo(x);
    }
  }

  // beforeunload fallback
  window.addEventListener('beforeunload', function(e){ if(window.dirty){ e.preventDefault(); e.returnValue=''; } });

  // --- Autosave every 5 seconds when dirty ---
  (function autosaveLoop(){
    let running=false;
    async function tick(){
      if(running) return; running=true;
      try{
        if(window.dirty && typeof window.save==='function'){
          // non-blocking save
          try{ await window.save('draft'); console.debug('autosave: draft saved'); }
          catch(err){ console.warn('autosave error',err) }
        }
      }finally{ running=false }
    }
    setInterval(tick,5000);
  })();

  // --- Attach mic buttons next to important textareas/inputs (Final Remarks, notes, comment areas) ---
  function attachMics(){
    try{
      const selectors = ['textarea','input[type="text"]'];
      const observer = new MutationObserver(()=>{
        document.querySelectorAll('textarea, input[type="text"]').forEach(el=>{
          if(el.dataset.aqlMic) return; // already processed
          // limit to likely fields by name or placeholder
          const name = (el.name||'').toLowerCase(); const ph = (el.placeholder||'').toLowerCase();
          const targetKeywords=['final','remark','note','comment','description','decision','remarks','report'];
          const ok = targetKeywords.some(k=>name.includes(k)||ph.includes(k)) || el.id==='';
          // be conservative: only attach for longer textareas or fields with these keywords
          if(el.tagName.toLowerCase()==='textarea' || ok){
            const btn = document.createElement('button'); btn.type='button'; btn.className='btn s'; btn.textContent='🎤';
            btn.title='Record and fill (speech)'; btn.style.marginLeft='6px';
            btn.addEventListener('click', async ()=>{
              try{
                btn.disabled=true; btn.textContent='…';
                if(window.AQLNativeSpeech && window.AQLNativeSpeech.isNative && window.AQLNativeSpeech.isNative()){
                  await window.AQLNativeSpeech.start({language: 'ar-EG', onResult: t=>{ el.value = (el.value?el.value+'\n':'') + t; el.dispatchEvent(new Event('input')); }, onEnd: ()=>{ btn.disabled=false; btn.textContent='🎤' } });
                } else if(window.SpeechRecognition || window.webkitSpeechRecognition){
                  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; const rec = new SR(); rec.lang='ar-EG'; rec.continuous=false; rec.interimResults=false; rec.onresult=e=>{const t=e.results[0][0].transcript; el.value = (el.value?el.value+'\n':'') + t; el.dispatchEvent(new Event('input'));}; rec.onerror=()=>{btn.disabled=false;btn.textContent='🎤'}; rec.onend=()=>{btn.disabled=false;btn.textContent='🎤'}; rec.start(); btn.textContent='●';
                } else { alert('Voice recognition not available here. Use Android app or Chrome on HTTPS.'); }
              }catch(e){console.warn(e); alert('Could not start microphone: '+(e&&e.message)); btn.disabled=false; btn.textContent='🎤' }
            });
            el.parentNode?.insertBefore(btn, el.nextSibling);
            el.dataset.aqlMic='1';
          }
        });
      });
      observer.observe(document.body,{childList:true,subtree:true});
      // initial run
      document.querySelectorAll('textarea, input[type="text"]').forEach(i=>{});
    }catch(e){console.warn('attachMics',e)}
  }
  attachMics();

  // --- Simple toasts for admins (realtime notifications hook will call window.AQL_showToast) ---
  window.AQL_showToast = function(msg,opts){
    try{
      const t = document.createElement('div'); t.className='aql-toast'; t.textContent = msg; t.style.position='fixed'; t.style.right='16px'; t.style.top='16px'; t.style.zIndex='999999'; t.style.background='#222'; t.style.color='#fff'; t.style.padding='8px 12px'; t.style.borderRadius='6px'; t.style.boxShadow='0 6px 18px rgba(0,0,0,.3)';
      document.body.append(t); setTimeout(()=>t.remove(), (opts&&opts.duration)||8000);
    }catch(e){console.warn(e)}
  }

  console.info('AQL UI enhancements loaded: autosave, exit-confirmation, theme toggle, speech attachments');
})();
