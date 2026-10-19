// integrations.js — DOM-level integrations and patches to wire the new helpers into the existing app
(function(){
  if(window.AQLIntegrations) return; window.AQLIntegrations = true;
  const log = (...a)=>console.debug('AQLIntegrations:',...a);

  // utility to wait for element
  function waitFor(sel,root=document,timeout=10000){return new Promise((res,rej)=>{const el=root.querySelector(sel);if(el)return res(el);const mo=new MutationObserver((ms,ob)=>{const e=root.querySelector(sel);if(e){ob.disconnect();res(e);}});mo.observe(root, {childList:true,subtree:true});if(timeout>0)setTimeout(()=>{mo.disconnect();rej(new Error('timeout waiting for '+sel))},timeout);});}

  // Patch login view: add OAuth buttons to existing vLogin form when present
  async function enhanceLogin(){
    try{
      const box = await waitFor('.card.form'); // heuristics: vLogin renders a .card.form container
      if(!box) return;
      // only add once
      if(box.dataset.aqlOauthAdded) return; box.dataset.aqlOauthAdded='1';
      const row = document.createElement('div'); row.style.display='flex'; row.style.gap='8px'; row.style.marginTop='8px';
      const g = document.createElement('button'); g.className='btn p'; g.textContent='Sign in with Google';
      const f = document.createElement('button'); f.className='btn p'; f.textContent='Sign in with Facebook';
      g.addEventListener('click', async ()=>{ try{ await window.AQLAuth.signInWithProvider('google'); alert('If redirected, complete provider sign-in and return here.'); }catch(e){alert('OAuth failed: '+(e&&e.message))}});
      f.addEventListener('click', async ()=>{ try{ await window.AQLAuth.signInWithProvider('facebook'); alert('If redirected, complete provider sign-in and return here.'); }catch(e){alert('OAuth failed: '+(e&&e.message))}});
      row.append(g,f); box.append(row);
      log('OAuth buttons added to login form');
    }catch(e){console.warn('enhanceLogin',e)}
  }

  // Patch annotatePhoto to offer cropping modal before original annotate
  function patchAnnotate(){
    try{
      if(!window.annotatePhoto) return log('annotatePhoto not found yet');
      if(window.__aql_annotate_patched) return; window.__aql_annotate_patched = true;
      const orig = window.annotatePhoto;
      window.annotatePhoto = function(obj,onDone){
        (async()=>{
          try{
            if(window.AQLImageTools && obj && (obj.p||obj.p0)){
              const src = obj.p0||obj.p;
              try{ const edited = await window.AQLImageTools.editImageModal(src); if(edited){ obj.p = edited; } }catch(e){ /* cancel or fail, continue to original annotate */ }
            }
          }catch(e){console.warn('annotate patch err',e)}
          try{ orig(obj,onDone); }catch(e){ console.warn('orig annotate failed',e); if(typeof onDone==='function') onDone(); }
        })();
      };
      log('annotatePhoto patched to use AQLImageTools');
    }catch(e){console.warn(e)}
  }

  // Ensure pickPhotos uses compression then optionally edit image modal if available
  function patchPickPhotos(){
    try{
      // pickPhotos is defined in app.js as global function
      if(!window.pickPhotos) return log('pickPhotos not found yet');
      if(window.__aql_pickphotos_patched) return; window.__aql_pickphotos_patched = true;
      const orig = window.pickPhotos;
      window.pickPhotos = function(cam,add){
        const wrappedAdd = async(p=>{
          try{
            if(window.AQLImageTools){
              try{ const edited = await window.AQLImageTools.editImageModal(p); if(edited) p = edited; }catch(e){}
            }
            return add(p);
          }catch(e){console.warn('wrappedAdd',e); return add(p);} 
        });
        return orig(cam,wrappedAdd);
      };
      log('pickPhotos patched to support AQLImageTools edit modal');
    }catch(e){console.warn(e)}
  }

  // Provide an in-app Academy route handler for #/academy (injects into #view)
  function handleAcademyRoute(){
    function renderAcademy(){
      const view = document.getElementById('view'); if(!view) return;
      view.replaceChildren();
      const card = document.createElement('div'); card.className='card';
      card.style.padding='12px'; card.innerHTML = '<h3>MicroLearning — Academy</h3><p>Quick flashcards and short quizzes for inspectors.</p>';
      const loadBtn = document.createElement('button'); loadBtn.className='btn p'; loadBtn.textContent='Load flashcards';
      loadBtn.addEventListener('click', async ()=>{
        try{ const res = await fetch('./src/data/aql-definitions.json'); const data = await res.json(); showFlashcards(data); }catch(e){alert('Could not load definitions: '+e.message)}
      });
      card.append(loadBtn);
      view.append(card);
    }
    function showFlashcards(data){
      const view = document.getElementById('view'); view.replaceChildren();
      const wrap = document.createElement('div'); wrap.className='card'; wrap.style.padding='12px';
      const idx = {i:0};
      const fc = document.createElement('div'); fc.style.minHeight='120px'; fc.style.display='flex'; fc.style.flexDirection='column';
      const renderCard = ()=>{
        const item = data.cards[idx.i % data.cards.length]; fc.innerHTML = `<h4>${item.title}</h4><p>${item.content}</p>`;
      };
      const prev = document.createElement('button'); prev.className='btn'; prev.textContent='◀ Prev'; prev.addEventListener('click', ()=>{ idx.i=(idx.i-1+data.cards.length)%data.cards.length; renderCard(); });
      const next = document.createElement('button'); next.className='btn p'; next.textContent='Next ▶'; next.addEventListener('click', ()=>{ idx.i=(idx.i+1)%data.cards.length; renderCard(); });
      wrap.append(fc, document.createElement('div').appendChild(prev) && document.createElement('div'));
      const ctrl = document.createElement('div'); ctrl.style.marginTop='12px'; ctrl.style.display='flex'; ctrl.style.gap='8px'; ctrl.append(prev,next);
      wrap.append(fc, ctrl);
      view.append(wrap);
      renderCard();
    }

    window.addEventListener('hashchange', ()=>{ if(location.hash==='#/academy') renderAcademy(); });
    // also handle if current hash is academy
    if(location.hash==='#/academy') renderAcademy();
  }

  // Header quick-actions: sampling calculator button
  function addSamplingButton(){
    try{
      const mo = new MutationObserver(()=>{
        const header = document.querySelector('.top'); if(!header) return; if(header.dataset.aqlSampling) return; header.dataset.aqlSampling='1';
        const btn = document.createElement('button'); btn.className='btn s'; btn.textContent='Sampling Calc'; btn.style.marginRight='8px';
        btn.addEventListener('click', ()=>{
          const lot = prompt('Enter lot size (number of pieces):'); if(!lot) return; try{ const r = window.AQLSampling.recommend(Number(lot)); alert(`Sample size: ${r.sampleSize}\nIndices: ${r.sampleIndices.slice(0,Math.min(20,r.sampleIndices.length)).join(', ')}\nNote: ${r.note}`);}catch(e){alert('Sampling error: '+e.message)}
        });
        header.querySelector('span')?.prepend(btn);
      });
      mo.observe(document.body,{childList:true,subtree:true});
    }catch(e){console.warn(e)}
  }

  // Subscribe managers to rejection notifications once the app is loaded and S.me is known
  function subscribeRejectionsWhenReady(){
    const trySub = ()=>{
      try{
        if(!window.S || !window.S.me) return false; if(!(window.S.me && window.S.me.role==='manager')) return false;
        if(window.AQLSync && window.AQLSync.subscribeRejections){ window.AQLSync.subscribeRejections(rec=>{ window.AQL_showToast && window.AQL_showToast('Realtime: Rejected '+(rec.id||rec.orderNo||'')); }); log('manager realtime subscription established'); return true; }
      }catch(e){console.warn(e)}
      return false;
    };
    const intv = setInterval(()=>{ if(trySub()){ clearInterval(intv); } },1000);
    // stop after 60s
    setTimeout(()=>clearInterval(intv),60000);
  }

  // bootstrapping: wait for app root then patch
  (function bootstrap(){
    document.addEventListener('DOMContentLoaded', ()=>{
      setTimeout(()=>{ enhanceLogin().catch(()=>{}); patchAnnotate(); patchPickPhotos(); handleAcademyRoute(); addSamplingButton(); subscribeRejectionsWhenReady(); },500);
    });
    // also try quickly in case DOMContent already fired
    setTimeout(()=>{ enhanceLogin().catch(()=>{}); patchAnnotate(); patchPickPhotos(); handleAcademyRoute(); addSamplingButton(); subscribeRejectionsWhenReady(); },1000);
  })();

})();
