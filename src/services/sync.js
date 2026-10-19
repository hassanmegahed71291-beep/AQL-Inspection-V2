// Lightweight Supabase sync helper and realtime subscription manager
// Exposes window.AQLSync with init(), subscribeRejections(), push(), pull()
(function(){
  if(window.AQLSync) return;
  const CLOUD_CFG_KEY='aql-cloud-config-v1';
  function cloudCfg(){try{return JSON.parse(localStorage.getItem(CLOUD_CFG_KEY)||'{}')}catch(e){return {}}}
  function cfgValid(c){return c&&c.url&&c.anonKey}
  let supabaseClient = null;
  function initClient(){
    const c=cloudCfg(); if(!cfgValid(c)) throw new Error('Supabase config not set');
    supabaseClient = supabase.createClient(c.url,c.anonKey);
    return supabaseClient;
  }
  async function ensure(){ if(!supabaseClient) initClient(); return supabaseClient }

  async function subscribeRejections(onReject){
    try{
      const sb = await ensure();
      // subscribe to changes on aql_cloud_records or inspections if available
      // prefer inspections table
      try{
        const sub = sb.channel('public:inspections')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'inspections' }, payload => {
            try{
              const newRec = payload.new || {};
              if(newRec.status==='rejected'){
                window.AQL_showToast && window.AQL_showToast('Order rejected: '+(newRec.id||newRec.orderNo||''));
                if(typeof onReject==='function') onReject(newRec);
              }
            }catch(e){console.warn('rejection handler',e)}
          })
          .subscribe();
        return sub;
      }catch(e){
        console.warn('subscribeRejections: inspections subscription failed, trying fallback',e);
        // fallback: aql_cloud_records table
        const sub2 = sb.channel('public:aql_cloud_records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'aql_cloud_records' }, payload=>{
          // payload could be uploaded records; not ideal, leave for now
        }).subscribe();
        return sub2;
      }
    }catch(e){console.warn('AQLSync subscribe error',e);throw e}
  }

  async function push(){ if(typeof window.cloudPush==='function') return window.cloudPush(); const c=await ensure(); /* fallback - not implemented */ throw new Error('cloudPush not available'); }
  async function pull(){ if(typeof window.cloudPull==='function') return window.cloudPull(); const c=await ensure(); throw new Error('cloudPull not available'); }

  window.AQLSync = { initClient, subscribeRejections, push, pull, _internal:{cloudCfg} };
})();
