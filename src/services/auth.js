(function(){
  // Lightweight Supabase Auth helper for the app
  if(window.AQLAuth) return; const CLOUD_CFG_KEY='aql-cloud-config-v1';
  function cloudCfg(){try{return JSON.parse(localStorage.getItem(CLOUD_CFG_KEY)||'{}')}catch(e){return {}}}
  function cfgValid(c){return c&&c.url&&c.anonKey}
  let supabase = null;
  function client(){
    if(supabase) return supabase;
    const c = cloudCfg(); if(!cfgValid(c)) throw new Error('Supabase config not set');
    supabase = supabaseClient = supabase || window.supabase ? window.supabase.createClient(c.url,c.anonKey) : (window.supabase && window.supabase.createClient ? window.supabase.createClient(c.url,c.anonKey) : null);
    if(!supabase && window.supabase) supabase = window.supabase.createClient(c.url,c.anonKey);
    return supabase;
  }

  async function init(){ try{client(); return true}catch(e){console.warn('AQLAuth.init',e);return false} }

  async function signInEmail(email,password){
    const c = client(); const r = await c.auth.signInWithPassword({email,password}); if(r.error) throw r.error; return r.data;
  }
  async function signUpEmail(email,password){ const c=client(); const r=await c.auth.signUp({email,password}); if(r.error) throw r.error; return r.data }
  async function signInWithProvider(provider){ const c=client(); if(!['google','facebook'].includes(provider)) throw new Error('unsupported'); const r = await c.auth.signInWithOAuth({provider}); return r }
  async function signOut(){ const c=client(); await c.auth.signOut(); if(typeof window.signOut==='function') window.signOut(); }
  async function getUser(){ const c=client(); const r = await c.auth.getUser(); if(r.error) throw r.error; return r.data.user }

  // convenience: try to map supabase user to local member and start session
  async function loginAndStartSession(email){
    try{
      const user = (await getUser()) || {};
      // find local member matching email
      if(!window.S) return user;
      const m = window.S.members.find(x=>x.email && x.email.toLowerCase()===String(email||'').toLowerCase());
      if(m){ // start local session
        if(typeof window.startSession==='function') await window.startSession(m,true);
      }
      return user;
    }catch(e){console.warn(e);return null}
  }

  window.AQLAuth = { init, signInEmail, signUpEmail, signInWithProvider, signOut, getUser, loginAndStartSession };
})();
