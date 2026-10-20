function render(){document.documentElement.lang=S.lang;document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';applyTheme();
  if(!S.members.length){$('#app').replaceChildren(vSetup());return}if(!S.me){$('#app').replaceChildren(vLogin());return}
  const navs=NAV.filter(n=>isMgr()||!MGRNAV.includes(n[0])),outBtn=h('button',{class:'btn ghost s',onClick:signOut},'⎋ '+L('Sign out','خروج'));
  const y=scrollY,hash=ROUTE,a='#/'+(hash.split('/')[1]||'');
  const curNav=NAV.find(n=>n[0]===(a==='#/i'?'#/archive':a==='#/report'?'#/reports':a))||NAV[0];
  const sw=h('button',{class:'btn ghost s',onClick:()=>{S.lang=S.lang==='en'?'ar':'en';LS.set('lang',S.lang);render()}},S.lang==='en'?'العربية':'English');
  const themeBtn=h('button',{class:'btn ghost s theme-toggle',onClick:()=>setTheme(S.theme==='dark'?'light':'dark')},S.theme==='dark'?'☀️':'🌙');
  const link=n=>h('a',{href:n[0],class:n===curNav?'on':''},h('span',{},n[1]),' ',L(n[2],n[3]));
  const name=S.settings.platformName,fac=S.settings.factoryName;
  const v=({'':vPanel,new:vIns,i:vIns,archive:()=>vList(false),reports:()=>vList(true),analytics:vAnalytics,library:vLib,aql:vAql,settings:vSettings,audit:vAudit,report:vReport})[hash.split('/')[["1"]]||''];
  $('#app').replaceChildren(h('div',{class:'shell'},
    h('aside',{class:'side'},h('div',{class:'brand'},h('b',{},name),h('small',{},fac)),navs.map(link),h('div',{style:'margin-top:auto;display:grid;gap:8px'},h('small',{style:'color:#8fa6bb;padding:8px 8px 0'},L('Theme','الثيم')),h('div',{class:'row wrap'},themeBtn,sw)),h('div',{style:'margin-top:6px'},outBtn)),
    h('div',{class:'main'},h('header',{class:'top'},h('h1',{},L(curNav[2],curNav[3])),h('span',{style:'display:flex;gap:6px'},themeBtn,sw,outBtn)),h('main',{id:'view'},v())),
    h('nav',{class:'tabs'},navs.map(n=>h('a',{href:n[0],class:n===curNav?'on':''},h('span',{},n[1]),L(({'#/':'Panel','#/new':'New','#/archive':'Archive','#/analytics':'Analytics','#/library':'Library','#/aql':'AQL','#/settings':'Settings','#/audit':'Audit'}[n[0]]||n[2]),({'#/':'لوحة','#/new':'جديد','#/archive':'أرشيف','#/analytics':'التحليلات','#/library':'المكتبة','#/aql':'AQL','#/settings':'الإعدادات','#/audit':'السجل'}[n[0]]||n[3])))),h('div',{class:'tabs-actions'},themeBtn,sw))
  ));
  scrollTo(0,y)}
