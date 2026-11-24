'use strict';
/* ---------- helpers ---------- */
const $=(s)=>document.querySelector(s);
function h(tag,props,...kids){const e=document.createElement(tag);props=props||{};
  for(const[k,v]of Object.entries(props)){if(v==null||v===false||k==='value'||k==='checked')continue;
    if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else if(v===true)e.setAttribute(k,'');else e.setAttribute(k,v)}
  kids.flat(9).forEach(c=>{if(c==null||c===false)return;e.append(c.nodeType?c:document.createTextNode(String(c)))});
  if('value'in props&&props.value!=null)e.value=props.value;if('checked'in props)e.checked=!!props.checked;return e}
const LS={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
const SS={get(k){try{return sessionStorage.getItem(k)}catch(e){return null}},set(k,v){try{sessionStorage.setItem(k,v)}catch(e){}},del(k){try{sessionStorage.removeItem(k)}catch(e){}}};
const S={lang:LS.get('lang')||'en',settings:null,lib:[],plans:[],ins:[],trash:[],audit:[],members:[],me:null,lists:{id:'lists',customers:[]}};
const L=(en,ar)=>S.lang==='ar'?ar:en;
const THEME_KEY='aql-theme';
function applyTheme(){document.documentElement.dataset.theme=LS.get(THEME_KEY)||'light'}
function themeButton(){return h('button',{class:'btn ghost s',type:'button',onClick:()=>{const n=(LS.get(THEME_KEY)||'light')==='dark'?'light':'dark';LS.set(THEME_KEY,n);applyTheme();render()}},(LS.get(THEME_KEY)||'light')==='dark'?'☀️':'🌙 '+L('Dark mode','الوضع الداكن'))}
function voiceButton(target){return h('button',{type:'button',class:'btn s voice-btn',onClick:()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert(L('Voice input is not supported in this browser. Try Chrome and allow microphone access.','الإملاء الصوتي غير مدعوم في هذا المتصفح. جرّب Chrome واسمح باستخدام الميكروفون.'));return}const r=new SR();r.lang=S.lang==='ar'?'ar-EG':'en-US';r.interimResults=false;r.onresult=e=>{const text=e.results[0][0].transcript;target.value+=(target.value?' ':'')+text;target.dispatchEvent(new Event('input',{bubbles:true}))};r.onerror=()=>alert(L('Microphone error. Check browser permission.','حدث خطأ بالميكروفون. راجع أذونات المتصفح.'));r.start()}},'🎙 '+L('Speak','تحدث'))}

const uid=(n=5)=>Math.random().toString(36).slice(2,2+n);
const nowLocal=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)};
const insId=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return`INS-${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${uid().toUpperCase()}`};
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g,'');
const num=v=>Number(v)||0;
const EDIT=['draft','in_progress'];
const SEV=['critical','major','minor'];
const GT=['jacket','trousers','vest','shorts','suit'],SINGLE=['jacket','trousers','vest','shorts'];
const gL={jacket:['Jacket','جاكيت'],trousers:['Trousers','بنطلون'],vest:['Vest','فيست'],shorts:['Shorts','شورت'],suit:['Suit','بدلة'],both:['Suit','بدلة']};
const gName=t=>L(...(gL[t]||[t||'',t||'']));
const garmentsOf=t=>(t==='suit'||t==='both')?['jacket','trousers']:[t];
const pack=i=>num(i.orderQty)>0&&num(i.actualQty)>0?Math.round(num(i.actualQty)/num(i.orderQty)*100)+'%':'';
function migratePhotos(o){if(!o.defPhotos){o.defPhotos=[];(o.defs||[]).forEach(d=>{(d.photos||[]).forEach(p=>o.defPhotos.push({p,defId:d.id}));d.photos=[]})}return o}
function mapDefPhotos(i){const gs=garmentsOf(i.garmentType),defs=(i.defs||[]).filter(d=>gs.includes(d.garment)),seq=[];defs.forEach(d=>{const n=Math.max(0,num(d.pieces));for(let k=0;k<n;k++)seq.push(d)});let k=0;
  return(i.defPhotos||[]).map(ph=>{const d=ph.defId?defs.find(x=>x.id===ph.defId):(seq[k++]||null);return{p:ph.p,name:d?defNm(d):'',sev:d?d.severity:'',auto:!ph.defId,defId:d?d.id:''}})}
function padPages(arr,min){const pages=Math.max(num(min),Math.ceil(arr.length/15));return arr.concat(Array(pages*15-arr.length).fill(null))}
const sevL={critical:['Critical','حرج'],major:['Major','رئيسي'],minor:['Minor','ثانوي']};
const stL=s=>({draft:L('Draft','مسودة'),in_progress:L('In progress','قيد التنفيذ'),pending_review:L('Pending review','بانتظار المراجعة'),approved:L('Approved','معتمد'),rejected:L('Rejected','مرفوض')})[s]||s;
/* ---------- storage (IndexedDB, this device only) ---------- */
const DB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('aql-inspection',3);r.onupgradeneeded=()=>{['kv','library','plans','inspections','comparisons','cmpfiles','files','filedata'].forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})})};r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  tx(s,m,f){return new Promise((res,rej)=>{const t=this.db.transaction(s,m);let r;try{r=f(t.objectStore(s))}catch(e){return rej(e)}t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  all(s){return this.tx(s,'readonly',st=>st.getAll())},get(s,id){return this.tx(s,'readonly',st=>st.get(id))},keys(s){return this.tx(s,'readonly',st=>st.getAllKeys())},rev:0,own:0,noTomb:false,noKick:false,noDirty:false,
  dirty:(()=>{try{return new Map(Object.entries(JSON.parse(localStorage.getItem('aql-dirty-v1')||'{}')))}catch(e){return new Map()}})(),
  markDirty(s,id){const k=s+'/'+id;this.dirty.set(k,(this.dirty.get(k)||0)+1);clearTimeout(this._dt);this._dt=setTimeout(()=>this.saveDirty(),300)},
  saveDirty(){try{localStorage.setItem('aql-dirty-v1',JSON.stringify(Object.fromEntries(this.dirty)))}catch(e){}},

  put(s,o){DB.rev++;if(!DB.noDirty&&o&&(s==='inspections'||s==='library'||s==='plans'||(s==='kv'&&(o.id==='settings'||o.id==='lists'||String(o.id).startsWith('inspset_')||String(o.id).startsWith('cust_')))))DB.markDirty(s,o.id);if(!DB.noKick&&(s==='inspections'||s==='library'||s==='plans'||(s==='kv'&&o&&(o.id==='settings'||o.id==='lists'||String(o.id).startsWith('inspset_')||String(o.id).startsWith('cust_')))))cloudKick();return this.tx(s,'readwrite',st=>st.put(o))},clear(s){return this.tx(s,'readwrite',st=>st.clear())},del(s,id){DB.rev++;if(!DB.noKick&&['library','plans','inspections'].includes(s))cloudKick();return this.tx(s,'readwrite',st=>st.delete(id)).then(async r=>{if(!DB.noTomb&&['library','plans','inspections'].includes(s)){try{const m=(await DB.get('kv','syncmeta'))||{id:'syncmeta',ws:'',h:{},s:{},tomb:{},aud:{}};m.tomb=m.tomb||{};m.tomb[s+'/'+id]=Date.now();await DB.put('kv',m)}catch(e){}}return r})}};
const DEPTS=[['Cutting','القص'],['Front Preparation','تجهيز الأمام'],['Sleeve Preparation','تجهيز الأكمام'],['Lining Preparation','تجهيز البطانة'],['Assembly','التجميع'],['Pressing','الكي'],['Packing','التعبئة']];
const defSettings=()=>({id:'settings',platformName:'MEYAR',factoryName:'ALPHA OMEGA EGYPT',inspectorName:'',jacket:DEPTS.map(([en,ar])=>({id:'d_'+uid(6),en,ar,active:true})),trousers:[],vest:[],shorts:[],minDefPages:2,minItemPages:0});
async function loadAll(){S.lib=await DB.all('library');S.plans=await DB.all('plans');const allIns=(await DB.all('inspections')).sort((a,b)=>b.createdAt-a.createdAt),lim=Date.now()-30*864e5,keepIns=[];
  for(const x of allIns){if(x.deletedAt&&x.deletedAt<lim){try{await DB.del('inspections',x.id)}catch(e){}}else keepIns.push(x)}
  S.ins=keepIns.filter(x=>!x.deletedAt);S.trash=keepIns.filter(x=>x.deletedAt);S.ins.forEach(migratePhotos);
  const kv=await DB.all('kv');S.settings=kv.find(x=>x.id==='settings');if(!S.settings){S.settings=defSettings();await DB.put('kv',S.settings)}else if(S.settings.platformName!=='MEYAR'){S.settings.platformName='MEYAR';await DB.put('kv',S.settings)}
  S.inspSets={};kv.forEach(x=>{if(String(x.id).startsWith('inspset_'))S.inspSets[x.id]=x});
  S.audit=(kv.find(x=>x.id==='audit')||{items:[]}).items;SINGLE.forEach(g=>{S.settings[g]=S.settings[g]||[]});
  S.members=(kv.find(x=>x.id==='members')||{items:[]}).items;S.lists=kv.find(x=>x.id==='lists')||{id:'lists',customers:[]};await custMigrate(kv);
  S.me=S.members.find(m=>m.active&&m.id===(SS.get('meId')||LS.get('meId')))||null;await seedDefaults(kv)}
const DEF_LOGO="data:image/jpeg;base64,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",DEF_AVATAR="data:image/jpeg;base64,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";
const Z14=[[2,8,'A',2,[0,1],[0,1],[0,1]],[9,15,'B',3,[0,1],[0,1],[0,1]],[16,25,'C',5,[0,1],[0,1],[0,1]],[26,50,'D',8,[0,1],[1,2],[1,2]],[51,90,'E',13,[1,2],[1,2],[2,3]],[91,150,'F',20,[1,2],[2,3],[3,4]],[151,280,'G',32,[2,3],[3,4],[5,6]],[281,500,'H',50,[3,4],[5,6],[7,8]],[501,1200,'J',80,[5,6],[7,8],[10,11]],[1201,3200,'K',125,[7,8],[10,11],[14,15]],[3201,10000,'L',200,[10,11],[14,15],[21,22]],[10001,35000,'M',315,[14,15],[21,22],[21,22]]];
function z14Plan(){return{id:'plan_'+uid(6),name:'Alpha Omega – ANSI/ASQ Z1.4 single sampling (Critical 0, Major 2.5, Minor 4.0)',active:true,current:1,versions:{1:{version:1,countBasis:'pieces',verified:true,effectiveDate:'',createdAt:Date.now(),
  procedure:'Sampling inspection based on ANSI/ ASQC Z1.4 ( formerly known as MIL- STD - 105E ), Single Sampling plans for normal inspection, General Inspection Level II, with AQL: Critical ( Not Allowed ), Major ( 2.5 ), Minor ( 4.0 ).',
  rows:Z14.map(([a,b,c,n,m,mi])=>({lotMin:a,lotMax:b,codeLetter:c,sampleSize:n,critical:{aql:'0',ac:0,re:1},major:{aql:'2.5',ac:m[0],re:m[1]},minor:{aql:'4.0',ac:mi[0],re:mi[1]}}))}}}}
const SEEDDEF=[["D001", "Wrong Size / Measurement Error", "خطأ في المقاس", "critical", ["jacket", "trousers", "vest", "shorts"]], ["D002", "Wrong Style / Model", "موديل غلط", "critical", ["jacket", "trousers", "vest", "shorts"]], ["D003", "Wrong Fabric / Color", "قماش أو لون غلط", "critical", ["jacket", "trousers", "vest", "shorts"]], ["D004", "Open Seam", "خياطة مفتوحة", "major", ["jacket", "trousers", "vest", "shorts"]], ["D005", "Broken Stitches", "خيوط مقطوعة", "major", ["jacket", "trousers", "vest", "shorts"]], ["D006", "Uneven Stitching", "خياطة غير منتظمة", "major", ["jacket", "trousers", "vest", "shorts"]], ["D007", "Puckering", "تجعد في الخياطة", "major", ["jacket", "trousers", "vest", "shorts"]], ["D008", "Collar Misalignment", "كولر غير مستوي", "major", ["jacket", "vest"]], ["D009", "Collar Shape Defect", "شكل الكولر معيب", "major", ["jacket", "vest"]], ["D010", "Lapel Misalignment", "لابيل غير مستوي", "major", ["jacket", "vest"]], ["D011", "Lapel Shape Defect", "شكل اللابيل معيب", "major", ["jacket", "vest"]], ["D012", "Sleeve Length Variation", "تفاوت في طول الكم", "major", ["jacket", "vest"]], ["D013", "Sleeve Width Variation", "تفاوت في عرض الكم", "major", ["jacket", "vest"]], ["D014", "Open Sleeve Armhole", "فتحة الكم مفتوحة", "major", ["jacket", "vest"]], ["D015", "Shoulder Width Variation", "تفاوت في عرض الكتف", "major", ["jacket", "vest"]], ["D016", "Chest Width Variation", "تفاوت في عرض الصدر", "major", ["jacket", "vest"]], ["D017", "Back Length Variation", "تفاوت في طول الظهر", "major", ["jacket", "vest"]], ["D018", "Lining Defect", "عيب في البطانة", "major", ["jacket", "vest"]], ["D019", "Lining Misalignment", "بطانة غير مستوية", "major", ["jacket", "vest"]], ["D020", "Pocket Misalignment", "جيب غير مستوي", "major", ["jacket", "trousers", "vest", "shorts"]], ["D021", "Pocket Shape Defect", "شكل الجيب معيب", "major", ["jacket", "trousers", "vest", "shorts"]], ["D022", "Chest Pocket Defect", "عيب في جيب الصدر", "major", ["jacket", "vest"]], ["D023", "Loose Button", "زرار مفكوك", "major", ["jacket", "trousers", "vest", "shorts"]], ["D024", "Missing Button", "زرار ناقص", "major", ["jacket", "trousers", "vest", "shorts"]], ["D025", "Button Hole Defect", "عيب في فتحة الزرار", "major", ["jacket", "vest"]], ["D026", "Open Button Hole", "فتحة زرار مفتوحة", "major", ["jacket", "vest"]], ["D027", "Padding Visible", "حشو ظاهر", "major", ["jacket", "vest"]], ["D028", "Shoulder Pad Misalignment", "وتد الكتف غير مستوي", "major", ["jacket", "vest"]], ["D029", "Thread Trimming", "خيوط زيادة", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D030", "Dust / Dirt", "غبار / اتساخ", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D031", "Stain", "بقعة", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D032", "Oil Stain", "بقعة زيت", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D033", "Iron Mark", "أثر المكواة", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D034", "Pen Mark", "أثر قلم", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D035", "Needle Mark", "أثر إبرة", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D036", "Improper Folding", "طي غير صحيح", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D037", "Wrong Label", "لافتة غلط", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D038", "Wrong Tag / Sticker", "تاج أو ستيكر غلط", "minor", ["jacket", "trousers", "vest", "shorts"]], ["D039", "Waistband Misalignment", "حزام غير مستوي", "major", ["trousers", "shorts"]], ["D040", "Waistband Width Variation", "تفاوت في عرض الحزام", "major", ["trousers", "shorts"]], ["D041", "Leg Length Variation", "تفاوت في طول الرجل", "major", ["trousers", "shorts"]], ["D042", "Leg Width Variation", "تفاوت في عرض الرجل", "major", ["trousers", "shorts"]], ["D043", "Zipper Length Variation", "تفاوت في طول السحاب", "major", ["trousers", "shorts"]], ["D044", "Faulty Zipper", "سحاب معيب", "major", ["trousers", "shorts"]], ["D045", "Misaligned Zipper", "سحاب غير مستوي", "major", ["trousers", "shorts"]], ["D046", "Button Problem", "مشكلة في الزرار", "major", ["trousers", "shorts"]], ["D047", "Uneven Belt Loops", "لوبات حزام غير منتظمة", "major", ["trousers", "shorts"]], ["D048", "Loops Slanted", "لوبات مائلة", "major", ["trousers", "shorts"]], ["D049", "Open Hem", "حاشية مفتوحة", "major", ["trousers", "shorts"]], ["D050", "Color shading", "اختلاف لون", "major", ["jacket", "trousers", "vest", "shorts"]], ["D051", "Loose stitching", "خياطه مفكوكه", "major", ["jacket", "trousers", "vest", "shorts"]], ["D052", "Open Side Seam", "فك في الجنب", "major", ["jacket", "trousers", "vest", "shorts"]], ["D053", "Open Stitch Button Hole", "فك في العروة", "major", ["jacket", "trousers", "vest", "shorts"]], ["D054", "Cut Fabric", "قطع في القماش", "major", ["jacket", "trousers", "vest", "shorts"]], ["D055", "Open Seam Sleeve", "فتح خياطة الكم", "major", ["jacket"]], ["D056", "Open Seam Sleeve Hem", "فتح خياطة حاشية الكم", "major", ["jacket"]]];
async function seedDefaults(kv){if(kv.find(x=>x.id==='seeded'&&x.v>=3))return;
  const old=S.plans.length===1&&S.plans[0].current===1&&S.plans[0].versions[1].rows.length===1;
  if(!S.plans.length||old){const p=z14Plan();if(old)p.id=S.plans[0].id;await DB.put('plans',p)}
  const used=new Set(S.ins.flatMap(i=>(i.defs||[]).map(d=>d.defectId)));
  for(const id of['OSS','OSA','CUT','OSB','OSH','BTN','SHD','THR','DST','STN','IRN']){const x=S.lib.find(l=>l.id===id);if(x&&!used.has(id)&&!(x.photos&&x.photos.length))await DB.del('library',id)}
  const have=new Set((await DB.all('library')).map(l=>norm(l.nameEn)));
  for(const [code,en,ar,sv,g] of SEEDDEF){if(have.has(norm(en)))continue;await DB.put('library',{id:code,code,nameEn:en,nameAr:ar,descEn:'',descAr:'',severity:sv,garments:[...g],active:true,photos:[],createdAt:Date.now(),updatedAt:0})}
  await DB.put('kv',{id:'seeded',v:3});S.plans=await DB.all('plans');S.lib=await DB.all('library')}
async function audit(action,rec,meta){S.audit.unshift({at:Date.now(),by:(S.me&&S.me.name)||'-',action,rec,meta:meta||{}});S.audit=S.audit.slice(0,500);await DB.put('kv',{id:'audit',items:S.audit})}
/* ---------- AQL engine (pure) ---------- */
function evaluate(plan,lot,counts){
  if(!plan)return{status:'no_plan',authoritative:false,result:null};
  const row=plan.rows.find(r=>lot>=r.lotMin&&lot<=r.lotMax);if(!row)return{status:'no_range',authoritative:false,result:null};
  const cats={};for(const c of SEV){const l=row[c],f=counts[c];cats[c]={aql:l.aql,ac:l.ac,re:l.re,found:f,result:f<=l.ac?'pass':f>=l.re?'fail':null}}
  const rs=SEV.map(c=>cats[c].result);const result=rs.includes('fail')?'fail':rs.every(r=>r==='pass')?'pass':null;
  return{status:'ok',authoritative:!!plan.verified,sampleSize:row.sampleSize,codeLetter:row.codeLetter,cats,result}}
function validateRows(rows){const e=[];const s=[...rows].sort((a,b)=>a.lotMin-b.lotMin);
  s.forEach((r,i)=>{if(![r.lotMin,r.lotMax,r.sampleSize].every(Number.isInteger)||r.lotMin<1||r.lotMax<r.lotMin||r.sampleSize<1)e.push(`Row ${i+1}: invalid lot range / sample size`);
    if(i&&r.lotMin<=s[i-1].lotMax)e.push(`Row ${i+1}: overlaps previous range`);
    for(const c of SEV){const l=r[c];if(!Number.isInteger(l.ac)||!Number.isInteger(l.re)||l.ac<0||l.re!==l.ac+1)e.push(`Row ${i+1} ${c}: Re must equal Ac + 1 (single sampling)`)}});return e}
const activePlan=()=>{const p=S.plans.find(x=>x.active&&x.current);if(!p)return null;const v=p.versions[p.current];return{id:p.id,name:p.name,version:p.current,...v}};
/* ---------- state / router ---------- */
let D=null,dirty=false,errs=[],okMsg='',busy=false,DN='',LE=null,PE=null;
const NAV=[['#/','📊','Manager Panel','لوحة المدير'],['#/new','➕','New Inspection','فحص جديد'],['#/archive','🗂','Inspection Archive','أرشيف الفحوصات'],['#/charts','🥧','Pie Charts','الرسوم الدائرية'],['#/monthly','📅','Monthly Quality Report','تقرير الجودة الشهري'],['#/compare','⚖️','Customer vs Factory Report','مقارنة تقرير العميل بالمصنع'],['#/cmpcust','📈','Customer Comparison','مقارنة العملاء'],['#/library','📚','Defect Library','مكتبة العيوب'],['#/customers','🏢','Customers','العملاء'],['#/reports','📄','Reports','التقارير'],['#/aql','🛠','AQL Plans','خطط AQL'],['#/cloud','☁️','My Cloud','سحابتي'],['#/inspset','🛠','Inspection Settings','إعدادات الفحص'],['#/settings','⚙️','General Settings','الإعدادات العامة']];
let ROUTE=(location.hash&&location.hash.startsWith('#/'))?location.hash:'#/';
let SCROLL_TO_TOP=false;
const ROUTE_SCROLL=new Map();
function captureScrollState(){
  const items=[];document.querySelectorAll('#view *').forEach((el)=>{
    const st=getComputedStyle(el),scrollable=(el.scrollHeight>el.clientHeight+2)&&(/auto|scroll/.test(st.overflowY)||el.classList.contains('liblist'));
    if(scrollable){const cls=[...el.classList].sort().join('.');const same=[...document.querySelectorAll('#view *')].filter(x=>[...x.classList].sort().join('.')===cls);items.push({cls,index:same.indexOf(el),top:el.scrollTop,left:el.scrollLeft})}
  });
  return{windowY:window.scrollY,windowX:window.scrollX,items};
}
function restoreScrollState(snap){if(!snap)return;requestAnimationFrame(()=>{
  window.scrollTo(snap.windowX||0,snap.windowY||0);
  (snap.items||[]).forEach(it=>{const els=[...document.querySelectorAll('#view *')].filter(x=>[...x.classList].sort().join('.')===it.cls);const el=els[it.index];if(el){el.scrollTop=it.top;el.scrollLeft=it.left}});
});}
/* ---- keep user input when switching language (v24) ---- */
let VS={};const keepView=(k,init)=>VS[k]||(VS[k]=init);
const langFields=()=>[...document.querySelectorAll('#app input,#app select,#app textarea')].filter(e=>!['file','button','submit','password'].includes(e.type));
const langSnap=()=>langFields().map(e=>({t:e.tagName+':'+(e.type||''),v:e.value,c:e.checked}));
const langRestore=snap=>{const els=langFields();if(els.length!==snap.length||els.some((e,i)=>e.tagName+':'+(e.type||'')!==snap[i].t))return;
  const live=!['new','i'].includes(ROUTE.split('/')[1]||'');
  els.forEach((e,i)=>{const o=snap[i];if(e.type==='checkbox'||e.type==='radio'){if(e.checked!==o.c){e.checked=o.c;if(live)e.dispatchEvent(new Event('change',{bubbles:true}))}}
    else if(e.value!==o.v){e.value=o.v;if(live){e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}}})};
function switchLang(){const snap=langSnap();S.lang=S.lang==='en'?'ar':'en';LS.set('lang',S.lang);render();langRestore(snap)}
function go(x){if(x===ROUTE)return;
  if(dirty&&!confirm(L('You have unsaved changes. Leave without saving?','لديك تغييرات غير محفوظة. المغادرة دون حفظ؟')))return;
  ROUTE_SCROLL.set(ROUTE,captureScrollState());dirty=false;ROUTE=x;SCROLL_TO_TOP=true;
  try{history.pushState({meyar:true,route:x,from:ROUTE},'',x)}catch(e){}
  route();
}
function syncRouteFromHistory(){const x=(location.hash&&location.hash.startsWith('#/'))?location.hash:'#/';if(x===ROUTE)return;
  if(dirty&&!confirm(L('You have unsaved changes. Leave without saving?','لديك تغييرات غير محفوظة. المغادرة دون حفظ؟'))){try{history.pushState({meyar:true,route:ROUTE},'',ROUTE)}catch(e){}return}
  dirty=false;ROUTE=x;route();restoreScrollState(ROUTE_SCROLL.get(x));
}
try{history.replaceState({meyar:true,route:ROUTE,from:null},'',ROUTE)}catch(e){}
window.addEventListener('popstate',syncRouteFromHistory);
window.addEventListener('hashchange',syncRouteFromHistory);
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="#/"]');if(a){e.preventDefault();go(a.getAttribute('href'))}});
function newIns(){return{id:insId(),createdAt:Date.now(),status:'draft',orderNo:'',customer:'',model:'',color:'',garmentType:'jacket',orderQty:'',lotSize:'',sampleSize:'',date:nowLocal(),notes:'',comment:'',poCustomer:'',item:'',style:'',salesOrder:'',actualQty:'',packingPct:'',startCode:'',endCode:'',rows:[],props:{},secs:{},defs:[],itemPhotos:[],defPhotos:[],measOn:false,meas:{},measSamples:'',measSizes:'',createdBy:S.me?S.me.id:'',inspectorName:S.me?S.me.name:'',result:null,decisionNote:'',aql:null,history:[]}}
const MGRNAV=['#/','#/aql','#/settings','#/monthly','#/compare','#/cmpcust'],isMgr=()=>!!(S.me&&S.me.role==='manager'),mine=i=>!!S.me&&(i.createdBy===S.me.id||i.inspectorName===S.me.name);
async function route(){VS={};const parts=ROUTE.split('/');const a=parts[1]||'',b=parts.slice(2).join('/');
  if(S.me&&!isMgr()&&['','aql','settings','compare','monthly','cmpcust'].includes(a)){ROUTE='#/new';return route()}
  if(a==='files'){ROUTE='#/archive';return route()}
  if(a==='new'){D=newIns();dirty=false;errs=[];okMsg=''}
  else if(a==='i'){const f=S.ins.find(i=>i.id===b);D=f&&(isMgr()||mine(f))?structuredClone(f):null;if(D&&D.garmentType==='both')D.garmentType='suit';dirty=false;errs=[];okMsg='';DN=''}
  render()}
window.addEventListener('hashchange',()=>{if(location.hash&&location.hash!==ROUTE)go(location.hash)});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
/* live update of the derived parts (packing %, AQL sample, AQL columns, totals, result) WITHOUT touching inputs, so typing is never interrupted */
let liveT=null;function softRender(){clearTimeout(liveT);liveT=setTimeout(liveUpdate,250)}
function liveUpdate(){if(!D||!EDIT.includes(D.status)||!(ROUTE.startsWith('#/new')||ROUTE.startsWith('#/i/')))return;
  const fresh=vIns();fresh.querySelectorAll('[data-live]').forEach(n=>{const k=n.getAttribute('data-live'),old=document.querySelector('#view [data-live="'+k+'"]');if(!old||old.contains(document.activeElement))return;old.replaceWith(n)})}
/* ---------- shared widgets ---------- */
const bars=(items,max=5)=>{const t=items.slice(0,max);const m=Math.max(1,...t.map(i=>i.value));return t.length?h('div',{class:'bars'},t.map(i=>h('div',{class:'bar'},h('span',{},i.label),h('div',{class:'bt'},h('i',{style:`width:${i.value/m*100}%`})),h('b',{},i.value)))):h('p',{class:'hint'},L('No data.','لا توجد بيانات.'))};
function rank(rows,key,f){const m={};rows.forEach(r=>{const k=key(r);if(k)m[k]=(m[k]||0)+num(r[f])});return Object.entries(m).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value)}
const libOf=id=>S.lib.find(x=>x.id===id);
const defName=d=>{const l=libOf(d.defectId);const en=l?l.nameEn:d.nameEn,ar=l?l.nameAr:d.nameAr;return`${d.code||''} ${S.lang==='ar'?(ar||en):en}`.trim()||d.defectId};
const fld=(label,get,set,attrs)=>h('label',{},label,h('input',Object.assign({},attrs,{value:get()??'',onInput:e=>{set(e.target.value)}})));
function compress(file,max=1280){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{const r=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*r);c.height=Math.round(im.height*r);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL('image/jpeg',.8))};im.onerror=()=>rej(new Error('img'));im.src=u})}
function pickOne(cb){const i=document.createElement('input');i.type='file';i.accept='image/*';i.onchange=async()=>{const f=i.files[0];if(!f)return;try{cb(await compress(f,500))}catch(e){alert(L('Could not read image.','تعذرت قراءة الصورة.'))}};i.click()}
function photoStampDate(d,fmt){const p=n=>String(n).padStart(2,'0');if(fmt==='us')return `${p(d.getMonth()+1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;if(fmt==='iso')return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`}
/* The stamp is still burned into the picture, but its text and the pixels it covers are also kept inside the JPEG file (invisible COM segment).
   That lets crop/rotate take the stamp off, change the picture, and draw the SAME stamp again — so cropping never cuts the stamp. */
const STAMP_TAG='AQLSTAMP1:';
function jpegSetMeta(url,meta){try{const enc=new TextEncoder().encode(STAMP_TAG+JSON.stringify(meta));if(enc.length>65000)return url;const bin=atob(url.slice(url.indexOf(',')+1)),n=bin.length;
  if(bin.charCodeAt(0)!==0xFF||bin.charCodeAt(1)!==0xD8)return url;const out=new Uint8Array(n+enc.length+4),len=enc.length+2;out[0]=0xFF;out[1]=0xD8;out[2]=0xFF;out[3]=0xFE;out[4]=len>>8;out[5]=len&255;out.set(enc,6);
  for(let k=2;k<n;k++)out[6+enc.length+k-2]=bin.charCodeAt(k);let b='';for(let k=0;k<out.length;k+=0x8000)b+=String.fromCharCode.apply(null,out.subarray(k,k+0x8000));return 'data:image/jpeg;base64,'+btoa(b)}catch(e){return url}}
function jpegGetMeta(url){try{if(typeof url!=='string'||!/^data:image\/jpe?g;base64,/i.test(url))return null;const i=url.indexOf(',')+1,bin=atob(url.slice(i,i+4*Math.ceil(70000/3))),b=Uint8Array.from(bin,ch=>ch.charCodeAt(0));let p=2;
  while(p+4<=b.length&&b[p]===0xFF){const m=b[p+1];if(m===0xDA)break;const len=(b[p+2]<<8)|b[p+3];if(m===0xFE){const t=new TextDecoder().decode(b.subarray(p+4,p+2+len));if(t.startsWith(STAMP_TAG))return JSON.parse(t.slice(STAMP_TAG.length))}p+=2+len}return null}catch(e){return null}}
function drawStamp(c,lines,pos){const x=c.getContext('2d');x.setTransform(1,0,0,1,0,0);const scale=Math.max(1,Math.min(c.width,c.height)/720),pad=Math.round(12*scale),font=Math.max(13,Math.round(Math.min(c.width,c.height)*.027));x.font=`600 ${font}px Arial`;
  const lineH=Math.round(font*1.42),w=Math.ceil(Math.max(...lines.map(t=>x.measureText(t).width))+pad*2),hh=Math.ceil(lineH*lines.length+pad*1.5),left=Math.round(pos.endsWith('l')?pad:c.width-w-pad),top=Math.round(pos.startsWith('t')?pad:c.height-hh-pad);
  const pc=document.createElement('canvas');pc.width=w;pc.height=hh;pc.getContext('2d').drawImage(c,left,top,w,hh,0,0,w,hh);
  x.fillStyle='rgba(0,0,0,.68)';x.fillRect(left,top,w,hh);x.fillStyle='#fff';x.textBaseline='top';lines.forEach((t,i)=>x.fillText(t,left+pad,top+pad*.65+i*lineH));
  return{rect:{x:left,y:top,w,h:hh},patch:pc.toDataURL('image/jpeg',.9)}}
const stampedUrl=(c,lines,pos)=>{const r=drawStamp(c,lines,pos);return jpegSetMeta(c.toDataURL('image/jpeg',.9),{v:1,lines,pos,W:c.width,H:c.height,rect:r.rect,patch:r.patch})};
function unstampCanvas(c,meta){return new Promise(res=>{const im=new Image();im.onload=()=>{c.getContext('2d').drawImage(im,meta.rect.x,meta.rect.y);res(c)};im.onerror=()=>res(c);im.src=meta.patch})}
function stampPhoto(data){const cfg=S.settings||{};if(cfg.photoStampEnabled===false)return data;return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{try{const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
  const lines=['AQL INSPECTION',photoStampDate(new Date(),cfg.photoStampFormat||'eu')];if(cfg.photoStampInspector!==false&&(S.me?.name||S.settings?.inspectorName))lines.push(`${L('Inspector','المفتش')}: ${S.me?.name||S.settings.inspectorName}`);if(cfg.photoStampOrder!==false&&D?.orderNo)lines.push(`${L('Order','الطلبية')}: ${D.orderNo}`);
  resolve(stampedUrl(c,lines,cfg.photoStampPosition||'br'))}catch(e){reject(e)}};im.onerror=()=>reject(new Error('stamp'));im.src=data})}
function pickPhotos(cam,add){const i=document.createElement('input');i.type='file';i.accept='image/*';if(cam)i.capture='environment';i.multiple=!cam;
  i.onchange=async()=>{for(const f of i.files){if(!f.type.startsWith('image/')){alert(L('Only images are allowed.','يُسمح بالصور فقط.'));continue}
    if(f.size>20*1024*1024){alert(L('Image larger than 20 MB.','الصورة أكبر من 20 ميجابايت.'));continue}
    try{const compressed=await compress(f);add(await stampPhoto(compressed))}catch(e){alert(L('Could not read or stamp image.','تعذرت قراءة الصورة أو إضافة الطابع.'))}}};i.click()}
const photoStrip=(photos,onDel,ro,onAdd)=>h('div',{},h('div',{class:'thumbs'},photos.map((p,i)=>h('div',{class:'thumb'},h('img',{src:p,onClick:()=>window.open(p)}),ro?null:h('button',{type:'button',onClick:()=>onDel(i)},'×')))),
  ro?null:h('div',{class:'row wrap',style:'margin-top:6px'},h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(true,onAdd)},'📷 '+L('Camera','الكاميرا')),h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(false,onAdd)},'🖼 '+L('Gallery','المعرض'))));
/* ---------- shell ---------- */
function render(){document.documentElement.lang=S.lang;document.documentElement.dir=S.lang==='ar'?'rtl':'ltr';
  if(!S.members.length){$('#app').replaceChildren(vSetup());return}if(!S.me){$('#app').replaceChildren(vLogin());return}
  const navs=NAV.filter(n=>isMgr()||!MGRNAV.includes(n[0])),outBtn=h('button',{class:'btn ghost s',onClick:signOut},'⎋ '+L('Sign out','خروج'));
  const scrollSnapshot=LIB_EDIT_SCROLL||captureScrollState(),hash=ROUTE,a='#/'+(hash.split('/')[1]||'');
  const curNav=NAV.find(n=>n[0]===(a==='#/i'?'#/archive':a==='#/report'?'#/reports':a))||NAV[0];
  const sw=h('button',{class:'btn ghost s',onClick:()=>{switchLang()}},S.lang==='en'?'العربية':'English');
  const link=n=>h('a',{href:n[0],class:n===curNav?'on':''},h('span',{},n[1]),' ',L(n[2],n[3]));
  const name='MEYAR',fac=S.settings.factoryName;
  const v=({'':vPanel,new:vIns,i:vIns,archive:()=>vList(false),reports:()=>vList(true),charts:vCharts,monthly:vMonthly,compare:vCompare,cmpcust:vCmpCust,library:vLib,customers:vCustomers,aql:vAql,settings:vSettings,inspset:vInspSet,report:vReport,cloud:vCloud})[hash.split('/')[1]||'']||vDash;
  $('#app').replaceChildren(h('div',{class:'shell'},
    h('aside',{class:'side'},h('div',{class:'brand'},h('div',{class:'brand-wordmark',dir:'ltr'},h('img',{src:'./icons/meyar-192.png',alt:'M'}),h('b',{},'EYAR')),h('small',{},fac)),navs.map(link),h('div',{style:'margin-top:auto;display:grid;gap:8px'},themeButton(),h('small',{style:'color:#8fa6bb;padding:0 8px'},S.me.name+' · '+(isMgr()?L('Manager','مدير'):L('Inspector','مفتش'))),sw,outBtn)),
    h('div',{class:'main'+(hash.split('/')[1]==='report'?' inspection-report-route':'')},h('header',{class:'top'},(ROUTE!=='#/'&&!ROUTE.startsWith('#/report/')?h('button',{class:'top-action page-back',type:'button','aria-label':L('Back','رجوع'),title:L('Back','رجوع'),onClick:()=>{if(history.state&&history.state.from)history.back();else go('#/')}},'←'):null),h('button',{class:'menu-toggle',type:'button','aria-label':'Open navigation',title:L('Menu','القائمة'),onClick:()=>{const m=$('#top-menu');if(m)m.classList.toggle('open')}},'☰'),cloudChipEl(),h('button',{class:'top-action lang-action',type:'button',title:L('Change language','تغيير اللغة'),onClick:()=>{switchLang()}},'🌐'),h('button',{class:'top-action logout-action',type:'button',title:L('Sign out','تسجيل الخروج'),onClick:signOut},'↪'),h('div',{class:'top-brand',dir:'ltr'},h('img',{src:'./icons/meyar-192.png',alt:'MEYAR'}),h('span',{},'MEYAR')),h('span',{id:'autosave-status',class:'autosave-status'},dirty?L('Unsaved changes','تغييرات غير محفوظة'):L('Saved','تم الحفظ'))),h('nav',{id:'top-menu',class:'top-menu'},[...navs.map(link),h('div',{class:'menu-theme'},themeButton())]),h('main',{id:'view'},pagePdfBar(),v()))));
  if(SCROLL_TO_TOP){SCROLL_TO_TOP=false;requestAnimationFrame(()=>scrollTo(0,0))}else restoreScrollState(scrollSnapshot);if(!LE)LIB_EDIT_SCROLL=null}
/* ---------- dashboard ---------- */
function vDash(){const done=S.ins.filter(i=>['approved','rejected'].includes(i.status));const c=s=>S.ins.filter(i=>s.includes(i.status)).length;const defs=done.flatMap(i=>i.defs||[]);const sum=k=>defs.reduce((a,d)=>a+num(d[k]),0);
  const M=[[L('Completed inspections','الفحوصات المكتملة'),done.length],[L('Accepted orders','الطلبيات المقبولة'),c(['approved'])],[L('Rejected orders','الطلبيات المرفوضة'),c(['rejected'])],[L('Awaiting review','بانتظار المراجعة'),c(['pending_review'])],[L('In progress','قيد التنفيذ'),c(['draft','in_progress'])],[L('Defect occurrences','مرات حدوث العيوب'),sum('occurrences')],[L('Affected pieces','القطع المتأثرة'),sum('pieces')]];
  const nm=r=>defs.find(d=>d.defectId===r.label);const lab=i=>({...i,label:defName(nm(i)||{defectId:i.label})});
  return h('div',{},h('div',{class:'grid'},M.map(([l,v])=>h('div',{class:'card metric'},h('span',{},l),h('b',{},v)))),
    h('p',{class:'hint'},L('Occurrences and affected pieces are separate measures and are never added together. Defect figures include approved and rejected inspections only.','مرات الحدوث والقطع المتأثرة مقياسان منفصلان ولا يُجمعان. أرقام العيوب تشمل الفحوصات المعتمدة والمرفوضة فقط.')),
    S.ins.length?null:h('div',{class:'card empty'},h('h2',{},L('No inspections yet','لا توجد فحوصات بعد')),h('p',{class:'hint'},L('Start with New Inspection. All values here are calculated from your saved records.','ابدأ بـ«فحص جديد». كل القيم هنا محسوبة من سجلاتك المحفوظة.'))),
    h('div',{class:'two'},h('div',{class:'card'},h('h3',{},L('Top 5 defects by occurrences','أعلى 5 عيوب حسب مرات الحدوث')),bars(rank(defs,d=>d.defectId,'occurrences').map(lab))),
      h('div',{class:'card'},h('h3',{},L('Top 5 defects by affected pieces','أعلى 5 عيوب حسب القطع المتأثرة')),bars(rank(defs,d=>d.defectId,'pieces').map(lab)))))}
/* ---------- archive / reports list ---------- */
/* ---------- archive folders: customer > inspection type > PO > reports (+ ZIP download for laptop) ---------- */
const ARCH={view:'folders',c:null,g:null,t:null};
const archGarKey=i=>GT.includes(i.garmentType)?i.garmentType:(String(i.garmentType||'').trim()||'none');
const archGarName=k=>k==='none'?L('Unspecified garment','قطعة غير محددة'):gName(k);
const archTypeKey=i=>i.inspType==='final'?'final':i.inspType==='prefinal'?'prefinal':'none';
const archTypeName=k=>k==='final'?L('Final','فاينل'):k==='prefinal'?L('Pre-Final','بري فاينل'):L('Unspecified type','نوع غير محدد');
const archSafe=s=>String(s||'').replace(/[\\\/:*?"<>|\r\n]+/g,'_').replace(/\s+/g,' ').trim().slice(0,80)||'-';
const archFile=i=>{const res=['approved','rejected'].includes(i.status)?(i.result==='accepted'?'PASS':'FAIL'):'PENDING';return 'AQL-Inspection-Report-'+archSafe(i.orderNo||i.id).replace(/\s+/g,'_')+'-'+archSafe(i.id).replace(/\s+/g,'_')+'-'+res+'.pdf'};
const archDl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)};
const archBusy=async(b,fn)=>{const t=b.textContent;b.disabled=true;try{await fn(m=>{b.textContent=m})}catch(e){alert(L('Export failed: ','فشل التصدير: ')+(e&&e.message||e))}b.disabled=false;b.textContent=t};
async function archZip(items,zipName,say){const lib=await loadFflate(),files={},used=new Set();let k=0;
  for(const i of items){say('⏳ '+(++k)+'/'+items.length);const blob=await makePdf(i);
    let path=archSafe(i.customer||L('No customer','بدون عميل'))+'/'+archSafe(archGarName(archGarKey(i)))+'/'+archSafe(archTypeName(archTypeKey(i)))+'/'+archSafe(i.orderNo||L('No PO','بدون PO'))+'/'+archFile(i);
    while(used.has(path))path=path.replace(/\.pdf$/,'_2.pdf');used.add(path);
    files[path]=[new Uint8Array(await blob.arrayBuffer()),{level:0}]}
  say('📦 …');const z=lib.zipSync(files);archDl(new Blob([z],{type:'application/zip'}),zipName);await audit('archive_zip_downloaded','-',{n:items.length,name:zipName})}
const archZipBtn=(items,name)=>items.length?h('button',{type:'button',class:'btn s p fold-dl',title:L('Download everything in this folder as one ZIP file (same folder structure inside)','تحميل كل اللي في الفولدر ده في ملف ZIP واحد (بنفس ترتيب الفولدرات)'),onClick:e=>{e.preventDefault();e.stopPropagation();archBusy(e.currentTarget,say=>archZip(items,name+'.zip',say))}},'⬇ '+L('Download','تحميل')):null;
const archCount=rows=>{const ok=rows.filter(i=>i.status==='approved'&&i.result==='accepted').length,bad=rows.filter(i=>i.status==='rejected'||(i.status==='approved'&&i.result!=='accepted')).length;return rows.length+' '+L('reports','تقرير')+(rows.length?' · ✅ '+ok+' · ❌ '+bad:'')};
const archFolder=(icon,title,sub,onOpen,extra)=>h('div',{class:'fold',role:'button',tabindex:'0',onClick:onOpen,onKeydown:e=>{if(e.key==='Enter')onOpen()}},h('div',{class:'fold-ic'},icon),h('div',{class:'fold-tx'},h('b',{},title),h('span',{class:'hint'},sub)),extra||null);
function archReportRow(i,toTrash){
  return h('div',{class:'card item arch',onClick:()=>go('#/i/'+i.id)},
    h('div',{},h('b',{},i.id),' · '+(i.orderNo||''),h('div',{class:'hint'},`${i.model||''} · ${i.garmentType||''} · ${i.inspectorName||''} · ${fmtDate(i.date||i.createdAt)}`)),
    h('span',{style:'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end'},rnd(i)>1?h('span',{class:'badge'},L('Re-insp. ','إعادة ')+rnd(i)):null,msOt(i)==='ot'?h('span',{class:'badge ot'},'⏱ '+L('Overtime','أوفر تايم')):null,h('span',{class:'badge '+i.status},stL(i.status))),
    h('span',{class:'arch-btns'},
      h('button',{type:'button',class:'btn s p',onClick:e=>{e.stopPropagation();go('#/i/'+i.id)}},'📂 '+L('Open','فتح')),
      h('button',{type:'button',class:'btn s',onClick:e=>{e.stopPropagation();archBusy(e.currentTarget,async say=>{say('⏳');archDl(await makePdf(i),archFile(i));await audit('report_pdf_downloaded',i.id)})}},'⬇ '+L('PDF to laptop','تحميل PDF')),
      (isMgr()||(mine(i)&&EDIT.includes(i.status)))?h('button',{type:'button',class:'btn s d',onClick:e=>{e.stopPropagation();toTrash(i)}},'🗑 '+L('Delete','مسح')):null))}
function archFolders(rows,o){
  const groups=new Map(),add=(n,k)=>{if(!groups.has(k))groups.set(k,{k,n,rows:[]});return groups.get(k)};
  if(isMgr()&&!o.filtered)customerList().forEach(n=>add(n,norm(n)||n));
  rows.forEach(i=>{const n=String(i.customer||'').trim();add(n||L('No customer','بدون عميل'),n?(norm(n)||n):'_none').rows.push(i)});
  const cur=ARCH.c?(groups.get(ARCH.c.k)||{k:ARCH.c.k,n:ARCH.c.n,rows:[]}):null;
  const gRows=cur&&ARCH.g?cur.rows.filter(i=>archGarKey(i)===ARCH.g):null;
  const tRows=gRows&&ARCH.t?gRows.filter(i=>archTypeKey(i)===ARCH.t):null;
  const cb=(t,fn)=>h('button',{type:'button',class:'btn s',onClick:fn},t),sep=()=>h('span',{class:'hint'},'›');
  const crumb=[cb('🗂 '+L('All customers','كل العملاء'),()=>{ARCH.c=null;ARCH.g=null;ARCH.t=null;o.fill()})];
  if(cur)crumb.push(sep(),cb('📁 '+cur.n,()=>{ARCH.g=null;ARCH.t=null;o.fill()}));
  if(cur&&ARCH.g)crumb.push(sep(),cb('📁 '+archGarName(ARCH.g),()=>{ARCH.t=null;o.fill()}));
  if(cur&&ARCH.g&&ARCH.t)crumb.push(sep(),cb('📁 '+archTypeName(ARCH.t),()=>{}));
  const scope=tRows||gRows||(cur?cur.rows:rows),stamp=new Date().toISOString().slice(0,10);
  const zname=archSafe(cur?cur.n:'MEYAR-Archive')+(ARCH.g?'_'+archSafe(archGarName(ARCH.g)):'')+(ARCH.t?'_'+archSafe(archTypeName(ARCH.t)):'')+'_'+stamp;
  const head=h('div',{class:'fold-crumb'},h('div',{class:'row wrap',style:'gap:6px;align-items:center'},crumb),archZipBtn(scope,zname));
  let body;
  if(!cur){
    const list=[...groups.values()].sort((a,b)=>a.n.localeCompare(b.n));
    body=list.length?h('div',{class:'fold-grid'},list.map(g=>archFolder('📁',g.n,archCount(g.rows),()=>{ARCH.c={k:g.k,n:g.n};ARCH.g=null;ARCH.t=null;o.fill()},archZipBtn(g.rows,archSafe(g.n)+'_'+stamp)))):h('div',{class:'card empty'},h('h2',{},L('No customers or inspections yet','لا يوجد عملاء أو فحوصات بعد')));
  }else if(!ARCH.g){
    const ks=[...new Set(cur.rows.map(archGarKey))].sort((a,b)=>{const x=GT.indexOf(a),y=GT.indexOf(b);return(x<0?99:x)-(y<0?99:y)||String(a).localeCompare(String(b))});
    body=ks.length?h('div',{class:'fold-grid'},ks.map(k=>{const rr=cur.rows.filter(i=>archGarKey(i)===k);return archFolder(k==='jacket'?'🧥':k==='trousers'?'👖':k==='suit'?'🤵':k==='vest'?'🦺':k==='shorts'?'🩳':'👕',archGarName(k),archCount(rr),()=>{ARCH.g=k;ARCH.t=null;o.fill()},archZipBtn(rr,archSafe(cur.n)+'_'+archSafe(archGarName(k))+'_'+stamp))})):h('div',{class:'card empty'},h('h2',{},L('No reports for this customer yet','لا توجد تقارير لهذا العميل بعد')));
  }else if(!ARCH.t){
    const keys=['prefinal','final'];if(gRows.some(i=>archTypeKey(i)==='none'))keys.push('none');
    body=h('div',{class:'fold-grid'},keys.map(k=>{const rr=gRows.filter(i=>archTypeKey(i)===k);return archFolder(k==='final'?'✅':k==='prefinal'?'🧵':'❔',archTypeName(k),archCount(rr),()=>{ARCH.t=k;o.fill()},archZipBtn(rr,archSafe(cur.n)+'_'+archSafe(archGarName(ARCH.g))+'_'+archSafe(archTypeName(k))+'_'+stamp))}));
  }else{
    const pos=new Map();tRows.forEach(i=>{const p=String(i.orderNo||'').trim()||L('No PO','بدون PO'),k=norm(p)||p;if(!pos.has(k))pos.set(k,{p,rows:[]});pos.get(k).rows.push(i)});
    const list=[...pos.values()].sort((a,b)=>(b.rows[0].createdAt||0)-(a.rows[0].createdAt||0));
    body=list.length?h('div',{class:'list'},list.map(g=>h('details',{class:'fold-po card',open:list.length===1},
      h('summary',{},h('span',{class:'fold-ic'},'📦'),h('span',{class:'fold-tx'},h('b',{},'PO '+g.p),h('span',{class:'hint'},archCount(g.rows))),archZipBtn(g.rows,archSafe(cur.n)+'_'+archSafe(archGarName(ARCH.g))+'_'+archSafe(archTypeName(ARCH.t))+'_'+archSafe(g.p)+'_'+stamp)),
      h('div',{class:'list'},g.rows.map(i=>archReportRow(i,o.toTrash)))))):h('div',{class:'card empty'},h('h2',{},L('No reports in this folder yet','لا توجد تقارير في هذا الفولدر بعد')));
  }
  return [head,body]}
function vList(rep){const F=keepView('list'+(rep?'R':'A'),{q:'',st:[],g:[],cu:[],ins:[],rd:[],ty:[],po:[],mo:[],mn:[],wk:[],dy:[],ot:[]});const box=h('div',{class:'list'});
  const tb=rep?null:h('button',{type:'button',class:'btn s',onClick:()=>{F.trash=!F.trash;fill()}}),vb=rep?null:h('button',{type:'button',class:'btn s',onClick:()=>{ARCH.view=ARCH.view==='folders'?'list':'folders';fill()}}),banner=h('p',{class:'hint'}),
    emptyBtn=h('button',{type:'button',class:'btn s d',onClick:async()=>{if(!S.trash.length)return;if(!confirm(L('Permanently delete everything in the trash?','حذف كل محتويات السلة نهائياً؟')))return;const n=S.trash.length;for(const x of S.trash)await DB.del('inspections',x.id);await audit('trash_emptied','-',{n});await loadAll();fill()}},'🗑 '+L('Empty trash','إفراغ السلة'));
  const fill=()=>{const trash=!rep&&!!F.trash;
    if(tb){tb.textContent=trash?'← '+L('Back to archive','رجوع للأرشيف'):'🗑 '+L('Trash','سلة المحذوفات')+' ('+S.trash.filter(x=>isMgr()||mine(x)).length+')';banner.textContent=trash?L('Items in the trash are deleted permanently after 30 days.','العناصر في السلة تُحذف نهائياً بعد 30 يوماً.'):'';banner.style.display=trash?'':'none';emptyBtn.style.display=trash&&isMgr()&&S.trash.length?'':'none'}
    if(vb){vb.textContent=ARCH.view==='folders'?'📋 '+L('List view','عرض قائمة'):'🗂 '+L('Folder view','عرض فولدرات');vb.style.display=trash?'none':''}
    const rows=(trash?S.trash:S.ins).filter(i=>(isMgr()||mine(i))&&msInC(F.cu,i.customer)&&msIn(F.ins,i.inspectorName)&&(!rep||['approved','rejected','pending_review'].includes(i.status))&&msIn(F.st,i.status)&&(!F.rd.length||F.rd.some(v=>rndMatch(rnd(i),v)))&&msIn(F.ty,i.inspType)&&msG(F.g,i)&&msIn(F.po,String(i.orderNo||'').trim())&&msIn(F.mo,String(i.model||'').trim())&&msIn(F.mn,msMon(i))&&msIn(F.wk,msWeek(i))&&msIn(F.dy,msDay(i))&&msIn(F.ot,msOt(i))&&norm(`${i.id}${i.orderNo}${i.customer}${i.model}${i.color}${i.inspectorName}`).includes(norm(F.q)));
    const toTrash=async i=>{if(!confirm(L('Move inspection '+i.id+' to the trash? You can restore it within 30 days.','نقل الفحص '+i.id+' إلى سلة المحذوفات؟ يمكنك استعادته خلال 30 يوماً.')))return;try{i.deletedAt=Date.now();i.updatedAt=Date.now();i.deletedBy=(S.me&&S.me.name)||'';await DB.put('inspections',i);await audit('inspection_trashed',i.id,{status:i.status,order:i.orderNo});await loadAll();fill()}catch(err){alert(L('Could not delete.','تعذر المسح.'))}};
    const restore=async i=>{try{delete i.deletedAt;delete i.deletedBy;i.updatedAt=Date.now();await DB.put('inspections',i);await audit('inspection_restored',i.id,{});await loadAll();fill()}catch(err){alert(L('Could not restore.','تعذرت الاستعادة.'))}};
    const purge=async i=>{if(!confirm(L('Permanently delete '+i.id+'? This cannot be undone.','حذف '+i.id+' نهائياً؟ لا يمكن التراجع عن ذلك.')))return;try{await DB.del('inspections',i.id);await audit('inspection_deleted',i.id,{status:i.status,order:i.orderNo});await loadAll();fill()}catch(err){alert(L('Could not delete.','تعذر المسح.'))}};
    if(!rep&&!trash&&ARCH.view==='folders'){const filtered=!!F.q||Object.values(F).some(v=>Array.isArray(v)&&v.length);box.replaceChildren(...archFolders(rows,{filtered,toTrash,fill}));return}
    box.replaceChildren(...(rows.length?rows.map(i=>h('div',{class:'card item'+(rep?'':' arch'),onClick:()=>{if(!trash)go(rep?'#/report/'+i.id:'#/i/'+i.id)}},
      h('div',{},h('b',{},i.id),' · '+i.orderNo,h('div',{class:'hint'},`${i.customer||''} · ${i.model||''} · ${i.garmentType} · ${i.inspectorName||''}`),trash?h('div',{class:'hint'},L('Deleted','حُذف')+' '+new Date(i.deletedAt).toLocaleDateString()+(i.deletedBy?' · '+i.deletedBy:'')):null),
      h('span',{style:'display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end'},rnd(i)>1?h('span',{class:'badge'},L('Re-insp. ','إعادة ')+rnd(i)):null,msOt(i)==='ot'?h('span',{class:'badge ot'},'⏱ '+L('Overtime','أوفر تايم')):null,h('span',{class:'badge '+i.status},stL(i.status))),
      rep?null:h('span',{class:'arch-btns'},
        trash?[h('button',{type:'button',class:'btn s p',onClick:e=>{e.stopPropagation();restore(i)}},'♻ '+L('Restore','استعادة')),isMgr()?h('button',{type:'button',class:'btn s d',onClick:e=>{e.stopPropagation();purge(i)}},'✖ '+L('Delete forever','حذف نهائي')):null]
        :[h('button',{type:'button',class:'btn s p',onClick:e=>{e.stopPropagation();go('#/i/'+i.id)}},'📂 '+L('Open','فتح')),
          (isMgr()||(mine(i)&&EDIT.includes(i.status)))?h('button',{type:'button',class:'btn s d',onClick:e=>{e.stopPropagation();toTrash(i)}},'🗑 '+L('Delete','مسح')):null]))):[h('div',{class:'card empty'},h('h2',{},trash?L('Trash is empty','السلة فارغة'):L('No inspections found','لا توجد فحوصات')))]))};
  fill();
  return h('div',{},rep?null:archTabs('archive'),rep?null:pdfImportCard(),h('div',{class:'row wrap'},h('input',{placeholder:L('Search ID, order, customer, model, inspector','ابحث بالرقم أو الطلبية أو العميل أو الموديل أو المفتش'),onInput:e=>{F.q=e.target.value;fill()}}),
    (()=>{const vis=()=>(F.trash?S.trash:S.ins).filter(i=>isMgr()||mine(i)),ch=()=>fill();return[
      msBtn(L('Status','الحالة'),()=>['draft','in_progress','pending_review','approved','rejected'].map(s=>[s,stL(s)]),F.st,ch),
      msBtn(L('Customer','العميل'),()=>customerList().map(c=>[c,c]),F.cu,ch),
      msBtn('PO',()=>msOptsOf(vis(),'po'),F.po,ch),
      msBtn(L('Model','الموديل'),()=>msOptsOf(vis(),'model'),F.mo,ch),
      msBtn(L('Month','الشهر'),()=>msOptsOf(vis(),'mon'),F.mn,ch),
      msBtn(L('Week','الأسبوع'),()=>msOptsOf(vis(),'wk'),F.wk,ch),
      msBtn(L('Day','اليوم'),()=>msOptsOf(vis(),'day'),F.dy,ch),
      msBtn(L('Day type','نوع اليوم'),OT_OPTS,F.ot,ch),
      msBtn(L('Garment','القطعة'),()=>GT.map(g=>[g,gName(g)]),F.g,ch),
      msBtn(L('Inspection No.','عدد الفحص'),RND_OPTS,F.rd,ch),
      msBtn(L('Inspection Type','نوع الفحص'),TYPE_OPTS,F.ty,ch),
      isMgr()?msBtn(L('Inspector','المفتش'),()=>inspectorList().map(c=>[c,c]),F.ins,ch):null,
      h('button',{type:'button',class:'btn s',onClick:()=>render()},'✖ '+L('Clear filters','مسح الفلاتر'))]})(),tb,vb),h('div',{class:'row wrap'},banner,emptyBtn),box)}
/* ---------- analytics ---------- */
/* ---------- pie charts ---------- */
const PIE_COLORS=['#2563eb','#f59e0b','#10b981','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#64748b'];
function pieCard(title,items,note){
  const data=items.filter(x=>x.value>0),tot=data.reduce((a,x)=>a+x.value,0);
  if(!tot)return h('div',{class:'card pie-card'},h('h3',{},title),h('p',{class:'hint'},L('No data for the selected filters.','لا توجد بيانات للفلاتر المحددة.')));
  let acc=0;const stops=data.map((x,k)=>{x.c=x.color||PIE_COLORS[k%PIE_COLORS.length];const a=acc/tot*100;acc+=x.value;return `${x.c} ${a}% ${acc/tot*100}%`});
  return h('div',{class:'card pie-card'},h('h3',{},title),note?h('p',{class:'hint'},note):null,
    h('div',{class:'pie-wrap'},h('div',{class:'pie',style:`background:conic-gradient(${stops.join(',')})`},h('span',{class:'pie-total'},String(tot))),
      h('ul',{class:'pie-leg'},data.map(x=>h('li',{},h('i',{style:'background:'+x.c}),h('span',{},x.label),h('b',{},x.value+' · '+Math.round(x.value/tot*100)+'%'))))))}
/* ---------- pie charts → A4 PDF with the factory logo and name (added 18 Nov 2026) ---------- */
function chartsPieSvg(items,size){const data=items.filter(x=>x.value>0),tot=data.reduce((a,x)=>a+x.value,0),R=size/2,ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('width',size);svg.setAttribute('height',size);svg.setAttribute('viewBox',`0 0 ${size} ${size}`);svg.style.flex='0 0 auto';
  const add=(tag,at)=>{const e=document.createElementNS(ns,tag);for(const k in at)e.setAttribute(k,at[k]);svg.append(e);return e},P=a=>`${(R+R*Math.cos(a)).toFixed(2)} ${(R+R*Math.sin(a)).toFixed(2)}`;let a0=-Math.PI/2;
  data.forEach((x,k)=>{const c=x.color||PIE_COLORS[k%PIE_COLORS.length],a1=a0+x.value/tot*2*Math.PI;
    if(data.length===1)add('circle',{cx:R,cy:R,r:R,fill:c});else add('path',{d:`M${R} ${R} L${P(a0)} A${R} ${R} 0 ${a1-a0>Math.PI?1:0} 1 ${P(a1)} Z`,fill:c});a0=a1});
  add('circle',{cx:R,cy:R,r:R*.5,fill:'#ffffff'});const t=add('text',{x:R,y:R+size*.06,'text-anchor':'middle','font-size':size*.18,'font-weight':'800',fill:'#1f2937'});t.textContent=String(tot);return svg}
function chartsCard(s){const data=s.i.filter(x=>x.value>0),tot=data.reduce((a,x)=>a+x.value,0);
  return h('div',{style:'border:1px solid #d7dee7;border-radius:6px;padding:8px 9px;min-height:200px'},h('div',{style:'font-weight:700;font-size:11px;color:#1f4e79'},s.t),s.n?h('div',{style:'font-size:8px;color:#64748b;margin-top:1px'},s.n):null,
    tot?h('div',{style:'display:flex;gap:9px;align-items:center;margin-top:8px'},chartsPieSvg(s.i,108),
      h('div',{style:'flex:1;min-width:0;display:grid;gap:3px'},data.map((x,k)=>h('div',{style:'display:flex;align-items:center;gap:5px;font-size:8.5px;line-height:1.25'},h('i',{style:`width:9px;height:9px;border-radius:2px;flex:0 0 auto;background:${x.color||PIE_COLORS[k%PIE_COLORS.length]}`}),h('span',{style:'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'},x.label),h('b',{style:'white-space:nowrap'},`${x.value} · ${Math.round(x.value/tot*100)}%`)))))
    :h('p',{style:'font-size:9px;color:#64748b;margin:12px 0'},L('No data for the selected filters.','لا توجد بيانات للفلاتر المحددة.')))}
async function chartsMakePdf(last,fdesc){
  if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true}),stage=h('div',{class:'stage',style:'position:fixed;left:-12000px;top:0;width:794px'});document.body.append(stage);
  const dir=S.lang==='ar'?'rtl':'ltr',pages=[];let page,grid;
  const room=()=>{const top=page.getBoundingClientRect().top;let m=0;[...page.children].forEach(c=>{m=Math.max(m,c.getBoundingClientRect().bottom-top)});return 1123-46-44-m};
  const newPage=first=>{page=h('div',{class:'rpage cmp-page',dir});stage.append(page);pages.push(page);if(!first)page.append(cmpLogo());if(first){page.append(analysisReportHeader(L('PIE CHARTS REPORT','تقرير الرسوم الدائرية'),[[L('Factory','المصنع'),S.settings.factoryName||'—'],[L('Period','الفترة'),analysisDateRange(F.from,F.to)],[L('Customer','العميل'),F.cu.length?F.cu.join('، '):L('All customers','كل العملاء')],[L('Garment','القطعة'),F.g.length?F.g.map(gName).join('، '):L('All garments','كل القطع')],[L('Report date','تاريخ التقرير'),new Date().toLocaleDateString(S.lang==='ar'?'ar-EG':'en-GB')]]),h('div',{style:'font-size:8.5px;color:#475569;margin:0 0 7px'},fdesc),
      h('div',{style:'display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:10px'},last.metrics.map(([l,v])=>h('div',{style:'border:1px solid #d7dee7;border-radius:6px;padding:7px 8px;min-height:44px'},h('div',{style:'font-size:8.5px;color:#64748b'},l),h('b',{style:'font-size:18px;color:#1f4e79'},String(v))))))}
    else page.append(h('div',{class:'cmp-run'},L('Pie charts report — continued','تقرير الرسوم الدائرية — تابع')));
    grid=h('div',{style:'display:grid;grid-template-columns:1fr 1fr;gap:9px'});page.append(grid)};
  try{try{await document.fonts.load("700 12px CalibriX");await document.fonts.ready}catch(e){}
    newPage(true);last.sets.forEach(s=>{const c=chartsCard(s);grid.append(c);if(room()<0){grid.removeChild(c);newPage(false);grid.append(c)}});
    pages.forEach((p,k)=>p.append(h('div',{class:'cmp-foot'},h('span',{},'Quality Department · قسم الجودة'),h('span',{},S.settings.factoryName||''),h('span',{},`Page ${k+1} / ${pages.length}`))));
    await new Promise(r=>setTimeout(r,100));
    for(let k=0;k<pages.length;k++){const c=await window.html2canvas(pages[k],{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});if(k)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.93),'JPEG',0,0,210,297,undefined,'FAST')}}
  finally{stage.remove()}
  return pdf.output('blob')}
async function chartsExport(btn,last,fdesc){const t=btn.textContent;btn.disabled=true;btn.textContent=L('Preparing…','جارٍ التجهيز…');
  try{const d=new Date(),p=n=>String(n).padStart(2,'0');cmpSaveBlob(await chartsMakePdf(last,fdesc()),`Pie-Charts-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.pdf`)}
  catch(e){alert(L('Export failed: ','فشل التصدير: ')+(e&&e.message||e))}btn.disabled=false;btn.textContent=t}
function vCharts(){
  const F=keepView('charts',{from:'',to:'',cu:[],mo:[],g:[],rd:[],ty:[],sev:[],po:[],mn:[],wk:[],dy:[],ot:[],basis:'pieces',meas:'reports'});const out=h('div',{class:'stack'});
  const MEAS=()=>[['reports',L('Reports','التقارير')],['defects',L('Defects','العيوب')],['accepted',L('Accepted','المقبولة')],['rejected',L('Rejected','المرفوضة')]];
  const dOf=i=>String(i.date||'').slice(0,10);
  const dc=i=>(i.defs||[]).filter(d=>msIn(F.sev,d.severity)).reduce((a,d)=>a+num(d[F.basis]),0);
  const mv=i=>F.meas==='reports'?1:F.meas==='defects'?dc(i):F.meas==='accepted'?(i.status==='approved'?1:0):(i.status==='rejected'?1:0);
  const top=(m,n)=>{const e=[...m.entries()].sort((a,b)=>b[1]-a[1]);const head=e.slice(0,n).map(([label,value])=>({label,value})),rest=e.slice(n).reduce((a,x)=>a+x[1],0);if(rest>0)head.push({label:L('Other','أخرى'),value:rest,color:'#94a3b8'});return head};
  const timeSlices=(m,n)=>{const keys=[...m.keys()].sort(),keep=keys.slice(-n),old=keys.slice(0,-n).reduce((a,k)=>a+m.get(k),0);const r=keep.map(k=>({key:k,value:m.get(k)}));if(old>0)r.unshift({key:'',value:old,color:'#94a3b8',older:true});return r};
  const pad=n=>String(n).padStart(2,'0');
  let last={sets:[],metrics:[]};const pc=(t,i,n)=>{last.sets.push({t,i,n});return pieCard(t,i,n)};
  const fill=()=>{
    last={sets:[],metrics:[]};
    const rows=S.ins.filter(i=>['approved','rejected'].includes(i.status)&&(isMgr()||mine(i))&&(!F.from||dOf(i)>=F.from)&&(!F.to||dOf(i)<=F.to)&&msInC(F.cu,i.customer)&&msIn(F.mo,String(i.model||'').trim())&&msG(F.g,i)&&(!F.rd.length||F.rd.some(v=>rndMatch(rnd(i),v)))&&msIn(F.ty,i.inspType)&&(!F.sev.length||(i.defs||[]).some(d=>F.sev.includes(d.severity)))&&msIn(F.po,String(i.orderNo||'').trim())&&msIn(F.mn,msMon(i))&&msIn(F.wk,msWeek(i))&&msIn(F.dy,msDay(i))&&msIn(F.ot,msOt(i)));
    const defs=rows.flatMap(i=>(i.defs||[]).filter(d=>msIn(F.sev,d.severity)));
    const sum=k=>defs.reduce((a,d)=>a+num(d[k]),0);
    const acc=rows.filter(i=>i.status==='approved').length,rej=rows.filter(i=>i.status==='rejected').length;
    const ml=(MEAS().find(x=>x[0]===F.meas)||[])[1]||'';
    const byCu=new Map(),byWeek=new Map(),byMon=new Map();
    rows.forEach(i=>{const v=mv(i),cu=i.customer||L('No customer','بدون عميل');byCu.set(cu,(byCu.get(cu)||0)+v);const d=new Date(i.date);if(isNaN(d))return;
      const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-x.getDay());const wk=`${x.getFullYear()}-${pad(x.getMonth()+1)}-${pad(x.getDate())}`;byWeek.set(wk,(byWeek.get(wk)||0)+v);
      const mk=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;byMon.set(mk,(byMon.get(mk)||0)+v)});
    const byOt=new Map();rows.forEach(i=>{const k=msOt(i);if(k)byOt.set(k,(byOt.get(k)||0)+mv(i))});
    const bySev=SEV.map(k=>({label:L(...sevL[k]),value:defs.filter(d=>d.severity===k).reduce((a,d)=>a+num(d[F.basis]),0),color:sevColor[k]}));
    const byDef=new Map();defs.forEach(d=>{const k=defName(d)||'?';byDef.set(k,(byDef.get(k)||0)+num(d[F.basis]))});
    const basisTxt=F.basis==='pieces'?L('Counted by affected pieces','العدّ حسب القطع المتأثرة'):L('Counted by occurrences','العدّ حسب مرات الحدوث');
    out.replaceChildren(
      h('div',{class:'grid'},(last.metrics=[[L('Reports','التقارير'),rows.length],[L('Accepted','المقبولة'),acc],[L('Rejected','المرفوضة'),rej],[L('Defect occurrences','مرات حدوث العيوب'),sum('occurrences')],[L('Affected pieces','القطع المتأثرة'),sum('pieces')],[L('Overtime reports','فحوصات الأوفر تايم'),rows.filter(i=>msOt(i)==='ot').length]]).map(([l,v])=>h('div',{class:'card metric'},h('span',{},l),h('b',{},v)))),
      h('p',{class:'hint'},L('Source: approved and rejected inspections. Occurrences and affected pieces are separate measures and are never added together.','المصدر: الفحوصات المعتمدة والمرفوضة. مرات الحدوث والقطع المتأثرة مقياسان منفصلان ولا يُجمعان.')),
      h('div',{class:'two'},
        pc(L('Accepted vs Rejected','القبول والرفض'),[{label:L('Accepted','مقبول'),value:acc,color:'#16a34a'},{label:L('Rejected','مرفوض'),value:rej,color:'#dc2626'}]),
        pc(L('Defects by classification','العيوب حسب التصنيف'),bySev,basisTxt),
        pc(L('Top defects','أكثر العيوب تكراراً'),top(byDef,8),basisTxt),
        pc(L('By customer','حسب العميل')+' — '+ml,top(byCu,8),F.meas==='defects'?basisTxt:null),
        pc(L('Weekly','أسبوعياً')+' — '+ml,timeSlices(byWeek,8).map(x=>({label:x.older?L('Older','أقدم'):L('Week of ','أسبوع ')+fmtDate(x.key),value:x.value,color:x.color})),L('Latest 8 weeks (week starts Sunday)','آخر 8 أسابيع (بداية الأسبوع الأحد)')),
        pc(L('Regular vs Overtime','عادي مقابل أوفر تايم')+' — '+ml,[{label:L('Regular (Sun–Thu)','عادي (الأحد–الخميس)'),value:byOt.get('reg')||0,color:'#2563eb'},{label:L('Overtime (Fri & Sat)','أوفر تايم (الجمعة والسبت)'),value:byOt.get('ot')||0,color:'#f59e0b'}].filter(x=>x.value>0)),
        pc(L('Monthly','شهرياً')+' — '+ml,timeSlices(byMon,12).map(x=>({label:x.older?L('Older','أقدم'):MON[Number(x.key.slice(5))-1]+'-'+x.key.slice(0,4),value:x.value,color:x.color})),L('Latest 12 months','آخر 12 شهراً'))))};
  const fdesc=()=>{const a=[];if(F.from)a.push(L('From','من')+' '+fmtDate(F.from));if(F.to)a.push(L('To','إلى')+' '+fmtDate(F.to));if(F.cu.length)a.push(L('Customer','العميل')+': '+F.cu.join(', '));if(F.mo.length)a.push(L('Model','الموديل')+': '+F.mo.join(', '));if(F.po.length)a.push('PO: '+F.po.join(', '));const ox=k=>msOptsOf(rowsAll(),k);if(F.mn.length)a.push(L('Month','الشهر')+': '+F.mn.map(v=>(ox('mon').find(x=>x[0]===v)||[])[1]||v).join(', '));if(F.wk.length)a.push(L('Week','الأسبوع')+': '+F.wk.map(v=>(ox('wk').find(x=>x[0]===v)||[])[1]||v).join(', '));if(F.dy.length)a.push(L('Day','اليوم')+': '+F.dy.map(fmtDate).join(', '));if(F.ot.length)a.push(L('Day type','نوع اليوم')+': '+F.ot.map(v=>optTxt(OT_OPTS(),v)).join(', '));
    if(F.g.length)a.push(L('Garment','القطعة')+': '+F.g.map(gName).join(', '));if(F.rd.length)a.push(L('Inspection No.','عدد الفحص')+': '+F.rd.map(v=>optTxt(RND_OPTS(),v)).join(', '));if(F.ty.length)a.push(L('Inspection Type','نوع الفحص')+': '+F.ty.map(v=>optTxt(TYPE_OPTS(),v)).join(', '));
    if(F.sev.length)a.push(L('Severity','التصنيف')+': '+F.sev.map(k=>L(...sevL[k])).join(', '));a.push(L('Measure','القياس')+': '+((MEAS().find(x=>x[0]===F.meas)||[])[1]||''));a.push(F.basis==='pieces'?L('Counted by affected pieces','العدّ حسب القطع المتأثرة'):L('Counted by occurrences','العدّ حسب مرات الحدوث'));return a.join(' · ')};
  const rowsAll=()=>S.ins.filter(i=>['approved','rejected'].includes(i.status)&&(isMgr()||mine(i)));
  fill();const set=k=>e=>{F[k]=e.target.value;fill()};
  const sel=(lab,k,opts,all)=>h('label',{},lab,h('select',{value:F[k],onChange:set(k)},all?h('option',{value:''},all):null,opts.map(([v,t])=>h('option',{value:v},t))));
  return h('div',{class:'stack'},h('div',{class:'card filters'},
    h('label',{},L('From','من'),h('input',{type:'date',onChange:set('from')})),h('label',{},L('To','إلى'),h('input',{type:'date',onChange:set('to')})),
    msBtn(L('Customer','العميل'),()=>customerList().map(c=>[c,c]),F.cu,fill),
    msBtn('PO',()=>msOptsOf(rowsAll(),'po'),F.po,fill),
    msBtn(L('Model','الموديل'),()=>msOptsOf(S.ins.filter(i=>isMgr()||mine(i)),'model'),F.mo,fill),
    msBtn(L('Month','الشهر'),()=>msOptsOf(rowsAll(),'mon'),F.mn,fill),
    msBtn(L('Week','الأسبوع'),()=>msOptsOf(rowsAll(),'wk'),F.wk,fill),
    msBtn(L('Day','اليوم'),()=>msOptsOf(rowsAll(),'day'),F.dy,fill),
    msBtn(L('Day type','نوع اليوم'),OT_OPTS,F.ot,fill),
    msBtn(L('Garment','القطعة'),()=>SINGLE.map(g=>[g,gName(g)]),F.g,fill),
    msBtn(L('Inspection No.','عدد الفحص'),RND_OPTS,F.rd,fill),
    msBtn(L('Inspection Type','نوع الفحص'),TYPE_OPTS,F.ty,fill),
    msBtn(L('Severity','التصنيف'),()=>SEV.map(k=>[k,L(...sevL[k])]),F.sev,fill),
    sel(L('Measure (customer / weekly / monthly)','القياس (عملاء / أسبوعي / شهري)'),'meas',MEAS()),
    sel(L('Count defects by','عدّ العيوب حسب'),'basis',[['pieces',L('Affected pieces','القطع المتأثرة')],['occurrences',L('Occurrences','مرات الحدوث')]]),h('button',{type:'button',class:'btn p',onClick:e=>chartsExport(e.currentTarget,last,fdesc)},'⬇ '+L('Export PDF (A4)','تصدير PDF (A4)'))),out)}
/* ---------- monthly quality report ---------- */
function monthlyData(month,filters={}){
  const rows=S.ins.filter(i=>['approved','rejected'].includes(i.status)&&String(i.date||'').slice(0,7)===month&&msInC(filters.customer,i.customer)&&msIn(filters.model,i.model)&&msIn(filters.inspector,i.inspectorName)&&msIn(filters.po,String(i.orderNo||'').trim())&&msIn(filters.ot,msOt(i))&&msG(filters.g,i));
  const defs=rows.flatMap(i=>(i.defs||[]).map(d=>({...d,_inspection:i})));
  const countBy=(items,key,value)=>{const m=new Map();items.forEach(x=>{const k=key(x);if(!k)return;m.set(k,(m.get(k)||0)+num(value(x)))});return [...m.entries()].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value)};
  const accepted=rows.filter(i=>i.status==='approved').length,rejected=rows.filter(i=>i.status==='rejected').length;
  const orders=new Set(rows.map(i=>String(i.orderNo||i.id).trim()).filter(Boolean));
  return {rows,defs,accepted,rejected,orders:orders.size,overtime:rows.filter(i=>msOt(i)==='ot').length,rate:rows.length?accepted/rows.length*100:0,
    occurrences:defs.reduce((a,d)=>a+num(d.occurrences),0),pieces:defs.reduce((a,d)=>a+num(d.pieces),0),
    topDefects:countBy(defs,d=>defNm(d)||d.defectId,d=>d.occurrences).slice(0,5),
    topModels:countBy(defs,d=>d._inspection.model||L('No model','بدون موديل'),d=>d.occurrences).slice(0,5),
    departments:countBy(defs,d=>d.deptName||d.deptAr||L('Unspecified','غير محدد'),d=>d.occurrences).slice(0,6),
    inspectors:countBy(rows,i=>i.inspectorName||L('Unspecified','غير محدد'),()=>1).slice(0,6)};
}
function monthlyTable(title,items,empty){return h('section',{style:'margin-top:13px'},h('h3',{style:'font-size:12px;margin:0 0 5px;color:#1f4e79'},title),items.length?h('table',{style:'width:100%;border-collapse:collapse;font-size:10px'},h('thead',{},h('tr',{},h('th',{style:'text-align:left;background:#eaf1f8;padding:5px;border:1px solid #ccd6e0'},L('Name','الاسم')),h('th',{style:'text-align:right;background:#eaf1f8;padding:5px;border:1px solid #ccd6e0'},L('Count','العدد')))),h('tbody',{},items.map(x=>h('tr',{},h('td',{style:'padding:4px 5px;border:1px solid #d7dee7'},x.label),h('td',{style:'padding:4px 5px;border:1px solid #d7dee7;text-align:right;font-weight:700'},x.value))))):h('p',{style:'font-size:10px;color:#64748b;margin:4px 0'},empty||L('No data for this period.','لا توجد بيانات لهذه الفترة.')))}
function monthlyPage(month,filters={}){
  const d=monthlyData(month,filters),[yy,mm]=month.split('-').map(Number),monthName=new Date(yy,mm-1,1).toLocaleDateString(S.lang==='ar'?'ar-EG':'en-US',{month:'long',year:'numeric'});
  const metric=(label,value)=>h('div',{style:'border:1px solid #d7dee7;border-radius:6px;padding:8px;min-height:48px'},h('div',{style:'font-size:9px;color:#64748b'},label),h('b',{style:'font-size:19px;color:#1f4e79'},String(value)));
  const page=h('div',{class:'rpage monthly-page'});
  const fl=v=>Array.isArray(v)?v.join(', '):v,activeFilters=[fl(filters.customer)&&`${L('Customer','العميل')}: ${fl(filters.customer)}`,fl(filters.po)&&`PO: ${fl(filters.po)}`,fl(filters.model)&&`${L('Model','الموديل')}: ${fl(filters.model)}`,fl(filters.inspector)&&`${L('Inspector','المفتش')}: ${fl(filters.inspector)}`,Array.isArray(filters.ot)&&filters.ot.length&&`${L('Day type','نوع اليوم')}: ${filters.ot.map(v=>optTxt(OT_OPTS(),v)).join(', ')}`,Array.isArray(filters.g)&&filters.g.length&&`${L('Garment','القطعة')}: ${filters.g.map(gName).join(', ')}`].filter(Boolean);
  const monthStart=`${month}-01`,monthEnd=`${month}-${String(new Date(yy,mm,0).getDate()).padStart(2,'0')}`;
  page.append(analysisReportHeader(L('MONTHLY QUALITY REPORT','تقرير الجودة الشهري'),[[L('Factory','المصنع'),S.settings.factoryName||'—'],[L('Period','الفترة'),`${fmtDate(monthStart)} – ${fmtDate(monthEnd)} (${monthName})`],[L('Customer','العميل'),fl(filters.customer)||L('All customers','كل العملاء')],[L('Garment','القطعة'),filters.g&&filters.g.length?filters.g.map(gName).join('، '):L('All garments','كل القطع')],[L('Report date','تاريخ التقرير'),new Date().toLocaleDateString(S.lang==='ar'?'ar-EG':'en-GB')]]));
  if(activeFilters.length)page.append(h('div',{style:'font-size:8.5px;color:#475569;margin-bottom:7px'},activeFilters.join(' · ')));
  page.append(h('div',{style:'display:grid;grid-template-columns:repeat(4,1fr);gap:7px'},metric(L('Completed inspections','الفحوصات المكتملة'),d.rows.length),metric(L('Unique orders','الطلبيات الفريدة'),d.orders),metric(L('Accepted','مقبول'),d.accepted),metric(L('Rejected','مرفوض'),d.rejected),metric(L('Acceptance rate','نسبة القبول'),d.rate.toFixed(1)+'%'),metric(L('Defect occurrences','مرات حدوث العيوب'),d.occurrences),metric(L('Affected pieces','القطع المتأثرة'),d.pieces),metric(L('Rejection rate','نسبة الرفض'),d.rows.length?(d.rejected/d.rows.length*100).toFixed(1)+'%':'0%'),metric(L('Overtime inspections (Fri & Sat)','فحوصات أوفر تايم (الجمعة والسبت)'),d.overtime),metric(L('Overtime share','نسبة الأوفر تايم'),d.rows.length?(d.overtime/d.rows.length*100).toFixed(1)+'%':'0%')));
  page.append(h('div',{style:'font-size:9px;color:#64748b;margin-top:6px'},L('Based on completed (approved/rejected) inspection records dated within the selected month. Each saved inspection record is counted once; repeated rounds may appear as separate inspection records.','يعتمد التقرير على سجلات الفحص المكتملة (مقبول/مرفوض) بتاريخ داخل الشهر المحدد. يُحتسب كل سجل فحص محفوظ مرة واحدة؛ وقد تظهر جولات إعادة الفحص كسجلات منفصلة.')));
  const grid=h('div',{style:'display:grid;grid-template-columns:1fr 1fr;gap:14px'});
  grid.append(h('div',{},monthlyTable(L('Top defects by occurrences','أكثر العيوب تكرارًا'),d.topDefects)),h('div',{},monthlyTable(L('Models by defect occurrences','الموديلات حسب مرات العيوب'),d.topModels)),h('div',{},monthlyTable(L('Departments by defect occurrences','الأقسام حسب مرات العيوب'),d.departments)),h('div',{},monthlyTable(L('Inspections by inspector','الفحوصات حسب المفتش'),d.inspectors)));
  page.append(grid,h('div',{style:'position:absolute;bottom:22px;left:44px;right:44px;border-top:1px solid #cbd5e1;padding-top:6px;font-size:8px;color:#64748b;display:flex;justify-content:space-between'},h('span',{},L('Quality Department','قسم الجودة')),h('span',{},`${L('Generated','تاريخ الإصدار')}: ${new Date().toLocaleDateString()}`)));
  return page;
}
async function makeMonthlyPdf(page,month){
  if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
  const stage=h('div',{class:'stage',style:'position:fixed;left:-12000px;top:0;width:794px'});document.body.append(stage);
  try{stage.append(page);try{await document.fonts.ready}catch(e){}await new Promise(r=>setTimeout(r,100));const c=await window.html2canvas(page,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});pdf.addImage(c.toDataURL('image/jpeg',.93),'JPEG',0,0,210,297,undefined,'FAST')}
  finally{stage.remove()}
  return pdf.output('blob');
}
function vMonthly(){
  const today=new Date(),localMonth=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;const m=h('input',{type:'month',value:localMonth}),wrap=h('div',{class:'stack'}),preview=h('div'),F={customer:[],model:[],inspector:[],po:[],ot:[],g:[]};
  const options=(values,all)=>[h('option',{value:''},all),...values.map(v=>h('option',{value:v},v))];
  const doneRows=()=>S.ins.filter(i=>['approved','rejected'].includes(i.status)&&(isMgr()||mine(i)));
  const customer=msBtn(L('Customer','العميل'),()=>customerList().map(c=>[c,c]),F.customer,()=>redraw()),po=msBtn('PO',()=>msOptsOf(doneRows(),'po'),F.po,()=>redraw()),model=msBtn(L('Model','الموديل'),()=>msOptsOf(doneRows(),'model'),F.model,()=>redraw()),inspector=msBtn(L('Inspector','المفتش'),()=>inspectorList().map(c=>[c,c]),F.inspector,()=>redraw()),otBtn=msBtn(L('Day type','نوع اليوم'),OT_OPTS,F.ot,()=>redraw()),gBtn=msBtn(L('Garment','القطعة'),()=>SINGLE.map(g=>[g,gName(g)]),F.g,()=>redraw());
  const redraw=()=>{const page=monthlyPage(m.value,F);page.style.width='100%';page.style.maxWidth='794px';page.style.height='auto';page.style.minHeight='900px';page.style.padding='32px';page.style.boxSizing='border-box';preview.replaceChildren(page)};
  const run=async(b,fn)=>{const t=b.textContent;b.disabled=true;b.textContent=L('Preparing…','جارٍ التجهيز…');try{await fn()}catch(e){alert(L('Export failed: ','فشل التصدير: ')+(e&&e.message||e))}b.disabled=false;b.textContent=t};
  const download=h('button',{class:'btn p',onClick:e=>run(e.currentTarget,async()=>{const blob=await makeMonthlyPdf(monthlyPage(m.value,F),m.value),url=URL.createObjectURL(blob),a=h('a',{href:url,download:`Monthly-Quality-Report-${m.value}.pdf`});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)})},'⬇ '+L('Download monthly PDF','تحميل تقرير PDF'));
  m.addEventListener('change',redraw);
  wrap.append(h('div',{class:'card filters'},h('label',{},L('Report month','شهر التقرير'),m),customer,po,model,gBtn,inspector,otBtn,download,h('button',{class:'btn',onClick:()=>print()},'🖨 '+L('Print','طباعة'))),h('p',{class:'hint'},L('The report uses completed inspections only and reuses the exact factory logo and factory name configured for the inspection report. Filters are optional.','يعتمد التقرير على الفحوصات المكتملة فقط، ويستخدم نفس لوجو واسم المصنع المضبوطين في تقرير الفحص. الفلاتر اختيارية.')),preview);
  redraw();return wrap;
}

/* ---------- customer vs factory report comparison (added 17 Nov 2026) ---------- */
/* Pure logic first (no DOM): reading text from the customer PDF, suggesting field values, and comparing them with the factory report. */
const CMP_MAX_MB=25,CMP_IMG_PAGES=6,CMP_TXT_PAGES=40;
const cmpSev=s=>{s=String(s||'').toLowerCase();return /critical|حرج|خطير/.test(s)?'critical':/major|رئيسي|كبير/.test(s)?'major':/minor|ثانوي|بسيط|طفيف/.test(s)?'minor':''};
const cmpTok=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').split(' ').filter(t=>t.length>1).map(t=>t.replace(/([^s])s$/,'$1'));
function cmpSim(a,b){const ta=[...new Set(cmpTok(a))],tb=[...new Set(cmpTok(b))];if(!ta.length||!tb.length)return 0;
  const inter=ta.filter(t=>tb.includes(t)).length;let s=2*inter/(ta.length+tb.length);const na=norm(a),nb=norm(b);
  if(na&&na===nb)s=1;else if(na&&nb&&Math.min(na.length,nb.length)>=5&&(na.includes(nb)||nb.includes(na)))s=Math.max(s,.8);return s}
const CMP_MON=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function cmpYmd(y,m,d){y=+y;m=+m;d=+d;if(!(y>=2000&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31))return'';const p=n=>String(n).padStart(2,'0');return`${y}-${p(m)}-${p(d)}`}
function cmpDate(s){s=String(s||'').trim();let m;
  if((m=s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)))return cmpYmd(m[1],m[2],m[3]);
  if((m=s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))){let y=+m[3],a=+m[1],b=+m[2];if(y<100)y+=2000;if(b>12&&a<=12)[a,b]=[b,a];return cmpYmd(y,b,a)}
  if((m=s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?[\s,.-]+(\d{4})/))){const k=CMP_MON.indexOf(m[2].slice(0,3).toLowerCase());if(k>=0)return cmpYmd(m[3],k+1,m[1])}
  if((m=s.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/))){const k=CMP_MON.indexOf(m[1].slice(0,3).toLowerCase());if(k>=0)return cmpYmd(m[3],k+1,m[2])}
  return''}
const cmpNumber=s=>{const m=String(s||'').replace(/,/g,'').match(/\d+(?:\.\d+)?/);return m?m[0]:''};
const cmpAqlNorm=v=>{const s=String(v??'').trim().toLowerCase();if(!s)return'';if(/not\s*allowed|^n\/?a$|غير\s*مسموح/.test(s))return'0';const n=parseFloat(s.replace(',','.'));return isNaN(n)?s:String(n)};
/* group pdf.js text items into visual lines; wide gaps become two spaces so table columns can be separated later */
function cmpLinesFrom(items){const rows=[];
  items.forEach(it=>{if(!it.str||!it.str.trim())return;const x=it.transform[4],y=it.transform[5],w=it.width||0;let r=rows.find(r=>Math.abs(r.y-y)<3);if(!r){r={y,parts:[]};rows.push(r)}r.parts.push({x,w,s:it.str})});
  return rows.sort((a,b)=>b.y-a.y).map(r=>{r.parts.sort((a,b)=>a.x-b.x);let out='',end=null;
    r.parts.forEach(p=>{if(end!==null){const gap=p.x-end;out+=gap>14?'  ':(gap>1&&!/\s$/.test(out)&&!/^\s/.test(p.s)?' ':'')}out+=p.s;end=p.x+p.w});return out.replace(/[ \t]+$/,'')}).filter(Boolean)}
const CMP_LABELS={
  orderNo:'p\\.?\\s?o\\.?(?:\\s*(?:no|number|#))?|purchase\\s*order(?:\\s*(?:no|number|#))?|order\\s*(?:no|number|#)|رقم\\s*(?:الطلبية|الأوردر|أمر\\s*الشراء|الطلب)',
  customer:'customer|buyer|client|brand|العميل|المشتري',
  model:'style(?:\\s*(?:no|number|#|name))?|model|article|item(?:\\s*(?:no|number|#|name))?|الموديل|الستايل|الصنف',
  color:'colou?r(?:way)?|ال?لون',
  orderQty:'order(?:ed)?\\s*(?:qty|quantity)|po\\s*(?:qty|quantity)|total\\s*(?:order\\s*)?(?:qty|quantity)|qty\\s*ordered|كمية\\s*(?:الطلبية|الأوردر|الطلب)',
  lotSize:'lot\\s*size|batch\\s*size|inspection\\s*lot|shipment\\s*(?:qty|quantity)|shipped\\s*(?:qty|quantity)|packed\\s*(?:qty|quantity)|actual\\s*(?:qty|quantity)|حجم\\s*الدفعة|الكمية\\s*الفعلية',
  sampleSize:'sample\\s*size|sample\\s*(?:qty|quantity)|(?:qty|quantity)\\s*inspected|inspected\\s*(?:qty|quantity|pcs|pieces)|حجم\\s*العينة',
  date:'inspection\\s*date|date\\s*of\\s*inspection|insp\\.?\\s*date|تاريخ\\s*الفحص|date|التاريخ',
  inspector:'inspector(?:\\s*name)?|inspected\\s*by|auditor|qc\\s*(?:name|inspector)|المفتش|اسم\\s*المفتش'};
function cmpLabelValue(lines,src){const re=new RegExp('(?:^|[\\s|,;(])(?:'+src+')\\s*(?:no\\.?|number|#|name)?\\s*[:：#\\-–=]?\\s*(.*)$','i');
  for(let k=0;k<lines.length;k++){const m=lines[k].match(re);if(!m)continue;let v=m[1].split(/\s{2,}|\|/)[0].trim();
    if(!v&&lines[k+1])v=lines[k+1].split(/\s{2,}|\|/)[0].trim();v=v.replace(/^[:：\-–=\s]+|[\s,;]+$/g,'');if(v)return v}return''}
function cmpPolarity(s){if(/not\s+(approved|accepted)/i.test(s))return'fail';
  const n=/\b(fail(?:ed)?|reject(?:ed)?)\b|مرفوض|راسب/i.test(s),p=/\b(pass(?:ed)?|accept(?:ed)?|approved)\b|مقبول|ناجح/i.test(s);return n&&!p?'fail':p&&!n?'pass':''}
function cmpFindResult(lines,text){
  for(let k=0;k<lines.length;k++){if(/result|decision|conclusion|verdict|disposition|overall|النتيجة|القرار|التقييم/i.test(lines[k])){const r=cmpPolarity(lines[k])||cmpPolarity(lines[k+1]||'');if(r)return r}}
  const pol=new Set();(text.match(/\b(PASS(?:ED)?|FAIL(?:ED)?|ACCEPTED|REJECTED|APPROVED)\b/g)||[]).forEach(t=>pol.add(/^(FAIL|REJ)/.test(t)?'fail':'pass'));return pol.size===1?[...pol][0]:''}
function cmpParseDefLine(line){line=String(line||'').trim();if(!line)return null;let name,sev,count;
  if(line.includes('|')){const p=line.split('|').map(x=>x.trim());name=p[0];sev=cmpSev(p.find((x,i)=>i>0&&cmpSev(x))||'');const nums=p.slice(1).filter(x=>/^\d+$/.test(x));count=nums.length?+nums[nums.length-1]:NaN}
  else{sev=cmpSev(line);const m=line.match(/(\d+)(?!.*\d)/);count=m?+m[1]:NaN;
    name=line.replace(/critical|major|minor|حرج|رئيسي|ثانوي/gi,' ').replace(/\d+/g,' ').replace(/[|:;,\-–]+/g,' ').replace(/\s+/g,' ').trim()}
  if(!name||name.length<2||!(count>=0))return null;return{name,severity:sev,count}}
const cmpDefText=defs=>defs.map(d=>`${d.name} | ${d.severity||'-'} | ${d.count}`).join('\n');
const cmpParseDefs=text=>String(text||'').split('\n').map(cmpParseDefLine).filter(Boolean);
/* best-effort suggestion of the customer's values from the PDF text — always shown to the user for review before comparing */
function cmpExtract(text){const lines=String(text||'').split('\n').map(x=>x.trim()).filter(Boolean),F={};
  ['orderNo','customer','model','color','orderQty','lotSize','sampleSize','date','inspector'].forEach(k=>{let v=cmpLabelValue(lines,CMP_LABELS[k]);
    if(k==='orderNo'){const t=v.match(/[A-Za-z0-9][A-Za-z0-9\-\/_.]{2,}/);v=t?t[0]:''}
    else if(['orderQty','lotSize','sampleSize'].includes(k))v=cmpNumber(v);else if(k==='date')v=cmpDate(v);F[k]=v||''});
  F.inspType=/pre[\s-]*final|during\s*production|in[\s-]*line|ما\s*قبل\s*النهائي/i.test(text)?'prefinal':/final|نهائي/i.test(text)?'final':'';
  SEV.forEach(c=>{const C=c[0].toUpperCase()+c.slice(1);F['aql'+C]='';F['found'+C]='';F['ac'+C]=''});
  lines.forEach(l=>{if(!/aql/i.test(l))return;SEV.forEach(c=>{const C=c[0].toUpperCase()+c.slice(1);if(F['aql'+C])return;
    const m=l.match(new RegExp(c+'[^0-9a-z]{0,20}(not\\s*allowed|n\\/?a|\\d+(?:\\.\\d+)?)','i'));if(m)F['aql'+C]=cmpAqlNorm(m[1])})});
  lines.forEach(l=>{if(/aql|allowed|accept|reject|sample/i.test(l))return;SEV.forEach(c=>{const C=c[0].toUpperCase()+c.slice(1);if(F['found'+C]!=='')return;
    const m=l.match(new RegExp('^(?:total\\s+|no\\.?\\s*of\\s+)?'+c+'\\b\\s*(?:defects?\\s*|nonconformit\\w*\\s*)?(?:found\\s*)?[:=\\-–]?\\s*(\\d+)(?!\\.\\d)\\b','i'));if(m)F['found'+C]=m[1]})});
  F.result=cmpFindResult(lines,String(text||''));
  const defs=lines.filter(l=>cmpSev(l)&&!/total|aql|allowed|accept|reject|sample|result|found\s*:|qty|quantity/i.test(l)).map(cmpParseDefLine).filter(Boolean);
  return{fields:F,defs}}
/* ---------- comparison ---------- */
const CMP_FIELDS=[
  ['orderNo','text','Order / PO No.','رقم الطلبية / PO'],['customer','text','Customer','العميل'],['model','text','Style / Model','الموديل'],['color','text','Color','اللون'],
  ['orderQty','num','Order quantity','كمية الطلبية'],['lotSize','num','Lot size','حجم الدفعة'],['sampleSize','num','Sample size','حجم العينة'],
  ['date','date','Inspection date','تاريخ الفحص'],['inspector','text','Inspector','المفتش'],['inspType','type','Inspection type','نوع الفحص'],
  ['aqlCritical','aql','AQL – Critical','AQL – حرج'],['aqlMajor','aql','AQL – Major','AQL – رئيسي'],['aqlMinor','aql','AQL – Minor','AQL – ثانوي'],
  ['acCritical','num','Allowed – Critical','المسموح – حرج'],['acMajor','num','Allowed – Major','المسموح – رئيسي'],['acMinor','num','Allowed – Minor','المسموح – ثانوي'],
  ['foundCritical','num','Found – Critical','الموجود – حرج'],['foundMajor','num','Found – Major','الموجود – رئيسي'],['foundMinor','num','Found – Minor','الموجود – ثانوي'],
  ['result','result','Inspection result','نتيجة الفحص']];
const CMP_RANK={match:3,partial:2,diff:1};
function cmpStatus(type,f,c){const fe=f===''||f==null,ce=c===''||c==null;if(ce)return'na';if(fe)return'nf';
  if(type==='result'&&f==='pending')return'pend';
  if(type==='num')return Number(f)===Number(c)?'match':'diff';
  if(type==='aql')return cmpAqlNorm(f)===cmpAqlNorm(c)?'match':'diff';
  if(type==='date'||type==='type'||type==='result')return f===c?'match':'diff';
  const a=norm(f),b=norm(c);if(a&&a===b)return'match';if(a&&b&&(a.includes(b)||b.includes(a)))return'partial';return'diff'}
function cmpFacValues(fac){const v={orderNo:fac.orderNo,customer:fac.customer,model:fac.model,color:fac.color,orderQty:fac.orderQty,lotSize:fac.lotSize,sampleSize:fac.sampleSize,date:fac.date,inspector:fac.inspector,inspType:fac.inspType,result:fac.result};
  SEV.forEach(c=>{const C=c[0].toUpperCase()+c.slice(1);v['aql'+C]=fac.cats[c].aql;v['ac'+C]=fac.cats[c].ac;v['found'+C]=fac.cats[c].found});return v}
function cmpCompare(fac,cus){const fv=cmpFacValues(fac);
  return CMP_FIELDS.map(([key,type,en,ar])=>{const f=fv[key],c=cus[key];let st=cmpStatus(type,f,c);
    if(key==='orderNo'&&fac.poCustomer&&c){const s2=cmpStatus('text',fac.poCustomer,c);if((CMP_RANK[s2]||0)>(CMP_RANK[st]||0))st=s2}
    return{key,type,en,ar,f,c,st}})}
function cmpMatchDefects(facDefs,cusDefs){const used=new Set(),rows=[];
  const sim=(fd,cd)=>Math.max(0,...[fd.nameEn,fd.nameAr].filter(Boolean).map(n=>cmpSim(n,cd.name)));
  facDefs.forEach(fd=>{let best=-1,bs=0;cusDefs.forEach((cd,k)=>{if(used.has(k))return;const s=sim(fd,cd)+(cd.severity&&cd.severity===fd.severity?.05:0);if(s>bs&&s>=.5){bs=s;best=k}});
    if(best<0){rows.push({fd,cd:null,st:'facOnly'});return}used.add(best);const cd=cusDefs[best];
    rows.push({fd,cd,st:(cd.severity&&cd.severity!==fd.severity)?'sev':(Number(cd.count)!==Number(fd.count)?'count':'match')})});
  cusDefs.forEach((cd,k)=>{if(!used.has(k))rows.push({fd:null,cd,st:'cusOnly'})});return rows}
function cmpSummary(rows,defRows){const c=s=>rows.filter(r=>r.st===s).length,d=s=>defRows.filter(r=>r.st===s).length;
  const res=rows.find(r=>r.key==='result'),resultState=!res||!res.c||res.st==='pend'||res.st==='nf'?'none':res.st==='match'?'agree':'differ';
  return{match:c('match'),partial:c('partial'),diff:c('diff'),na:c('na')+c('nf'),pend:c('pend'),compared:c('match')+c('partial')+c('diff'),
    defMatch:d('match'),defDiff:d('count')+d('sev'),defFacOnly:d('facOnly'),defCusOnly:d('cusOnly'),resultState}}
/* snapshot of the factory report at the time of comparison (kept inside the saved comparison even if the inspection is later edited or deleted) */
function cmpFacDefs(i,basis){const by=new Map();
  (i.defs||[]).forEach(d=>{const k=(d.defectId||d.id)+'|'+d.severity,l=libOf(d.defectId),en=(l?l.nameEn:d.nameEn)||d.defectId||'',ar=(l?l.nameAr:d.nameAr)||'';let o=by.get(k);
    if(!o){o={nameEn:en,nameAr:ar,code:d.code||(l&&l.code)||'',severity:d.severity,count:0,occurrences:0,pieces:0};by.set(k,o)}
    o.occurrences+=num(d.occurrences);o.pieces+=num(d.pieces);o.count+=num(basis==='occurrences'?d.occurrences:d.pieces)});return[...by.values()]}
function cmpFacSnap(i){const A=i.aql,basis=A?A.countBasis:'pieces',defs=cmpFacDefs(i,basis),tot=c=>defs.filter(d=>d.severity===c).reduce((a,d)=>a+d.count,0),decided=['approved','rejected'].includes(i.status),cats={};
  SEV.forEach(c=>{cats[c]={aql:A?A.cats[c].aql:'',ac:A?A.cats[c].ac:'',found:A?A.cats[c].found:tot(c)}});
  return{id:i.id,orderNo:i.orderNo||'',poCustomer:i.poCustomer||'',customer:i.customer||'',model:i.model||i.style||'',color:i.color||'',garmentType:i.garmentType||'',
    orderQty:String(i.orderQty||''),lotSize:String(i.lotSize||i.actualQty||i.orderQty||''),sampleSize:String((A&&A.sampleSize)||i.sampleSize||''),date:String(i.date||'').slice(0,10),
    inspector:i.inspectorName||'',inspType:i.inspType||'',round:rnd(i),status:i.status,result:decided?(i.result==='accepted'?'pass':'fail'):'pending',basis,cats,defs}}

/* ---------- reading the customer PDF (pdf.js is loaded only when this page is used) ---------- */
let CMP_PDFJS=null;
function cmpPdfjs(){if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  return CMP_PDFJS||(CMP_PDFJS=new Promise((res,rej)=>{const s=document.createElement('script');s.src='./vendor/pdf.min.js';
    s.onload=()=>{try{window.pdfjsLib.GlobalWorkerOptions.workerSrc='./vendor/pdf.worker.min.js';res(window.pdfjsLib)}catch(e){CMP_PDFJS=null;rej(e)}};
    s.onerror=()=>{CMP_PDFJS=null;rej(new Error(L('Could not load the PDF reader. Open the app once while online, then try again.','تعذر تحميل قارئ PDF. افتح التطبيق مرة واحدة بالإنترنت ثم أعد المحاولة.')))};document.head.append(s)}))}
async function cmpReadPdf(file){
  if(!(file.type==='application/pdf'||/\.pdf$/i.test(file.name)))throw new Error(L('Please choose a PDF file.','اختر ملف PDF.'));
  if(file.size>CMP_MAX_MB*1048576)throw new Error(L(`The file is larger than ${CMP_MAX_MB} MB.`,`حجم الملف أكبر من ${CMP_MAX_MB} ميجابايت.`));
  const head=new Uint8Array(await file.slice(0,5).arrayBuffer());if(String.fromCharCode(...head)!=='%PDF-')throw new Error(L('This file is not a valid PDF.','هذا الملف ليس PDF صالحاً.'));
  const lib=await cmpPdfjs(),buf=await file.arrayBuffer(),blob=new Blob([buf],{type:'application/pdf'});let doc;
  try{doc=await lib.getDocument({data:new Uint8Array(buf.slice(0))}).promise}
  catch(e){throw new Error(e&&e.name==='PasswordException'?L('The PDF is password-protected.','ملف PDF محمي بكلمة مرور.'):L('Could not open this PDF.','تعذر فتح ملف PDF هذا.'))}
  const lines=[],imgs=[],n=doc.numPages;
  try{for(let p=1;p<=Math.min(n,CMP_TXT_PAGES);p++){const pg=await doc.getPage(p);lines.push(...cmpLinesFrom((await pg.getTextContent()).items));
    if(p<=CMP_IMG_PAGES){const vp=pg.getViewport({scale:1.5}),c=document.createElement('canvas');c.width=Math.round(vp.width);c.height=Math.round(vp.height);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
      await pg.render({canvasContext:x,viewport:vp}).promise;imgs.push(c.toDataURL('image/jpeg',.78))}pg.cleanup()}}
  finally{try{doc.destroy()}catch(e){}}
  const text=lines.join('\n');return{pages:n,text,imgs,blob,hasText:text.replace(/\s/g,'').length>40}}
/* ---------- display helpers (screen follows the app language; the PDF is always bilingual) ---------- */
const CMP_ST={match:['✓ Match','✓ مطابق','cmp-ok'],partial:['≈ Similar','≈ متقارب','cmp-mid'],diff:['✗ Differs','✗ مختلف','cmp-bad'],
  na:['— Not in customer report','— غير مذكور في تقرير العميل','cmp-na'],nf:['— Not in factory report','— غير مسجّل في تقرير المصنع','cmp-na'],pend:['… Decision pending','… القرار لم يصدر بعد','cmp-na'],
  facOnly:['✗ Factory only','✗ في المصنع فقط','cmp-bad'],cusOnly:['✗ Customer only','✗ عند العميل فقط','cmp-bad'],count:['✗ Count differs','✗ العدد مختلف','cmp-bad'],sev:['✗ Severity differs','✗ الخطورة مختلفة','cmp-bad']};
const cmpStat=(st,pdf)=>{const s=CMP_ST[st]||CMP_ST.na;return pdf?h('span',{class:s[2]},s[0],h('div',{dir:'rtl',style:'font-size:8px;font-weight:400;text-align:left'},s[1])):h('span',{class:s[2]},L(s[0],s[1]))};
const cmpBi=(en,ar)=>h('span',{},en,h('div',{dir:'rtl',style:'font-size:8px;color:#64748b;font-weight:400;text-align:left'},ar));
function cmpDisp(type,v,pdf){if(v===''||v==null)return'—';
  if(type==='date'){const[y,m,d]=String(v).split('-');return y&&m&&d?`${d}/${m}/${y}`:String(v)}
  if(type==='type'){const t=({final:['Final','نهائي'],prefinal:['Pre-Final','ما قبل النهائي']})[v];return t?(pdf?t[0]:L(t[0],t[1])):String(v)}
  if(type==='result'){const t=({pass:['PASS','مقبول'],fail:['FAIL','مرفوض'],pending:['PENDING','معلّق']})[v];return t?(pdf?t[0]:L(t[0],t[1])):String(v)}
  if(type==='aql'&&String(v)==='0')return pdf?'0 (Not allowed)':'0';return String(v)}
const cmpFmtDay=iso=>{const t=new Date(iso);return isNaN(t)?'':t.toLocaleDateString('en-GB')};
/* ---------- the comparison PDF: A4 pages with the factory logo, paginated by measuring the real layout ---------- */
const CMP_PH=1123,CMP_PAD=46,CMP_BOTTOM=1123-46-44;
const cmpLogo=()=>h('div',{class:'rlh',style:'margin-bottom:8px'},h('img',{class:'rlogo',src:S.settings.logo||DEF_LOGO}),h('div',{class:'rlogotxt'},String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean).map(w=>h('div',{},w))));

function analysisReportHeader(title,rows){
  const logo=h('div',{style:'width:30%;min-width:180px;display:flex;align-items:center;gap:10px'},h('img',{src:S.settings.logo||DEF_LOGO,style:'width:66px;height:66px;object-fit:contain;flex:0 0 auto'}),h('div',{},h('div',{style:'font-size:20px;font-weight:800;letter-spacing:1px;color:#17365b'},'MEYAR'),h('div',{style:'font-size:9px;font-weight:700;color:#64748b'},String(S.settings.factoryName||'').toUpperCase())));
  const table=h('table',{style:'width:100%;border-collapse:collapse;table-layout:fixed;font-size:9.5px;direction:rtl'},h('tbody',{},rows.map(([k,v])=>h('tr',{},h('th',{style:'width:29%;background:#eaf1f8;border:1px solid #9fb2c7;padding:5px 7px;text-align:right;color:#17365b;white-space:normal'},k),h('td',{style:'border:1px solid #9fb2c7;padding:5px 7px;text-align:right;font-weight:700;color:#172b45;overflow-wrap:anywhere;background:#fff'},String(v==null||v===''?'—':v))))));
  return h('div',{style:'display:flex;align-items:flex-start;justify-content:space-between;gap:16px;direction:ltr;border-bottom:3px solid #17365b;padding-bottom:9px;margin-bottom:10px;min-height:78px'},logo,h('div',{style:'width:67%;text-align:right'},h('div',{style:'font-size:16px;font-weight:800;color:#17365b;text-align:right;margin-bottom:5px'},title),table));
}
const analysisDateRange=(from,to)=>from&&to?`${fmtDate(from)} – ${fmtDate(to)}`:from?`${L('From','من')} ${fmtDate(from)}`:to?`${L('To','إلى')} ${fmtDate(to)}`:L('All available dates','كل الفترات المتاحة');

async function cmpBuildPages(rec,imgs,stage){
  const pages=[],sm=rec.summary,fac=rec.fac;let page=null;
  const room=()=>{const top=page.getBoundingClientRect().top;let m=0;[...page.children].forEach(c=>{m=Math.max(m,c.getBoundingClientRect().bottom-top)});return CMP_BOTTOM-m};
  const nextPage=cont=>{page=h('div',{class:'rpage cmp-page',dir:'ltr'});stage.append(page);pages.push(page);if(cont)page.append(cmpLogo());
    if(cont)page.append(h('div',{class:'cmp-run'},`${rec.id} · Order ${rec.orderNo}${cont==='appendix'?' · Appendix / ملحق':' — continued / تابع'}`));return page};
  const addTable=(title,cols,items,mkRow,empty)=>{let tbl,tb;
    const open=cont=>{page.append(h('div',{class:'cmp-h'},title+(cont?' (cont.)':'')));tbl=h('table',{class:'cmp-t'});
      tbl.append(h('thead',{},h('tr',{},cols.map(c=>h('th',{style:'width:'+c[1]},c[0])))));tb=h('tbody');tbl.append(tb);page.append(tbl)};
    if(room()<130)nextPage(true);if(!items.length){page.append(h('div',{class:'cmp-h'},title),h('p',{style:'font-size:10px;color:#64748b;margin:2px 0 8px'},empty||'—'));return}
    open(false);items.forEach(it=>{const tr=mkRow(it);tb.append(tr);if(room()<0){tb.removeChild(tr);nextPage(true);open(true);tb.append(tr)}})};
  nextPage(false);
  const resTxt=fac.result==='pending'?'PENDING':fac.result.toUpperCase();
  page.append(analysisReportHeader('CUSTOMER vs FACTORY INSPECTION REPORT COMPARISON',[[L('Factory','المصنع'),S.settings.factoryName||'—'],[L('Customer','العميل'),rec.customer||'—'],[L('Period / dates','الفترة / التواريخ'),`${cmpDisp('date',fac.date,true)} · ${cmpDisp('date',rec.cus.date,true)}`],[L('Garment','القطعة'),gName(fac.garmentType)||'—'],[L('Model / Style','الموديل'),rec.model||fac.model||'—'],['PO / Order',rec.orderNo||'—'],[L('Factory result','نتيجة المصنع'),resTxt],[L('Customer result','نتيجة العميل'),rec.cus.result?rec.cus.result.toUpperCase():'—'],[L('Report date','تاريخ التقرير'),new Date().toLocaleDateString('en-GB')]]));
  const vs=sm.resultState,vcls=vs==='agree'?'cmp-v-ok':vs==='differ'?'cmp-v-bad':'cmp-v-na';
  page.append(h('div',{class:'cmp-verdict '+vcls},vs==='agree'?'RESULTS AGREE — النتيجتان متطابقتان':vs==='differ'?'RESULTS DIFFER — النتيجتان مختلفتان':'RESULT NOT COMPARED — لم تتم مقارنة النتيجة',
    h('small',{},` Factory: ${resTxt} · Customer: ${rec.cus.result?rec.cus.result.toUpperCase():'—'}`)));
  const met=(l,ar,v)=>h('div',{class:'cmp-met'},h('div',{},l,h('div',{dir:'rtl',style:'font-size:8px;text-align:left'},ar)),h('b',{},String(v)));
  page.append(h('div',{style:'display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:8px 0'},met('Fields compared','حقول تمت مقارنتها',sm.compared),met('Matching','مطابقة',sm.match+sm.partial),met('Differences','اختلافات',sm.diff+sm.defDiff+sm.defFacOnly+sm.defCusOnly),met('Not available','غير متاحة',sm.na+sm.pend)));
  addTable('1. Field-by-field comparison / مقارنة الحقول',[['Field / الحقل','27%'],['Factory report / المصنع','24%'],['Customer report / العميل','24%'],['Status / الحالة','25%']],rec.rows,
    r=>h('tr',{},h('td',{},cmpBi(r.en,r.ar)),h('td',{},cmpDisp(r.type,r.f,true)),h('td',{},cmpDisp(r.type,r.c,true)),h('td',{},cmpStat(r.st,true))));
  const sevT={critical:'Critical',major:'Major',minor:'Minor'};
  addTable('2. Defect-by-defect comparison / مقارنة العيوب',[['Factory defect / عيب المصنع','25%'],['Sev.','8%'],['Count','7%'],['Customer defect / عيب العميل','25%'],['Sev.','8%'],['Count','7%'],['Status / الحالة','20%']],rec.defRows,
    r=>h('tr',{},h('td',{},r.fd?cmpBi(r.fd.nameEn,r.fd.nameAr):'—'),h('td',{},r.fd?sevT[r.fd.severity]||'—':'—'),h('td',{},r.fd?r.fd.count:'—'),h('td',{},r.cd?r.cd.name:'—'),h('td',{},r.cd?sevT[r.cd.severity]||'—':'—'),h('td',{},r.cd?r.cd.count:'—'),h('td',{},cmpStat(r.st,true))),
    'No defects recorded in either report. / لا توجد عيوب مسجلة في التقريرين.');
  page.append(h('p',{style:'font-size:8.5px;color:#64748b;margin:4px 0 0'},`Factory counts are by ${fac.basis==='occurrences'?'occurrences':'affected pieces'} (AQL plan basis). Customer counts are as entered from the customer report.`,h('div',{dir:'rtl',style:'text-align:left'},`أعداد المصنع حسب ${fac.basis==='occurrences'?'مرات الحدوث':'القطع المتأثرة'} (أساس خطة AQL)، وأعداد العميل كما أُدخلت من تقرير العميل.`)));
  if(rec.notes){if(room()<90)nextPage(true);page.append(h('div',{class:'cmp-h'},'3. Notes / ملاحظات'),h('div',{class:'cmp-notes'},rec.notes))}
  if(!rec.customerFile.hasText)page.append(h('p',{style:'font-size:8.5px;color:#b45309;margin:6px 0 0'},'The customer PDF had no readable text (scan/photo); customer values were entered manually.',h('div',{dir:'rtl',style:'text-align:left'},'ملف العميل بدون نص قابل للقراءة (مسح ضوئي/صورة)، وأُدخلت قيم العميل يدوياً.')));
  imgs.forEach((src,k)=>{nextPage('appendix');page.append(h('div',{class:'cmp-h'},`Customer report as uploaded — page ${k+1} of ${rec.customerFile.pages}${rec.customerFile.pages>imgs.length&&k===imgs.length-1?` (first ${imgs.length} pages shown; the full file is stored in the order archive)`:''}`));
    page.append(h('img',{src,style:`display:block;margin:6px auto 0;max-width:100%;max-height:${Math.floor(room())-10}px;object-fit:contain;border:1px solid #cbd5e1`}))});
  pages.forEach((p,k)=>p.append(h('div',{class:'cmp-foot'},h('span',{},'Quality Department · قسم الجودة'),h('span',{},rec.id),h('span',{},`Page ${k+1} / ${pages.length}`))));
  return pages}
async function cmpMakePdf(rec,imgs){
  if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true}),stage=h('div',{class:'stage',style:'position:fixed;left:-12000px;top:0;width:794px'});document.body.append(stage);
  try{try{await document.fonts.load("700 12px CalibriX");await document.fonts.load("400 12px CalibriX");await document.fonts.ready}catch(e){}
    const pages=await cmpBuildPages(rec,imgs,stage);await Promise.all([...stage.querySelectorAll('img')].map(im=>im.decode?im.decode().catch(()=>{}):null));await new Promise(r=>setTimeout(r,80));
    for(let k=0;k<pages.length;k++){const c=await window.html2canvas(pages[k],{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});if(k)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.92),'JPEG',0,0,210,297,undefined,'FAST')}}
  finally{stage.remove()}
  return pdf.output('blob')}

/* ---------- the page: upload → choose order → review → compare → issue PDF & save to the order archive ---------- */
const cmpNewId=()=>{const d=new Date(),p=x=>String(x).padStart(2,'0');return`CMP-${String(d.getFullYear()).slice(2)}${p(d.getMonth()+1)}${p(d.getDate())}-${uid().toUpperCase()}`};
const cmpFileName=rec=>`AQL-Comparison-${String(rec.orderNo||rec.id).replace(/[^\w-]+/g,'_')}-${rec.id}.pdf`;
const cmpSaveBlob=(blob,name)=>{const a=h('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)};
async function cmpShareBlob(blob,name){const f=new File([blob],name,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:name});return true}
  cmpSaveBlob(blob,name);alert(L('Sharing files is not supported here. The PDF was downloaded; attach it manually.','المشاركة المباشرة غير مدعومة هنا. تم تحميل الـPDF؛ أرفقه يدوياً.'));return false}
function cmpOrders(){const m=new Map();
  S.ins.filter(i=>['approved','rejected','pending_review'].includes(i.status)&&String(i.orderNo||'').trim()&&(isMgr()||mine(i))).forEach(i=>{const k=String(i.orderNo).trim();if(!m.has(k))m.set(k,[]);m.get(k).push(i)});
  m.forEach(a=>a.sort((x,y)=>rnd(y)-rnd(x)||(y.createdAt||0)-(x.createdAt||0)));return m}
const cmpBlankCus=()=>{const o={};CMP_FIELDS.forEach(f=>o[f[0]]='');return o};
let CMP_KEEP=null; /* keeps the work in progress when the language/theme is switched */
function cmpTable(rows,screen){const tb=h('tbody');
  rows.forEach(r=>tb.append(h('tr',{},h('td',{},L(r.en,r.ar)),h('td',{},cmpDisp(r.type,r.f)),h('td',{},cmpDisp(r.type,r.c)),h('td',{},cmpStat(r.st)))));
  return h('div',{class:'cmp-wrap'},h('table',{class:'cmp-t'},h('thead',{},h('tr',{},[L('Field','الحقل'),L('Factory report','تقرير المصنع'),L('Customer report','تقرير العميل'),L('Status','الحالة')].map(t=>h('th',{},t)))),tb))}
function cmpDefTable(defRows){const sevT=s=>s?L(...sevL[s]):'—',nm=fd=>S.lang==='ar'?(fd.nameAr||fd.nameEn):fd.nameEn;
  if(!defRows.length)return h('p',{class:'hint'},L('No defects recorded in either report.','لا توجد عيوب مسجلة في التقريرين.'));
  const tb=h('tbody');defRows.forEach(r=>tb.append(h('tr',{},h('td',{},r.fd?nm(r.fd):'—'),h('td',{},r.fd?sevT(r.fd.severity):'—'),h('td',{},r.fd?r.fd.count:'—'),h('td',{},r.cd?r.cd.name:'—'),h('td',{},r.cd?sevT(r.cd.severity):'—'),h('td',{},r.cd?r.cd.count:'—'),h('td',{},cmpStat(r.st)))));
  return h('div',{class:'cmp-wrap'},h('table',{class:'cmp-t'},h('thead',{},h('tr',{},[L('Factory defect','عيب المصنع'),L('Sev.','الخطورة'),L('Count','العدد'),L('Customer defect','عيب العميل'),L('Sev.','الخطورة'),L('Count','العدد'),L('Status','الحالة')].map(t=>h('th',{},t)))),tb))}
function vCompare(){
  if(!CMP_KEEP||CMP_KEEP.meId!==(S.me&&S.me.id))CMP_KEEP={meId:S.me&&S.me.id,blob:null,name:'',size:0,read:null,order:'',insId:'',cus:cmpBlankCus(),auto:[],defText:'',notes:'',savedId:null,created:null};
  const st=CMP_KEEP,orders=cmpOrders(),pre=(()=>{try{return decodeURIComponent(ROUTE.split('/')[2]||'')}catch(e){return''}})();
  if(pre&&orders.has(pre)&&st.order!==pre){st.order=pre;st.insId='';st.savedId=null;st.created=null}
  if(st.order&&!orders.has(st.order)){st.order='';st.insId=''}else if(st.order&&!orders.get(st.order).some(i=>i.id===st.insId))st.insId=orders.get(st.order)[0].id;
  const wrap=h('div',{class:'stack cmp-screen'}),selIns=()=>(orders.get(st.order)||[]).find(i=>i.id===st.insId)||null;
  const msg=h('p',{class:'hint',style:'overflow-wrap:anywhere'}),setMsg=(en,ar,cls)=>{msg.className=cls||'hint';msg.textContent=en?L(en,ar):''};
  const run=async(b,fn)=>{const t=b.textContent;b.disabled=true;b.textContent=L('Preparing…','جارٍ التجهيز…');try{await fn()}catch(e){alert(L('Failed: ','فشل: ')+(e&&e.message||e))}b.disabled=false;b.textContent=t};
  /* 1 — customer PDF */
  const fileInfo=h('div',{class:'hint'}),input=h('input',{type:'file',accept:'application/pdf,.pdf',style:'display:none',onChange:e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)onFile(f)}});
  const showFile=()=>{fileInfo.replaceChildren(...(st.blob?[h('b',{},st.name),` · ${(st.size/1048576).toFixed(1)} MB · ${st.read.pages} ${L('page(s)','صفحة')} · `,
    st.read.hasText?h('span',{class:'cmp-ok'},'✓ '+L('Text was read from the file; values below are suggestions — please review them.','تمت قراءة النص من الملف؛ القيم بالأسفل اقتراحات — راجعها قبل المقارنة.')):h('span',{class:'cmp-bad'},'⚠ '+L('No readable text (scan/photo). Enter the customer values manually; the pages are still attached to the PDF.','لا يوجد نص قابل للقراءة (مسح/صورة). أدخل قيم العميل يدوياً؛ وستُرفق الصفحات في الـPDF.'))]:[L('No file chosen yet.','لم يتم اختيار ملف بعد.')]))};
  const onFile=f=>run(pickBtn,async()=>{setMsg('Reading the PDF…','جارٍ قراءة الـPDF…');const r=await cmpReadPdf(f);const ex=cmpExtract(r.text);
    st.blob=r.blob;st.name=f.name;st.size=f.size;st.read=r;st.cus={...cmpBlankCus(),...ex.fields};st.auto=Object.keys(ex.fields).filter(k=>ex.fields[k]!=='');st.defText=cmpDefText(ex.defs);st.savedId=null;st.created=null;
    setMsg('');showFile();buildReview()});
  const pickBtn=h('button',{type:'button',class:'btn p',onClick:()=>input.click()},'📎 '+L('Upload customer report (PDF)','رفع تقرير العميل (PDF)'));
  /* 2 — order + factory report from the archive */
  const ordIn=h('input',{list:'cmp-orders',placeholder:L('Type or choose an order number','اكتب أو اختر رقم الطلبية'),autocomplete:'off',value:st.order}),
    ordList=h('datalist',{id:'cmp-orders'},[...orders.keys()].sort().map(k=>h('option',{value:k}))),facBox=h('div'),roundSel=h('select',{onChange:e=>{st.insId=e.target.value;st.savedId=null;st.created=null;showFactory();buildReview()}});
  const chooseOrder=v=>{const key=[...orders.keys()].find(k=>norm(k)===norm(v))||'';if(key!==st.order){st.order=key;st.insId=key?orders.get(key)[0].id:'';st.savedId=null;st.created=null}if(key&&!st.insId)st.insId=orders.get(key)[0].id;showFactory();buildReview()};
  ordIn.addEventListener('change',()=>chooseOrder(ordIn.value.trim()));ordIn.addEventListener('input',()=>{if(orders.has(ordIn.value.trim()))chooseOrder(ordIn.value.trim())});
  const showFactory=()=>{const list=orders.get(st.order)||[],i=selIns();
    if(!i){facBox.replaceChildren(ordIn.value.trim()?h('p',{class:'warn'},L('No submitted or completed factory report was found for this order number in the archive.','لا يوجد تقرير مصنع مُرسل أو مكتمل بهذا الرقم في الأرشيف.')):h('p',{class:'hint'},L('Choose an order to retrieve the factory report from the archive.','اختر طلبية لاسترجاع تقرير المصنع من الأرشيف.')));return}
    roundSel.replaceChildren(...list.map(x=>h('option',{value:x.id,selected:x.id===st.insId},`${L('Inspection','فحص')} ${rnd(x)} · ${x.id} · ${stL(x.status)}`)));roundSel.value=st.insId;
    const f=cmpFacSnap(i);
    facBox.replaceChildren(h('div',{class:'card item2',style:'display:block'},h('b',{},i.id),' · '+i.orderNo,h('div',{class:'hint'},`${i.customer||''} · ${i.model||''} · ${gName(i.garmentType)} · ${i.inspectorName||''} · ${cmpDisp('date',f.date)}`),
      h('div',{class:'row wrap',style:'margin:6px 0'},h('span',{class:'badge '+i.status},stL(i.status)),h('span',{class:'badge'},L('Result','النتيجة')+': '+cmpDisp('result',f.result)),h('span',{class:'badge'},L('Inspection no. ','عدد الفحص ')+f.round),h('a',{class:'btn s',href:'#/report/'+i.id},'📄 '+L('Open factory report','فتح تقرير المصنع'))),
      list.length>1?h('label',{},L('Several inspections exist for this order — choose the one to compare','يوجد أكثر من فحص لهذه الطلبية — اختر الفحص المراد مقارنته'),roundSel):null,
      i.status==='pending_review'?h('p',{class:'warn'},L('This report is still pending review, so its result is not final.','هذا التقرير ما زال بانتظار المراجعة، لذا نتيجته غير نهائية.')):null))};
  /* 3 — customer values (suggested from the PDF, editable) */
  const reviewBox=h('div'),outBox=h('div'),archBox=h('div',{class:'list'});let redrawT=null;
  const later=()=>{clearTimeout(redrawT);redrawT=setTimeout(recompute,200)};
  const fieldInput=([key,type,en,ar])=>{const sync=v=>{st.cus[key]=v;st.auto=st.auto.filter(k=>k!==key);lab.classList.remove('cmp-auto');later()};let el;
    if(type==='date')el=h('input',{type:'date',value:st.cus[key]||'',onInput:e=>sync(e.target.value)});
    else if(type==='type')el=h('select',{onChange:e=>sync(e.target.value)},[['',L('— not stated —','— غير مذكور —')],['final',L('Final Inspection','فحص نهائي')],['prefinal',L('Pre-Final Inspection','فحص ما قبل النهائي')]].map(([v,t])=>h('option',{value:v,selected:st.cus[key]===v},t)));
    else if(type==='result')el=h('select',{onChange:e=>sync(e.target.value)},[['',L('— not stated —','— غير مذكور —')],['pass',L('PASS / Accepted','مقبول (PASS)')],['fail',L('FAIL / Rejected','مرفوض (FAIL)')]].map(([v,t])=>h('option',{value:v,selected:st.cus[key]===v},t)));
    else el=h('input',{value:st.cus[key]||'',inputmode:type==='num'||type==='aql'?'decimal':null,onInput:e=>sync(e.target.value)});
    const lab=h('label',{class:st.auto.includes(key)?'cmp-auto':''},L(en,ar),el);return lab};
  const buildReview=()=>{const i=selIns();if(!st.blob||!i){reviewBox.replaceChildren(h('p',{class:'hint'},L('Upload the customer PDF and choose the order to continue.','ارفع PDF العميل واختر الطلبية للمتابعة.')));outBox.replaceChildren();return}
    const defTa=h('textarea',{rows:6,placeholder:L('Defect name | critical/major/minor | count','اسم العيب | حرج/رئيسي/ثانوي | العدد'),onInput:e=>{st.defText=e.target.value;later()}}),notesTa=h('textarea',{rows:3,placeholder:L('Optional notes to print on the comparison report','ملاحظات اختيارية تُطبع في تقرير المقارنة'),onInput:e=>{st.notes=e.target.value;later()}});
    defTa.value=st.defText;notesTa.value=st.notes;
    reviewBox.replaceChildren(h('div',{class:'card form'},h('h3',{},'3. '+L('Customer report values — review and correct','قيم تقرير العميل — راجعها وصحّحها')),
      h('p',{class:'hint'},L('Highlighted fields were suggested automatically from the PDF text and may be wrong. Leave a field empty if the customer report does not state it.','الحقول المميّزة اقترحها البرنامج من نص الـPDF وقد تكون خاطئة. اترك الحقل فارغاً إذا لم يذكره تقرير العميل.')),
      h('div',{class:'cmp-grid'},CMP_FIELDS.slice(0,10).map(fieldInput)),h('h4',{},L('AQL limits and defects found','حدود AQL والعيوب الموجودة')),h('div',{class:'cmp-grid'},CMP_FIELDS.slice(10).map(fieldInput)),
      h('label',{},L('Defects listed in the customer report (one per line: name | severity | count)','العيوب المذكورة في تقرير العميل (سطر لكل عيب: الاسم | الخطورة | العدد)'),defTa),
      h('label',{},L('Notes','ملاحظات'),notesTa),
      h('details',{},h('summary',{},L('Text read from the customer PDF','النص المقروء من PDF العميل')),h('pre',{class:'cmp-raw'},st.read.hasText?st.read.text.slice(0,8000):L('(no text layer)','(لا توجد طبقة نصية)')))));
    recompute()};
  const buildRec=()=>{const fac=cmpFacSnap(selIns()),cus={...st.cus};CMP_FIELDS.forEach(([k,t])=>{if(t==='num')cus[k]=cmpNumber(cus[k]);else if(t==='aql')cus[k]=cmpAqlNorm(cus[k]);else cus[k]=String(cus[k]||'').trim()});
    const defs=cmpParseDefs(st.defText),rows=cmpCompare(fac,cus),defRows=cmpMatchDefects(fac.defs,defs);
    return{id:st.savedId||cmpNewId(),createdAt:st.created||Date.now(),createdBy:(S.me&&S.me.name)||'',createdById:(S.me&&S.me.id)||'',orderNo:fac.orderNo,customer:fac.customer,model:fac.model,inspectionId:fac.id,
      fac,cus,cusDefs:defs,notes:st.notes.trim(),rows,defRows,summary:cmpSummary(rows,defRows),customerFile:{name:st.name,size:st.size,pages:st.read.pages,hasText:st.read.hasText}}};
  /* 4 — comparison result and actions */
  const recompute=()=>{if(!st.blob||!selIns())return;const rec=buildRec(),sm=rec.summary,chip=(t,c)=>h('span',{class:'badge '+(c||'')},t);
    const rs=sm.resultState,orderRow=rec.rows.find(r=>r.key==='orderNo');
    const issueBtn=h('button',{type:'button',class:'btn p',onClick:e=>run(e.currentTarget,async()=>{const r=buildRec(),blob=await cmpMakePdf(r,st.read.imgs);
        await DB.put('comparisons',r);await DB.put('cmpfiles',{id:r.id,customerPdf:st.blob,resultPdf:blob,pageImgs:st.read.imgs});st.savedId=r.id;st.created=r.createdAt;
        await audit('comparison_saved',r.id,{order:r.orderNo,inspection:r.inspectionId});cmpSaveBlob(blob,cmpFileName(r));setMsg('Comparison saved to the order archive and the PDF was downloaded: '+r.id,'تم حفظ المقارنة في أرشيف الطلبية وتنزيل الـPDF: '+r.id,'ok');await fillArchive();recompute()})},'📄 '+L(st.savedId?'Update PDF & saved comparison':'Issue PDF & save to order archive',st.savedId?'تحديث الـPDF والمقارنة المحفوظة':'إصدار PDF وحفظ في أرشيف الطلبية')),
      shareBtn=h('button',{type:'button',class:'btn',onClick:e=>run(e.currentTarget,async()=>{const r=buildRec(),blob=await cmpMakePdf(r,st.read.imgs);await DB.put('comparisons',r);await DB.put('cmpfiles',{id:r.id,customerPdf:st.blob,resultPdf:blob,pageImgs:st.read.imgs});st.savedId=r.id;st.created=r.createdAt;
        await audit('comparison_saved',r.id,{order:r.orderNo,inspection:r.inspectionId});await cmpShareBlob(blob,cmpFileName(r));await fillArchive();recompute()})},'📤 '+L('Save & share (WhatsApp)','حفظ ومشاركة (واتساب)'));
    outBox.replaceChildren(h('div',{class:'card'},h('h3',{},'4. '+L('Comparison result','نتيجة المقارنة')),
      orderRow&&orderRow.st==='diff'?h('p',{class:'warn'},'⚠ '+L('The order/PO number in the customer report does not match the selected order. Make sure you chose the right order.','رقم الطلبية/PO في تقرير العميل لا يطابق الطلبية المختارة. تأكد أنك اخترت الطلبية الصحيحة.')):null,
      h('div',{class:'row wrap'},chip((rs==='agree'?'✓ ':rs==='differ'?'✗ ':'— ')+(rs==='agree'?L('Results agree','النتيجتان متطابقتان'):rs==='differ'?L('Results differ','النتيجتان مختلفتان'):L('Result not compared','لم تتم مقارنة النتيجة')),rs==='agree'?'approved':rs==='differ'?'rejected':''),
        chip(L('Compared','تمت مقارنتها')+': '+sm.compared),chip('✓ '+(sm.match+sm.partial)),chip('✗ '+sm.diff),chip('— '+(sm.na+sm.pend))),
      h('h4',{},L('Field-by-field','مقارنة الحقول')),cmpTable(rec.rows),h('h4',{},L('Defect-by-defect','مقارنة العيوب')),cmpDefTable(rec.defRows),
      h('p',{class:'hint'},L('Factory counts follow the AQL plan basis ('+(rec.fac.basis==='occurrences'?'occurrences':'affected pieces')+'). Defects are matched by name similarity — check the pairs.','أعداد المصنع حسب أساس خطة AQL ('+(rec.fac.basis==='occurrences'?'مرات الحدوث':'القطع المتأثرة')+'). تُطابَق العيوب بتشابه الاسم — راجع الأزواج.')),
      h('div',{class:'row wrap'},issueBtn,shareBtn,h('button',{type:'button',class:'btn',onClick:()=>{if(confirm(L('Start a new comparison? Unsaved values will be cleared.','بدء مقارنة جديدة؟ ستُمسح القيم غير المحفوظة.'))){CMP_KEEP=null;render()}}},'➕ '+L('New comparison','مقارنة جديدة'))),msg))};
  /* order archive of saved comparisons */
  const fillArchive=async()=>{let all=[];try{all=(await DB.all('comparisons')).sort((a,b)=>b.createdAt-a.createdAt)}catch(e){}
    const list=st.order?all.filter(c=>norm(c.orderNo)===norm(st.order)):all;
    const items=list.map(c=>h('div',{class:'card item2',style:'display:block'},h('b',{},c.id),' · '+c.orderNo,h('div',{class:'hint'},`${c.customer||''} · ${c.model||''} · ${new Date(c.createdAt).toLocaleString()} · ${c.createdBy||''}`),
      h('div',{class:'row wrap',style:'margin:6px 0'},h('span',{class:'badge '+(c.summary.resultState==='agree'?'approved':c.summary.resultState==='differ'?'rejected':'')},c.summary.resultState==='agree'?L('Results agree','النتيجتان متطابقتان'):c.summary.resultState==='differ'?L('Results differ','النتيجتان مختلفتان'):L('Result not compared','لم تتم مقارنة النتيجة')),
        h('span',{class:'badge'},'✗ '+(c.summary.diff+c.summary.defDiff+c.summary.defFacOnly+c.summary.defCusOnly)),h('span',{class:'badge'},c.customerFile.name)),
      h('div',{class:'row wrap'},
        h('button',{type:'button',class:'btn s',onClick:e=>run(e.currentTarget,async()=>{const f=await DB.get('cmpfiles',c.id);if(!f||!f.resultPdf)throw new Error(L('PDF not found.','لم يُعثر على الـPDF.'));cmpSaveBlob(f.resultPdf,cmpFileName(c))})},'⬇ '+L('Comparison PDF','PDF المقارنة')),
        h('button',{type:'button',class:'btn s',onClick:e=>run(e.currentTarget,async()=>{const f=await DB.get('cmpfiles',c.id);if(!f||!f.resultPdf)throw new Error(L('PDF not found.','لم يُعثر على الـPDF.'));await cmpShareBlob(f.resultPdf,cmpFileName(c))})},'📤 '+L('Share','مشاركة')),
        h('button',{type:'button',class:'btn s',onClick:e=>run(e.currentTarget,async()=>{const f=await DB.get('cmpfiles',c.id);if(!f||!f.customerPdf)throw new Error(L('File not found.','لم يُعثر على الملف.'));cmpSaveBlob(f.customerPdf,c.customerFile.name||('customer-'+c.id+'.pdf'))})},'📎 '+L('Customer PDF','PDF العميل')),
        h('button',{type:'button',class:'btn s d',onClick:async()=>{if(!confirm(L('Delete comparison '+c.id+'? This cannot be undone.','حذف المقارنة '+c.id+'؟ لا يمكن التراجع.')))return;await DB.del('comparisons',c.id);await DB.del('cmpfiles',c.id);await audit('comparison_deleted',c.id,{order:c.orderNo});if(st.savedId===c.id){st.savedId=null;st.created=null}await fillArchive();recompute()}},'🗑 '+L('Delete','حذف')))));
    archBox.replaceChildren(h('div',{class:'card'},h('h3',{},'🗂 '+L(st.order?'Saved comparisons for order '+st.order:'Saved comparisons (all orders)','المقارنات المحفوظة'+(st.order?' للطلبية '+st.order:' (كل الطلبيات)'))),
      items.length?h('div',{class:'list'},items):h('p',{class:'hint'},L('No saved comparisons yet.','لا توجد مقارنات محفوظة بعد.'))))};
  wrap.append(h('div',{class:'card form'},h('h3',{},'1. '+L('Customer inspection report (PDF)','تقرير فحص العميل (PDF)')),h('p',{class:'hint'},L('Choose the PDF from your phone (Files, Drive, WhatsApp downloads…).','اختر ملف الـPDF من الموبايل (الملفات، درايف، تحميلات واتساب…).')),input,h('div',{class:'row wrap'},pickBtn),fileInfo),
    h('div',{class:'card form'},h('h3',{},'2. '+L('Order number — factory report from the archive','رقم الطلبية — تقرير المصنع من الأرشيف')),ordIn,ordList,facBox),reviewBox,outBox,archBox);
  showFile();showFactory();buildReview();fillArchive();return wrap}

/* ---------- defect library ---------- */
const blankDef=()=>({code:'',nameEn:'',nameAr:'',descEn:'',descAr:'',severity:'minor',garments:[...SINGLE],active:true,photos:[]});
const libActive=()=>!!(D&&EDIT.includes(D.status)&&Array.isArray(D.defs)&&(isMgr()||mine(D)));
async function libAddToReport(l){
 if(!libActive())return{ok:false,text:L('No open report. Open a draft inspection first (New Inspection or the archive), then come back here.','لا يوجد تقرير مفتوح. افتح مسودة فحص أولاً (فحص جديد أو الأرشيف) ثم ارجع هنا.')};
 const rg=garmentsOf(D.garmentType),cand=(l.garments&&l.garments.length?l.garments:SINGLE).filter(g=>rg.includes(g));
 const g=LIB_F.g&&cand.includes(LIB_F.g)?LIB_F.g:cand[0];
 if(!g)return{ok:false,text:L('This defect does not apply to the garment type of the open report.','هذا العيب لا ينطبق على نوع القطعة في التقرير المفتوح.')};
 const nm=S.lang==='ar'?(l.nameAr||l.nameEn):(l.nameEn||l.nameAr),ex=D.defs.find(x=>x.defectId===l.id&&x.garment===g);let n=1;
 if(ex){ex.pieces=(num(ex.pieces)||0)+1;ex.occurrences=(num(ex.occurrences)||0)+1;n=ex.occurrences}
 else{const d=deptsFor(g)[0];D.defs.push({id:'d_'+uid(8),garment:g,deptId:d?d.id:'',deptName:d?d.en:'',deptAr:d?d.ar:'',defectId:l.id,code:l.code,nameEn:l.nameEn,nameAr:l.nameAr,severity:l.severity,pieces:1,occurrences:1,description:'',photos:[],corrective:'',responsible:'',followUp:'none',reinspection:'',_open:false})}
 const x=structuredClone(D);x.defs.forEach(d=>{delete d._open});if(x.status==='draft')x.status='in_progress';x.updatedAt=Date.now();
 await DB.put('inspections',x);D.status=x.status;D.updatedAt=x.updatedAt;dirty=false;await loadAll();
 return{ok:true,text:'✔ '+L('Added "'+nm+'" to the report ('+gName(g)+')'+(n>1?' — count '+n:''),'تمت إضافة «'+nm+'» للتقرير ('+gName(g)+')'+(n>1?' — العدد '+n:''))}}
let LIB_F={g:'',q:''},LIB_EDIT_SCROLL=null;
function vLib(){
  if(LE){const e=LE.d;const tg=g=>{e.garments=e.garments.includes(g)?e.garments.filter(x=>x!==g):[...e.garments,g]};
    return h('div',{class:'card form'},h('h3',{},e.id?(S.lang==='ar'?e.nameAr:e.nameEn)||e.code:L('New defect','عيب جديد')),
      e.id&&e.updatedBy?h('p',{class:'hint'},L('Last edited by ','آخر تعديل بواسطة ')+e.updatedBy+(e.updatedAt?' · '+new Date(e.updatedAt).toLocaleString():'')):null,
      fld(L('English name','الاسم بالإنجليزية'),()=>e.nameEn,v=>e.nameEn=v),fld(L('Arabic name','الاسم بالعربية'),()=>e.nameAr,v=>e.nameAr=v,{dir:'rtl'}),
      h('label',{},L('Severity','التصنيف'),h('select',{value:e.severity,onChange:x=>e.severity=x.target.value},SEV.map(s=>h('option',{value:s,selected:e.severity===s},L(...sevL[s]))))),
      h('div',{class:'row wrap'},SINGLE.map(g=>h('label',{class:'chk'},h('input',{type:'checkbox',checked:e.garments.includes(g),onChange:()=>tg(g)}),gName(g))),h('label',{class:'chk'},h('input',{type:'checkbox',checked:e.active,onChange:x=>e.active=x.target.checked}),L('Active','مفعّل'))),
      h('label',{},L('English description','الوصف بالإنجليزية'),h('textarea',{onInput:x=>e.descEn=x.target.value},e.descEn)),h('label',{},L('Arabic description','الوصف بالعربية'),h('textarea',{dir:'rtl',onInput:x=>e.descAr=x.target.value},e.descAr)),
      photoStrip(e.photos,i=>{e.photos.splice(i,1);render()},false,p=>{e.photos.push(p);render()}),LE.msg?h('p',{class:'err'},LE.msg):null,
      h('div',{class:'row'},h('button',{class:'btn p',onClick:saveDef},L('Save','حفظ')),h('button',{class:'btn',onClick:()=>{LE=null;render()}},L('Cancel','إلغاء'))))}
  const note=h('p',{class:'libnote'}),rc=id=>libActive()?D.defs.filter(x=>x.defectId===id).reduce((a,x)=>a+(num(x.occurrences)||1),0):0,chips=h('div',{class:'libchips'}),box=h('div',{class:'liblist'}),cnt=h('p',{class:'hint',style:'margin:6px 2px 0'});
  const gs=SINGLE.filter(g=>g==='jacket'||g==='trousers'||S.lib.some(d=>(d.garments||[]).includes(g)));
  if(LIB_F.g&&!gs.includes(LIB_F.g))LIB_F.g='';
  const nm=d=>S.lang==='ar'?(d.nameAr||d.nameEn):(d.nameEn||d.nameAr),rank={critical:0,major:1,minor:2};
  const fill=()=>{
    chips.replaceChildren(...[['',L('All','الكل')],...gs.map(g=>[g,gName(g)])].map(([g,lb])=>h('button',{type:'button',class:'libchip'+(LIB_F.g===g?' on':''),onClick:()=>{LIB_F.g=g;fill()}},lb)));
    const r=S.lib.filter(d=>(!LIB_F.g||(d.garments||[]).includes(LIB_F.g))&&norm(d.code+d.nameEn+d.nameAr).includes(norm(LIB_F.q))).sort((a,b)=>((rank[a.severity]??3)-(rank[b.severity]??3))||String(a.code).localeCompare(String(b.code)));
    cnt.textContent=r.length+' '+L('defects','عيب');
    box.replaceChildren(...(r.length?r.map(d=>h('div',{class:'libitem sev-'+d.severity+(d.active?'':' off')},
      h('div',{class:'libname'},h('b',{},nm(d)),(!LIB_F.g||!d.active||(d.photos&&d.photos.length))?h('span',{class:'hint'},[!LIB_F.g?(d.garments||[]).map(gName).join(' · '):'',d.active?'':L('inactive','غير مفعّل'),(d.photos&&d.photos.length)?'📷 '+d.photos.length:''].filter(Boolean).join(' · ')):null),
      h('span',{class:'sevchip '+d.severity},L(...sevL[d.severity])),
      h('button',{type:'button',class:'btn s libedit','aria-label':L('Edit','تعديل'),onClick:()=>{LIB_EDIT_SCROLL=captureScrollState();LE={d:structuredClone(d)};render()}},'✏️'),
      h('button',{type:'button',class:'btn s p libadd'+(libActive()?'':' dim'),onClick:async e=>{const b=e.currentTarget;b.disabled=true;try{const r=await libAddToReport(d);note.textContent=r.text;note.className='libnote '+(r.ok?'ok':'warn');fill()}catch(x){note.textContent=L('Error: ','خطأ: ')+((x&&x.message)||x);note.className='libnote warn'}finally{b.disabled=false}}},libActive()&&rc(d.id)?'×'+rc(d.id)+' ＋':'＋ '+L('Add','إضافة')))):[h('div',{class:'card empty'},h('h2',{},L('No defects found','لا توجد عيوب')),h('p',{class:'hint'},L('Try another search or add a new defect.','جرّب بحثاً آخر أو أضف عيباً جديداً.')))]))};
  fill();
  return h('div',{},h('div',{class:'libbar'},h('div',{class:'libsearch'},h('span',{},'🔍'),h('input',{value:LIB_F.q,placeholder:L('Search for a defect…','ابحث عن عيب…'),onInput:e=>{LIB_F.q=e.target.value;fill()}})),
    h('button',{class:'btn p',onClick:()=>{LIB_EDIT_SCROLL=captureScrollState();LE={d:{...blankDef(),garments:LIB_F.g?[LIB_F.g]:[...SINGLE]}};render()}},'＋ '+L('Add defect','إضافة عيب'))),
    libActive()?h('div',{class:'libreport'},h('span',{},'📝 '+L('Adding to report: ','الإضافة إلى التقرير: ')+' '),h('b',{style:'flex:1'},(D.orderNo||L('New report','تقرير جديد'))+(D.customer?' · '+D.customer:'')),h('button',{type:'button',class:'btn s',onClick:async()=>{if(!S.ins.some(i=>i.id===D.id)){const x=structuredClone(D);x.defs.forEach(d=>{delete d._open});x.updatedAt=Date.now();await DB.put('inspections',x);dirty=false;await loadAll()}go('#/i/'+D.id)}},'↩ '+L('Back to report','العودة للتقرير'))):h('div',{class:'libreport off'},'ℹ️ '+L('Open an inspection draft to add defects to it from here.','افتح مسودة فحص لتضيف العيوب إليها من هنا.')),
    note,chips,cnt,box)}
async function saveDef(){const e=LE.d;
  if(!e.nameEn.trim()||!e.nameAr.trim()){LE.msg=L('Both the English and Arabic names are required.','الاسم الإنجليزي والعربي مطلوبان.');return render()}
  if(!e.garments.length){LE.msg=L('Select at least one garment type.','اختر نوع قطعة واحداً على الأقل.');return render()}
  const id=e.id||('N-'+Date.now().toString(36).toUpperCase().slice(-5)+uid(2).toUpperCase()),code=e.id?e.code:id;
  const dup=S.lib.find(d=>d.id!==id&&(norm(d.nameEn)===norm(e.nameEn)||norm(d.nameAr)===norm(e.nameAr)));if(dup){LE.msg=L('Looks like a duplicate of ','يبدو مكرراً للعيب ')+(S.lang==='ar'?dup.nameAr:dup.nameEn);return render()}
  const me=(S.me&&S.me.name)||'';
  await DB.put('library',{...e,id,code,updatedAt:Date.now(),createdAt:e.createdAt||Date.now(),createdBy:e.createdBy||me,updatedBy:me});await audit(e.id?'defect_updated':'defect_created',id);LE=null;await loadAll();render();try{cloudAuto(true)}catch(x){}}
/* ---------- inspection form ---------- */
const deptsFor=g=>{const l=(S.settings[g]||[]).filter(d=>d.active).map(d=>({...d}));Object.values(D.secs).forEach(s=>{if(s.garment===g&&!l.some(d=>d.id===s.deptId))l.push({id:s.deptId,en:s.nameEn,ar:s.nameAr})});return l};
const dnm=d=>S.lang==='ar'?d.ar||d.en:d.en;
const getSec=(g,d)=>D.secs[g+'__'+d.id]||(D.secs[g+'__'+d.id]={garment:g,deptId:d.id,nameEn:d.en,nameAr:d.ar,status:'pending',inspected:'',notes:''});
const garments=()=>garmentsOf(D.garmentType);
function aqlCalc(){const plan=activePlan();const c={critical:0,major:0,minor:0};let unc=0;
  D.defs.filter(d=>garments().includes(d.garment)).forEach(d=>{const v=num(plan&&plan.countBasis==='occurrences'?d.occurrences:d.pieces);if(SEV.includes(d.severity))c[d.severity]+=v;else unc+=v});
  return{plan,unc,ev:evaluate(plan,num(D.lotSize||D.actualQty||D.orderQty),c)}}
function liveSnap(){const a=aqlCalc();return a.ev.status==='ok'&&!a.unc?{planId:a.plan.id,planName:a.plan.name,version:a.plan.version,verified:!!a.plan.verified,countBasis:a.plan.countBasis,procedure:a.plan.procedure||'',sampleSize:a.ev.sampleSize,cats:a.ev.cats,result:a.ev.result,authoritative:a.ev.authoritative,at:new Date().toISOString()}:null}
function syncDerived(){
  D.packingPct=pack(D);D.lotSize=String(num(D.actualQty)||num(D.orderQty)||'');
  const ev=evaluate(activePlan(),num(D.lotSize),{critical:0,major:0,minor:0});if(ev.status==='ok')D.sampleSize=String(ev.sampleSize);}
function validate(submit){const e=[];if(!D.orderNo.trim())e.push(L('Order number is required.','رقم الطلبية مطلوب.'));if(!submit)return e;
  if(!D.customer.trim())e.push(L('Customer is required.','العميل مطلوب.'));if(!D.model.trim())e.push(L('Model is required.','الموديل مطلوب.'));
  if(!(num(D.orderQty)>0))e.push(L('Quantity must be greater than 0.','الكمية يجب أن تكون أكبر من 0.'));
  if(!(num(D.actualQty)>0))e.push(L('Actual quantity is required.','الكمية الفعلية مطلوبة.'));
  if(!(num(D.sampleSize)>0))e.push(L('Sample size is required.','حجم العينة مطلوب.'));else if(num(D.sampleSize)>num(D.lotSize))e.push(L('Sample size cannot exceed the lot size.','حجم العينة لا يمكن أن يتجاوز حجم الدفعة.'));
  if(D.rows.length&&D.rows.reduce((a,r)=>a+num(r.qty),0)!==num(D.orderQty))e.push(L('Color/size quantities must add up to the quantity.','مجموع كميات اللون/المقاس يجب أن يساوي الكمية.'));
  D.defs.filter(d=>garments().includes(d.garment)).forEach((d,k)=>{const n=k+1;
    if(!d.defectId)e.push(L(`Defect row ${n}: choose the defect.`,`صف العيب ${n}: اختر العيب.`));
    if(!(num(d.pieces)>=1))e.push(L(`Defect row ${n}: count must be at least 1.`,`صف العيب ${n}: العدد 1 على الأقل.`));
    if(num(d.occurrences)<num(d.pieces))e.push(L(`Defect row ${n}: occurrences cannot be fewer than affected pieces.`,`صف العيب ${n}: مرات الحدوث لا تقل عن القطع المتأثرة.`));});
  return e}
async function save(kind){if(busy)return;if(EDIT.includes(D.status))syncDerived();errs=validate(kind==='submit');if(errs.length)return render();busy=true;
  try{const gs=garments();D.defs=D.defs.filter(d=>gs.includes(d.garment)).map(d=>{const x={...d};delete x._open;return x});
    const started=D.defs.length>0||(D.defPhotos||[]).length>0||(D.itemPhotos||[]).length>0;
    D.status=kind==='submit'?'pending_review':started?'in_progress':'draft';D.aql=liveSnap();let auto=false;
    if(kind==='submit'&&!(S.settings&&S.settings.requireReview)&&D.aql&&D.aql.authoritative&&D.aql.result){auto=true;D.status=D.aql.result==='pass'?'approved':'rejected';D.result=D.aql.result==='pass'?'accepted':'rejected';D.decisionNote='';D.history.push({at:Date.now(),by:'AQL',action:'auto_'+D.status})}
    D.round=parseInt(D.round,10)>0?parseInt(D.round,10):'';
    D.updatedAt=Date.now();D.history.push({at:Date.now(),by:D.inspectorName,action:kind});await DB.put('inspections',D);await audit(auto?'inspection_auto_'+D.status:kind==='submit'?'inspection_submitted':'inspection_saved',D.id,{status:D.status});dirty=false;await loadAll();
    if(auto){alert(L('AQL result: ','نتيجة AQL: ')+(D.result==='accepted'?L('ACCEPTED','مقبول'):L('REJECTED','مرفوض')));go('#/report/'+D.id)}
    else if(kind==='submit')go('#/archive');else{okMsg=L('Draft saved.','تم حفظ المسودة.');if(ROUTE!=='#/i/'+D.id)go('#/i/'+D.id);else{D=structuredClone(S.ins.find(i=>i.id===D.id));render()}}}
  catch(e){errs=[L('Save failed: ','فشل الحفظ: ')+(e&&e.message||e)];render()}finally{busy=false}}
const histName=a=>({draft:L('Saved draft','حفظ مسودة'),submit:L('Submitted','إرسال'),auto_approved:L('Accepted automatically (AQL)','قبول تلقائي (AQL)'),auto_rejected:L('Rejected automatically (AQL)','رفض تلقائي (AQL)'),accept:L('Accepted by reviewer','قبول من المراجع'),reject:L('Rejected by reviewer','رفض من المراجع'),return:L('Returned for correction','إرجاع للتصحيح'),reopen:L('Reopened for correction','إعادة فتح للتصحيح')})[a]||a;
async function reopenIns(i){if(!isMgr())return;const o=S.ins.find(x=>x.id===i.id);if(!o||!['approved','rejected'].includes(o.status))return;
  const why=prompt(L('Reason for reopening (required):','سبب إعادة الفتح (مطلوب):'));if(why==null)return;if(why.trim().length<3)return alert(L('Please write the reason.','اكتب السبب.'));
  const prev={at:Date.now(),by:S.me.name,reason:why.trim(),status:o.status,result:o.result,aql:o.aql?{planName:o.aql.planName,version:o.aql.version,sampleSize:o.aql.sampleSize,result:o.aql.result,cats:o.aql.cats}:null};
  o.revisions=(o.revisions||[]).concat([prev]);o.history=(o.history||[]).concat([{at:Date.now(),by:S.me.name,action:'reopen',note:why.trim()}]);
  o.status='in_progress';o.result=null;o.decisionNote='';o.updatedAt=Date.now();
  await DB.put('inspections',o);await audit('inspection_reopened',o.id,{reason:why.trim(),was:prev.status,result:prev.result});await loadAll();go('#/i/'+o.id)}
async function decide(kind){if(busy)return;if(kind!=='accept'&&!DN.trim()){errs=[L('Write a note explaining the decision.','اكتب ملاحظة توضح القرار.')];return render()}
  if(!confirm(L('Confirm this decision?','تأكيد هذا القرار؟')))return;busy=true;
  try{D.status=kind==='accept'?'approved':kind==='reject'?'rejected':'in_progress';D.result=kind==='return'?null:kind==='accept'?'accepted':'rejected';D.decisionNote=DN;D.history.push({at:Date.now(),by:(S.me&&S.me.name)||'-',action:kind,note:DN});
    await DB.put('inspections',D);await audit('inspection_'+kind,D.id,{note:DN});await loadAll();go('#/archive')}catch(e){errs=[String(e)];render()}finally{busy=false}}
function vIns(){if(!D)return h('div',{class:'card empty'},h('h2',{},L('Inspection not found','الفحص غير موجود')));
  const isNew=!S.ins.some(i=>i.id===D.id),ed=EDIT.includes(D.status),dt=()=>{dirty=true;okMsg=''};D.itemPhotos=D.itemPhotos||[];D.defPhotos=D.defPhotos||[];if(ed)syncDerived();const gs=garments();
  const f=(label,key,at)=>fld(label,()=>D[key],v=>{D[key]=v;dt();softRender()},at);
  const A=aqlCalc(),snap=!ed&&D.aql?D.aql:null,view=snap||(A.ev.status==='ok'?{planName:A.plan.name,version:A.plan.version,authoritative:A.ev.authoritative,sampleSize:A.ev.sampleSize,cats:A.ev.cats,result:A.ev.result}:null);
  const aqlCard=h('div',{class:'card','data-live':'aql'},h('h3',{},L('AQL evaluation','تقييم AQL')),
    !view?h('p',{class:'warn'},!A.plan?L('No active AQL plan: the decision is manual.','لا توجد خطة AQL مفعّلة: القرار يدوي.'):L('Lot size is outside the configured plan ranges: the decision is manual.','حجم الدفعة خارج نطاقات الخطة: القرار يدوي.')):
    h('p',{},`${view.planName} v${view.version} · `,h('b',{},L('Plan result','نتيجة الخطة')+': '+(view.result?(view.result==='pass'?L('PASS','مقبول'):L('FAIL','مرفوض')):'—')),' ',view.authoritative?h('span',{class:'hint'},L('(applied automatically on submit)','(تُطبّق تلقائياً عند الإرسال)')):h('span',{class:'warn'},L('plan not verified: indicative only','الخطة غير موثقة: استرشادي فقط'))),
    !snap&&A.unc>0?h('p',{class:'warn'},L('Some defects have no severity; fix them before relying on this result.','بعض العيوب بلا خطورة؛ صححها قبل الاعتماد على النتيجة.')):null,
    isNew?null:h('a',{class:'btn s',href:'#/report/'+D.id},L('Open report','فتح التقرير')));
  const rowsUI=h('div',{},h('b',{},L('Color / size breakdown','توزيع اللون / المقاس')),D.rows.map((r,i)=>h('div',{class:'row',style:'margin-top:6px'},h('input',{placeholder:L('Color','اللون'),value:r.color,onInput:e=>{r.color=e.target.value;dt()}}),h('input',{placeholder:L('Size','المقاس'),value:r.size,onInput:e=>{r.size=e.target.value;dt()}}),h('input',{type:'number',placeholder:L('Qty','الكمية'),value:r.qty,onInput:e=>{r.qty=e.target.value;dt()}}),h('button',{type:'button',class:'btn s',onClick:()=>{D.rows.splice(i,1);dt();render()}},'🗑'))),
    h('button',{type:'button',class:'btn s',style:'margin-top:6px',onClick:()=>{D.rows.push({color:'',size:'',qty:''});dt();render()}},'+ '+L('Add row','إضافة صف')));
  const lot=num(D.lotSize),ev0=evaluate(activePlan(),lot,{critical:0,major:0,minor:0});
  const sampleBox0=!lot?h('p',{class:'hint'},L('Enter Quantity and Actual quantity above to get the AQL sample size.','أدخل الكمية والكمية الفعلية بالأعلى لتظهر عينة AQL.')):
    ev0.status==='ok'?h('div',{class:'smp'},h('div',{},L('Lot size (actual quantity)','حجم الدفعة (الكمية الفعلية)')+': ',h('b',{},lot)),h('div',{class:'big'},L('AQL sample size','حجم عينة AQL')+': ',h('b',{},ev0.sampleSize),' · '+L('Code letter','الحرف')+' ',h('b',{},ev0.codeLetter))):
    h('div',{},h('p',{class:'warn'},!activePlan()?L('No AQL plan: enter the sample size manually.','لا توجد خطة AQL: أدخل حجم العينة يدوياً.'):L('Lot size is outside the plan ranges: enter the sample size manually.','حجم الدفعة خارج نطاقات الخطة: أدخل حجم العينة يدوياً.')),h('label',{},L('Sample size','حجم العينة'),h('input',{type:'number',min:0,value:D.sampleSize,onInput:e=>{D.sampleSize=e.target.value;dt()}})));
  const sampleBox=h('div',{'data-live':'smp'},sampleBox0);
  const dupBanner=()=>{if(!ed)return h('span');const m=sameOrder(D).filter(x=>isMgr()||mine(x));if(!m.length)return h('span');const last=m[0];
    return h('div',{class:'warn'},'⚠ '+L(`This order was already inspected ${m.length} time(s). Last: `,`هذا الأوردر تم فحصه من قبل ${m.length} مرة. آخرها: `)+last.id+' · '+stL(last.status)+(last.result?' · '+(last.result==='accepted'?L('accepted','مقبول'):L('rejected','مرفوض')):''),
      h('div',{class:'row wrap',style:'margin-top:6px'},h('a',{class:'btn s',href:'#/i/'+last.id},L('Open it','فتحه')),isNew?h('button',{type:'button',class:'btn s',onClick:()=>copyFrom(last)},L('Copy its data','نسخ بياناته')):null,h('span',{class:'hint'},L('This will be saved as re-inspection no. ','سيُحفظ كإعادة فحص رقم ')+(m.length+1))))};
  const prevSel=isNew&&ed?h('label',{},L('Copy from a previous inspection (optional)','نسخ من فحص سابق (اختياري)'),h('select',{onChange:e=>{const src=S.ins.find(x=>x.id===e.target.value);e.target.value='';if(!src)return;if(D.orderNo&&!confirm(L('Replace the data typed so far?','استبدال البيانات المكتوبة حتى الآن؟')))return;copyFrom(src)}},h('option',{value:''},'—'),S.ins.filter(x=>isMgr()||mine(x)).slice(0,40).map(x=>h('option',{value:x.id},`${x.orderNo} · ${x.customer||''} · ${String(x.date).slice(0,10)}`)))):null;
  const basicsEl=h('div',{class:'form basics'},prevSel,f(L('Order number','رقم الطلبية')+' *','orderNo'),h('div',{'data-live':'dup'},dupBanner()),f(L('Color','اللون'),'color'),sampleBox,rowsUI,h('label',{},L('General notes','ملاحظات عامة'),h('textarea',{onInput:e=>{D.notes=e.target.value;dt()}},D.notes)));
  /* defect table (the report's "Details of Defect Found" is the entry grid) */
  const libFor=g=>S.lib.filter(l=>l.active!==false&&(!l.garments||!l.garments.length||l.garments.includes(g)));
  const us=usageMap(),dnm2=l=>S.lang==='ar'?(l.nameAr||l.nameEn):l.nameEn;
  const defOptions=g=>{const lst=libFor(g),opt=l=>h('option',{value:l.id},dnm2(l)),top=lst.filter(l=>us[l.id]>0).sort((a,b)=>us[b.id]-us[a.id]).slice(0,8);
    return[h('option',{value:''},L('— choose defect —','— اختر العيب —')),top.length?h('optgroup',{label:'★ '+L('Most used','الأكثر استخداماً')},top.map(opt)):null,h('optgroup',{label:L('All defects (A–Z)','كل العيوب (أبجدياً)')},lst.slice().sort((a,b)=>dnm2(a).localeCompare(dnm2(b))).map(opt))]};
  const selDef=(x,id)=>{const l=libOf(id);x.defectId=id;if(l){x.code=l.code;x.nameEn=l.nameEn;x.nameAr=l.nameAr;x.severity=l.severity}else x.severity=''};
  const setDept=(x,id)=>{const d=deptsFor(x.garment).find(z=>z.id===id);x.deptId=id;x.deptName=d?d.en:'';x.deptAr=d?d.ar:''};
  const addDef=()=>{const g=gs[0],d=deptsFor(g)[0];D.defs.push({id:'d_'+uid(8),garment:g,deptId:d?d.id:'',deptName:d?d.en:'',deptAr:d?d.ar:'',defectId:'',pieces:1,occurrences:1,description:'',photos:[],corrective:'',responsible:'',followUp:'none',reinspection:'',severity:'',_open:false});dt();render()};
  const detailRow=x=>{const dl=deptsFor(x.garment);return h('tr',{class:'dtl'},h('td',{colspan:4},h('div',{class:'form'},
    gs.length>1?h('label',{},L('Garment','القطعة'),h('select',{value:x.garment,onChange:e=>{x.garment=e.target.value;const d=deptsFor(x.garment)[0];x.deptId=d?d.id:'';x.deptName=d?d.en:'';x.deptAr=d?d.ar:'';x.defectId='';x.severity='';dt();render()}},gs.map(g=>h('option',{value:g},gName(g))))):null,
    h('label',{},L('Department (optional)','القسم (اختياري)'),h('select',{value:x.deptId,onChange:e=>{setDept(x,e.target.value);dt();render()}},dl.length?null:h('option',{value:''},'—'),dl.map(d=>h('option',{value:d.id},dnm(d))))),
    fld(L('Occurrences (times it appears)','مرات الحدوث'),()=>x.occurrences,v=>{x.occurrences=v;x.occCustom=true;dt()},{type:'number',min:1}),
    h('label',{},L('Description','الوصف'),h('textarea',{onInput:e=>{x.description=e.target.value;dt()}},x.description),voiceButton({get value(){return x.description},set value(v){x.description=v},dispatchEvent(){dt()}})),
    fld(L('Corrective action','الإجراء التصحيحي'),()=>x.corrective,v=>{x.corrective=v;dt()}),
    h('div',{class:'row'},fld(L('Responsible','المسؤول'),()=>x.responsible,v=>{x.responsible=v;dt()}),h('label',{},L('Follow-up','المتابعة'),h('select',{value:x.followUp,onChange:e=>{x.followUp=e.target.value;dt()}},['none','open','done'].map(o=>h('option',{value:o},o))))),
    fld(L('Reinspection notes','ملاحظات إعادة الفحص'),()=>x.reinspection,v=>{x.reinspection=v;dt()}),
    ed?h('button',{type:'button',class:'btn s',onClick:()=>{if(confirm(L('Delete this defect?','حذف هذا العيب؟'))){D.defs=D.defs.filter(z=>z!==x);dt();render()}}},'🗑 '+L('Delete defect','حذف العيب')):null)))};
  const E={canEdit:ed,
    sel:(k,opts)=>h('select',{value:String(D[k]??''),onChange:e=>{D[k]=e.target.value;dt()}},h('option',{value:''},''),opts.map(([v,t])=>h('option',{value:v},t))),
    cust:()=>h('button',{type:'button',class:'custbtn',onClick:()=>csPick(D.customer,v=>{D.customer=v;dt();render()})},(D.customer||L('Choose customer…','اختر العميل…'))+' ▾'),inp:(k,at,rr)=>h('input',Object.assign({},at,{value:D[k]??'',onInput:e=>{D[k]=e.target.value;dt();if(rr||D.measOn)softRender()}})),
    item:()=>h('select',{value:D.garmentType==='both'?'suit':D.garmentType,onChange:e=>{D.garmentType=e.target.value;dt();render()}},GT.map(g=>h('option',{value:g},gName(g)))),
    itemPhotos:()=>h('div',{class:'ipw'},D.itemPhotos.length?null:h('p',{class:'hint'},L('Add photos of the actual item (front, inside, back, labels…). Captions are optional.','أضف صور المنتج الفعلي (الأمام، الداخل، الخلف، الليبلات…). التعليق اختياري.')),
      h('div',{class:'pg'},D.itemPhotos.map((x,k)=>h('figure',{},h('img',{src:x.p,onClick:()=>window.open(x.p)}),ed?h('button',{type:'button',class:'annbtn',onClick:()=>annotatePhoto(x,()=>{dt();render()})},'✏️'):null,h('figcaption',{},h('input',{value:x.cap||'',placeholder:L('Caption (optional)','تعليق (اختياري)'),onInput:e=>{x.cap=e.target.value;dt()}}),ed?h('button',{type:'button',class:'xbtn',onClick:()=>{D.itemPhotos.splice(k,1);dt();render()}},'×'):null)))),
      ed?h('div',{class:'row wrap',style:'margin-top:8px'},h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(true,p=>{D.itemPhotos.push({p,cap:''});dt();render()})},'📷 '+L('Camera','الكاميرا')),h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(false,p=>{D.itemPhotos.push({p,cap:''});dt();render()})},'🖼 '+L('Gallery','المعرض'))):null),
    defPhotos:()=>{const mp=mapDefPhotos(D),dl=D.defs.filter(x=>gs.includes(x.garment)&&x.defectId),add=p=>{D.defPhotos.push({p,defId:''});dt();render()};
      return h('div',{class:'ipw','data-live':'dph'},h('p',{class:'hint'},L('Record the defects in the table first, then add the photos IN ORDER: each defect takes as many photos as its count, and its name + severity are written under each photo automatically. You can change a photo\u2019s defect from its list.','سجّل العيوب في الجدول أولاً ثم أضف الصور بالترتيب: كل عيب يأخذ عدداً من الصور بقدر عدده، ويُكتب اسم العيب وخطورته تحت كل صورة تلقائياً. يمكنك تغيير عيب الصورة من قائمتها.')),
        h('div',{class:'pg'},mp.map((x,k)=>{const ph=D.defPhotos[k];return h('figure',{},h('img',{src:x.p,onClick:()=>window.open(x.p)}),ed?h('button',{type:'button',class:'annbtn',onClick:()=>annotatePhoto(ph,()=>{dt();render()})},'✏️'):null,h('figcaption',{},
          h('select',{value:ph.defId||'',onChange:e=>{ph.defId=e.target.value;dt();render()}},h('option',{value:''},x.name&&ph.defId===''?L('Auto: ','تلقائي: ')+x.name+(x.sev?' ('+L(...sevL[x.sev])+')':''):L('Auto (no defect left)','تلقائي (لا يوجد عيب متبقٍ)')),dl.map(d=>h('option',{value:d.id},defNm(d)+' ('+L(...sevL[d.severity||'major'])+')'))),
          ed?h('button',{type:'button',class:'xbtn',onClick:()=>{D.defPhotos.splice(k,1);dt();render()}},'×'):null))})),
        ed?h('div',{class:'row wrap',style:'margin-top:8px'},h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(true,add)},'📷 '+L('Camera','الكاميرا')),h('button',{type:'button',class:'btn s',onClick:()=>pickPhotos(false,add)},'🖼 '+L('Gallery (select many)','المعرض (اختر عدة صور)'))):null)},
    meas:()=>{const tg=h('label',{class:'chk',style:'margin:10px 0'},h('input',{type:'checkbox',checked:!!D.measOn,onChange:e=>{D.measOn=e.target.checked;if(D.measOn)ensureMeas(D);dt();render()}}),L('Include the Measurement Report (adds the measurement table pages)','تضمين تقرير المقاسات (يضيف صفحات جدول المقاسات للتقرير)'));
      if(!D.measOn)return h('div',{},tg);ensureMeas(D);
      return h('div',{},tg,measKinds(D.garmentType).map(k=>h('div',{},h('div',{class:'bar1'},'• '+L('MEASUREMENT REPORT','تقرير المقاسات')+' — '+gName(k)),h('div',{'data-live':'mh_'+k},measHdr(D,true,dt)),
        ed?h('button',{type:'button',class:'btn p',style:'margin:6px 0 10px',onClick:()=>measureMode(k,()=>render())},'🎤 '+L('Measure by voice / keypad','قياس بالصوت / الأزرار')):null,D.meas[k].map(b=>h('div',{class:'mtw'},measBlock(b,true,dt))),
        ed?h('div',{class:'row wrap'},h('button',{type:'button',class:'btn s',onClick:()=>{D.meas[k].push(newBlock(k));dt();render()}},'+ '+L('Add table','إضافة جدول')),D.meas[k].length>1?h('button',{type:'button',class:'btn s',onClick:()=>{if(confirm(L('Remove the last table?','حذف آخر جدول؟'))){D.meas[k].pop();dt();render()}}},L('Remove last','حذف الأخير')):null):null)))},
    prop:(k,v)=>{if(!ed)return;D.props[k]=D.props[k]===v?'':v;dt();render()},basics:()=>basicsEl,
    cm:(k,t,arr)=>h('input',{value:t,onInput:e=>{arr[k]=e.target.value;D.comment=arr.join('\n').replace(/\n+$/,'');dt()}}),
    rows:NR=>{const out=[],list=D.defs.filter(x=>gs.includes(x.garment));
      list.forEach(x=>{out.push(h('tr',{},h('td',{class:'nm'},h('button',{type:'button',class:'tg',onClick:()=>{x._open=!x._open;render()}},x._open?'▾':'▸'),
          h('select',{value:x.defectId,onChange:e=>{selDef(x,e.target.value);dt();render()}},defOptions(x.garment))),
          SEV.map(c=>h('td',{class:'n'},x.severity===c?h('input',{type:'number',min:1,value:x.pieces,onInput:e=>{x.pieces=e.target.value;if(!x.occCustom||num(x.occurrences)<num(e.target.value))x.occurrences=e.target.value;dt();softRender()}}):''))));
        if(x._open)out.push(detailRow(x))});
      if(ed)out.push(h('tr',{class:'addr'},h('td',{colspan:4},h('button',{type:'button',class:'btn s',onClick:addDef},'+ '+L('Add defect','إضافة عيب')),S.lib.length?null:h('span',{class:'hint'},' '+L('(add defects in Defect Library first)','(أضف العيوب أولاً من مكتبة العيوب)')))));
      while(out.filter(r=>!r.classList.contains('dtl')).length<NR)out.push(h('tr',{class:'addr',onClick:()=>{if(ed)addDef()}},h('td'),h('td'),h('td'),h('td')));
      return out}};
  const head=reportPages({...D,aql:ed?liveSnap():D.aql},E)[0];
  const canDecide=D.status==='pending_review'&&isMgr();
  const hist=(D.history||[]).slice().reverse(),lastRe=hist.find(x=>x.action==='reopen'),canReopen=isMgr()&&!isNew&&['approved','rejected'].includes(D.status);
  const histEl=hist.length?h('details',{style:'margin-top:8px'},h('summary',{},L('History','السجل')+' ('+hist.length+')'),hist.map(x=>h('div',{class:'hint',style:'padding:3px 0'},new Date(x.at).toLocaleString()+' · '+(x.by||'-')+' · '+histName(x.action)+(x.note?': '+x.note:'')))):null;
  return h('div',{class:'stack'},h('div',{class:'card'},h('b',{},D.id),' ',h('span',{class:'badge '+D.status},stL(D.status)),rnd(D)>1?h('span',{class:'badge',style:'margin-inline-start:6px'},L('Re-inspection','إعادة فحص')+' '+rnd(D)):null,D.decisionNote?h('p',{class:'hint'},L('Decision note','ملاحظة القرار')+': '+D.decisionNote):null,
      ed&&lastRe&&D.status==='in_progress'?h('p',{class:'warn'},L('Reopened by ','أعاد فتحه ')+lastRe.by+': '+lastRe.note):null,
      canReopen?h('div',{style:'margin-top:8px'},h('button',{class:'btn s',onClick:()=>reopenIns(D)},'🔓 '+L('Reopen for correction','إعادة فتح للتصحيح'))):null,histEl),
    aqlCard,h('fieldset',{disabled:!ed},head),insFilesCard(D),h('datalist',{id:'dl-inspectors'},inspectorList().map(c=>h('option',{value:c}))),
    errs.length?h('div',{class:'card errbox'},errs.map(e=>h('div',{},'• '+e))):null,okMsg?h('p',{class:'ok'},okMsg):null,
    ed?[h('div',{style:'height:76px'}),h('div',{class:'fab-wrap noprint'},
      h('div',{id:'fab-menu',class:'fab-menu'},
        h('button',{type:'button',class:'btn',onClick:()=>{const m=$('#fab-menu');if(m)m.classList.remove('open');save('draft')}},'💾 '+L('Save draft','حفظ مسودة')),
        h('button',{type:'button',class:'btn p',onClick:()=>{const m=$('#fab-menu');if(m)m.classList.remove('open');save('submit')}},'✔ '+L('Submit','إرسال'))),
      h('button',{type:'button',class:'fab','aria-label':L('Actions menu','قائمة الإجراءات'),onClick:()=>{const m=$('#fab-menu');if(m)m.classList.toggle('open')}},h('i'),h('i'),h('i')))]:null,
    canDecide?h('div',{class:'card form'},h('h3',{},L('Review decision (no automatic AQL result was available)','قرار المراجعة (لا توجد نتيجة AQL تلقائية)')),h('textarea',{placeholder:L('Decision note','ملاحظة القرار'),onInput:e=>DN=e.target.value},DN),
      h('div',{class:'row wrap'},h('button',{class:'btn p',onClick:()=>decide('accept')},L('Accept order','قبول الطلبية')),h('button',{class:'btn d',onClick:()=>decide('reject')},L('Reject order','رفض الطلبية')),h('button',{class:'btn',onClick:()=>decide('return')},L('Return for correction','إرجاع للتصحيح')))):null)}
/* ---------- AQL plans ---------- */
const blankRow=()=>({lotMin:1,lotMax:1,codeLetter:'',sampleSize:1,critical:{aql:'0',ac:0,re:1},major:{aql:'2.5',ac:0,re:1},minor:{aql:'4.0',ac:0,re:1}});
function vAql(){
  if(PE){const e=PE.v;return h('div',{class:'stack'},h('button',{class:'btn s',onClick:()=>{PE=null;render()}},'←'),h('div',{class:'card form'},h('h3',{},`${PE.p.name} · v${PE.p.current||'—'}`),
    h('p',{class:'hint'},L('Single sampling only. Saving creates a NEW version; old versions never change and inspections keep the version they used.','سحب عينة واحدة فقط. الحفظ ينشئ إصداراً جديداً ولا يتغير القديم، والفحوصات تحتفظ بالإصدار الذي استخدمته.')),
    h('div',{class:'row'},h('label',{},L('Count defects by','عدّ العيوب حسب'),h('select',{value:e.countBasis,onChange:x=>e.countBasis=x.target.value},h('option',{value:'pieces'},L('Affected pieces','القطع المتأثرة')),h('option',{value:'occurrences'},L('Occurrences','مرات الحدوث')))),fld(L('Effective date','تاريخ السريان'),()=>e.effectiveDate,v=>e.effectiveDate=v,{type:'date'})),
    h('label',{},L('Procedure text shown on the report','نص الإجراء الذي يظهر في التقرير'),h('textarea',{onInput:x=>e.procedure=x.target.value},e.procedure||'')),h('label',{class:'chk'},h('input',{type:'checkbox',checked:e.verified,onChange:x=>e.verified=x.target.checked}),L('Verified against approved factory examples (results become authoritative)','تم التحقق منه بأمثلة المصنع المعتمدة (تصبح النتائج معتمدة)')),
    e.rows.map((r,i)=>h('div',{class:'card defect form'},h('div',{class:'row'},fld(L('Lot from','الدفعة من'),()=>r.lotMin,v=>r.lotMin=v,{type:'number'}),fld(L('to','إلى'),()=>r.lotMax,v=>r.lotMax=v,{type:'number'})),
      h('div',{class:'row'},fld(L('Code letter','الحرف'),()=>r.codeLetter,v=>r.codeLetter=v),fld(L('Sample size','حجم العينة'),()=>r.sampleSize,v=>r.sampleSize=v,{type:'number'})),
      SEV.map(c=>h('div',{class:'row'},h('b',{style:'width:64px;font-size:13px'},L(...sevL[c])),fld('AQL',()=>r[c].aql,v=>r[c].aql=v),fld('Ac',()=>r[c].ac,v=>r[c].ac=v,{type:'number'}),fld('Re',()=>r[c].re,v=>r[c].re=v,{type:'number'}))),
      h('button',{class:'btn s',onClick:()=>{e.rows.splice(i,1);render()}},L('Remove row','حذف الصف')))),
    h('div',{class:'row wrap'},h('button',{class:'btn',onClick:()=>{e.rows.push(blankRow());render()}},L('Add lot range','إضافة نطاق دفعة')),h('button',{class:'btn p',onClick:savePlan},L('Save new version','حفظ إصدار جديد'))),
    PE.errs&&PE.errs.length?h('div',{class:'card errbox'},PE.errs.map(x=>h('div',{},'• '+x))):null))}
  return h('div',{class:'stack'},h('div',{class:'card form'},h('div',{class:'row'},h('input',{id:'pn',placeholder:L('New plan name','اسم الخطة الجديدة')}),h('button',{class:'btn p',onClick:async()=>{const n=$('#pn').value.trim();if(!n)return;const p={id:'plan_'+uid(6),name:n,active:false,current:0,versions:{}};await DB.put('plans',p);await audit('aql_plan_created',p.id);await loadAll();PE={p,v:{rows:[blankRow()],countBasis:'pieces',verified:false,effectiveDate:''}};render()}},L('Create','إنشاء'))),
      h('button',{class:'btn s',onClick:seedPlan},L('Add the factory Z1.4 plan (full table)','إضافة خطة Z1.4 الخاصة بالمصنع (الجدول كاملاً)'))),
    S.plans.length?h('div',{class:'list'},S.plans.map(p=>h('div',{class:'card item'},h('div',{},h('b',{},p.name),h('div',{class:'hint'},`v${p.current||'—'}${p.active?' · '+L('ACTIVE','مفعّلة'):''}`)),h('div',{class:'row'},
      h('button',{class:'btn s',onClick:()=>{const v=p.current?structuredClone(p.versions[p.current]):{rows:[blankRow()],countBasis:'pieces',verified:false,effectiveDate:''};PE={p,v};render()}},L('Edit','تعديل')),
      p.current&&!p.active?h('button',{class:'btn s p',onClick:async()=>{for(const x of S.plans){x.active=x.id===p.id;await DB.put('plans',x)}await audit('aql_plan_activated',p.id);await loadAll();render()}},L('Activate','تفعيل')):null)))):
    h('div',{class:'card empty'},h('h2',{},L('No AQL plan yet','لا توجد خطة AQL بعد')),h('p',{class:'hint'},L('Until a plan is configured, results are manual and provisional.','حتى يتم إعداد خطة تكون النتائج يدوية ومؤقتة.'))))}
async function savePlan(){const e=PE.v;const rows=e.rows.map(r=>({lotMin:+r.lotMin,lotMax:+r.lotMax,codeLetter:r.codeLetter,sampleSize:+r.sampleSize,...Object.fromEntries(SEV.map(c=>[c,{aql:String(r[c].aql),ac:+r[c].ac,re:+r[c].re}]))}));
  const er=validateRows(rows);if(!rows.length)er.push(L('Add at least one row.','أضف صفاً واحداً على الأقل.'));PE.errs=er;if(er.length)return render();
  const p=PE.p,v=(p.current||0)+1;p.versions[v]={version:v,rows,countBasis:e.countBasis,verified:!!e.verified,effectiveDate:e.effectiveDate||'',procedure:e.procedure||'',approvedBy:(S.me&&S.me.name)||'-',createdAt:Date.now()};p.current=v;
  await DB.put('plans',p);await audit('aql_plan_version_saved',p.id,{version:v,verified:!!e.verified});await loadAll();PE=null;alert(L(`Saved as version ${v}.`,`تم الحفظ كإصدار ${v}.`));render()}
async function seedPlan(){const p=z14Plan();p.active=!S.plans.some(x=>x.active);await DB.put('plans',p);await audit('aql_plan_created',p.id);await loadAll();alert(L('Added the factory Z1.4 plan (all lot ranges).','تمت إضافة خطة Z1.4 الخاصة بالمصنع (كل نطاقات الدفعات).'));render()}
/* ---------- settings / backup ---------- */
/* ---------- secure cloud sync (Supabase) ---------- */
const CLOUD_CFG_KEY='aql-cloud-config-v1';
const CLOUD_WS_KEY='aql-cloud-workspace-v1', CLOUD_AUTO_KEY='aql-cloud-auto-v1', CLOUD_LASTSYNC_KEY='aql-cloud-lastsync-v1';
let CLOUD_CLIENT=null, CLOUD_BUSY=false, CLOUD_LAST='', CLOUD_SEEN={ws:'',rev:-1};
const AQL_SUPABASE_DEFAULTS={url:'https://ayyqopyazqvdoldasqiw.supabase.co',anonKey:'sb_publishable_OhWHv4LTR0NsvYnE_JY0Ug_LpeAJme0'};
function cloudCfg(){try{return {...AQL_SUPABASE_DEFAULTS,...JSON.parse(localStorage.getItem(CLOUD_CFG_KEY)||'{}')}}catch(e){return {...AQL_SUPABASE_DEFAULTS}}}
function cloudSaveCfg(c){localStorage.setItem(CLOUD_CFG_KEY,JSON.stringify(c));CLOUD_CLIENT=null}
function cloudClient(){const c=cloudCfg();if(!c.url||!c.anonKey)throw new Error(L('Enter the Supabase project URL and anon/public key first.','أدخل رابط مشروع Supabase ومفتاح anon/public أولاً.'));if(!window.supabase||!window.supabase.createClient)throw new Error(L('Cloud library could not load. Connect to the internet and refresh.','تعذر تحميل مكتبة السحابة. اتصل بالإنترنت وأعد فتح الصفحة.'));if(!CLOUD_CLIENT)CLOUD_CLIENT=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});return CLOUD_CLIENT}
function cloudPanel(){
 const cfg=cloudCfg(), url=h('input',{type:'url',placeholder:'https://xxxxxxxx.supabase.co',value:cfg.url||''}), key=h('input',{type:'password',placeholder:L('Supabase anon/public key','مفتاح anon/public من Supabase'),value:cfg.anonKey||'',autocomplete:'off'}), email=h('input',{type:'email',placeholder:L('Cloud account email','البريد الإلكتروني للحساب السحابي'),autocomplete:'email'}), pass=h('input',{type:'password',placeholder:L('Cloud account password','كلمة مرور الحساب السحابي'),autocomplete:'current-password'}), workspace=h('input',{placeholder:L('Workspace name (for manager)','اسم مساحة العمل (للمدير)'),value:(S.settings&&S.settings.factoryName)||'AQL Workspace'}), code=h('input',{placeholder:L('Join code from the manager (12 characters)','رمز الانضمام من المدير (12 خانة)'),autocomplete:'off'}), msg=h('p',{class:'hint',style:'overflow-wrap:anywhere;font-weight:600;min-height:1.4em'},CLOUD_LAST), membersBox=h('div',{class:'stack'});
 const note=(en,ar)=>{CLOUD_LAST=L(en,ar);msg.textContent=CLOUD_LAST};
 const row=(...children)=>h('div',{class:'row wrap'},...children);
 const lastSync=()=>{const t=+localStorage.getItem(CLOUD_LASTSYNC_KEY)||0;return t?new Date(t).toLocaleString():L('never','لم تتم بعد')};
 const status=()=>{const c=cloudCfg();let host='';try{host=new URL(c.url).host}catch(e){}const ws=localStorage.getItem(CLOUD_WS_KEY);return L('Project: ','المشروع: ')+(host||'-')+' · '+L('Workspace: ','مساحة العمل: ')+(ws||L('not joined','لم يتم الانضمام'))+' · '+L('Last sync: ','آخر مزامنة: ')+lastSync()};
 const btn=(label,fn)=>h('button',{class:'btn s',type:'button',onClick:async()=>{if(CLOUD_BUSY){note('Another cloud operation is running. Try again in a moment.','عملية سحابة أخرى قيد التنفيذ. حاول بعد لحظات.');return}CLOUD_BUSY=true;note('Working…','جارٍ التنفيذ…');try{await fn()}catch(e){const m=(e&&e.message)||String(e);note('Error: '+m,'خطأ: '+m)}finally{CLOUD_BUSY=false}}},label);
 const needWs=()=>{const ws=localStorage.getItem(CLOUD_WS_KEY);if(!ws)throw new Error(L('Create or join a workspace first.','أنشئ مساحة عمل أو انضم إليها أولاً.'));return ws};
 const loadMembers=async()=>{const ws=needWs(),c=cloudClient();const r=await c.rpc('aql_list_members',{p_workspace:ws});if(r.error)throw r.error;
   membersBox.replaceChildren(...(r.data||[]).map(m=>{const own=m.role==='owner';const sel=h('select',{},h('option',{value:'manager',selected:m.role==='manager'},L('Manager','مدير')),h('option',{value:'inspector',selected:m.role==='inspector'},L('Inspector','مفتش')));
     return h('div',{class:'row wrap'},h('b',{style:'flex:1;overflow-wrap:anywhere;font-size:14px'},m.email+(own?' ('+L('owner','المالك')+')':'')),own?null:sel,
       own?null:h('button',{class:'btn s',type:'button',onClick:async()=>{try{const x=await c.rpc('aql_set_member_role',{p_workspace:ws,p_user:m.user_id,p_role:sel.value});if(x.error)throw x.error;note('Role updated.','تم تحديث الصلاحية.')}catch(e){note('Error: '+e.message,'خطأ: '+e.message)}}},L('Save role','حفظ'))
       ,own?null:h('button',{class:'btn s d',type:'button',onClick:async()=>{if(!confirm(L('Remove this member from the cloud workspace?','إزالة هذا العضو من مساحة العمل السحابية؟')))return;try{const x=await c.rpc('aql_remove_member',{p_workspace:ws,p_user:m.user_id});if(x.error)throw x.error;note('Member removed.','تمت إزالة العضو.');await loadMembers()}catch(e){note('Error: '+e.message,'خطأ: '+e.message)}}},'🗑'))}));
   note('Members loaded: '+(r.data||[]).length,'تم تحميل الأعضاء: '+(r.data||[]).length)};
 const sum=s=>['Done. Uploaded '+s.up+', downloaded '+s.down+', deleted from cloud '+s.del+', removed locally '+s.delLocal+', conflicts resolved '+s.conf+', skipped '+s.skip+'.'+(s.err?' First error: '+s.err:''),'اكتملت المزامنة. رفع '+s.up+'، تنزيل '+s.down+'، حذف من السحابة '+s.del+'، حذف محلي '+s.delLocal+'، تعارضات تمت معالجتها '+s.conf+'، متخطى '+s.skip+'.'+(s.err?' أول خطأ: '+s.err:'')];
 const done=async s=>{if(s.changed)await loadAll();const m=sum(s);note(m[0],m[1]);render()};
 return h('div',{class:'card form'},h('h3',{},'☁️ '+L('Cloud database & multi-device sync','قاعدة البيانات السحابية والمزامنة بين الأجهزة')),
   h('p',{class:'hint'},L('This connects the app to your own Supabase project. Keep the anon/public key only; never paste a service_role key here.','هذا يربط المنصة بمشروع Supabase الخاص بك. استخدم مفتاح anon/public فقط ولا تضع مفتاح service_role هنا.')),
   url,key,row(btn(L('Save cloud settings','حفظ إعدادات السحابة'),async()=>{if(!url.value.trim()||!key.value.trim())throw new Error(L('Both fields are required.','يجب إدخال الرابط والمفتاح.'));let u;try{u=new URL(url.value.trim())}catch(e){throw new Error(L('Project URL is invalid.','رابط المشروع غير صحيح.'))}if(u.protocol!=='https:')throw new Error(L('Use an HTTPS project URL.','يجب استخدام رابط HTTPS.'));cloudSaveCfg({url:url.value.trim().replace(/\/$/,''),anonKey:key.value.trim()});note('Cloud settings saved on this device.','تم حفظ إعدادات السحابة على هذا الجهاز.')}),btn(L('Test connection','اختبار الاتصال'),async()=>{const c=cloudClient();const r=await c.auth.getSession();if(r.error)throw r.error;const q=await c.from('aql_cloud_records').select('record_id',{head:true,count:'exact'}).limit(1);if(q.error)throw q.error;note('Connection successful. '+(r.data.session?'Signed in.':'Not signed in yet.'),'الاتصال ناجح. '+(r.data.session?'تم تسجيل الدخول.':'لم يتم تسجيل الدخول بعد.'))})),
   h('div',{class:'divider'}),h('h4',{},L('Cloud account','حساب السحابة')),email,pass,row(btn(L('Create account','إنشاء حساب'),async()=>{if(!email.value||pass.value.length<8)throw new Error(L('Enter email and a password of at least 8 characters.','أدخل البريد وكلمة مرور لا تقل عن 8 أحرف.'));const r=await cloudClient().auth.signUp({email:email.value.trim(),password:pass.value});if(r.error)throw r.error;note('Account request submitted. If email confirmation is enabled, confirm the email before signing in.','تم إرسال طلب إنشاء الحساب. إذا كان تأكيد البريد مفعلاً، أكد البريد قبل تسجيل الدخول.')}),btn(L('Sign in','تسجيل الدخول'),async()=>{const r=await cloudClient().auth.signInWithPassword({email:email.value.trim(),password:pass.value});if(r.error)throw r.error;note('Signed in to cloud account.','تم تسجيل الدخول للحساب السحابي.')}),btn(L('Sign out cloud','خروج من السحابة'),async()=>{const r=await cloudClient().auth.signOut();if(r.error)throw r.error;note('Signed out. Local data was not deleted.','تم تسجيل الخروج. لم تُحذف البيانات المحلية.')})),
   h('div',{class:'divider'}),h('h4',{},L('Shared workspace','مساحة العمل المشتركة')),workspace,code,row(btn(L('Create workspace','إنشاء مساحة عمل'),async()=>{if(!workspace.value.trim())throw new Error(L('Enter a workspace name.','أدخل اسم مساحة العمل.'));const r=await cloudClient().rpc('aql_create_workspace',{p_name:workspace.value.trim()});if(r.error)throw r.error;const x=Array.isArray(r.data)?r.data[0]:r.data;if(!x||!x.workspace_id)throw new Error(L('Workspace was created but no ID was returned. Check the SQL setup.','تم إنشاء مساحة العمل لكن لم يصل المعرّف. راجع إعداد SQL.'));localStorage.setItem(CLOUD_WS_KEY,x.workspace_id);const jc=x.join_code||'';note('Workspace created. Join code (share only with trusted users): '+jc,'تم إنشاء مساحة العمل. رمز الانضمام (شاركه مع الموثوقين فقط): '+jc);render()}),btn(L('Join workspace','الانضمام لمساحة'),async()=>{if(!code.value.trim())throw new Error(L('Enter the join code.','أدخل رمز الانضمام.'));const r=await cloudClient().rpc('aql_join_workspace',{p_code:code.value.trim()});if(r.error)throw r.error;localStorage.setItem(CLOUD_WS_KEY,r.data);note('Joined workspace as inspector. The manager can change your role.','تم الانضمام لمساحة العمل بصفة مفتش. يستطيع المدير تغيير صلاحيتك.');render()})),
   h('p',{class:'hint'},status()),
   row(btn(L('Upload local data to cloud','رفع البيانات المحلية للسحابة'),async()=>{await done(await cloudSync('push'))}),btn(L('Download cloud data to this device','تنزيل بيانات السحابة لهذا الجهاز'),async()=>{if(!confirm(L('Cloud versions will replace local records that were changed on both sides. Continue?','نسخ السحابة ستحل محل السجلات المعدلة في الجهتين. هل تريد المتابعة؟')))return;await done(await cloudSync('pull'))}),btn(L('Sync both ways','مزامنة في الاتجاهين'),async()=>{await done(await cloudSync('both'))})),
   h('label',{class:'chk'},h('input',{type:'checkbox',checked:localStorage.getItem(CLOUD_AUTO_KEY)!=='off',onChange:e=>localStorage.setItem(CLOUD_AUTO_KEY,e.target.checked?'on':'off')}),L('Automatic sync (when you save, when the app opens, and when another device changes data)','مزامنة تلقائية (عند الحفظ، وعند فتح التطبيق، وعند تغيير بيانات من جهاز آخر)')),
   msg,
   h('div',{class:'divider'}),h('h4',{},L('Cloud members & roles','أعضاء السحابة وصلاحياتهم')),
   h('p',{class:'hint'},L('Inspectors can add/edit inspections only. Managers can also change library, AQL plans, settings and delete records. Only the owner changes roles.','المفتش يضيف ويعدل الفحوصات فقط. المدير يعدل أيضاً المكتبة وخطط AQL والإعدادات ويحذف السجلات. المالك وحده يغير الصلاحيات.')),
   row(btn(L('Show members','عرض الأعضاء'),loadMembers),btn(L('New join code','رمز انضمام جديد'),async()=>{const r=await cloudClient().rpc('aql_rotate_join_code',{p_workspace:needWs()});if(r.error)throw r.error;note('New join code: '+r.data,'رمز الانضمام الجديد: '+r.data)})),membersBox,
   h('p',{class:'warn'},L('Run the latest AQL_Supabase_Setup.sql once in Supabase. Not synced by design: members and PINs (they stay on each device for security) and customer-comparison PDFs. When the same record changed on two devices, the newer edit wins (a device joining for the first time adopts the workspace settings).','شغّل أحدث ملف AQL_Supabase_Setup.sql مرة واحدة في Supabase. لا تتزامن عمداً: الأعضاء والأرقام السرية (تبقى على كل جهاز للأمان) وملفات PDF الخاصة بالمقارنات. عند تعديل نفس السجل على جهازين يفوز التعديل الأحدث (والجهاز الذي ينضم لأول مرة يتبنى إعدادات مساحة العمل).')));
}

/*SYNC-REGION-START*/
/* ---- photos: content-addressed upload (only what the cloud doesn't have yet), parallel download that reuses local copies ---- */
async function aqlPool(items,n,fn){let i=0;const w=async()=>{while(i<items.length){const k=i++;await fn(items[k],k)}};await Promise.all(Array.from({length:Math.min(n,items.length)},w))}
async function aqlHash24(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return[...new Uint8Array(b)].slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('')}
const aqlIsPhoto=v=>typeof v==='string'&&/^data:image\//i.test(v);
function aqlPhotoExt(v){const m=/^data:image\/([a-z0-9.+-]+)/i.exec(v);return((m&&m[1])||'jpeg').toLowerCase().replace('jpeg','jpg').replace(/[^a-z0-9]/g,'')||'jpg'}
async function aqlPhotoToCloud(root,c,ws,basePath,gc){
 const found=[];const walk=v=>{if(aqlIsPhoto(v)){found.push(v);return{__ph:found.length-1}}if(Array.isArray(v))return v.map(walk);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))o[k]=walk(v[k]);return o}return v};
 const skel=walk(root);if(!found.length)return root;
 const names=new Array(found.length);await aqlPool(found,4,async(v,i)=>{names[i]='h-'+await aqlHash24(v)+'.'+aqlPhotoExt(v)});
 let have=new Set();try{const l=await c.storage.from('aql-photos').list(basePath,{limit:1000});if(l&&l.data)have=new Set(l.data.map(f=>f.name))}catch(e){}
 const byName=new Map();names.forEach((n,i)=>{if(!byName.has(n))byName.set(n,found[i])});
 await aqlPool([...byName.keys()].filter(n=>!have.has(n)),3,async n=>{const blob=await(await fetch(byName.get(n))).blob(),up=await c.storage.from('aql-photos').upload(basePath+'/'+n,blob,{contentType:blob.type||'image/jpeg',upsert:true});if(up.error)throw up.error});
 if(gc)[...have].filter(n=>/^photo-\d+\./.test(n)).forEach(n=>gc.push(basePath+'/'+n));
 const fix=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(fix):('__ph' in v?{__aqlCloudPhoto:basePath+'/'+names[v.__ph]}:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fix(x)])))):v;
 return fix(skel)}
async function aqlPhotoFromCloud(root,c,localObj){
 const refs=[];const walk=v=>{if(v&&typeof v==='object'&&!Array.isArray(v)&&typeof v.__aqlCloudPhoto==='string'){refs.push(v.__aqlCloudPhoto);return{__ph:refs.length-1}}if(Array.isArray(v))return v.map(walk);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))o[k]=walk(v[k]);return o}return v};
 const skel=walk(root);if(!refs.length)return root;
 const out=new Array(refs.length),reuse=new Map();
 if(localObj&&refs.some(p=>/\/h-[0-9a-f]{24}\./.test(p))){const mine=[];const w2=v=>{if(aqlIsPhoto(v))mine.push(v);else if(Array.isArray(v))v.forEach(w2);else if(v&&typeof v==='object')Object.values(v).forEach(w2)};w2(localObj);
  await aqlPool(mine,4,async v=>{reuse.set('h-'+await aqlHash24(v)+'.'+aqlPhotoExt(v),v)})}
 const need=[];refs.forEach((p,i)=>{const n=p.slice(p.lastIndexOf('/')+1);if(reuse.has(n))out[i]=reuse.get(n);else need.push(i)});
 const cache=new Map();
 await aqlPool(need,4,async i=>{const p=refs[i];if(!cache.has(p))cache.set(p,(async()=>{const d=await c.storage.from('aql-photos').download(p);if(d.error)throw d.error;return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('Could not read cloud photo'));r.readAsDataURL(d.data)})})());out[i]=await cache.get(p)});
 const fix=v=>v&&typeof v==='object'?(Array.isArray(v)?v.map(fix):('__ph' in v?out[v.__ph]:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fix(x)])))):v;
 return fix(skel)}
/* ---- safe two-way sync engine: per-record change detection, conflict rules, tombstones ---- */
const SYNC_NEW_META=ws=>({id:'syncmeta',ws,h:{},s:{},tomb:{},aud:{}});
async function syncHash(o){const s=JSON.stringify(o);try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch(e){return fbHash(s,'sync')}}
async function cloudRole(c,ws){const r=await c.rpc('aql_my_role',{p_workspace:ws});if(r.error){if(/aql_my_role|schema cache|does not exist|Could not find/i.test(r.error.message||''))return 'legacy';throw r.error}if(!r.data)throw new Error(L('This account is not a member of the workspace. Join it with the manager\'s code.','هذا الحساب ليس عضواً في مساحة العمل. انضم برمز المدير.'));return r.data}
async function cloudFetchPayloads(c,ws,keys){const by={};keys.forEach(k=>{const i=k.indexOf('/');(by[k.slice(0,i)]=by[k.slice(0,i)]||[]).push(k.slice(i+1))});const out=new Map();
 for(const [t,ids] of Object.entries(by))for(let i=0;i<ids.length;i+=20){const r=await c.from('aql_cloud_records').select('record_type,record_id,payload,updated_at').eq('workspace_id',ws).eq('record_type',t).in('record_id',ids.slice(i,i+20));if(r.error)throw r.error;for(const x of r.data)out.set(t+'/'+x.record_id,x)}return out}
async function cloudRemovePhotos(c,ws,type,id){try{const base=`${ws}/${type}/${encodeURIComponent(String(id)).replace(/%/g,'_')}`;const l=await c.storage.from('aql-photos').list(base);if(l&&l.data&&l.data.length)await c.storage.from('aql-photos').remove(l.data.map(f=>base+'/'+f.name))}catch(e){}}
async function cloudSyncCore(mode,opts){opts=opts||{};
 const c=cloudClient(),ws=localStorage.getItem(CLOUD_WS_KEY);
 if(!ws)throw new Error(L('Create or join a workspace first.','أنشئ مساحة عمل أو انضم إليها أولاً.'));
 const ses=await c.auth.getSession();if(ses.error)throw ses.error;if(!ses.data.session)throw new Error(L('Sign in to your cloud account first.','سجل الدخول إلى حساب السحابة أولاً.'));
 const role=await cloudRole(c,ws),mgr=role!=='inspector',canW=k=>mgr||k.startsWith('inspections/')||k.startsWith('kv/inspset_')||k.startsWith('kv/cust_')||k.startsWith('library/');
 let meta=await DB.get('kv','syncmeta');if(!meta||meta.ws!==ws)meta=SYNC_NEW_META(ws);['h','s','tomb','aud'].forEach(f=>meta[f]=meta[f]||{});
 const st={up:0,down:0,del:0,delLocal:0,conf:0,skip:0,err:'',changed:false,pull:{ins:[],other:false}},T='aql_cloud_records',OC={onConflict:'workspace_id,record_type,record_id'};
 const failed=new Set(),fail=(e,k)=>{st.skip++;if(k)failed.add(k);if(!st.err)st.err=(e&&e.message)||String(e)};
 const sput=(s,o)=>{DB.own++;DB.noKick=true;DB.noDirty=true;try{return DB.put(s,o)}finally{DB.noKick=false;DB.noDirty=false}};
 const rev0=DB.rev-DB.own,startT=Date.now(),dirtySnap=new Map(DB.dirty||[]);
 /* fast (automatic) runs only look at records changed since the last sync; manual runs and a daily run verify everything */
 const full=!opts.fast||!meta.fullAt||Date.now()-meta.fullAt>864e5;
 try{
  /* 1. cloud index (metadata only; the audit log is handled separately) */
  const idx=new Map();let from=0;
  while(true){const r=await c.from(T).select('record_type,record_id,updated_at').eq('workspace_id',ws).neq('record_type','audit').order('record_type').order('record_id').range(from,from+499);if(r.error)throw r.error;for(const x of r.data)idx.set(x.record_type+'/'+x.record_id,Date.parse(x.updated_at));if(r.data.length<500)break;from+=500}
  /* 2. local records: only the keys here; bodies (with photos) are read on demand */
  const local=new Map();
  for(const t of ['library','plans','inspections'])for(const k of await DB.keys(t))local.set(t+'/'+k,{store:t,type:t,id:String(k),rid:k,obj:undefined});
  for(const k of await DB.keys('kv')){const id=String(k);if(id==='settings'||id==='lists'||id.startsWith('inspset_')||id.startsWith('cust_'))local.set('kv/'+id,{store:'kv',type:'kv',id,rid:k,obj:undefined})}
  const LO=async k=>{const e=local.get(k);if(e.obj===undefined)e.obj=await DB.get(e.store,e.rid);return e.obj};
  const hc=new Map(),H=async k=>{if(!hc.has(k)){const e=local.get(k),o=await LO(k);hc.set(k,await syncHash(o));if(!e.keep)e.obj=undefined}return hc.get(k)};
  const lchg=async k=>(!full&&meta.h[k]!==undefined&&!dirtySnap.has(k))?false:(await H(k))!==meta.h[k];
  /* 3. decide per record */
  const toPull=new Set(),toPush=new Set(),toDelCloud=[],toDelLocal=[],conflicts=[];
  const keys=new Set([...local.keys(),...idx.keys()]);
  for(const k of keys){
   const L0=local.get(k),cs=idx.get(k),bs=meta.s[k],tomb=meta.tomb[k],cw=canW(k);
   if(!L0){
    if(cs===undefined){delete meta.tomb[k];delete meta.h[k];delete meta.s[k];continue}
    if(tomb){if(bs!==undefined&&cs===bs){if(mode!=='pull'&&cw)toDelCloud.push(k);else st.skip++}else{delete meta.tomb[k];if(mode!=='push')toPull.add(k)}continue}
    if(mode!=='push')toPull.add(k);continue}
   if(tomb)delete meta.tomb[k];
   if(cs===undefined){
    if(bs!==undefined){if(mode!=='push'&&!(await lchg(k)))toDelLocal.push(k);else if(mode!=='pull'&&cw)toPush.add(k);continue}
    if(mode!=='pull'&&cw)toPush.add(k);continue}
   const cch=bs===undefined||cs!==bs,lc=await lchg(k);
   if(!lc&&!cch)continue;
   if(lc&&!cch){if(mode!=='pull'&&cw)toPush.add(k);continue}
   if(!lc&&cch){if(mode!=='push')toPull.add(k);continue}
   conflicts.push(k);
  }
  /* 4. resolve conflicts (newer edit wins; explicit upload/download choose a side) */
  const need=[...toPull,...conflicts],fetched=need.length?await cloudFetchPayloads(c,ws,need):new Map();
  const ts=o=>Math.max(+o.updatedAt||0,+o.deletedAt||0);
  for(const k of conflicts){
   const row=fetched.get(k),lo=await LO(k),cw=canW(k);
   if(!row||!row.payload||typeof row.payload!=='object'){if(mode!=='pull'&&cw)toPush.add(k);continue}
   const co=row.payload;
   if(ts(lo)>0&&ts(co)>0&&ts(lo)===ts(co)){meta.h[k]=await H(k);meta.s[k]=idx.get(k);continue}
   st.conf++;let w;
   if(mode==='push')w=cw?'local':'cloud';else if(mode==='pull')w='cloud';
   else if(ts(lo)>0&&ts(co)>0)w=ts(lo)>ts(co)?'local':'cloud';
   else w=(meta.s[k]===undefined||!cw)?'cloud':'local';
   if(w==='local'&&cw)toPush.add(k);else toPull.add(k)}
  /* 5. pull (photos already on this device are reused, the rest download in parallel) */
  for(const k of toPull){try{const row=fetched.get(k);if(!row||!row.payload||typeof row.payload!=='object')continue;const i=k.indexOf('/'),type=k.slice(0,i);
    if(type==='kv'&&!['settings','lists'].includes(row.payload.id)&&!String(row.payload.id).startsWith('inspset_')&&!String(row.payload.id).startsWith('cust_'))continue;
    const lo=local.has(k)?await LO(k):null,x=await aqlPhotoFromCloud(row.payload,c,lo);if(local.has(k))local.get(k).obj=undefined;
    await sput(type,x);meta.h[k]=await syncHash(await DB.get(type,x.id));meta.s[k]=idx.get(k);st.down++;st.changed=true;if(type==='inspections')st.pull.ins.push(x.id);else st.pull.other=true}catch(e){fail(e,k)}}
  /* 6. push */
  let batch=[];const flush=async()=>{if(!batch.length)return;const part=batch;batch=[];const r=await c.from(T).upsert(part.map(b=>b.row),OC);if(r.error){part.forEach(b=>failed.add(b.k));throw r.error}part.forEach(b=>{meta.h[b.k]=b.lh;meta.s[b.k]=b.stamp;st.up++});
    const gcAll=part.flatMap(b=>b.gc);if(gcAll.length){try{await c.storage.from('aql-photos').remove(gcAll)}catch(e){}}};
  for(const k of toPush){try{const e=local.get(k);e.keep=true;const lh=await H(k),obj=await LO(k),gc=[],safe=encodeURIComponent(e.id).replace(/%/g,'_');
    const payload=await aqlPhotoToCloud(obj,c,ws,`${ws}/${e.type}/${safe}`,gc),iso=new Date().toISOString();e.obj=undefined;e.keep=false;
    batch.push({k,lh,gc,stamp:Date.parse(iso),row:{workspace_id:ws,record_type:e.type,record_id:e.id,payload,updated_at:iso}});if(batch.length>=10)await flush()}catch(e2){fail(e2,k)}}
  try{await flush()}catch(e){fail(e);batch=[]}
  /* 7. deletions */
  for(const k of toDelCloud){try{const i=k.indexOf('/'),type=k.slice(0,i),id=k.slice(i+1);const r=await c.from(T).delete().eq('workspace_id',ws).eq('record_type',type).eq('record_id',id);if(r.error)throw r.error;await cloudRemovePhotos(c,ws,type,id);delete meta.tomb[k];delete meta.h[k];delete meta.s[k];st.del++}catch(e){fail(e,k)}}
  for(const k of toDelLocal){try{const L0=local.get(k);DB.noTomb=true;DB.own++;try{await DB.del(L0.store,L0.rid)}finally{DB.noTomb=false}delete meta.h[k];delete meta.s[k];st.delLocal++;st.changed=true;st.pull.other=true}catch(e){fail(e,k)}}
  /* 8. audit log: push only what is new, pull only what is newer than the last pull (never the whole history) */
  if(mode!=='pull'){const ak=await DB.get('kv','audit'),items=(ak&&ak.items)||[],mine=items.map((x,i)=>({...x,id:String(x.id||x.at||i)})).filter(x=>!meta.aud[x.id]);
    for(let i=0;i<mine.length;i+=20){const part=mine.slice(i,i+20);const r=await c.from(T).upsert(part.map(x=>({workspace_id:ws,record_type:'audit',record_id:x.id,payload:x,updated_at:new Date().toISOString()})),OC);if(r.error){fail(r.error);break}part.forEach(x=>meta.aud[x.id]=1)}}
  if(mode!=='push'){let q=c.from(T).select('record_id,payload,updated_at').eq('workspace_id',ws).eq('record_type','audit');
    if(meta.audT)q=q.gt('updated_at',new Date(Date.parse(meta.audT)-6e5).toISOString()).order('updated_at',{ascending:true}).limit(1000);else q=q.order('updated_at',{ascending:false}).limit(500);
    const r=await q;if(r.error)fail(r.error);else if(r.data.length){const ak=await DB.get('kv','audit'),old=(ak&&ak.items)||[],have=new Set(old.map(x=>String(x.id||x.at))),add=r.data.map(x=>x.payload).filter(p=>p&&p.action&&!have.has(String(p.id||p.at)));
     meta.audT=r.data.reduce((m,x)=>x.updated_at>m?x.updated_at:m,meta.audT||'');r.data.forEach(x=>meta.aud[x.record_id]=1);
     if(add.length){const mp=new Map();[...old,...add].forEach((x,i)=>mp.set(String(x.id||x.at||i),x));await sput('kv',{id:'audit',items:[...mp.values()].sort((a,b)=>(b.at||0)-(a.at||0)).slice(0,500)})}}}
  {const ks=Object.keys(meta.aud);if(ks.length>6000)ks.slice(0,ks.length-4000).forEach(k=>delete meta.aud[k])}
  /* local changes that were handled are no longer "dirty" (a failed record stays dirty and is retried) */
  if(mode!=='pull'){for(const [k,v] of dirtySnap)if(!failed.has(k)&&DB.dirty.get(k)===v)DB.dirty.delete(k);if(DB.saveDirty)DB.saveDirty()}
  if(full&&!st.err)meta.fullAt=Date.now();
 }finally{
  try{const cur=await DB.get('kv','syncmeta');if(cur&&cur.ws===ws&&cur.tomb)for(const k in cur.tomb)if(!(k in meta.tomb)&&cur.tomb[k]>=startT)meta.tomb[k]=cur.tomb[k];await sput('kv',meta)}catch(e){}
 }
 CLOUD_SEEN={ws,rev:rev0};
 localStorage.setItem(CLOUD_LASTSYNC_KEY,String(Date.now()));
 return st;
}

/* automatic background sync (safe: only changed records, never blocks the form being edited) */
let CLOUD_AUTO_T=0;
async function cloudAuto(force){
 try{
  if(CLOUD_BUSY||localStorage.getItem(CLOUD_AUTO_KEY)==='off'||!navigator.onLine||!localStorage.getItem(CLOUD_WS_KEY))return;
  if(!force&&Date.now()-CLOUD_AUTO_T<60000)return;
  const cfg=cloudCfg();if(!cfg.url||!window.supabase||!window.supabase.createClient)return;
  const s=await cloudClient().auth.getSession();if(!s.data||!s.data.session){CLOUD_ST.s='signedout';cloudChip();return}
  CLOUD_UID=s.data.session.user.id;cloudRealtime();
  CLOUD_AUTO_T=Date.now();CLOUD_BUSY=true;
  const st=await cloudSync('both',{fast:true});
  CLOUD_LAST=(st.err?'Auto sync finished with errors: '+st.err:'');
  if(st.changed){if(st.pull&&!st.pull.other&&st.pull.ins.length&&!st.delLocal)await patchIns(st.pull.ins);else await loadAll();notifyNewReports();if(!dirty&&!(ROUTE.startsWith('#/new')||ROUTE.startsWith('#/i/')))render()}
 }catch(e){CLOUD_LAST='Auto sync failed: '+((e&&e.message)||e)}finally{CLOUD_BUSY=false}
}
async function patchIns(ids){for(const id of ids){const x=await DB.get('inspections',id);S.ins=S.ins.filter(y=>y.id!==id);S.trash=S.trash.filter(y=>y.id!==id);if(x){migratePhotos(x);(x.deletedAt?S.trash:S.ins).push(x)}}S.ins.sort((a,b)=>b.createdAt-a.createdAt);S.trash.sort((a,b)=>b.createdAt-a.createdAt)}
window.addEventListener('online',()=>cloudAuto(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)cloudAuto()});
setTimeout(()=>cloudAuto(true),5000);
/* =====================================================================
   v3: per-inspector cloud account page, live alerts, file archive
   ===================================================================== */
const CLOUD_ST={s:'idle',err:''};            /* idle | off | signedout | busy | ok | err */
const FILES_AUTO_KEY='aql-files-auto-v1',PEND_KEY='aql-seen-pending-v1';
function cloudChipText(){
 if(!LS.get(CLOUD_WS_KEY))return '☁️ '+L('Not linked','غير مربوط');
 if(!navigator.onLine)return '☁️ '+L('Offline','بدون إنترنت');
 if(CLOUD_ST.s==='signedout')return '☁️ '+L('Sign in','سجّل الدخول');
 if(CLOUD_ST.s==='busy')return '☁️ '+L('Syncing…','مزامنة…');
 if(CLOUD_ST.s==='err')return '☁️ ⚠ '+L('Error','خطأ');
 const t=+LS.get(CLOUD_LASTSYNC_KEY)||0;
 return '☁️ ✓ '+(t?new Date(t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'');
}
function cloudChipEl(){return h('a',{id:'cloud-chip',href:'#/cloud',class:'cloud-chip '+CLOUD_ST.s,title:CLOUD_ST.err||''},cloudChipText())}
function cloudChip(){const el=document.getElementById('cloud-chip');if(!el)return;el.textContent=cloudChipText();el.className='cloud-chip '+CLOUD_ST.s;el.title=CLOUD_ST.err||''}
window.addEventListener('offline',cloudChip);window.addEventListener('online',cloudChip);

/* sync wrapper: keeps the header chip up to date */
async function cloudSync(mode,opts){CLOUD_ST.s='busy';cloudChip();
 try{const st=await cloudSyncCore(mode,opts);CLOUD_ST.s=st.err?'err':'ok';CLOUD_ST.err=st.err||'';return st}
 catch(e){CLOUD_ST.s='err';CLOUD_ST.err=(e&&e.message)||String(e);throw e}
 finally{cloudChip()}}

/* push right after a local change (e.g. an inspector submits a report) instead of waiting for the 90 s timer */
let KICK_T=0,KICK_N=0;
function cloudKick(){clearTimeout(KICK_T);KICK_N=0;KICK_T=setTimeout(kickRun,2500)}
function kickRun(){if(CLOUD_BUSY&&KICK_N++<6){KICK_T=setTimeout(kickRun,3000);return}cloudAuto(true)}

/* small toast */
function toast(txt,href){let t=document.getElementById('toast');if(!t){t=h('div',{id:'toast',class:'toast noprint'});document.body.append(t)}
 t.textContent=txt;t.onclick=()=>{t.classList.remove('on');if(href)go(href)};t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),9000)}

/* manager: tell me about NEW reports waiting for review (compares with what was already seen on this device) */
function notifyNewReports(){
 try{if(!isMgr())return;const first=LS.get(PEND_KEY)===null;let seen=[];try{seen=JSON.parse(LS.get(PEND_KEY)||'[]')}catch(e){}
  const keyOf=i=>i.id+'@'+(i.updatedAt||i.createdAt||0),cur=S.ins.filter(i=>i.status==='pending_review');
  const fresh=cur.filter(i=>!seen.includes(keyOf(i))&&i.createdBy!==S.me.id);
  LS.set(PEND_KEY,JSON.stringify(cur.map(keyOf).slice(-300)));
  if(first||!fresh.length)return;
  const who=[...new Set(fresh.map(i=>i.inspectorName).filter(Boolean))].join('، ');
  toast('📥 '+L(fresh.length+' new report(s) waiting for your review'+(who?' — '+who:''),'وصلك '+fresh.length+' تقرير جديد بانتظار مراجعتك'+(who?' — '+who:'')),'#/')}catch(e){}}

/* realtime: wakes the manager's app up the moment an inspector writes to the cloud */
let CLOUD_RT=null,CLOUD_RT_WS='',RT_T=0,FILES_HOOK=null;
function cloudRealtimeStop(){try{if(CLOUD_RT&&CLOUD_CLIENT)CLOUD_CLIENT.removeChannel(CLOUD_RT)}catch(e){}CLOUD_RT=null;CLOUD_RT_WS=''}
function cloudRealtime(){
 try{const ws=LS.get(CLOUD_WS_KEY);if(!ws||!window.supabase||!window.supabase.createClient)return;if(CLOUD_RT&&CLOUD_RT_WS===ws)return;cloudRealtimeStop();
  const c=cloudClient();CLOUD_RT_WS=ws;
  CLOUD_RT=c.channel('aql-'+ws).on('postgres_changes',{event:'*',schema:'public',table:'aql_cloud_records',filter:'workspace_id=eq.'+ws},p=>{
    try{const n=p.new||{};
     if(FILES_HOOK&&n.record_type==='files')FILES_HOOK();
     if(n.record_type==='audit')return;
    }catch(e){}
    clearTimeout(RT_T);RT_T=setTimeout(()=>cloudAuto(true),1200)}).subscribe();
 }catch(e){}}
let CLOUD_UID='';
window.addEventListener('load',()=>setTimeout(async()=>{try{const s=await cloudClient().auth.getSession();if(s.data&&s.data.session){CLOUD_UID=s.data.session.user.id;cloudRealtime()}else if(LS.get(CLOUD_WS_KEY)){CLOUD_ST.s='signedout';cloudChip()}}catch(e){}},3000));

/* ---------- "My Cloud" page — for every user (inspector or manager) ---------- */
function vCloud(){
 const email=h('input',{type:'email',placeholder:L('Email','البريد الإلكتروني'),autocomplete:'email'}),
  pass=h('input',{type:'password',placeholder:L('Password (8+ characters)','كلمة المرور (8 أحرف أو أكثر)'),autocomplete:'current-password'}),
  code=h('input',{placeholder:L('Join code from the manager (first time only)','رمز الانضمام من المدير (أول مرة فقط)'),autocomplete:'off',style:'text-transform:uppercase'}),
  msg=h('p',{class:'hint cloud-msg'},CLOUD_LAST),acct=h('div',{class:'stack'}),team=h('div',{class:'stack'});
 const note=(en,ar)=>{CLOUD_LAST=L(en,ar);msg.textContent=CLOUD_LAST};
 const guard=(label,fn,cls)=>h('button',{type:'button',class:'btn '+(cls||''),onClick:async e=>{const b=e.currentTarget;if(CLOUD_BUSY){note('Another cloud operation is running. Try again in a moment.','عملية سحابة أخرى قيد التنفيذ. حاول بعد لحظات.');return}
   CLOUD_BUSY=true;b.disabled=true;note('Working…','جارٍ التنفيذ…');try{await fn()}catch(err){const m=(err&&err.message)||String(err);note('Error: '+m,'خطأ: '+m)}finally{CLOUD_BUSY=false;b.disabled=false}}},label);
 /* after login: join with the code if given; otherwise find the workspace this account already belongs to (second device) */
 const finishAuth=async()=>{const c=cloudClient();
  if(code.value.trim()){const j=await c.rpc('aql_join_workspace',{p_code:code.value.trim()});if(j.error)throw j.error;LS.set(CLOUD_WS_KEY,j.data);code.value=''}
  else if(!LS.get(CLOUD_WS_KEY)){const s=await c.auth.getSession(),uid=s.data.session.user.id;
   const m=await c.from('aql_workspace_members').select('workspace_id,role').eq('user_id',uid);if(m.error)throw m.error;
   if(m.data&&m.data.length===1)LS.set(CLOUD_WS_KEY,m.data[0].workspace_id);
   else if(m.data&&m.data.length>1)LS.set(CLOUD_WS_KEY,m.data[0].workspace_id);}
  const s2=await c.auth.getSession();CLOUD_UID=s2.data.session?s2.data.session.user.id:'';
  if(!LS.get(CLOUD_WS_KEY)){CLOUD_ST.s='signedout';cloudChip();note('Signed in, but this account has no workspace yet. Enter the join code from your manager and press Sign in again.','تم تسجيل الدخول لكن الحساب غير مرتبط بمساحة عمل. اكتب رمز الانضمام من المدير ثم اضغط تسجيل الدخول.');await paint();return}
  cloudRealtime();note('Signed in. Syncing…','تم تسجيل الدخول. جارٍ المزامنة…');
  const st=await cloudSync('both');if(st.changed)await loadAll();note('Done. Sent '+st.up+', received '+st.down+'.'+(st.err?' First error: '+st.err:''),'اكتملت المزامنة. أُرسل '+st.up+'، وصل '+st.down+'.'+(st.err?' أول خطأ: '+st.err:''));
  await paint();render()};
 const signIn=guard(L('Sign in','تسجيل الدخول'),async()=>{if(!email.value.trim()||!pass.value)throw new Error(L('Enter email and password.','أدخل البريد وكلمة المرور.'));
   const r=await cloudClient().auth.signInWithPassword({email:email.value.trim(),password:pass.value});if(r.error)throw r.error;await finishAuth()},'p');
 const signUp=guard(L('Create account','إنشاء حساب'),async()=>{if(!email.value.trim()||pass.value.length<8)throw new Error(L('Enter email and a password of at least 8 characters.','أدخل البريد وكلمة مرور لا تقل عن 8 أحرف.'));
   const r=await cloudClient().auth.signUp({email:email.value.trim(),password:pass.value});if(r.error)throw r.error;
   if(r.data&&r.data.session){await finishAuth()}else note('Account created. Open the confirmation email, then come back and press Sign in (add the join code the first time).','تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم ارجع واضغط تسجيل الدخول (واكتب رمز الانضمام أول مرة).')});
 const paint=async()=>{
  let ses=null;try{const s=await cloudClient().auth.getSession();ses=s.data&&s.data.session}catch(e){note('Error: '+e.message,'خطأ: '+e.message)}
  const ws=LS.get(CLOUD_WS_KEY),t=+LS.get(CLOUD_LASTSYNC_KEY)||0;
  if(!ses){acct.replaceChildren(h('div',{class:'card form'},h('h3',{},'☁️ '+L('Sign in to your cloud','سجّل الدخول إلى سحابتك')),
    h('p',{class:'hint'},L('Use one account per person. Reports you submit reach the manager automatically; the same account on another device brings your data there.','استخدم حساباً لكل شخص. التقارير التي ترسلها تصل للمدير تلقائياً، ونفس الحساب على جهاز آخر يجلب بياناتك إليه.')),
    email,pass,code,h('div',{class:'row wrap'},signIn,signUp)));team.replaceChildren();return}
  let role='';try{role=await cloudRole(cloudClient(),ws)}catch(e){role=''}
  const rl={owner:L('Owner','مالك'),manager:L('Manager','مدير'),inspector:L('Inspector','مفتش')}[role]||'—',mgr=role==='owner'||role==='manager';
  acct.replaceChildren(h('div',{class:'card form'},h('h3',{},'☁️ '+L('Your cloud','سحابتك')),
   h('div',{class:'kv'},h('span',{},L('Account','الحساب')),h('b',{},ses.user.email||'')),
   h('div',{class:'kv'},h('span',{},L('Role in the cloud','الصلاحية في السحابة')),h('b',{},ws?rl:L('Not linked','غير مربوط'))),
   h('div',{class:'kv'},h('span',{},L('Last sync','آخر مزامنة')),h('b',{},t?new Date(t).toLocaleString():L('never','لم تتم بعد'))),
   role==='inspector'?h('p',{class:'hint'},L('You can send inspections and files. You only see your own cloud copies; the manager sees everything.','تستطيع إرسال الفحوصات والملفات. ترى نسخك أنت فقط في السحابة، والمدير يرى الجميع.')):null,
   h('div',{class:'row wrap'},guard('🔄 '+L('Sync now','مزامنة الآن'),async()=>{const st=await cloudSync('both');if(st.changed)await loadAll();note('Done. Sent '+st.up+', received '+st.down+'.'+(st.err?' First error: '+st.err:''),'اكتملت المزامنة. أُرسل '+st.up+'، وصل '+st.down+'.'+(st.err?' أول خطأ: '+st.err:''));await paint();render()},'p'),
    guard(L('Sign out of cloud','خروج من السحابة'),async()=>{cloudRealtimeStop();const r=await cloudClient().auth.signOut();if(r.error)throw r.error;CLOUD_UID='';CLOUD_ST.s='signedout';cloudChip();note('Signed out. Local data was not deleted.','تم تسجيل الخروج. لم تُحذف البيانات المحلية.');await paint()})),
   h('label',{class:'chk'},h('input',{type:'checkbox',checked:LS.get(CLOUD_AUTO_KEY)!=='off',onChange:e=>LS.set(CLOUD_AUTO_KEY,e.target.checked?'on':'off')}),L('Automatic sync (when you save, when the app opens, and when another device changes data)','مزامنة تلقائية (عند الحفظ، وعند فتح التطبيق، وعند تغيير بيانات من جهاز آخر)'))));
  if(!mgr){team.replaceChildren();return}
  team.replaceChildren(h('div',{class:'card form'},h('h3',{},'👥 '+L('Inspectors in the cloud','المفتشون في السحابة')),
    h('div',{class:'row wrap'},guard(L('Show inspectors summary','عرض ملخص المفتشين'),async()=>{await teamSummary()}),
     guard(L('New join code for inspectors','رمز انضمام جديد للمفتشين'),async()=>{const r=await cloudClient().rpc('aql_rotate_join_code',{p_workspace:ws});if(r.error)throw r.error;try{await navigator.clipboard.writeText(r.data)}catch(e){}note('New join code (copied if allowed): '+r.data,'رمز الانضمام الجديد (تم نسخه إن سمح المتصفح): '+r.data)}),
     h('a',{class:'btn',href:'#/settings'},'⚙️ '+L('Workspace & roles','مساحة العمل والصلاحيات'))),
    h('div',{id:'team-out'})))};
 const teamSummary=async()=>{const c=cloudClient(),ws=LS.get(CLOUD_WS_KEY);
  const mem=await c.rpc('aql_list_members',{p_workspace:ws});if(mem.error)throw mem.error;
  const cnt=async type=>{const m=new Map();let from=0;while(true){const r=await c.from('aql_cloud_records').select('owner_id,updated_at').eq('workspace_id',ws).eq('record_type',type).range(from,from+999);if(r.error)throw r.error;
    r.data.forEach(x=>{const e=m.get(x.owner_id)||{n:0,t:0};e.n++;e.t=Math.max(e.t,Date.parse(x.updated_at)||0);m.set(x.owner_id,e)});if(r.data.length<1000)break;from+=1000}return m};
  const ins=await cnt('inspections'),fil=await cnt('files'),roleT={owner:L('Owner','مالك'),manager:L('Manager','مدير'),inspector:L('Inspector','مفتش')};
  const tb=h('tbody');(mem.data||[]).forEach(m=>{const a=ins.get(m.user_id)||{n:0,t:0},b=fil.get(m.user_id)||{n:0,t:0},last=Math.max(a.t,b.t);
    tb.append(h('tr',{},h('td',{style:'overflow-wrap:anywhere'},m.email),h('td',{},roleT[m.role]||m.role),h('td',{},a.n),h('td',{},b.n),h('td',{},last?new Date(last).toLocaleString():'—')))});
  const out=document.getElementById('team-out');if(out)out.replaceChildren(h('div',{style:'overflow-x:auto'},h('table',{class:'tbl'},h('thead',{},h('tr',{},[L('Account','الحساب'),L('Role','الصلاحية'),L('Reports in cloud','تقارير في السحابة'),L('Files in cloud','ملفات في السحابة'),L('Last activity','آخر نشاط')].map(t=>h('th',{},t)))),tb)));
  note('Summary loaded.','تم تحميل الملخص.')};
 setTimeout(paint,0);
 return h('div',{class:'stack'},acct,msg,team,h('p',{class:'warn'},L('Instant alerts reach the manager while the app is open. Offline work is kept on the device and sent when the internet returns. Members and PINs stay on each device by design.','التنبيه اللحظي يصل للمدير والتطبيق مفتوح. العمل بدون إنترنت يُحفظ على الجهاز ويُرسل عند عودة الإنترنت. الأعضاء والأرقام السرية تبقى على كل جهاز عمداً.')))}

/* ---------- File archive: device -> archive -> cloud ---------- */
const FILE_MAX=50*1024*1024;
const FILES_CLOUD=new Map();let FILES_CLOUD_OK=false,FILES_CLOUD_ERR='',FILES_CLOUD_AT=0;
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':n>=1024?Math.round(n/1024)+' KB':(n||0)+' B';
const fileIcon=m=>{const s=((m.mime||'')+' '+(m.name||'')).toLowerCase();return /pdf/.test(s)?'📕':/image\/|\.(png|jpe?g|gif|webp|heic)\b/.test(s)?'🖼':/sheet|excel|csv|\.xlsx?\b/.test(s)?'📊':/word|\.docx?\b/.test(s)?'📝':/zip|rar|7z/.test(s)?'🗜':'📄'};
const fileViewable=m=>{const s=((m.mime||'')+' '+(m.name||'')).toLowerCase();return /pdf|image\/|\.(png|jpe?g|gif|webp)\b/.test(s)};
async function filesSession(){const c=cloudClient(),ws=LS.get(CLOUD_WS_KEY);
 if(!ws)throw new Error(L('Link the cloud first (☁️ My Cloud).','اربط السحابة أولاً من صفحة ☁️ سحابتي.'));
 const s=await c.auth.getSession();if(s.error)throw s.error;
 if(!s.data.session)throw new Error(L('Sign in to the cloud first (☁️ My Cloud).','سجّل الدخول للسحابة أولاً من صفحة ☁️ سحابتي.'));
 CLOUD_UID=s.data.session.user.id;return{c,ws,user:s.data.session.user}}
async function filesCloudRefresh(force){
 if(!force&&FILES_CLOUD_OK&&Date.now()-FILES_CLOUD_AT<20000)return true;
 try{const {c,ws}=await filesSession();const rows=[];let from=0;
  while(true){const r=await c.from('aql_cloud_records').select('record_id,payload,owner_id,updated_at').eq('workspace_id',ws).eq('record_type','files').order('updated_at',{ascending:false}).range(from,from+199);if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<200)break;from+=200}
  FILES_CLOUD.clear();rows.forEach(x=>FILES_CLOUD.set(x.record_id,x));
  for(const f of await DB.all('files')){if(f.cloud&&!FILES_CLOUD.has(f.id)){f.cloud=null;await DB.put('files',f)}}
  FILES_CLOUD_OK=true;FILES_CLOUD_ERR='';FILES_CLOUD_AT=Date.now();return true}
 catch(e){FILES_CLOUD_OK=false;FILES_CLOUD_ERR=(e&&e.message)||String(e);return false}}
async function fileToCloud(rec,blob){
 const {c,ws,user}=await filesSession();
 const ext=((String(rec.name).match(/\.([A-Za-z0-9]{1,8})$/)||[])[1]||'bin').toLowerCase(),path=`${ws}/${user.id}/${rec.id}/file.${ext}`;
 const up=await c.storage.from('aql-files').upload(path,blob,{contentType:rec.mime||'application/octet-stream',upsert:true});if(up.error)throw up.error;
 const payload={id:rec.id,name:rec.name,size:rec.size,mime:rec.mime||'',note:rec.note||'',orderNo:rec.orderNo||'',insId:rec.insId||'',createdAt:rec.createdAt,uploaderName:rec.uploaderName||'',uploaderEmail:user.email||'',path},iso=new Date().toISOString();
 const r=await c.from('aql_cloud_records').upsert({workspace_id:ws,record_type:'files',record_id:rec.id,payload,updated_at:iso},{onConflict:'workspace_id,record_type,record_id'});
 if(r.error){try{await c.storage.from('aql-files').remove([path])}catch(e){}throw r.error}
 rec.cloud={path,at:Date.now()};await DB.put('files',rec);FILES_CLOUD.set(rec.id,{record_id:rec.id,payload,owner_id:user.id,updated_at:iso});await audit('file_uploaded',rec.id,{name:rec.name})}
async function fileFromCloud(p){const {c}=await filesSession();const d=await c.storage.from('aql-files').download(p.path);if(d.error)throw d.error;return new Blob([d.data],{type:p.mime||d.data.type||'application/octet-stream'})}

/* ===== ربط الملفات بالفحوصات ===== */
let FILE_ROWS_CACHE=[];
const insChoices=()=>S.ins.filter(i=>!i.deletedAt&&(isMgr()||mine(i))).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,150);
const insLabel=i=>(i.orderNo||'—')+' · '+i.id+' · '+stL(i.status);
async function fileRowsAll(){await filesCloudRefresh(false);
 const locals=await DB.all('files'),m=new Map();
 locals.forEach(f=>m.set(f.id,{id:f.id,loc:f,cl:FILES_CLOUD.get(f.id)||null,m:f}));
 FILES_CLOUD.forEach((x,id)=>{if(!m.has(id))m.set(id,{id,loc:null,cl:x,m:x.payload||{}})});
 let rows=[...m.values()];if(!isMgr())rows=rows.filter(r=>r.loc||(r.cl&&(r.cl.owner_id===CLOUD_UID||(r.cl.payload&&r.cl.payload.assignedTo===CLOUD_UID))));
 rows.forEach(r=>{r.state=r.loc&&r.cl?'both':r.loc?'dev':'cloud';r.insId=r.loc?(r.loc.insId||''):((r.cl&&r.cl.payload&&r.cl.payload.insId)||'')});
 FILE_ROWS_CACHE=rows;return rows}
async function fileBlob(r){if(r.loc){const d=await DB.get('filedata',r.id);if(d&&d.blob)return d.blob}if(r.cl)return await fileFromCloud(r.cl.payload);throw new Error(L('File not found.','لم يُعثر على الملف.'))}
async function fileOpenRow(r){const w=window.open('','_blank');try{const b=await fileBlob(r),u=URL.createObjectURL(new Blob([b],{type:r.m.mime||b.type}));if(w)w.location.href=u;else cmpSaveBlob(b,r.m.name);setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){if(w)w.close();throw e}}
async function fileSetIns(r,insId){
 const i=insId?(S.ins.find(x=>x.id===insId)||(D&&D.id===insId?D:null)):null,ord=i?(i.orderNo||''):'';
 if(r.loc){r.loc.insId=insId||'';if(ord)r.loc.orderNo=ord;r.loc.updatedAt=Date.now();await DB.put('files',r.loc)}
 let warn='';
 if(r.cl){try{const {c,ws}=await filesSession(),payload={...(r.cl.payload||{}),insId:insId||''};if(ord)payload.orderNo=ord;const iso=new Date().toISOString();
   const u=await c.from('aql_cloud_records').upsert({workspace_id:ws,record_type:'files',record_id:r.id,payload,updated_at:iso},{onConflict:'workspace_id,record_type,record_id'});if(u.error)throw u.error;
   FILES_CLOUD.set(r.id,{...r.cl,payload,updated_at:iso})}catch(e){warn=(e&&e.message)||String(e)}}
 await audit(insId?'file_linked':'file_unlinked',r.id,{ins:insId||'',name:(r.m&&r.m.name)||''});return warn}
async function fileAddRecs(fs,opt){let ok=0,big=0,errs=0,first='';const added=[];
 for(const f of fs){if(f.size>FILE_MAX){big++;continue}
  const buf=await f.arrayBuffer(),blob=new Blob([buf],{type:f.type||'application/octet-stream'}),rec={id:'f_'+Date.now().toString(36)+uid(5),name:f.name,size:f.size,mime:f.type||'',note:opt.note||'',orderNo:opt.orderNo||'',insId:opt.insId||'',createdAt:Date.now(),updatedAt:Date.now(),createdBy:S.me.id,uploaderName:S.me.name,cloud:null};
  await DB.put('files',rec);await DB.put('filedata',{id:rec.id,blob});await audit('file_added',rec.id,{name:rec.name,ins:rec.insId});added.push({rec,blob});ok++}
 if(LS.get(FILES_AUTO_KEY)==='on'&&navigator.onLine)for(const a of added){try{await fileToCloud(a.rec,a.blob)}catch(e){errs++;if(!first)first=(e&&e.message)||String(e)}}
 return{ok,big,errs,first}}
function insFilesCard(Di){
 const box=h('div',{class:'list'}),msg=h('p',{class:'hint cloud-msg'}),title=h('h3',{},''),linkBox=h('div');let rows=FILE_ROWS_CACHE;
 const say=(en,ar)=>{msg.textContent=L(en,ar)},sayErr=e=>{msg.textContent=L('Error: ','خطأ: ')+((e&&e.message)||e)};
 const guard=async(b,fn)=>{if(b)b.disabled=true;try{await fn()}catch(e){sayErr(e)}finally{if(b)b.disabled=false}};
 const reload=async()=>{try{rows=await fileRowsAll()}catch(e){}fill()};
 const fill=()=>{const mineR=rows.filter(r=>r.insId===Di.id).sort((a,b)=>(a.m.createdAt||0)-(b.m.createdAt||0));
  title.textContent='📎 '+L('Inspection files','ملفات الفحص')+' ('+mineR.length+')';
  const sameOrd=r=>norm(r.m.orderNo||'')===norm(Di.orderNo||'')?1:0;
  const free=rows.filter(r=>!r.insId&&(r.loc||(r.cl&&r.cl.payload&&r.cl.payload.assignedTo===CLOUD_UID))).sort((a,b)=>sameOrd(b)-sameOrd(a)||(b.m.createdAt||0)-(a.m.createdAt||0)).slice(0,100);
  linkBox.replaceChildren(...(free.length?[h('select',{onChange:e=>{const id=e.target.value;e.target.value='';const r=free.find(x=>x.id===id);if(r)guard(null,async()=>{const w=await fileSetIns(r,Di.id);if(w)say('Linked on this device; cloud update failed: '+w,'تم الربط على الجهاز؛ وفشل تحديث السحابة: '+w);else say('File added to this inspection.','تمت إضافة الملف للفحص.');await reload()})}},
    h('option',{value:''},'🔗 '+L('Add a file already in the archive…','إضافة ملف موجود في أرشيف الملفات…')),free.map(r=>h('option',{value:r.id},(r.m.name||'—')+(r.m.orderNo?' · '+r.m.orderNo:''))))]:[]));
  box.replaceChildren(...(mineR.length?mineR.map(r=>{const m=r.m;return h('div',{class:'card frow'},h('div',{class:'fmain'},h('span',{class:'ficon'},fileIcon(m)),h('div',{style:'min-width:0;flex:1'},h('b',{class:'fname'},m.name||'—'),h('div',{class:'hint'},[fmtSize(m.size),m.uploaderName?'👤 '+m.uploaderName:'',r.state==='dev'?'📱 '+L('Device only','على الجهاز فقط'):'☁️ '+L('In cloud','في السحابة')].filter(Boolean).join(' · ')),m.note?h('div',{class:'hint'},'📝 '+m.note):null)),
    h('div',{class:'fbtns'},fileViewable(m)?h('button',{type:'button',class:'btn s',onClick:e=>guard(e.currentTarget,()=>fileOpenRow(r))},'👁 '+L('Open','فتح')):null,
     h('button',{type:'button',class:'btn s',onClick:e=>guard(e.currentTarget,async()=>cmpSaveBlob(await fileBlob(r),m.name))},'⬇ '+L('Download','تنزيل')),
     r.state==='dev'?h('button',{type:'button',class:'btn s p',onClick:e=>guard(e.currentTarget,async()=>{await fileToCloud(r.loc,await fileBlob(r));say('Uploaded to the cloud.','تم الرفع للسحابة.');await reload()})},'☁️ '+L('Upload to cloud','رفع للسحابة')):null,
     h('button',{type:'button',class:'btn s d',onClick:e=>guard(e.currentTarget,async()=>{const w=await fileSetIns(r,'');if(w)say('Unlinked on this device; cloud update failed: '+w,'تم فك الربط على الجهاز؛ وفشل تحديث السحابة: '+w);else say('Unlinked from this inspection (the file stays in the Files archive).','تم فك الربط (الملف باقٍ في أرشيف الملفات).');await reload()})},'✖ '+L('Unlink','فك الربط'))))}):[h('p',{class:'hint'},L('No files attached to this inspection yet.','لا توجد ملفات مرفقة بهذا الفحص بعد.'))]))};
 const pick=h('button',{type:'button',class:'btn p',onClick:e=>{const b=e.currentTarget,i=document.createElement('input');i.type='file';i.multiple=true;i.onchange=()=>guard(b,async()=>{const fs=[...i.files];if(!fs.length)return;const r=await fileAddRecs(fs,{insId:Di.id,orderNo:Di.orderNo||''});
   say('Added '+r.ok+' file(s) to this inspection.'+(r.big?' '+r.big+' skipped (over 50 MB).':'')+(r.errs?' Cloud upload failed for '+r.errs+': '+r.first:''),'تمت إضافة '+r.ok+' ملف للفحص.'+(r.big?' تم تخطي '+r.big+' (أكبر من 50MB).':'')+(r.errs?' فشل الرفع للسحابة لعدد '+r.errs+': '+r.first:''));await reload()});i.click()}},'📎 '+L('Add files from this device','إضافة ملفات من الجهاز'));
 fill();setTimeout(reload,0);
 return h('div',{class:'card form noprint'},title,h('div',{class:'row wrap'},pick,linkBox),msg,box)}


/* ===== استيراد دفعة تقارير PDF وتوزيعها على المفتشين حسب الاسم المكتوب داخل التقرير ===== */
const NAMEMAP_KEY='aql-name-map-v1';
const arNz=s=>String(s||'').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^a-z0-9\u0600-\u06FF]+/g,' ').trim();
let FFLATE_P=null;
function loadFflate(){if(window.fflate)return Promise.resolve(window.fflate);
 return FFLATE_P||(FFLATE_P=new Promise((res,rej)=>{const s=document.createElement('script');s.src='./vendor/fflate.js';s.onload=()=>res(window.fflate);s.onerror=()=>{FFLATE_P=null;rej(new Error(L('Could not load the ZIP reader. Open the app once while online, then try again.','تعذر تحميل قارئ ZIP. افتح التطبيق مرة واحدة بالإنترنت ثم أعد المحاولة.')))};document.head.append(s)}))}
async function pdfHeadText(file,maxPages){const lib=await cmpPdfjs();let doc;
 try{doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise}catch(e){return''}
 let out='';try{for(let p=1;p<=Math.min(maxPages,doc.numPages);p++){const pg=await doc.getPage(p);out+=' '+cmpLinesFrom((await pg.getTextContent()).items).join(' ')}}catch(e){}
 try{doc.destroy()}catch(e){}return out}
function detectInspector(text,names){const tx=' '+arNz(text)+' ';let best=null;
 for(const n of names){const nn=arNz(n);if(!nn)continue;let idx=tx.indexOf(' '+nn+' ');
  if(idx<0){const toks=nn.split(' ').filter(x=>x.length>1);if(toks.length>=2&&toks.every(x=>tx.includes(' '+x+' ')))idx=1000+Math.max(...toks.map(x=>tx.indexOf(' '+x+' ')))}
  if(idx>=0&&(!best||idx<best.idx||(idx===best.idx&&nn.length>best.len)))best={n,idx,len:nn.length}}
 return best?best.n:''}
async function expandPicked(list,progress){const out=[];
 for(const f of list){
  if(/\.zip$/i.test(f.name)||/zip/.test(f.type||'')){const lib=await loadFflate();progress(L('Unzipping ','فك ضغط ')+f.name+'…');
   const files=lib.unzipSync(new Uint8Array(await f.arrayBuffer()),{filter:e=>/\.pdf$/i.test(e.name)&&!/(^|\/)__MACOSX\//.test(e.name)});
   for(const path of Object.keys(files))out.push(new File([files[path]],path.split('/').pop(),{type:'application/pdf'}))}
  else if(/\.pdf$/i.test(f.name)||f.type==='application/pdf')out.push(f)}
 return out}
function batchImportCard(onDone){
 let items=[],accts=[],busy=false,map={};try{map=JSON.parse(LS.get(NAMEMAP_KEY)||'{}')}catch(e){}
 const msg=h('p',{class:'hint cloud-msg'}),sumEl=h('p',{class:'hint'}),mapBox=h('div',{class:'list'}),tbl=h('div',{class:'list'}),goBtn=h('button',{type:'button',class:'btn p',style:'display:none'},'');
 const say=(en,ar)=>{msg.textContent=L(en,ar)},sayErr=e=>{msg.textContent=L('Error: ','خطأ: ')+((e&&e.message)||e)};
 const opts=sel=>[h('option',{value:''},'— '+L('Not assigned','غير مُسند')+' —'),...accts.map(a=>h('option',{value:a.user_id,selected:a.user_id===sel},a.email+(a.role==='inspector'?'':' ('+a.role+')')))];
 const render=()=>{
  const na=items.filter(x=>!x.uid).length,tot=items.reduce((s,x)=>s+x.file.size,0);
  sumEl.textContent=items.length?(L(items.length+' file(s) · '+fmtSize(tot)+' · assigned '+(items.length-na)+' · not assigned '+na,items.length+' ملف · '+fmtSize(tot)+' · مُسند '+(items.length-na)+' · غير مُسند '+na)):'';
  const dn=[...new Set(items.map(x=>x.det).filter(Boolean))];
  mapBox.replaceChildren(...dn.map(n=>{const s=h('select',{onChange:e=>{map[n]=e.target.value;LS.set(NAMEMAP_KEY,JSON.stringify(map));items.forEach(x=>{if(x.det===n)x.uid=e.target.value});render()}},opts(map[n]||''));
   return h('div',{class:'row wrap'},h('b',{style:'flex:1'},'🔎 '+n+' ('+items.filter(x=>x.det===n).length+')'),s)}));
  tbl.replaceChildren(...items.map(it=>h('div',{class:'card frow'},h('div',{class:'fmain'},h('span',{class:'ficon'},'📄'),h('div',{style:'min-width:0;flex:1'},h('b',{class:'fname'},it.file.name),h('div',{class:'hint'},fmtSize(it.file.size)+' · '+(it.det?'🔎 '+it.det:L('Name not found in the report','لم يُعثر على اسم المفتش في التقرير'))),it.err?h('div',{class:'warn'},it.err):null)),
   h('div',{class:'fbtns'},h('select',{onChange:e=>{it.uid=e.target.value;render()}},opts(it.uid))))));
  goBtn.style.display=items.length&&!busy?'':'none';goBtn.textContent='☁️ '+L('Upload & distribute ('+items.length+')','رفع وتوزيع ('+items.length+')')};
 const run=async fn=>{if(busy)return;busy=true;try{await fn()}catch(e){sayErr(e)}finally{busy=false;render()}};
 const read=async list=>{const pdfs=await expandPicked(list,t=>{msg.textContent=t});if(!pdfs.length){say('No PDF files found.','لا توجد ملفات PDF.');return}
  const s=await filesSession(),r=await s.c.rpc('aql_list_members',{p_workspace:s.ws});if(r.error)throw r.error;accts=r.data||[];
  const names=inspectorList(),seen=new Set();items=[];
  for(let k=0;k<pdfs.length;k++){const f=pdfs[k],key=f.name+'|'+f.size;if(seen.has(key))continue;seen.add(key);msg.textContent=L('Reading reports ','قراءة التقارير ')+(k+1)+'/'+pdfs.length;
   const det=detectInspector(await pdfHeadText(f,2),names),u=det&&map[det]&&accts.some(a=>a.user_id===map[det])?map[det]:'';items.push({file:f,det,uid:u,err:'',done:false})}
  say('Review the distribution below, then press Upload.','راجع التوزيع ثم اضغط رفع وتوزيع.')};
 const go=()=>run(async()=>{
  if(items.some(x=>!x.uid)&&!confirm(L('Some files are not assigned to anyone (only you will see them). Continue?','بعض الملفات غير مُسندة لأي مفتش (ستظهر لك أنت فقط). المتابعة؟')))return;
  const {c,ws,user}=await filesSession();await filesCloudRefresh(true);let ok=0,skip=0,fail=0,n=0,q=items.slice();
  const one=async it=>{const a=accts.find(x=>x.user_id===it.uid);
   if([...FILES_CLOUD.values()].some(x=>x.payload&&x.payload.name===it.file.name&&x.payload.size===it.file.size&&(x.payload.assignedTo||'')===it.uid)){it.done=true;skip++;return}
   const id='f_'+Date.now().toString(36)+uid(5),path=ws+'/'+user.id+'/'+id+'/file.pdf';
   const up=await c.storage.from('aql-files').upload(path,it.file,{contentType:'application/pdf',upsert:true});if(up.error)throw up.error;
   const payload={id,name:it.file.name,size:it.file.size,mime:'application/pdf',note:'',orderNo:'',insId:'',createdAt:Date.now(),uploaderName:(S.me&&S.me.name)||'',uploaderEmail:user.email||'',assignedTo:it.uid,assignedName:it.det||(a?a.email:''),path},iso=new Date().toISOString();
   const r=await c.from('aql_cloud_records').upsert({workspace_id:ws,record_type:'files',record_id:id,payload,updated_at:iso},{onConflict:'workspace_id,record_type,record_id'});
   if(r.error){try{await c.storage.from('aql-files').remove([path])}catch(e){}throw r.error}
   FILES_CLOUD.set(id,{record_id:id,payload,owner_id:user.id,updated_at:iso});it.done=true;ok++};
  const worker=async()=>{while(q.length){const it=q.shift();try{await one(it)}catch(e){fail++;it.err=(e&&e.message)||String(e)}n++;msg.textContent=L('Uploading ','جارٍ الرفع ')+n+'/'+items.length}};
  await Promise.all([worker(),worker(),worker()]);
  await audit('files_batch_import','batch',{ok,skip,fail});items=items.filter(x=>!x.done);
  say('Done: uploaded '+ok+(skip?', already there '+skip:'')+(fail?', failed '+fail+' (press Upload again to retry)':'')+'.','تم: رُفع '+ok+(skip?'، موجود مسبقاً '+skip:'')+(fail?'، فشل '+fail+' (اضغط رفع وتوزيع للمحاولة مرة أخرى)':'')+'.');
  if(onDone)await onDone()});
 goBtn.onclick=go;
 const pickBtn=h('button',{type:'button',class:'btn',onClick:()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.pdf,.zip,application/pdf,application/zip';i.onchange=()=>run(()=>read([...i.files]));i.click()}},'📥 '+L('Choose PDFs or a ZIP','اختيار ملفات PDF أو ملف مضغوط'));
 render();
 return h('div',{class:'card form noprint'},h('h3',{},'📥 '+L('Batch import reports (manager)','استيراد دفعة تقارير (للمدير)')),
  h('p',{class:'hint'},L('Pick all the PDF reports (or one ZIP). The inspector name written inside each report is read and the file is sent to that inspector\'s account. On a phone prefer picking the PDFs over one big ZIP.','اختر كل تقارير PDF (أو ملف ZIP واحد). يُقرأ اسم المفتش المكتوب داخل كل تقرير ويُرسل الملف لحساب هذا المفتش. على الموبايل الأفضل اختيار الملفات نفسها بدل ZIP كبير.')),
  h('div',{class:'row wrap'},pickBtn,goBtn),msg,sumEl,mapBox,tbl)}



/* ===== إعدادات الفحص: منفصلة لكل مفتش (نقاط القياس، أقل صفحات الصور، صورة المفتش) ===== */
const inspKey=n=>{const s=arNz(n);let x=0x811c9dc5;for(let k=0;k<s.length;k++){x^=s.charCodeAt(k);x=Math.imul(x,0x01000193)>>>0}return 'inspset_'+x.toString(36)};
function setOf(ins){const g=S.settings||{},r=(S.inspSets||{})[inspKey((ins&&ins.inspectorName)||'')]||{};
 return{measPoints:r.measPoints||g.measPoints,minDefPages:r.minDefPages!==undefined?r.minDefPages:g.minDefPages,minItemPages:r.minItemPages!==undefined?r.minItemPages:g.minItemPages,avatar:r.avatar!==undefined?r.avatar:g.avatar,own:!!r.id}}
let INSP_WHO='';
function vInspSet(){
 const mgr=isMgr(),me=(S.me&&S.me.name)||'';
 const names=mgr?[...new Set([me,...inspectorList(),...Object.values(S.inspSets||{}).map(x=>x.for).filter(Boolean)])].filter(Boolean):[me];
 let who=mgr&&INSP_WHO&&names.includes(INSP_WHO)?INSP_WHO:me;
 const msg=h('p',{class:'hint'}),cur=setOf({inspectorName:who}),rec0=(S.inspSets||{})[inspKey(who)];let avatar=cur.avatar||'';
 const mp=cur.measPoints||{},ta=v=>h('textarea',{rows:8,dir:'auto'},v.join('\n'));
 const jk=ta(mp.jacket||MEASP.jacket),tr=ta(mp.trousers||MEASP.trousers);
 const def=h('input',{type:'number',min:0,max:6,value:String(cur.minDefPages??2)}),itm=h('input',{type:'number',min:0,max:6,value:String(cur.minItemPages??0)});
 const img=h('img',{style:'height:64px;border-radius:8px;display:none'}),setImg=v=>{avatar=v||'';if(avatar){img.src=avatar;img.style.display='block'}else{img.removeAttribute('src');img.style.display='none'}};setImg(avatar);
 const lines=el=>el.value.split('\n').map(x=>x.trim()).filter(Boolean),clamp=el=>Math.max(0,Math.min(6,Math.round(num(el.value))));
 const save=h('button',{type:'button',class:'btn p',onClick:async e=>{const b=e.currentTarget,j=lines(jk),t2=lines(tr);
   if(!j.length||!t2.length){msg.textContent=L('Each list needs at least one measurement point.','كل قائمة تحتاج نقطة قياس واحدة على الأقل.');return}
   b.disabled=true;try{
    const rec={id:inspKey(who),for:who,measPoints:{...(cur.measPoints||{}),jacket:j,trousers:t2},minDefPages:clamp(def),minItemPages:clamp(itm),avatar,updatedAt:Date.now(),updatedBy:me};
    await DB.put('kv',rec);S.inspSets=S.inspSets||{};S.inspSets[rec.id]=rec;await audit('inspector_settings_updated',rec.id,{for:who});
    def.value=String(rec.minDefPages);itm.value=String(rec.minItemPages);
    msg.textContent=L('Saved for '+who+'. It applies to '+who+'\'s reports and syncs to the cloud.','تم الحفظ لـ'+who+'. يُطبَّق على تقارير '+who+' ويتزامن مع السحابة.');try{cloudAuto(true)}catch(x){}
   }catch(err){msg.textContent=L('Error: ','خطأ: ')+((err&&err.message)||err)}finally{b.disabled=false}}},'💾 '+L('Save settings','حفظ الإعدادات'));
 return h('div',{class:'stack'},h('div',{class:'card form'},h('h3',{},'🛠 '+L('Inspection settings','إعدادات الفحص')),
  mgr&&names.length>1?h('label',{},L('Settings of','إعدادات'),h('select',{onChange:e=>{INSP_WHO=e.target.value;render()}},names.map(n=>h('option',{value:n,selected:n===who},n)))):null,
  h('p',{class:'hint'},L('These settings belong to '+who+' only and are applied to '+who+'\'s reports.','هذه الإعدادات خاصة بـ'+who+' فقط وتُطبَّق على تقاريره.')+(cur.own?'':' '+L('(Not saved yet: showing the default values.)','(لم تُحفظ بعد: تظهر القيم الافتراضية.)'))),
  rec0&&rec0.updatedAt?h('p',{class:'hint'},L('Last saved by ','آخر حفظ بواسطة ')+(rec0.updatedBy||'—')+' · '+new Date(rec0.updatedAt).toLocaleString()):null,
  h('label',{},L('Jacket measurement points (one per line)','نقاط قياس الجاكيت (نقطة في كل سطر)'),jk),
  h('label',{},L('Trousers measurement points (one per line)','نقاط قياس البنطلون (نقطة في كل سطر)'),tr),
  h('label',{},L('Minimum pages for "Photos of Defects" (0-6)','أقل عدد صفحات لـ«صور العيوب» (0-6)'),def),
  h('label',{},L('Minimum pages for "Actual Item" photos (0-6)','أقل عدد صفحات لـ«صور المنتج الفعلي» (0-6)'),itm),
  h('div',{class:'row wrap'},h('b',{style:'flex:1;font-size:14px'},L('Inspector picture on report','صورة المفتش بالتقرير')),img,
   h('button',{type:'button',class:'btn s',onClick:()=>pickOne(v=>setImg(v))},L('Upload','رفع')),h('button',{type:'button',class:'btn s',onClick:()=>setImg('')},'🗑')),
  save,msg))}

/* ===== استيراد تقارير PDF إلى الفحوصات: بيانات مضمّنة (دقيقة) أو قراءة بصرية OCR (للتقارير القديمة) ===== */
let PDFIMP_W=null,TESS_LIB=null;
function pdfImpLoadTess(){if(window.Tesseract)return Promise.resolve();
 return TESS_LIB||(TESS_LIB=new Promise((res,rej)=>{const s=document.createElement('script');s.src='./vendor/tess/tesseract.min.js';s.onload=res;s.onerror=()=>{TESS_LIB=null;rej(new Error(L('Could not load the reader. Open the app once while online, then try again.','تعذر تحميل محرك القراءة. افتح التطبيق مرة بالإنترنت ثم أعد المحاولة.')))};document.head.append(s)}))}
async function pdfImpWorker(){if(PDFIMP_W)return PDFIMP_W;await pdfImpLoadTess();const base=new URL('./vendor/tess/',location.href).href;
 PDFIMP_W=await Tesseract.createWorker('eng',1,{workerPath:base+'worker.min.js',corePath:base,langPath:base});return PDFIMP_W}
async function pdfImpRecog(a,w,h,psm,wl){const W=await pdfImpWorker(),pw=w+48,ph=h+48,c=document.createElement('canvas');c.width=pw;c.height=ph;const ctx=c.getContext('2d'),id=ctx.createImageData(pw,ph),d=id.data;d.fill(255);
 for(let y=0;y<h;y++){let o=((y+24)*pw+24)*4,s=y*w;for(let x=0;x<w;x++){const v=a[s+x];d[o]=v;d[o+1]=v;d[o+2]=v;o+=4}}
 ctx.putImageData(id,0,0);await W.setParameters({tessedit_pageseg_mode:String(psm),tessedit_char_whitelist:wl||''});const r=await W.recognize(c);return(r&&r.data&&r.data.text)||''}
/*PDFIMP-EXTRACT-START*/
async function pdfImpExtract(G,W,H,rec){
 const f=W/2382,S2=v=>Math.round(v*f),X={ok:false,defects:[],props:{},tot:null};
 const frac=(x0,y0,x1,y1,thr)=>{x0=S2(x0);y0=S2(y0);x1=Math.min(W,S2(x1));y1=Math.min(H,S2(y1));let n=0,t=0;for(let y=y0;y<y1;y++){const o=y*W;for(let x=x0;x<x1;x++){t++;if(G[o+x]<thr)n++}}return t?n/t:0};
 const lod=(x0,y0,x1,y1)=>{x0=S2(x0);y0=S2(y0);x1=Math.min(W,S2(x1));y1=Math.min(H,S2(y1));const w=x1-x0,h=y1-y0,a=new Uint8Array(w*h);for(let y=0;y<h;y++){const o=(y0+y)*W+x0;for(let x=0;x<w;x++)a[y*w+x]=G[o+x]>150?0:255}return{a,w,h}};
 const dol=(x0,y0,x1,y1,thr,pad)=>{x0=S2(x0);y0=S2(y0);x1=Math.min(W,S2(x1));y1=Math.min(H,S2(y1));let mx=1e9,my=1e9,Mx=-1,My=-1,n=0;
  for(let y=y0;y<y1;y++){const o=y*W;for(let x=x0;x<x1;x++)if(G[o+x]<thr){n++;if(x<mx)mx=x;if(x>Mx)Mx=x;if(y<my)my=y;if(y>My)My=y}}
  if(n<Math.max(8,Math.round(12*f*f)))return null;const p=Math.round(pad*f),bx=Math.max(x0,mx-p),by=Math.max(y0,my-p),bX=Math.min(x1-1,Mx+p),bY=Math.min(y1-1,My+p),w=bX-bx+1,h=bY-by+1,a=new Uint8Array(w*h);
  for(let y=0;y<h;y++){const o=(by+y)*W+bx;for(let x=0;x<w;x++)a[y*w+x]=G[o+x]<thr?0:255}return{a,w,h}};
 const txt=async(m,psm,wl)=>m?String(await rec(m.a,m.w,m.h,psm,wl)).replace(/\s+/g,' ').trim():'';
 const title=await txt(dol(120,285,1100,365,130,14),7);X.title=title;
 if(!/INSPECT|REPORT/i.test(title)&&frac(132,380,824,547,100)<0.3){X.unsupported=true;return X}
 const boxes=[[132,824],[861,1345],[1383,1797],[1834,2249]],rows=[[380,435],[437,492],[494,547]],names=[['customer','poCustomer','model'],['item','style','salesOrder'],['orderQty','actualQty','packing'],['date']];
 for(let b=0;b<4;b++)for(let r=0;r<rows.length;r++){if(b===3&&r>0)continue;const w=boxes[b][1]-boxes[b][0],m=lod(boxes[b][0]+Math.round(w*0.40),rows[r][0]+5,boxes[b][1]-8,rows[r][1]-5);let t=await txt(m,7);
  if(['orderQty','actualQty','packing'].includes(names[b][r])){const d=t.match(/\d[\d,]*/g);t=d?d[d.length-1].replace(/,/g,''):''}X[names[b][r]]=t}
 const cols=[[790,960],[968,1138],[1146,1314]],cnt=async(top,bot,c)=>{const m=dol(cols[c][0]+25,top+10,cols[c][1]-25,bot-8,130,14);if(!m)return 0;const t=await txt(m,10,'0123456789');const d=t.match(/\d+/);return d?parseInt(d[0],10):0};
 for(let k=0;k<15;k++){const top=1169+57*k,bot=1220+57*k,nm=await txt(dol(150,top+8,772,bot-6,130,14),7),cc=[await cnt(top,bot,0),await cnt(top,bot,1),await cnt(top,bot,2)];
  if(nm&&nm.length>1&&(cc[0]||cc[1]||cc[2]))X.defects.push({name:nm.replace(/[|_]+/g,'').trim(),c:cc[0],m:cc[1],n:cc[2]});else if(!nm&&(cc[0]||cc[1]||cc[2]))X.defects.push({name:'',c:cc[0],m:cc[1],n:cc[2]})}
 X.tot=[await cnt(2026,2073,0),await cnt(2026,2073,1),await cnt(2026,2073,2)];
 ['packaging','labeling','spec','approvedSample','measurement','visual'].forEach((key,k)=>{const top=1169+57*k,bot=1220+57*k,c=frac(1830,top+8,2000,bot-6,110),n=frac(2030,top+8,2236,bot-6,110);if(c>0.006||n>0.006)X.props[key]=c>=n?'yes':'no'});
 const dk=(x0,x1)=>frac(x0,2211,x1,2318,45),res=[['pass',dk(308,661)],['fail',dk(952,1429)],['pending',dk(1662,2131)]].sort((a,b)=>b[1]-a[1]);X.result=res[0][1]>0.002?res[0][0]:'pending';
 X.inspector=(await txt(dol(1780,2716,2240,2772,130,14),7)).replace(/^[^A-Za-z\u0600-\u06FF]+/,'');
 const cm=[];for(let k=0;k<6;k++){const y0=2524+72*k+14,y1=2524+72*(k+1)-14;if(frac(160,y0,1280,y1,130)>0.004){const t=await txt(dol(160,y0,1280,y1,130,14),7);if(/[A-Za-z\u0600-\u06FF]{3}/.test(t))cm.push(t)}}X.comment=cm.join('\n');
 X.ok=!!(X.customer||X.poCustomer);return X}
/*PDFIMP-EXTRACT-END*/
const PDFIMP_G={JACKET:'jacket',TROUSER:'trousers',VEST:'vest',WAISTCOAT:'vest',SHORT:'shorts',SUIT:'suit'};
function pdfImpLev(a,b){const m=a.length,n=b.length;if(!m)return n;if(!n)return m;let p=Array.from({length:n+1},(_,j)=>j);for(let i=1;i<=m;i++){const c=[i];for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c}return p[n]}
function pdfImpDefMatch(name){const n=arNz(name);if(!n)return null;let best=null,bs=0;for(const l of S.lib){for(const c of[l.nameEn,l.nameAr]){const m=arNz(c);if(!m)continue;const sc=m===n?1:1-pdfImpLev(m,n)/Math.max(m.length,n.length);if(sc>bs){bs=sc;best=l}}}return bs>=0.8?best:null}
function pdfImpDate(s){s=String(s||'');const M=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];let m=s.match(/(\d{1,2})\s*[-\/ .]\s*([A-Za-z]{3,})\s*[-\/ .]\s*(\d{4})/);if(m){const k=M.indexOf(m[2].slice(0,3).toLowerCase());if(k>=0)return`${m[3]}-${String(k+1).padStart(2,'0')}-${m[1].padStart(2,'0')}`}
 m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m)return`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;return''}
function pdfImpAql(ins){const cnt={critical:0,major:0,minor:0};(ins.defs||[]).forEach(d=>{if(cnt[d.severity]!==undefined)cnt[d.severity]+=num(d.pieces)});const lot=num(ins.actualQty)||num(ins.orderQty);ins.lotSize=lot?String(lot):'';
 const plan=activePlan(),ev=evaluate(plan,lot,cnt);if(ev.status==='ok'){ins.sampleSize=String(ev.sampleSize);ins.aql={planId:plan.id,planName:plan.name,version:plan.version,verified:!!plan.verified,countBasis:plan.countBasis,procedure:plan.procedure||'',sampleSize:ev.sampleSize,cats:ev.cats,result:ev.result,authoritative:ev.authoritative,at:new Date().toISOString()}}else ins.aql=null;return ev}
function pdfImpSetResult(ins,res){if(res==='pass'){ins.status='approved';ins.result='accepted'}else if(res==='fail'){ins.status='rejected';ins.result='rejected'}else{ins.status='in_progress';ins.result=null}}
const PDFIMP_ALIAS_KEY='aql-insp-alias-v1';
function pdfImpAlias(){try{return JSON.parse(LS.get(PDFIMP_ALIAS_KEY)||'{}')}catch(e){return{}}}
function pdfImpDup(ins){const k=norm(ins.orderNo),d=String(ins.date||'').slice(0,10),n=arNz(ins.inspectorName);return S.ins.some(x=>x.id===ins.id||(norm(x.orderNo)===k&&String(x.date||'').slice(0,10)===d&&arNz(x.inspectorName)===n))}
function pdfImpBuild(x,file){const notes=[],itemU=String(x.item||'').toUpperCase().replace(/[^A-Z]/g,'');let g='';for(const k of Object.keys(PDFIMP_G))if(itemU.includes(k)){g=PDFIMP_G[k];break}
 if(!g){g='jacket';notes.push(L('Garment type not recognised: set to Jacket.','لم يُتعرَّف على نوع القطعة: تم اختيار جاكيت.'))}
 const d=pdfImpDate(x.date);if(!d)notes.push(L('Date not read: today’s date used.','لم يُقرأ التاريخ: استُخدم تاريخ اليوم.'));const day=d||nowLocal().slice(0,10);
 const names=inspectorList(),nz=arNz(x.inspector);let insp=names.find(n=>arNz(n)===nz)||names.find(n=>nz&&(arNz(n).includes(nz)||nz.includes(arNz(n))))||'';if(!insp&&nz){const al=pdfImpAlias()[nz];if(al&&names.includes(al))insp=al}if(!insp){insp=x.inspector||(S.me&&S.me.name)||'';if(x.inspector)notes.push(L('Inspector “'+x.inspector+'” is not a registered member.','المفتش «'+x.inspector+'» غير مسجّل كعضو.'))}
 if(!isMgr())insp=(S.me&&S.me.name)||insp;const mem=S.members.find(m=>arNz(m.name)===arNz(insp));
 const ins={...newIns(),orderNo:x.poCustomer||x.salesOrder||'',customer:x.customer||'',model:x.model||'',garmentType:g,orderQty:x.orderQty||'',actualQty:x.actualQty||'',poCustomer:x.poCustomer||'',style:x.style||'',salesOrder:x.salesOrder||'',packingPct:x.packing||'',
  date:day+'T09:00',createdAt:new Date(day+'T09:00:00').getTime()||Date.now(),updatedAt:Date.now(),inspectorName:insp,createdBy:isMgr()?(mem?mem.id:(S.me?S.me.id:'')):(S.me?S.me.id:''),comment:x.comment||'',props:{...x.props},decisionNote:L('Imported from PDF report','مستورد من تقرير PDF'),history:[{at:Date.now(),by:(S.me&&S.me.name)||'',action:'imported_pdf'}]};
 let unk=0;const gOk=g==='suit'?['jacket','trousers']:[g];
 x.defects.forEach(df=>{const l=pdfImpDefMatch(df.name);if(!l)unk++;[['critical',df.c],['major',df.m],['minor',df.n]].forEach(([sev,c])=>{if(c>0)ins.defs.push({id:'d_'+uid(8),garment:(l&&(l.garments||[]).find(q=>gOk.includes(q)))||gOk[0],deptId:'',deptName:'',deptAr:'',defectId:l?l.id:'IMP-'+norm(df.name).slice(0,20),code:l?l.code:'',nameEn:l?l.nameEn:df.name,nameAr:l?l.nameAr:'',severity:sev,pieces:c,occurrences:c,description:'',photos:[],corrective:'',responsible:'',followUp:'none',reinspection:''})})});
 if(unk)notes.push(L(unk+' defect name(s) not found in the library (kept as written).','عدد '+unk+' من أسماء العيوب غير موجود في المكتبة (تُرك كما كُتب).'));
 const sums=[0,0,0];x.defects.forEach(df=>{sums[0]+=df.c;sums[1]+=df.m;sums[2]+=df.n});if(x.tot&&(x.tot[0]!==sums[0]||x.tot[1]!==sums[1]||x.tot[2]!==sums[2]))notes.push(L('Defect counts do not match the report totals: check them.','أعداد العيوب لا تطابق إجمالي التقرير: راجعها.'));
 if(!/^\d+$/.test(String(x.orderQty||'')))notes.push(L('Quantity not read.','لم تُقرأ الكمية.'));if(!/^\d+$/.test(String(x.actualQty||'')))notes.push(L('Actual quantity not read.','لم تُقرأ الكمية الفعلية.'));if(!ins.orderNo)notes.push(L('Order number not read.','لم يُقرأ رقم الطلبية.'));
 const ev=pdfImpAql(ins);pdfImpSetResult(ins,x.result);if(ev&&ev.result&&x.result!=='pending'&&ev.result!==x.result)notes.push(L('The AQL plan in the app gives '+ev.result.toUpperCase()+' but the report says '+x.result.toUpperCase()+'.','خطة AQL في التطبيق تعطي '+ev.result.toUpperCase()+' بينما التقرير يقول '+x.result.toUpperCase()+'.'));
 return{ins,notes,raw:x.inspector||''}}
async function pdfEmbed(i){try{const lib=await loadFflate(),strip=v=>typeof v==='string'?(v.startsWith('data:')?'':v):Array.isArray(v)?v.map(strip):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,strip(x)])):v,j=JSON.stringify(strip(i)),b=lib.zlibSync(lib.strToU8(j),{level:6});let s='';for(let k=0;k<b.length;k+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(k,k+0x8000));return'AQLDATA1:'+btoa(s)}catch(e){return''}}
async function pdfImpRead(file,progress){
 const lib=await cmpPdfjs(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 try{let kw='';try{const m=await doc.getMetadata();kw=(m&&m.info&&m.info.Keywords)||''}catch(e){}
  if(/^AQLDATA1:/.test(kw)){try{const f=await loadFflate(),bin=atob(kw.slice(9)),u=new Uint8Array(bin.length);for(let k=0;k<bin.length;k++)u[k]=bin.charCodeAt(k);const ins=JSON.parse(f.strFromU8(f.unzlibSync(u)));
    ['defs'].forEach(k=>(ins[k]||[]).forEach(d=>{d.photos=(d.photos||[]).filter(p=>p&&p.p)}));['itemPhotos','defPhotos'].forEach(k=>{ins[k]=(ins[k]||[]).filter(p=>p&&p.p)});
    if(!isMgr()){ins.inspectorName=(S.me&&S.me.name)||ins.inspectorName;ins.createdBy=S.me?S.me.id:ins.createdBy}
    ins.updatedAt=Date.now();return{ins,notes:[L('Exact data found inside the PDF (photos are not included).','بيانات دقيقة مضمّنة في الـPDF (الصور غير متضمّنة).')],exact:true}}catch(e){}}
  progress(L('Rendering page…','تجهيز الصفحة…'));const pg=await doc.getPage(1),v0=pg.getViewport({scale:1}),vp=pg.getViewport({scale:2382/v0.width}),cv=document.createElement('canvas');cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const cx=cv.getContext('2d',{willReadFrequently:true});cx.fillStyle='#fff';cx.fillRect(0,0,cv.width,cv.height);await pg.render({canvasContext:cx,viewport:vp}).promise;
  const id=cx.getImageData(0,0,cv.width,cv.height),d=id.data,G=new Uint8Array(cv.width*cv.height);for(let k=0,j=0;k<G.length;k++,j+=4)G[k]=(d[j]*299+d[j+1]*587+d[j+2]*114)/1000|0;cv.width=cv.height=1;
  progress(L('Reading the report…','قراءة التقرير…'));const x=await pdfImpExtract(G,id.width,id.height,pdfImpRecog);if(x.unsupported)return{error:L('Not a supported English report (Arabic or a different layout).','ليس تقريراً إنجليزياً مدعوماً (عربي أو شكل مختلف).')};if(!x.ok)return{error:L('Could not read the report header.','تعذرت قراءة بيانات التقرير.')};
  return pdfImpBuild(x,file)}finally{try{doc.destroy()}catch(e){}}}
function pdfImportCard(){
 let items=[],busy=false,stop=false,accts=[],map={};try{map=JSON.parse(LS.get(NAMEMAP_KEY)||'{}')}catch(e){}const msg=h('p',{class:'hint cloud-msg'}),mapBox=h('div',{class:'list'}),distBtn=h('button',{type:'button',class:'btn',style:'display:none'},''),list=h('div',{class:'list'}),goBtn=h('button',{type:'button',class:'btn p',style:'display:none'},''),stopBtn=h('button',{type:'button',class:'btn s d',style:'display:none'},'⏹ '+L('Stop','إيقاف'));
 const say=(en,ar)=>{msg.textContent=L(en,ar)},sayErr=e=>{msg.textContent=L('Error: ','خطأ: ')+((e&&e.message)||e)};
 const sevTxt=i=>{const c=[0,0,0];(i.defs||[]).forEach(d=>{const k=['critical','major','minor'].indexOf(d.severity);if(k>=0)c[k]+=num(d.pieces)});return c.join(' / ')};
 const resOf=i=>i.status==='approved'?'pass':i.status==='rejected'?'fail':'pending';
 const loadAccts=async()=>{if(!isMgr()||accts.length)return;try{const s=await filesSession(),r=await s.c.rpc('aql_list_members',{p_workspace:s.ws});if(!r.error)accts=r.data||[]}catch(e){}};
 const asg=it=>{const u=map[it.ins.inspectorName]||'';it.ins.assignedTo=u;it.ins.assignedName=u?it.ins.inspectorName:''};
 const notMe=n=>n&&!(S.me&&n===S.me.name),undist=()=>S.ins.filter(x=>x.importedFrom&&!x.assignedTo&&notMe(x.inspectorName));
 const memNames=()=>S.members.filter(m=>m.active).map(m=>m.name),isMember=n=>S.members.some(m=>m.name===n);
 const aliasBlock=()=>{if(!isMgr())return[];const raws=[...new Set(items.filter(x=>x.ins&&x.raw&&!isMember(x.ins.inspectorName)).map(x=>x.raw))];if(!raws.length)return[];const al=pdfImpAlias();
  return[h('p',{class:'warn'},'⚠ '+L('These names read from the reports are not registered members. Pick the matching member once (remembered):','الأسماء دي اتقرت من التقارير وهي مش أعضاء مسجّلين. اختار العضو المقابل لكل اسم مرة واحدة (يتحفظ):')),...raws.map(raw=>h('div',{class:'row wrap'},h('b',{style:'flex:1'},'🔎 «'+raw+'» ('+items.filter(x=>x.raw===raw).length+')'),
   h('select',{onChange:e=>{const v=e.target.value;if(!v)return;const a=pdfImpAlias();a[arNz(raw)]=v;LS.set(PDFIMP_ALIAS_KEY,JSON.stringify(a));const m=S.members.find(q=>q.name===v);
    items.forEach(it=>{if(it.raw===raw&&it.ins){it.ins.inspectorName=v;if(m)it.ins.createdBy=m.id;asg(it);it.notes=(it.notes||[]).filter(n=>!/registered member|غير مسجّل/.test(n));it.dup=pdfImpDup(it.ins);if(it.dup)it.sel=false}});render()}},[h('option',{value:''},'— '+L('Choose member','اختر العضو')+' —'),...memNames().map(n=>h('option',{value:n},n))])))]};
 const mapRender=()=>{if(!isMgr()){mapBox.replaceChildren();distBtn.style.display='none';return}
  const names=[...new Set([...items.filter(x=>x.ins).map(x=>x.ins.inspectorName),...undist().map(x=>x.inspectorName)])].filter(notMe);
  mapBox.replaceChildren(...aliasBlock(),...(names.length?[h('p',{class:'hint'},'📤 '+L('Send each inspector’s reports to their own account (kept for the next time):','إرسال تقارير كل مفتش لحسابه (يتحفظ للمرات الجاية):')),accts.length?null:h('p',{class:'warn'},L('Sign in to the cloud (Files archive) so the accounts can load.','سجّل دخول السحابة (أرشيف الملفات) عشان تظهر الحسابات.'))].filter(Boolean):[]).concat(accts.length?names.map(n=>h('div',{class:'row wrap'},h('b',{style:'flex:1'},'👤 '+n+' ('+(items.filter(x=>x.ins&&x.ins.inspectorName===n).length+undist().filter(x=>x.inspectorName===n).length)+')'),h('select',{onChange:e=>{map[n]=e.target.value;LS.set(NAMEMAP_KEY,JSON.stringify(map));items.forEach(it=>{if(it.ins&&it.ins.inspectorName===n)asg(it)});render()}},[h('option',{value:''},'— '+L('Manager only','عند المدير فقط')+' —'),...accts.map(a=>h('option',{value:a.user_id,selected:a.user_id===map[n]},a.email))]))):[]));
  const n=undist().filter(x=>map[x.inspectorName]).length;distBtn.style.display=n?'':'none';distBtn.textContent='📤 '+L('Send '+n+' previously imported inspection(s) to their inspectors','إرسال '+n+' فحص مستورد سابقاً لمفتشيهم')};
 distBtn.onclick=()=>run(async()=>{const list2=undist().filter(x=>map[x.inspectorName]);let k=0;for(const x of list2){await DB.put('inspections',{...x,assignedTo:map[x.inspectorName],assignedName:x.inspectorName,updatedAt:Date.now()});k++}await loadAll();try{cloudAuto(true)}catch(e){}say('Sent '+k+' inspection(s) to their inspectors. They appear in each inspector’s archive after sync.','تم إرسال '+k+' فحص لمفتشيهم. يظهروا في أرشيف كل مفتش بعد المزامنة.');render()});
 const redo=it=>{pdfImpAql(it.ins);it.dup=pdfImpDup(it.ins);if(it.dup)it.sel=false;render()};
 const field=(it,lb,key,type)=>h('label',{},lb,h('input',{type:type||'text',value:type==='date'?String(it.ins.date||'').slice(0,10):it.ins[key]||'',onChange:e=>{const v=e.target.value;if(type==='date'){it.ins.date=(v||String(it.ins.date).slice(0,10))+'T09:00';it.ins.createdAt=new Date(it.ins.date).getTime()||it.ins.createdAt}else{it.ins[key]=v;if(key==='orderNo')it.ins.poCustomer=v}redo(it)}}));
 const row=it=>{const i=it.ins;if(it.error)return h('div',{class:'card frow'},h('div',{class:'fmain'},h('span',{class:'ficon'},'⛔'),h('div',{style:'min-width:0;flex:1'},h('b',{class:'fname'},it.file.name),h('div',{class:'warn'},it.error))));
  const edit=it.open?h('div',{class:'form'},field(it,L('Order No.','رقم الطلبية'),'orderNo'),field(it,L('Customer','العميل'),'customer'),field(it,L('Model','الموديل'),'model'),field(it,L('Quantity','الكمية'),'orderQty','number'),field(it,L('Actual quantity','الكمية الفعلية'),'actualQty','number'),field(it,L('Date','التاريخ'),'date','date'),
   h('label',{},L('Result','النتيجة'),h('select',{onChange:e=>{pdfImpSetResult(i,e.target.value);redo(it)}},['pass','fail','pending'].map(r=>h('option',{value:r,selected:resOf(i)===r},r.toUpperCase())))),
   isMgr()?h('label',{},L('Inspector','المفتش'),h('select',{onChange:e=>{i.inspectorName=e.target.value;const m=S.members.find(x=>x.name===e.target.value);if(m)i.createdBy=m.id;asg(it);redo(it)}},[...new Set([i.inspectorName,...inspectorList()])].filter(Boolean).map(n=>h('option',{value:n,selected:n===i.inspectorName},n)))):null):null;
  return h('div',{class:'card frow'},h('div',{class:'fmain'},h('input',{type:'checkbox',checked:it.sel,disabled:it.dup,onChange:e=>{it.sel=e.target.checked;sum()}}),h('div',{style:'min-width:0;flex:1'},h('b',{class:'fname'},(i.orderNo||'—')+' · '+(i.customer||'—')),
   h('div',{class:'hint'},[fmtDate(i.date),gName(i.garmentType),resOf(i)==='pass'?'✅ PASS':resOf(i)==='fail'?'❌ FAIL':'⏳ PENDING',L('Qty ','الكمية ')+(i.orderQty||'—'),L('Defects ','العيوب ')+sevTxt(i),'👤 '+(i.inspectorName||'—')].join(' · ')),
   h('div',{class:'hint'},(i.defs||[]).map(d=>(S.lang==='ar'?(d.nameAr||d.nameEn):(d.nameEn||d.nameAr))+' ×'+d.pieces).join(' · ')||L('No defects','لا عيوب')),
   h('div',{class:'hint'},'📄 '+it.file.name),it.dup?h('div',{class:'warn'},L('Already in the archive: skipped.','موجود مسبقاً في الأرشيف: سيُتخطى.')):null,isMgr()&&notMe(i.inspectorName)?h('div',{class:i.assignedTo?'hint':'warn'},i.assignedTo?'📤 '+L('Will be sent to ','سيُرسل إلى ')+((accts.find(a=>a.user_id===i.assignedTo)||{}).email||i.assignedName):'⚠ '+L('Not linked to an account: stays with the manager only.','غير مربوط بحساب: يفضل عند المدير فقط.')):null,(it.notes||[]).map(n=>h('div',{class:'warn'},'⚠ '+n)))),
   h('div',{class:'fbtns'},h('button',{type:'button',class:'btn s',onClick:()=>{it.open=!it.open;render()}},'✏️ '+L('Edit','تعديل'))),edit)};
 const sum=()=>{const n=items.filter(x=>x.sel&&!x.error).length;goBtn.style.display=items.length&&!busy?'':'none';goBtn.disabled=!n;goBtn.textContent='⬇ '+L('Import '+n+' inspection(s)','استيراد '+n+' فحص')};
 const render=()=>{list.replaceChildren(...items.map(row));sum();mapRender()};
 const readAll=async files=>{const pdfs=await expandPicked(files,t=>say(t,t));if(!pdfs.length){say('No PDF files found.','لا توجد ملفات PDF.');return}
  await loadAccts();items=[];stop=false;stopBtn.style.display='';render();
  for(let k=0;k<pdfs.length&&!stop;k++){const f=pdfs[k],pr=t=>{msg.textContent=(k+1)+'/'+pdfs.length+' · '+f.name+' · '+t};pr(L('Opening…','فتح…'));
   try{const r=await pdfImpRead(f,pr);if(r.error)items.push({file:f,error:r.error});else{const dup=pdfImpDup(r.ins),it={file:f,ins:r.ins,notes:r.notes,raw:r.raw||'',sel:!dup,dup,atch:true,open:false};if(isMgr())asg(it);items.push(it)}}catch(e){items.push({file:f,error:(e&&e.message)||String(e)})}render()}
  stopBtn.style.display='none';say(stop?'Stopped. Review what was read, then import.':'Done reading. Review, fix anything wrong with ✏️, then import.',stop?'تم الإيقاف. راجع ما اتقرأ ثم استورد.':'انتهت القراءة. راجع وصحّح أي خطأ بزر ✏️ ثم استورد.')};
 const run=async fn=>{if(busy)return;busy=true;sum();try{await fn()}catch(e){sayErr(e)}finally{busy=false;stopBtn.style.display='none';sum()}};
 stopBtn.onclick=()=>{stop=true};
 goBtn.onclick=()=>run(async()=>{const sel=items.filter(x=>x.sel&&!x.error&&!x.dup);let ok=0,fail=0;
  for(const it of sel){try{const ins=it.ins;ins.updatedAt=Date.now();ins.importedFrom=it.file.name;await DB.put('inspections',ins);await audit('inspection_imported',ins.id,{file:it.file.name});if(attachChk.checked)await fileAddRecs([it.file],{insId:ins.id,orderNo:ins.orderNo});it.dup=true;it.sel=false;ok++}catch(e){fail++;it.error=(e&&e.message)||String(e)}msg.textContent=L('Importing ','جارٍ الاستيراد ')+(ok+fail)+'/'+sel.length}
  await loadAll();try{cloudAuto(true)}catch(e){}say('Imported '+ok+' inspection(s)'+(fail?', failed '+fail:'')+'. They now appear in the archive, monthly report and charts.','تم استيراد '+ok+' فحص'+(fail?'، فشل '+fail:'')+'. ظهروا الآن في الأرشيف والتقرير الشهري والرسوم.');render()});
 const attachChk=h('input',{type:'checkbox'}),pickBtn=h('button',{type:'button',class:'btn',onClick:()=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.accept='.pdf,.zip,application/pdf,application/zip';i.onchange=()=>run(()=>readAll([...i.files]));i.click()}},'📥 '+L('Choose report PDFs or a ZIP','اختيار تقارير PDF أو ملف مضغوط'));
 render();
 return h('div',{class:'card form noprint'},h('h3',{},'📥 '+L('Import report PDFs as inspections','استيراد تقارير PDF كفحوصات')),
  h('p',{class:'hint'},L('Pick PDF reports made by the app. Each one becomes a finished inspection (archive, monthly report, charts). Reports exported from now on carry their exact data; older ones are read visually, so review before importing. Photos are not imported (tick the option below to keep a copy of each PDF). The manager keeps every report, and each one can also be sent to its own inspector.','اختر تقارير PDF اللي عملها التطبيق. كل تقرير يتحول لفحص كامل (الأرشيف والتقرير الشهري والرسوم). التقارير الجديدة بتحمل بياناتها بدقة، والقديمة بتتقرا بصرياً فراجعها قبل الاستيراد. الصور مش بتتستورد (علّم الخيار اللي تحت لو عايز تحتفظ بنسخة من كل PDF). المدير بيحتفظ بكل التقارير، وكل تقرير يقدر يروح كمان لمفتشه.')),
  h('div',{class:'row wrap'},pickBtn,goBtn,stopBtn),h('label',{class:'chk'},attachChk,L('Also attach a copy of each PDF to its inspection (uses storage)','إرفاق نسخة من كل PDF بفحصه (تستهلك مساحة)')),msg,mapBox,distBtn,list)}

/* ===== فلاتر متعددة الاختيار (زي فلتر الإكسل) ===== */
const msG=(a,i)=>!Array.isArray(a)||!a.length||a.some(g=>g===i.garmentType||(typeof garmentsOf==='function'&&garmentsOf(i.garmentType).includes(g)));
const msIn=(a,v)=>Array.isArray(a)?(!a.length||a.includes(v)):(!a||a===v);
const msDay=i=>String(i.date||'').slice(0,10),msMon=i=>String(i.date||'').slice(0,7);
const MS_OT_DAYS=[5,6]; /* الجمعة والسبت = أوفر تايم (أسبوع العمل: الأحد–الخميس) */
const msYmd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const msDt=i=>{const s=msDay(i),d=new Date(s+'T00:00:00');return s&&!isNaN(d)?d:null};
const msOt=i=>{const d=msDt(i);return d?(MS_OT_DAYS.includes(d.getDay())?'ot':'reg'):''};
const OT_OPTS=()=>[['reg',L('Regular (Sun–Thu)','عادي (الأحد–الخميس)')],['ot',L('Overtime (Fri & Sat)','أوفر تايم (الجمعة والسبت)')]];
function msWeek(i){const d=msDt(i);if(!d)return'';const su=new Date(d);su.setDate(d.getDate()-d.getDay());return msYmd(su)}
function msWkNo(su){const th=new Date(su);th.setDate(su.getDate()+4);const u=new Date(Date.UTC(th.getFullYear(),th.getMonth(),th.getDate())),n=(u.getUTCDay()+6)%7;u.setUTCDate(u.getUTCDate()-n+3);const f=new Date(Date.UTC(u.getUTCFullYear(),0,4));return 1+Math.round(((u-f)/86400000-3+((f.getUTCDay()+6)%7))/7)}
function msOptsOf(rows,kind){const m=new Map(),ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
 rows.forEach(i=>{let k='',t='';
  if(kind==='po'){k=String(i.orderNo||'').trim();t=k}else if(kind==='model'){k=String(i.model||'').trim();t=k}
  else if(kind==='mon'){k=msMon(i);if(k)t=(MON[Number(k.slice(5))-1]||'')+' '+k.slice(0,4)}
  else if(kind==='wk'){k=msWeek(i);if(k){const su=new Date(k+'T00:00:00'),sa=new Date(su);sa.setDate(su.getDate()+6);t='W'+String(msWkNo(su)).padStart(2,'0')+' · '+fmtDate(k)+' → '+fmtDate(msYmd(sa))}}
  else if(kind==='day'){k=msDay(i);if(k){const dd=msDt(i);t=dd.toLocaleDateString(S.lang==='ar'?'ar-EG':'en-US',{weekday:'long'})+' · '+fmtDate(k)+(msOt(i)==='ot'?' ⏱':'')}}
  if(k&&!m.has(k))m.set(k,t)});
 const a=[...m.entries()];if(kind==='po'||kind==='model')a.sort((x,y)=>x[0].localeCompare(y[0],undefined,{numeric:true}));else a.sort((x,y)=>y[0].localeCompare(x[0]));return a}
function msBtn(label,getOpts,arr,onChange){const b=h('button',{type:'button',class:'btn msb'},'');
 const upd=()=>{const n=arr.length,o=n===1?getOpts():[];b.textContent=label+': '+(n===0?L('All','الكل'):n===1?((o.find(x=>x[0]===arr[0])||[])[1]||arr[0]):n+' '+L('selected','محدد'));b.classList.toggle('on',n>0)};
 b.onclick=()=>msOpen(label,getOpts,arr,()=>{upd();onChange()});upd();return b}
function msOpen(label,getOpts,arr,onChange){
 const opts=getOpts();let q='';const ov=h('div',{class:'msov'}),list=h('div',{class:'mslist'}),cnt=h('span',{class:'hint'});
 const close=()=>{ov.remove();document.removeEventListener('keydown',esc)},esc=e=>{if(e.key==='Escape')close()};
 const shown=()=>opts.filter(([v,t])=>!q||norm(t).includes(norm(q)));
 const draw=()=>{const s=shown();cnt.textContent=arr.length?L(arr.length+' selected','تم تحديد '+arr.length):L('Nothing selected = all','لا يوجد تحديد = الكل');
  list.replaceChildren(...(s.length?s.map(([v,t])=>h('label',{class:'msrow'},h('input',{type:'checkbox',checked:arr.includes(v),onChange:e=>{const i=arr.indexOf(v);if(e.target.checked){if(i<0)arr.push(v)}else if(i>=0)arr.splice(i,1);cnt.textContent=arr.length?L(arr.length+' selected','تم تحديد '+arr.length):L('Nothing selected = all','لا يوجد تحديد = الكل');onChange()}}),h('span',{},t))):[h('p',{class:'hint'},L('No matches.','لا توجد نتائج.'))]))};
 const search=h('input',{placeholder:L('Search…','بحث…'),onInput:e=>{q=e.target.value;draw()}});
 const all=h('button',{type:'button',class:'btn s',onClick:()=>{shown().forEach(([v])=>{if(!arr.includes(v))arr.push(v)});draw();onChange()}},'☑ '+L('Select all','تحديد الكل')),
  none=h('button',{type:'button',class:'btn s',onClick:()=>{arr.splice(0,arr.length);draw();onChange()}},'☐ '+L('Clear','مسح'));
 ov.append(h('div',{class:'mssheet'},h('div',{class:'row'},h('b',{style:'flex:1;font-size:17px'},label),h('button',{type:'button',class:'btn s',onClick:close},'✕')),search,h('div',{class:'row wrap'},all,none,cnt),list,h('button',{type:'button',class:'btn p',onClick:close},L('Done','تم'))));
 ov.addEventListener('click',e=>{if(e.target===ov)close()});document.addEventListener('keydown',esc);document.body.append(ov);draw();setTimeout(()=>{if(opts.length>12)search.focus()},50)}

/* ===== مقارنة العملاء: عملاء متعددين جنب بعض + رسم + جدول + خلاصة تلقائية ===== */
let CMPC={cu:[],mn:[],init:false};
const CMPC_AUTO=4,CMPC_MAX=6;
function cmpCustCalc(cus,months){
 const cdn=d=>{const l=libOf(d.defectId),en=l?l.nameEn:d.nameEn,ar=l?l.nameAr:d.nameAr;return(S.lang==='ar'?(ar||en):(en||ar))||d.defectId||'?'};
 const rows=S.ins.filter(i=>['approved','rejected'].includes(i.status)&&(isMgr()||mine(i))&&msIn(months,msMon(i))&&String(i.customer||'').trim()),m=new Map();
 rows.forEach(i=>{const c=custCanon(i.customer);let o=m.get(c);if(!o){o={name:c,n:0,acc:0,rej:0,lot:0,sample:0,pieces:0,def:new Map()};m.set(c,o)}
  o.n++;if(i.status==='approved')o.acc++;else o.rej++;o.lot+=num(i.actualQty)||num(i.orderQty)||num(i.lotSize);o.sample+=num(i.sampleSize)||(i.aql?num(i.aql.sampleSize):0);
  (i.defs||[]).forEach(d=>{const p=num(d.pieces),k=cdn(d);o.pieces+=p;o.def.set(k,(o.def.get(k)||0)+p)})});
 const all=[...m.values()],chosen=cus.length?all.filter(o=>cus.includes(o.name)):all.slice().sort((a,b)=>b.n-a.n||b.lot-a.lot).slice(0,CMPC_AUTO);
 chosen.forEach(o=>{o.rate=o.sample?o.pieces/o.sample*100:null;o.top=[...o.def.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);o.accRate=o.n?o.acc/o.n*100:0});
 chosen.sort((a,b)=>((a.rate==null)-(b.rate==null))||((a.rate||0)-(b.rate||0))||b.n-a.n);
 return{list:chosen.slice(0,CMPC_MAX),extra:Math.max(0,chosen.length-CMPC_MAX),missing:cus.filter(c=>!m.has(c)),auto:!cus.length}}
function cmpCustSummary(list,periodTxt){
 const out=[],f1=x=>x.toFixed(1),ok=list.filter(o=>o.rate!=null);if(list.length<2)return[L('Pick at least two customers to compare.','اختر عميلين على الأقل للمقارنة.')];
 if(ok.length<2)return[L('Not enough sample-size data to compare defect rates.','لا توجد بيانات عينة كافية لمقارنة نسب العيوب.')];
 const best=ok[0],worst=ok[ok.length-1];
 if(Math.abs(worst.rate-best.rate)<0.05)out.push(L('Defect rates are about the same across these customers ('+f1(best.rate)+'%).','نسب العيوب متقاربة بين هؤلاء العملاء ('+f1(best.rate)+'%).'));
 else{out.push('✅ '+L(best.name+' is the best '+periodTxt+' (defect rate '+f1(best.rate)+'%).',best.name+' هو الأفضل '+periodTxt+' (نسبة العيوب '+f1(best.rate)+'%).'));
  const tp=worst.top[0],share=tp&&worst.pieces?Math.round(tp[1]/worst.pieces*100):0,mult=best.rate>0?worst.rate/best.rate:0;
  out.push('⚠️ '+L(worst.name+' is the worst '+periodTxt+' (defect rate '+f1(worst.rate)+'%'+(mult>=1.5?', about '+f1(mult)+'× the best':'')+')'+(tp?'. Main problem: '+tp[0]+' ('+share+'% of its defects).':'.'),worst.name+' هو الأسوأ '+periodTxt+' (نسبة العيوب '+f1(worst.rate)+'%'+(mult>=1.5?'، حوالي '+f1(mult)+' ضعف الأفضل':'')+')'+(tp?'، ومشكلته الأساسية: '+tp[0]+' ('+share+'% من عيوبه).':'.')))}
 const rj=list.filter(o=>o.rej>0).sort((a,b)=>b.rej/b.n-a.rej/a.n)[0];
 if(rj)out.push('❌ '+L('Highest rejection: '+rj.name+' ('+rj.rej+' of '+rj.n+' shipments rejected).','أعلى رفض: '+rj.name+' ('+rj.rej+' من '+rj.n+' شحنة اترفضت).'));
 else out.push('✅ '+L('No rejected shipments for these customers.','لا توجد شحنات مرفوضة لهؤلاء العملاء.'));
 return out}
function vCmpCust(){
 const all=()=>S.ins.filter(i=>['approved','rejected'].includes(i.status)&&(isMgr()||mine(i)));
 if(!CMPC.init){const ms=msOptsOf(all(),'mon');CMPC.mn=ms.length?[ms[0][0]]:[];CMPC.init=true}
 const out=h('div',{class:'stack cccust-output'}),COL=['#2563eb','#f59e0b','#16a34a','#dc2626','#7c3aed','#0891b2'],fmtN=n=>Math.round(n).toLocaleString();let latest={list:[],sum:[],period:'overall'};
 const makePdf=async()=>{
  if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
  const {list,sum,period}=latest;if(!list.length)throw new Error(L('No comparison data to export.','لا توجد بيانات مقارنة لتصديرها.'));
  const stage=h('div',{style:'position:fixed;left:-12000px;top:0;width:794px;background:#fff;color:#172b45;padding:28px 34px;font-family:Arial,Tahoma,sans-serif;box-sizing:border-box'});
  const usedRows=all().filter(i=>(!CMPC.mn.length||CMPC.mn.includes(msMon(i)))&&(!CMPC.cu.length||CMPC.cu.some(c=>norm(c)===norm(i.customer)))),garments=[...new Set(usedRows.map(i=>gName(i.garmentType)).filter(Boolean))];
  const periodRange=CMPC.mn.length?CMPC.mn.slice().sort().map(m=>{const [y,mo]=m.split('-').map(Number),last=`${m}-${String(new Date(y,mo,0).getDate()).padStart(2,'0')}`;return `${fmtDate(m+'-01')} – ${fmtDate(last)}`}).join(' | '):L('All available dates','كل الفترات المتاحة');
  const title=analysisReportHeader(L('Customer Comparison','مقارنة العملاء'),[[L('Factory','المصنع'),S.settings.factoryName||'—'],[L('Customers','العملاء'),list.map(o=>o.name).join('، ')],[L('Period','الفترة'),periodRange],[L('Garment','القطعة'),garments.join('، ')||L('All garments','كل القطع')],[L('Report date','تاريخ التقرير'),new Date().toLocaleDateString(S.lang==='ar'?'ar-EG':'en-GB')]]);
  const summary=h('section',{style:'background:#f1f6fb;border:1px solid #d7e1ec;border-radius:10px;padding:14px;margin-bottom:16px'},h('h3',{style:'margin:0 0 8px;color:#17365b'},L('Automatic summary','الخلاصة التلقائية')),sum.map(t=>h('p',{style:'font-size:12px;line-height:1.55;margin:5px 0'},t)));
  const rows=[['Defect rate','نسبة العيوب',o=>o.rate==null?'—':o.rate.toFixed(1)+'%'],['Inspections / shipments','الفحوصات / الشحنات',o=>o.n],['Lot quantity','كمية الشحنات',o=>fmtN(o.lot)],['Inspected sample','العينة المفحوصة',o=>fmtN(o.sample)],['Defective pieces','القطع المعيبة',o=>fmtN(o.pieces)],['Accepted shipments','الشحنات المقبولة',o=>o.acc],['Rejected shipments','الشحنات المرفوضة',o=>o.rej],['Acceptance rate','نسبة القبول',o=>o.accRate.toFixed(0)+'%']];
  const table=h('table',{style:'width:100%;border-collapse:collapse;font-size:10px;table-layout:fixed'},h('thead',{},h('tr',{},[h('th',{style:'background:#17365b;color:#fff;padding:8px;text-align:left;width:22%'},L('Metric','المؤشر')),...list.map(o=>h('th',{style:'background:#17365b;color:#fff;padding:8px;text-align:center'},o.name))])),h('tbody',{},rows.map(([en,ar,fn],ri)=>h('tr',{},[h('th',{style:'background:#eef4f9;border:1px solid #d7e1ec;padding:7px;text-align:left'},L(en,ar)),...list.map(o=>h('td',{style:'border:1px solid #d7e1ec;padding:7px;text-align:center'},String(fn(o))))]))));
  const defects=h('section',{style:'margin-top:16px'},h('h3',{style:'color:#17365b;font-size:15px'},L('Top defects by customer','أكثر العيوب لكل عميل')),h('div',{style:'display:grid;grid-template-columns:repeat(2,1fr);gap:8px'},list.map(o=>h('div',{style:'border:1px solid #d7e1ec;border-radius:8px;padding:9px'},h('b',{style:'font-size:12px'},o.name),(o.top||[]).length?o.top.map(([n,v])=>h('div',{style:'font-size:10px;padding-top:4px'},n+' × '+v)):h('div',{style:'font-size:10px;color:#64748b'},'—')))));
  stage.append(title,summary,table,defects);document.body.append(stage);
  try{await Promise.all([...stage.querySelectorAll('img')].map(im=>im.decode?im.decode().catch(()=>{}):null));await new Promise(r=>setTimeout(r,80));const canvas=await window.html2canvas(stage,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});
   const pageH=1122, pageW=794, total=canvas.height;let y=0,first=true;while(y<total){const part=document.createElement('canvas');part.width=canvas.width;part.height=Math.min(Math.round(pageH*2),canvas.height-y);part.getContext('2d').drawImage(canvas,0,y,canvas.width,part.height,0,0,part.width,part.height);if(!first)pdf.addPage();first=false;const mmH=part.height/canvas.width*210;pdf.addImage(part.toDataURL('image/jpeg',.93),'JPEG',0,0,210,Math.min(297,mmH),undefined,'FAST');y+=part.height}
   return pdf.output('blob');
  }finally{stage.remove()}
 };
 const draw=()=>{const d=cmpCustCalc(CMPC.cu,CMPC.mn),list=d.list,mo=msOptsOf(all(),'mon'),mname=CMPC.mn.length===1?((mo.find(x=>x[0]===CMPC.mn[0])||[])[1]||CMPC.mn[0]):'',period=CMPC.mn.length===1?L('in '+mname,'في '+mname):CMPC.mn.length?L('in the selected months','في الشهور المحددة'):L('overall','إجمالاً');
  const sum=cmpCustSummary(list,period);latest={list,sum,period};
  if(!list.length){out.replaceChildren(h('div',{class:'card empty'},h('h2',{},L('No completed inspections for the selected period.','لا توجد فحوصات مكتملة في الفترة المحددة.')),h('p',{class:'hint'},L('Only approved/rejected inspections are compared.','تُقارَن الفحوصات المعتمدة والمرفوضة فقط.'))));return}
  const mx=Math.max(...list.map(o=>o.rate||0),0.0001),best=list.find(o=>o.rate!=null),worst=[...list].reverse().find(o=>o.rate!=null),ind=o=>o.rate==null?'':o===best?'🟢 ':o===worst&&worst!==best?'🔴 ':'🟡 ';
  const bars=h('div',{class:'ccbars'},list.map((o,k)=>h('div',{class:'ccbar'},h('div',{class:'ccbar-head'},h('b',{},o.name),h('strong',{},o.rate==null?'—':o.rate.toFixed(1)+'%')),h('div',{class:'cc-track'},h('i',{style:'width:'+Math.max(2,(o.rate||0)/mx*100)+'%;background:'+COL[k%COL.length]})))));
  const metrics=[[L('Inspections','الفحوصات'),o=>o.n],[L('Lot quantity','كمية الشحنات'),o=>fmtN(o.lot)],[L('Inspected sample','العينة المفحوصة'),o=>fmtN(o.sample)],[L('Defective pieces','القطع المعيبة'),o=>fmtN(o.pieces)],[L('Accepted','مقبول'),o=>o.acc],[L('Rejected','مرفوض'),o=>o.rej],[L('Acceptance rate','نسبة القبول'),o=>o.accRate.toFixed(0)+'%']];
  const cards=h('div',{class:'cc-customer-grid'},list.map((o,k)=>h('section',{class:'cc-customer-card'},h('div',{class:'cc-customer-title'},h('b',{},o.name),h('strong',{style:'color:'+(o===best?'#15803d':o===worst&&worst!==best?'#dc2626':'#176da8')},o.rate==null?'—':o.rate.toFixed(1)+'%')),h('div',{class:'cc-metrics'},metrics.map(([label,fn])=>h('div',{class:'cc-mini-metric'},h('span',{},label),h('b',{},String(fn(o)))))),h('div',{class:'cc-top-defects'},h('b',{},L('Top defects','أكثر العيوب')),o.top.length?o.top.map(([n,v])=>h('div',{},n+' × '+v)):h('span',{},'—')))));
  const filterCard=h('div',{class:'card form noprint cc-filters'},h('h3',{},'📈 '+L('Customer comparison','مقارنة العملاء')),h('p',{class:'hint'},L('Choose customers and months. The comparison updates automatically.','اختر العملاء والشهور، وسيتم تحديث المقارنة تلقائياً.')),h('div',{class:'row wrap'},msBtn(L('Customers','العملاء'),custOpts,CMPC.cu,draw),msBtn(L('Month','الشهر'),()=>msOptsOf(all(),'mon'),CMPC.mn,draw)));
  const actions=h('div',{class:'row wrap noprint cc-export-actions'},h('button',{type:'button',class:'btn p',onClick:e=>run(e.currentTarget,async()=>{const blob=await makePdf();cmpSaveBlob(blob,'MEYAR-Customer-Comparison.pdf')})},'⬇ '+L('Download PDF','تحميل PDF')),h('button',{type:'button',class:'btn cc-wa',onClick:e=>run(e.currentTarget,async()=>{const blob=await makePdf();await cmpShareBlob(blob,'MEYAR-Customer-Comparison.pdf')})},'📤 '+L('Send via WhatsApp','إرسال واتساب')));
  out.replaceChildren(filterCard,h('div',{class:'cc-period'},L('Comparison period','فترة المقارنة')+': '+period),h('div',{class:'card cc-chart-card'},h('h3',{},L('Defect rate by customer','نسبة العيوب لكل عميل')),bars),h('div',{class:'card ccnote'},h('h3',{},'🧠 '+L('Summary','الخلاصة')),sum.map(s=>h('p',{},s))),cards,d.auto?h('p',{class:'hint'},L('No customers selected: showing the '+CMPC_AUTO+' with the most inspections.','لم تحدد عملاء: عرض أكثر '+CMPC_AUTO+' عملاء فحوصاً.')):null,d.extra?h('p',{class:'warn'},L(d.extra+' more customer(s) not shown (max '+CMPC_MAX+').','يوجد '+d.extra+' عميل إضافي غير ظاهر (الحد الأقصى '+CMPC_MAX+').')):null,d.missing.length?h('p',{class:'warn'},L('No completed inspections in this period for: ','لا توجد فحوصات مكتملة في هذه الفترة لـ: ')+d.missing.join(', ')):null,actions)};
 const custOpts=()=>[...new Set(all().map(i=>custCanon(i.customer)).filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(c=>[c,c]);
 draw();return out}

function archTabs(cur){return null}

function vFiles(){
 const F=keepView('cloud',{q:'',st:'',by:'',lk:''}),box=h('div',{class:'list'}),msg=h('p',{class:'hint cloud-msg'}),sum=h('p',{class:'hint'});let rows=[],bulkBtn=null;
 const say=(en,ar)=>{msg.textContent=L(en,ar)},sayErr=e=>{msg.textContent=L('Error: ','خطأ: ')+((e&&e.message)||e)};
 const guard=async(b,fn)=>{const t=b&&b.textContent;if(b)b.disabled=true;try{await fn()}catch(e){sayErr(e)}finally{if(b){b.disabled=false;if(t)b.textContent=t}}};
 const dtf=ts=>ts?new Date(ts).toLocaleString(S.lang==='ar'?'ar-EG':'en-GB',{dateStyle:'medium',timeStyle:'short'}):'';
 const blobOf=async r=>{if(r.loc){const d=await DB.get('filedata',r.id);if(d&&d.blob)return d.blob}if(r.cl)return await fileFromCloud(r.cl.payload);throw new Error(L('File not found.','لم يُعثر على الملف.'))};
 const load=async force=>{if(force)await filesCloudRefresh(true);else await filesCloudRefresh(false);
  const locals=await DB.all('files'),m=new Map();
  locals.forEach(f=>m.set(f.id,{id:f.id,loc:f,cl:FILES_CLOUD.get(f.id)||null,m:f}));
  FILES_CLOUD.forEach((x,id)=>{if(!m.has(id))m.set(id,{id,loc:null,cl:x,m:x.payload||{}})});
  rows=[...m.values()].map(r=>({...r,state:r.loc&&r.cl?'both':r.loc?'dev':'cloud',insId:r.loc?(r.loc.insId||''):((r.cl&&r.cl.payload&&r.cl.payload.insId)||'')}));
  if(!isMgr())rows=rows.filter(r=>r.loc||(r.cl&&(r.cl.owner_id===CLOUD_UID||(r.cl.payload&&r.cl.payload.assignedTo===CLOUD_UID))));
  fill()};
 FILES_HOOK=()=>{if(document.body.contains(box))load(true);else FILES_HOOK=null};
 const openF=async r=>{const w=window.open('','_blank');try{const b=await blobOf(r),u=URL.createObjectURL(new Blob([b],{type:r.m.mime||b.type}));if(w)w.location.href=u;else cmpSaveBlob(b,r.m.name);setTimeout(()=>URL.revokeObjectURL(u),60000)}catch(e){if(w)w.close();throw e}};
 const dlF=async r=>{cmpSaveBlob(await blobOf(r),r.m.name)};
 const upF=async r=>{const b=await blobOf(r);await fileToCloud(r.loc,b);say('Uploaded to the cloud: '+r.m.name,'تم الرفع للسحابة: '+r.m.name)};
 const keepF=async r=>{const b=await blobOf(r),p=r.cl.payload,rec={id:p.id,name:p.name,size:p.size||b.size,mime:p.mime||'',note:p.note||'',orderNo:p.orderNo||'',insId:p.insId||'',createdAt:p.createdAt||Date.now(),updatedAt:Date.now(),createdBy:'',uploaderName:p.uploaderName||'',cloud:{path:p.path,at:Date.now()}};
  await DB.put('files',rec);await DB.put('filedata',{id:rec.id,blob:b});say('Saved to this device\'s archive.','تم الحفظ في أرشيف هذا الجهاز.')};
 const delLoc=async r=>{if(!confirm(L('Remove this file from this device? '+(r.cl?'The cloud copy stays.':'It is NOT in the cloud, so it will be lost.'),'مسح الملف من هذا الجهاز؟ '+(r.cl?'نسخة السحابة تبقى.':'الملف ليس في السحابة وسيُفقد نهائياً.'))))return;
  await DB.del('files',r.id);await DB.del('filedata',r.id);await audit('file_removed_local',r.id,{name:r.m.name});say('Removed from this device.','تم المسح من الجهاز.')};
 const delCl=async r=>{if(!confirm(L('Delete this file from the cloud for everyone? This cannot be undone.','حذف الملف من السحابة للجميع؟ لا يمكن التراجع.')))return;
  const {c,ws}=await filesSession();const d=await c.from('aql_cloud_records').delete().eq('workspace_id',ws).eq('record_type','files').eq('record_id',r.id).select('record_id');
  if(d.error)throw d.error;if(!d.data||!d.data.length)throw new Error(L('You are not allowed to delete this file.','غير مسموح لك بحذف هذا الملف.'));
  try{await c.storage.from('aql-files').remove([r.cl.payload.path])}catch(e){}
  FILES_CLOUD.delete(r.id);if(r.loc){r.loc.cloud=null;await DB.put('files',r.loc)}await audit('file_deleted_cloud',r.id,{name:r.m.name});say('Deleted from the cloud.','تم الحذف من السحابة.')};
 const act=(fn)=>e=>{e.stopPropagation();guard(e.currentTarget,async()=>{await fn();await load(false)})};
 const fill=()=>{const q=norm(F.q);
   const insById=id=>S.ins.find(x=>x.id===id),lnB=r=>r.insId?h('a',{class:'badge approved',href:'#/i/'+r.insId},'🔗 '+L('Inspection ','فحص ')+((insById(r.insId)&&insById(r.insId).orderNo)||r.insId)):h('span',{class:'badge'},L('Not linked','غير مربوط بفحص'));
   const lnS=r=>h('select',{onChange:e=>{const v=e.target.value;e.target.value='';guard(null,async()=>{const w=await fileSetIns(r,v==='-'?'':v);if(w)say('Saved on this device; cloud update failed: '+w,'تم الحفظ على الجهاز؛ وفشل تحديث السحابة: '+w);else say(v==='-'?'Unlinked.':'Moved to the inspection.',v==='-'?'تم فك الربط.':'تم نقل الملف للفحص.');await load(false)})}},h('option',{value:''},'🔗 '+L('Move to inspection…','نقل لفحص…')),r.insId?h('option',{value:'-'},'✖ '+L('Unlink','فك الربط')):null,insChoices().map(i=>h('option',{value:i.id},insLabel(i))));
  const list=rows.filter(r=>{const m=r.m;return(!q||norm((m.name||'')+(m.orderNo||'')+(m.note||'')+(m.uploaderName||'')+(r.insId||'')).includes(q))&&(!F.st||r.state===F.st)&&(!F.by||m.uploaderName===F.by)&&(!F.lk||(F.lk==='yes'?!!r.insId:!r.insId))}).sort((a,b)=>(b.m.createdAt||0)-(a.m.createdAt||0));
  const pend=rows.filter(r=>r.state==='dev').length;
  sum.textContent=L(rows.length+' file(s) · '+pend+' not in the cloud yet',rows.length+' ملف · '+pend+' لم يُرفع للسحابة بعد')+(FILES_CLOUD_OK?'':' · '+L('cloud not connected','السحابة غير متصلة')+(FILES_CLOUD_ERR?' ('+FILES_CLOUD_ERR+')':''));
  if(bulkBtn){bulkBtn.style.display=pend?'':'none';bulkBtn.textContent='☁️ '+L('Upload all not-in-cloud ('+pend+')','رفع كل ما ليس في السحابة ('+pend+')')}
  const canDelCl=r=>r.cl&&(isMgr()||r.cl.owner_id===CLOUD_UID);
  const stB=r=>h('span',{class:'badge '+(r.state==='dev'?'pending_review':'approved')},r.state==='both'?'☁️ '+L('In cloud + device','في السحابة وعلى الجهاز'):r.state==='dev'?'📱 '+L('Device only','على الجهاز فقط'):'☁️ '+L('Cloud only','في السحابة فقط'));
  box.replaceChildren(...(list.length?list.map(r=>{const m=r.m,meta=[fmtSize(m.size),dtf(m.createdAt),(isMgr()||m.uploaderName!==(S.me&&S.me.name))&&m.uploaderName?'👤 '+m.uploaderName:'',m.orderNo?L('Order ','طلبية ')+m.orderNo:''].filter(Boolean).join(' · ');
   return h('div',{class:'card frow'},h('div',{class:'fmain'},h('span',{class:'ficon'},fileIcon(m)),h('div',{style:'min-width:0;flex:1'},h('b',{class:'fname'},m.name||'—'),h('div',{class:'hint'},meta),m.note?h('div',{class:'hint'},'📝 '+m.note):null)),stB(r),lnB(r),(r.m.assignedName?h('span',{class:'badge'},'📌 '+r.m.assignedName):null),
    h('div',{class:'fbtns'},
     lnS(r),fileViewable(m)?h('button',{type:'button',class:'btn s',onClick:act(()=>openF(r))},'👁 '+L('Open','فتح')):null,
     h('button',{type:'button',class:'btn s',onClick:act(()=>dlF(r))},'⬇ '+L('Download','تنزيل')),
     r.state==='dev'?h('button',{type:'button',class:'btn s p',onClick:act(()=>upF(r))},'☁️ '+L('Upload to cloud','رفع للسحابة')):null,
     r.state==='cloud'?h('button',{type:'button',class:'btn s',onClick:act(()=>keepF(r))},'💾 '+L('Keep on device','حفظ بالأرشيف')):null,
     r.loc?h('button',{type:'button',class:'btn s d',onClick:act(()=>delLoc(r))},'🗑 '+L('Remove from device','مسح من الجهاز')):null,
     canDelCl(r)?h('button',{type:'button',class:'btn s d',onClick:act(()=>delCl(r))},'🗑☁️ '+L('Delete from cloud','حذف من السحابة')):null))}):[h('div',{class:'card empty'},h('h2',{},L('No files yet','لا توجد ملفات بعد')),h('p',{class:'hint'},L('Add a file from this device; it is saved in the archive, then you can upload it to the cloud.','أضف ملفاً من الجهاز؛ يُحفظ في الأرشيف ثم تستطيع رفعه للسحابة.')))]))};
 const order=h('input',{placeholder:L('Order no. (optional)','رقم الطلبية (اختياري)')}),note=h('input',{placeholder:L('Note (optional)','ملاحظة (اختياري)')}),insSel=h('select',{},h('option',{value:''},L('Link to inspection (optional)','ربط بفحص (اختياري)')),insChoices().map(i=>h('option',{value:i.id},insLabel(i))));
 const addFiles=async fs=>{if(!fs.length)return;let ok=0,big=0;const added=[];const ordV=order.value.trim();let tIns=insSel.value?S.ins.find(x=>x.id===insSel.value):null;if(!tIns&&ordV)tIns=insChoices().find(x=>norm(x.orderNo||'')===norm(ordV))||null;
  for(const f of fs){if(f.size>FILE_MAX){big++;continue}
   const buf=await f.arrayBuffer(),blob=new Blob([buf],{type:f.type||'application/octet-stream'}),rec={id:'f_'+Date.now().toString(36)+uid(5),name:f.name,size:f.size,mime:f.type||'',note:note.value.trim(),orderNo:tIns?(tIns.orderNo||ordV):ordV,insId:tIns?tIns.id:'',createdAt:Date.now(),updatedAt:Date.now(),createdBy:S.me.id,uploaderName:S.me.name,cloud:null};
   await DB.put('files',rec);await DB.put('filedata',{id:rec.id,blob});await audit('file_added',rec.id,{name:rec.name});added.push({rec,blob});ok++}
  note.value='';order.value='';insSel.value='';let errs=0,first='';
  if(LS.get(FILES_AUTO_KEY)==='on'&&navigator.onLine)for(const a of added){try{await fileToCloud(a.rec,a.blob)}catch(e){errs++;if(!first)first=(e&&e.message)||String(e)}}
  say('Added '+ok+' file(s) to the archive.'+(big?' '+big+' skipped (over 50 MB).':'')+(errs?' Cloud upload failed for '+errs+': '+first:''),'تمت إضافة '+ok+' ملف للأرشيف.'+(big?' تم تخطي '+big+' (أكبر من 50MB).':'')+(errs?' فشل الرفع للسحابة لعدد '+errs+': '+first:''));
  await load(false)};
 const pick=h('button',{type:'button',class:'btn p',onClick:e=>{const i=document.createElement('input');i.type='file';i.multiple=true;i.onchange=()=>guard(e.currentTarget,()=>addFiles([...i.files]));i.click()}},'📎 '+L('Add files from this device','إضافة ملفات من الجهاز'));
 bulkBtn=h('button',{type:'button',class:'btn',style:'display:none',onClick:e=>guard(e.currentTarget,async()=>{const todo=rows.filter(r=>r.state==='dev');let n=0,errs=0,first='';
   for(const r of todo){say('Uploading '+(++n)+' / '+todo.length+'…','جارٍ الرفع '+n+' / '+todo.length+'…');try{await fileToCloud(r.loc,await blobOf(r))}catch(err){errs++;if(!first)first=(err&&err.message)||String(err)}}
   say('Done. Uploaded '+(todo.length-errs)+' of '+todo.length+'.'+(errs?' First error: '+first:''),'اكتمل. رُفع '+(todo.length-errs)+' من '+todo.length+'.'+(errs?' أول خطأ: '+first:''));await load(true)})},'');
 const by=isMgr()?h('select',{onChange:e=>{F.by=e.target.value;fill()}},h('option',{value:''},L('All uploaders','كل من رفع')),inspectorList().map(c=>h('option',{value:c},c))):null;
 setTimeout(()=>load(true),0);
 return h('div',{class:'stack'},archTabs('files'),
  h('div',{class:'card form'},h('div',{class:'row wrap'},order,note,insSel),h('div',{class:'row wrap'},pick,bulkBtn,h('button',{type:'button',class:'btn',onClick:e=>guard(e.currentTarget,()=>load(true))},'🔄 '+L('Refresh','تحديث'))),
   h('label',{class:'chk'},h('input',{type:'checkbox',checked:LS.get(FILES_AUTO_KEY)==='on',onChange:e=>LS.set(FILES_AUTO_KEY,e.target.checked?'on':'off')}),L('Upload new files to the cloud automatically','رفع الملفات الجديدة للسحابة تلقائياً')),
   h('p',{class:'hint'},L('Any file type, up to 50 MB each. Files are stored on this device first; press “Upload to cloud” to send one to the manager’s cloud.','أي نوع ملف حتى 50MB للملف. تُحفظ الملفات على الجهاز أولاً؛ اضغط «رفع للسحابة» لإرسال الملف لسحابة المدير.'))),
  h('div',{class:'row wrap'},h('input',{placeholder:L('Search name, order, note, uploader','ابحث بالاسم أو الطلبية أو الملاحظة أو من رفع'),onInput:e=>{F.q=e.target.value;fill()}}),
   h('select',{onChange:e=>{F.st=e.target.value;fill()}},h('option',{value:''},L('All','الكل')),h('option',{value:'dev'},L('Device only','على الجهاز فقط')),h('option',{value:'both'},L('In cloud + device','في السحابة وعلى الجهاز')),h('option',{value:'cloud'},L('Cloud only','في السحابة فقط'))),h('select',{onChange:e=>{F.lk=e.target.value;fill()}},h('option',{value:''},L('Linked & not linked','المربوط وغير المربوط')),h('option',{value:'yes'},L('Linked to an inspection','مربوط بفحص')),h('option',{value:'no'},L('Not linked','غير مربوط'))),by),
  isMgr()?batchImportCard(()=>load(true)):null,
  sum,msg,box)}


function vSettings(){const s=S.settings;SINGLE.forEach(g=>{s[g]=s[g]||[]});const msg=h('p',{class:'hint'});
  const imgF=(lb,k)=>h('div',{class:'row wrap'},h('b',{style:'flex:1;font-size:14px'},lb),s[k]?h('img',{src:s[k],style:'height:44px'}):null,h('button',{class:'btn s',onClick:()=>pickOne(v=>{s[k]=v;render()})},L('Upload','رفع')),s[k]?h('button',{class:'btn s',onClick:()=>{s[k]='';render()}},'🗑'):null);
  const tpl=g=>h('div',{class:'card form'},h('h3',{},gName(g)+' — '+L('departments','الأقسام')),
    s[g].map((d,i)=>h('div',{class:'row wrap'},h('input',{value:d.en,placeholder:'English',onInput:e=>d.en=e.target.value}),h('input',{value:d.ar,dir:'rtl',placeholder:'العربية',onInput:e=>d.ar=e.target.value}),
      h('label',{class:'chk'},h('input',{type:'checkbox',checked:d.active,onChange:e=>d.active=e.target.checked}),L('Active','مفعّل')),
      h('button',{class:'btn s',onClick:()=>{if(i>0){[s[g][i-1],s[g][i]]=[s[g][i],s[g][i-1]];render()}}},'↑'),h('button',{class:'btn s',onClick:()=>{if(i<s[g].length-1){[s[g][i+1],s[g][i]]=[s[g][i],s[g][i+1]];render()}}},'↓'))),
    h('button',{class:'btn s',onClick:()=>{s[g].push({id:'d_'+uid(6),en:'',ar:'',active:true});render()}},'+ '+L('Add department','إضافة قسم')));
  return h('div',{class:'stack'},h('div',{class:'card form'},fld(L('Platform name','اسم المنصة'),()=>s.platformName,v=>s.platformName=v),fld(L('Factory name (report templates)','اسم المصنع (قوالب التقارير)'),()=>s.factoryName,v=>s.factoryName=v),h('div',{class:'row wrap'},h('span',{class:'hint',style:'flex:1'},L('Measurement points, minimum photo pages and the inspector picture moved to "Inspection settings" (a separate page for each inspector).','نقاط القياس وأقل عدد صفحات الصور وصورة المفتش انتقلت إلى «إعدادات الفحص» (صفحة منفصلة لكل مفتش).')),h('a',{class:'btn s',href:'#/inspset'},'🛠 '+L('Inspection settings','إعدادات الفحص'))),fld(L('Company shown under "From" on the report','الجهة المعروضة في خانة «من» بالتقرير'),()=>s.fromText||'',v=>s.fromText=v,{placeholder:s.factoryName}),imgF(L('Report logo','لوجو التقرير'),'logo'),
      h('div',{class:'card form',style:'margin-top:12px'},h('h3',{},L('Review policy','سياسة المراجعة')),h('label',{class:'chk'},h('input',{type:'checkbox',checked:!!s.requireReview,onChange:e=>s.requireReview=e.target.checked}),L('Manager must approve every inspection, even when AQL gives an automatic result','المدير يعتمد كل فحص، حتى لو أعطت AQL نتيجة تلقائية'))),
      h('div',{class:'card form',style:'margin-top:12px'},h('h3',{},L('Photo timestamp','طابع التاريخ والوقت على الصور')),
        h('label',{class:'chk'},h('input',{type:'checkbox',checked:s.photoStampEnabled!==false,onChange:e=>s.photoStampEnabled=e.target.checked}),L('Burn timestamp into the image permanently','حفظ الطابع داخل الصورة نفسها بشكل دائم')),
        h('label',{},L('Date and time format','صيغة التاريخ والوقت'),h('select',{value:s.photoStampFormat||'eu',onChange:e=>s.photoStampFormat=e.target.value},h('option',{value:'eu'},'DD/MM/YYYY  HH:MM'),h('option',{value:'us'},'MM/DD/YYYY  HH:MM'),h('option',{value:'iso'},'YYYY-MM-DD  HH:MM'))),
        h('label',{class:'chk'},h('input',{type:'checkbox',checked:s.photoStampInspector!==false,onChange:e=>s.photoStampInspector=e.target.checked}),L('Show inspector name','إظهار اسم المفتش')),
        h('label',{class:'chk'},h('input',{type:'checkbox',checked:s.photoStampOrder!==false,onChange:e=>s.photoStampOrder=e.target.checked}),L('Show order number','إظهار رقم الطلبية')),
        h('label',{},L('Stamp position','مكان الطابع'),h('select',{value:s.photoStampPosition||'br',onChange:e=>s.photoStampPosition=e.target.value},h('option',{value:'br'},L('Bottom right','أسفل اليمين')),h('option',{value:'bl'},L('Bottom left','أسفل اليسار')),h('option',{value:'tr'},L('Top right','أعلى اليمين')),h('option',{value:'tl'},L('Top left','أعلى اليسار')))),
        h('p',{class:'hint'},L('The timestamp is applied when a photo is added (with its original date and time). For photos added from now on, cropping and rotating keep the stamp complete and upright. Older photos are not changed, and cropping them can cut their stamp.','يُضاف الطابع وقت إضافة الصورة (بتاريخها ووقتها الأصلي). في الصور المضافة من الآن، القص والتدوير يُبقيان الطابع كاملاً وبوضع صحيح. الصور القديمة لا تتغير، وقصّها قد يقص طابعها.'))),
      h('button',{class:'btn p',onClick:async()=>{if(!s.platformName.trim()||!s.factoryName.trim()){msg.textContent=L('Both names are required.','الاسمان مطلوبان.');return}
        if([...s.jacket,...s.trousers].some(d=>!d.en.trim()||!d.ar.trim())){msg.textContent=L('Every department needs both names.','كل قسم يحتاج الاسمين.');return}
        await DB.put('kv',s);await audit('settings_updated','settings');msg.textContent=L('Saved.','تم الحفظ.');render()}},L('Save settings','حفظ الإعدادات')),msg),cloudPanel(),...SINGLE.map(tpl),
    h('div',{class:'card form'},h('h3',{},L('Backup & restore','النسخ الاحتياطي والاستعادة')),h('p',{class:'warn'},L('Your data lives only in this browser on this device. Export a backup regularly (it includes photos) and keep the file somewhere safe.','بياناتك محفوظة فقط في هذا المتصفح على هذا الجهاز. صدّر نسخة احتياطية بانتظام (تشمل الصور) واحفظ الملف في مكان آمن.')),
      h('div',{class:'row wrap'},h('button',{class:'btn',onClick:exportAll},L('Export backup','تصدير نسخة')),h('button',{class:'btn',onClick:importAll},L('Restore from file','استعادة من ملف'))))) }
function exportAll(){const b=new Blob([JSON.stringify({app:'aql-inspection',v:1,at:Date.now(),settings:S.settings,lib:S.lib,plans:S.plans,ins:S.ins,audit:S.audit,members:S.members,lists:S.lists,custs:S.custs||[]})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='aql-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();audit('backup_exported','all')}
function importAll(){const i=document.createElement('input');i.type='file';i.accept='application/json,.json';i.onchange=async()=>{try{const d=JSON.parse(await i.files[0].text());if(d.app!=='aql-inspection')throw new Error('bad file');
  if(!confirm(L('This REPLACES all current data with the backup. Continue?','سيتم استبدال كل البيانات الحالية بالنسخة. متابعة؟')))return;
  for(const s of['library','plans','inspections','kv'])await DB.clear(s);for(const x of d.lib)await DB.put('library',x);for(const x of d.plans)await DB.put('plans',x);for(const x of d.ins)await DB.put('inspections',x);await DB.put('kv',d.settings);for(const x of(d.custs||[]))await DB.put('kv',x);await DB.put('kv',{id:'audit',items:d.audit||[]});await DB.put('kv',{id:'seeded',v:3});if(d.members)await DB.put('kv',{id:'members',items:d.members});if(d.lists)await DB.put('kv',d.lists);
  await loadAll();await audit('backup_restored','all');alert(L('Restored.','تمت الاستعادة.'));render()}catch(e){alert(L('Invalid backup file.','ملف نسخة غير صالح.'))}};i.click()}
/* ---------- report (matches the factory's PDF layout) ---------- */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDate=s=>{const d=new Date(s);return isNaN(d)?String(s||'').slice(0,10):`${String(d.getDate()).padStart(2,'0')}-${MON[d.getMonth()]}-${d.getFullYear()}`};
const defNm=d=>{const l=libOf(d.defectId);const en=l?l.nameEn:d.nameEn,ar=l?l.nameAr:d.nameAr;return(S.lang==='ar'?(ar||en):en)||d.defectId||''};
const sevColor={critical:'#e00000',major:'#f5a800',minor:'#bf9000'};
const AVA='<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="80" fill="#fff"/><path d="M8 80c2-18 14-26 32-26s30 8 32 26z" fill="#1d4e89"/><path d="M34 54l6 10 6-10z" fill="#fff"/><path d="M40 62l-3 18h6z" fill="#c0392b"/><circle cx="40" cy="34" r="14" fill="#f1c27d"/><path d="M26 30c2-12 26-14 28 0-8-6-20-6-28 0z" fill="#3b2a1a"/><circle cx="52" cy="40" r="9" fill="#cfe8ff" fill-opacity=".6" stroke="#333" stroke-width="3"/><path d="M58 47l10 10" stroke="#333" stroke-width="4" stroke-linecap="round"/></svg>';
const MEASP={jacket:['Waist','Back','Sleeve'],trousers:['Waist','Inseam']},MEASB={jacket:4,trousers:5},MG=[4,4,4,3];
const measKinds=t=>t==='suit'||t==='both'?['trousers','jacket']:(t==='jacket'||t==='vest')?['jacket']:['trousers'];
const measPts=k=>((setOf({inspectorName:S.me&&S.me.name}).measPoints||{})[k]||MEASP[k]).filter(Boolean);
const newBlock=k=>({heads:['','','',''],rows:measPts(k).map(n=>({name:n,tp:'',tm:'',c:Array(15).fill('')}))});
function ensureMeas(o){o.meas=o.meas||{};measKinds(o.garmentType).forEach(k=>{if(!o.meas[k]||!o.meas[k].length)o.meas[k]=Array.from({length:MEASB[k]},()=>newBlock(k))})}
const hbwBox=rows=>h('table',{class:'hbwt'},rows.map(([a,b])=>h('tr',{},h('td',{class:'l'},a),h('td',{class:'v'+((typeof b==='string'||typeof b==='number')&&String(b).length>11?' sm':'')},b==null?'':b))));
const autoSizes=i=>{const z=new Set((i.rows||[]).map(r=>String(r.size||'').trim()).filter(Boolean));return z.size?String(z.size):''};
function measHdr(i,ed,dt){const sam=ed?h('input',{value:i.measSamples||'',onInput:e=>{i.measSamples=e.target.value;dt()}}):i.measSamples,siz=ed?h('input',{value:i.measSizes||autoSizes(i),onInput:e=>{i.measSizes=e.target.value;dt()}}):(i.measSizes||autoSizes(i));
  return h('div',{class:'mhr'},hbwBox([[L('Customer','العميل'),i.customer],[L('Po Customer','PO العميل'),i.poCustomer],[L('Model','الموديل'),i.model]]),
    hbwBox([[L('Item','الصنف'),gName(i.garmentType).toUpperCase()],[L('Style','الستايل'),i.style],[L('Sales order','أمر البيع'),i.salesOrder||i.orderNo]]),
    hbwBox([[L('No.Of Samples Measured','عدد العينات المقاسة'),sam],[L('Number Of Size','عدد المقاسات'),siz],[L('Color','اللون'),i.color]]),
    hbwBox([[L('Date','التاريخ'),fmtDate(i.date)],[L('Order No','رقم الطلبية'),i.orderNo],[L('Inspector','المفتش'),i.inspectorName]]))}
function measOutOfTolerance(b,r,k){const P=v=>parseFloat(String(v??'').replace(',','.')),plus=Math.abs(P(r.tp)),minus=Math.abs(P(r.tm));if(!Number.isFinite(plus)||!Number.isFinite(minus))return false;
  const raw=String(r.c[k]??'').trim().replace(/\s+/g,'');if(!raw)return false;
  /* deviation entry: "1+", "0.5-", "+1", "-0.5" (sign before or after the number) */
  const dm=raw.match(/^([+-]?)(\d+(?:[.,]\d+)?)([+-]?)$/);
  if(dm&&(dm[1]||dm[3])){const sign=(dm[1]||dm[3])==='-'?-1:1,dev=sign*parseFloat(dm[2].replace(',','.'));return dev>plus||dev<-minus}
  const gi=MG.findIndex((n,g)=>k>=MG.slice(0,g).reduce((a,x)=>a+x,0)&&k<MG.slice(0,g+1).reduce((a,x)=>a+x,0)),base=P(b.heads[gi]),actual=P(raw);
  if(!Number.isFinite(actual))return false;
  /* plain number: an absolute reading when it is near the size value, otherwise an unsigned deviation (treated as plus) */
  if(Number.isFinite(base)&&Math.abs(actual-base)<=Math.abs(actual))return actual>base+plus||actual<base-minus;
  return actual>plus}
function measBlock(b,ed,dt){const cell=(arr,k)=>ed?h('input',{value:arr[k]??'',inputmode:'decimal',onInput:e=>{arr[k]=e.target.value;dt()}}):(arr[k]||'');
  return h('table',{class:'mt'},h('colgroup',{},Array.from({length:18},()=>h('col',{style:'width:5.555%'}))),
    h('tr',{},h('th',{class:'diag'}),h('th',{},'Tol +'),h('th',{},'Tol -'),MG.map((n,g)=>h('th',{colspan:n},cell(b.heads,g)))),
    b.rows.map(r=>h('tr',{},h('td',{class:'pn'},ed?h('input',{value:r.name,onInput:e=>{r.name=e.target.value;dt()}}):r.name),h('td',{},cell(r,'tp')),h('td',{},cell(r,'tm')),Array.from({length:15},(_,k)=>h('td',{class:measOutOfTolerance(b,r,k)?'meas-out':''},cell(r.c,k))))))}
function measPages(i){const out=[],logo=h('div',{class:'rlh'},h('img',{class:'rlogo',src:S.settings.logo||DEF_LOGO}),h('div',{class:'rlogotxt'},String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean).map(w=>h('div',{},w))));
  measKinds(i.garmentType).forEach(k=>{const blocks=(i.meas&&i.meas[k])||[],per=k==='trousers'?5:4;
    for(let st=0;st<Math.max(blocks.length,1);st+=per)out.push(h('div',{class:'rpage'},h('div',{class:'rlh'},h('img',{class:'rlogo',src:S.settings.logo||DEF_LOGO}),h('div',{class:'rlogotxt'},String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean).map(w=>h('div',{},w)))),
      h('div',{class:'rtitle'},L('MEASUREMENT REPORT','تقرير المقاسات')),measHdr(i,false),blocks.slice(st,st+per).map(b=>measBlock(b,false))))});return out}
function usageMap(){const m={};S.ins.forEach(i=>(i.defs||[]).forEach(d=>{if(d.defectId)m[d.defectId]=(m[d.defectId]||0)+1}));return m}
const rnd=i=>{const r=parseInt(i.round,10);return r>0?r:1+sameOrder(i).filter(x=>(x.createdAt||0)<(i.createdAt||Infinity)).length};
const rndMatch=(n,f)=>n===Number(f);
const RND_OPTS=()=>[['1',L('1st Inspection','الفحص الأول')],['2',L('2nd Inspection','الفحص الثاني')],['3',L('3rd Inspection','الفحص الثالث')],['4',L('4th Inspection','الفحص الرابع')]];
const TYPE_OPTS=()=>[['final',L('Final Inspection','فحص نهائي')],['prefinal',L('Pre-Final Inspection','فحص ما قبل النهائي')]];
const optTxt=(opts,v)=>{const o=opts.find(x=>x[0]===String(v||''));return o?o[1]:''};
const sameOrder=o=>{const k1=norm(o.orderNo),k2=norm(o.poCustomer);return S.ins.filter(x=>x.id!==o.id&&((k1&&norm(x.orderNo)===k1)||(k2&&norm(x.poCustomer)===k2)))};
function copyFrom(src){['orderNo','customer','poCustomer','model','style','salesOrder','color','orderQty','actualQty'].forEach(k=>{D[k]=src[k]??''});D.garmentType=src.garmentType==='both'?'suit':src.garmentType;D.rows=structuredClone(src.rows||[]);D.prevId=src.id;dirty=true;okMsg='';render()}
/* ---------- WhatsApp-style crop & rotate screen (added 18 Nov 2026) ----------
   Drag the corners/edges, move the frame, rotate 90°, pick an aspect ratio, reset. Nothing changes until ✓ is pressed. */
function photoCropper(srcCv,onDone){
  const ov=h('div',{class:'cropov'}),box=h('div',{class:'cropbox'}),cv=h('canvas'),bar=h('div',{class:'cropbar'}),sheet=h('div',{class:'cropsheet',style:'display:none'});
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));let rc=srcCv,R={x:0,y:0,w:1,h:1},ratio=null,ratioName='free',drag=null,cw=0,ch=0,dpr=1,D={x:0,y:0,w:1,h:1},changed=false;
  const kOf=()=>ratio?ratio*rc.height/rc.width:null; /* ratio expressed in normalised units */
  const layout=()=>{cw=box.clientWidth;ch=box.clientHeight;dpr=window.devicePixelRatio||1;cv.width=Math.round(cw*dpr);cv.height=Math.round(ch*dpr);const pad=24,s=Math.min((cw-2*pad)/rc.width,(ch-2*pad)/rc.height);D={w:rc.width*s,h:rc.height*s,x:0,y:0};D.x=(cw-D.w)/2;D.y=(ch-D.h)/2;draw()};
  const px=()=>({x:D.x+R.x*D.w,y:D.y+R.y*D.h,w:R.w*D.w,h:R.h*D.h});
  const draw=()=>{const c=cv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,cw,ch);c.drawImage(rc,D.x,D.y,D.w,D.h);const r=px();
    c.fillStyle='rgba(0,0,0,.62)';c.fillRect(D.x,D.y,D.w,r.y-D.y);c.fillRect(D.x,r.y+r.h,D.w,D.y+D.h-r.y-r.h);c.fillRect(D.x,r.y,r.x-D.x,r.h);c.fillRect(r.x+r.w,r.y,D.x+D.w-r.x-r.w,r.h);
    c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1;c.beginPath();for(let k=1;k<3;k++){c.moveTo(r.x+r.w*k/3,r.y);c.lineTo(r.x+r.w*k/3,r.y+r.h);c.moveTo(r.x,r.y+r.h*k/3);c.lineTo(r.x+r.w,r.y+r.h*k/3)}c.stroke();
    c.strokeStyle='#fff';c.lineWidth=1.5;c.strokeRect(r.x,r.y,r.w,r.h);c.lineWidth=4;c.lineCap='square';const L=Math.min(24,r.w/3,r.h/3);c.beginPath();
    [[r.x,r.y,1,1],[r.x+r.w,r.y,-1,1],[r.x,r.y+r.h,1,-1],[r.x+r.w,r.y+r.h,-1,-1]].forEach(([x,y,a,b])=>{c.moveTo(x+a*L,y);c.lineTo(x,y);c.lineTo(x,y+b*L)});
    [[r.x+r.w/2,r.y,1,0],[r.x+r.w/2,r.y+r.h,1,0],[r.x,r.y+r.h/2,0,1],[r.x+r.w,r.y+r.h/2,0,1]].forEach(([x,y,a,b])=>{c.moveTo(x-a*L/2,y-b*L/2);c.lineTo(x+a*L/2,y+b*L/2)});c.stroke()};
  const hit=(x,y)=>{const r=px(),T=clamp(Math.min(r.w,r.h)/3,14,30),nl=Math.abs(x-r.x)<T,nr=Math.abs(x-r.x-r.w)<T,nt=Math.abs(y-r.y)<T,nb=Math.abs(y-r.y-r.h)<T,ix=x>r.x-T&&x<r.x+r.w+T,iy=y>r.y-T&&y<r.y+r.h+T;
    if(nl&&nt)return'tl';if(nr&&nt)return'tr';if(nl&&nb)return'bl';if(nr&&nb)return'br';if(nt&&ix)return't';if(nb&&ix)return'b';if(nl&&iy)return'l';if(nr&&iy)return'r';
    return x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h?'move':null};
  const apply=(type,dx,dy)=>{const o=drag.R0,minW=44/D.w,minH=44/D.h,k=kOf();
    if(type==='move'){R={x:clamp(o.x+dx,0,1-o.w),y:clamp(o.y+dy,0,1-o.h),w:o.w,h:o.h};return}
    let l=o.x,r=o.x+o.w,t=o.y,b=o.y+o.h;
    if(type.includes('l'))l=clamp(o.x+dx,0,r-minW);if(type.includes('r'))r=clamp(o.x+o.w+dx,l+minW,1);if(type.includes('t'))t=clamp(o.y+dy,0,b-minH);if(type.includes('b'))b=clamp(o.y+o.h+dy,t+minH,1);
    let w=r-l,hh=b-t;if(!k){R={x:l,y:t,w,h:hh};return}
    const hx=/[lr]/.test(type),hy=/[tb]/.test(type);if(hx&&hy){if(w/hh>k)w=hh*k;else hh=w/k}else if(hx)hh=w/k;else w=hh*k;
    const aw=type.includes('l')?o.x+o.w:type.includes('r')?1-o.x:2*Math.min(o.x+o.w/2,1-o.x-o.w/2),ah=type.includes('t')?o.y+o.h:type.includes('b')?1-o.y:2*Math.min(o.y+o.h/2,1-o.y-o.h/2),sc=Math.min(1,aw/w,ah/hh);w*=sc;hh*=sc;
    R={x:type.includes('l')?o.x+o.w-w:type.includes('r')?o.x:o.x+(o.w-w)/2,y:type.includes('t')?o.y+o.h-hh:type.includes('b')?o.y:o.y+(o.h-hh)/2,w,h:hh}};
  const pos=e=>{const q=cv.getBoundingClientRect();return{x:e.clientX-q.left,y:e.clientY-q.top}};
  cv.addEventListener('pointerdown',e=>{const q=pos(e),type=hit(q.x,q.y);if(!type)return;e.preventDefault();cv.setPointerCapture(e.pointerId);drag={type,sx:q.x,sy:q.y,R0:{...R}}});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const q=pos(e);apply(drag.type,(q.x-drag.sx)/D.w,(q.y-drag.sy)/D.h);changed=true;draw()});
  const end=()=>{drag=null};cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
  const setRatio=(name,val)=>{ratioName=name;ratio=name==='free'?null:name==='orig'?rc.width/rc.height:val;sheet.style.display='none';const k=kOf();
    if(k){let w=R.w,hh=R.h;if(w/hh>k)w=hh*k;else hh=w/k;const cx=R.x+R.w/2,cy=R.y+R.h/2;R={x:clamp(cx-w/2,0,1-w),y:clamp(cy-hh/2,0,1-hh),w,h:hh};changed=true}draw();buildBar()};
  const rotate=()=>{const c=document.createElement('canvas');c.width=rc.height;c.height=rc.width;const q=c.getContext('2d');q.translate(0,c.height);q.rotate(-Math.PI/2);q.drawImage(rc,0,0);rc=c;
    R={x:R.y,y:1-R.x-R.w,w:R.h,h:R.w};if(ratio)ratio=ratioName==='orig'?rc.width/rc.height:1/ratio;changed=true;layout()};
  const reset=()=>{rc=srcCv;R={x:0,y:0,w:1,h:1};ratio=null;ratioName='free';changed=false;sheet.style.display='none';layout();buildBar()};
  const close=()=>{window.removeEventListener('resize',layout);ov.remove()};
  const done=()=>{if(!changed){close();onDone(null);return}const w=Math.max(1,Math.round(R.w*rc.width)),hh=Math.max(1,Math.round(R.h*rc.height)),out=document.createElement('canvas');out.width=w;out.height=hh;
    out.getContext('2d').drawImage(rc,Math.round(R.x*rc.width),Math.round(R.y*rc.height),w,hh,0,0,w,hh);close();onDone(out)};
  const RATIOS=[['free',L('Freeform','حر')],['orig',L('Original','الأصلية')],['1:1',1],['4:3',4/3],['3:4',3/4],['3:2',3/2],['2:3',2/3],['16:9',16/9],['9:16',9/16]];
  const btn=(label,fn,cls)=>h('button',{type:'button',class:'cropbtn '+(cls||''),onClick:fn},label);
  const buildBar=()=>{bar.replaceChildren(btn('✕',()=>{close();onDone(null)}),btn('⟲',rotate),btn('▭',()=>{sheet.style.display=sheet.style.display==='none'?'flex':'none'}),btn(L('Reset','إعادة ضبط'),reset,'txt'),btn('✓',done,'ok'))};
  RATIOS.forEach(([n,v])=>sheet.append(h('button',{type:'button',class:'cropchip'+(ratioName===n?' on':''),onClick:()=>{setRatio(n,v);RATIOS.forEach((_,i)=>sheet.children[i].classList.toggle('on',RATIOS[i][0]===ratioName))}},n==='free'||n==='orig'?v:n)));
  box.append(cv,sheet);ov.append(box,bar);buildBar();document.body.append(ov);window.addEventListener('resize',layout);layout()}
function annotatePhoto(obj,onDone){const src=obj.p0||obj.p,im=new Image();
  im.onload=()=>{const W=im.naturalWidth,Hh=im.naturalHeight,lw=Math.max(4,Math.round(W/140));let shapes=structuredClone(obj.ann||[]),tool='c',drag=null;
    const cv=h('canvas',{width:W,height:Hh}),cx=cv.getContext('2d');
    const arrow=(s)=>{const x1=s.x1*W,y1=s.y1*Hh,x2=s.x2*W,y2=s.y2*Hh,a=Math.atan2(y2-y1,x2-x1),hl=lw*5;cx.beginPath();cx.moveTo(x1,y1);cx.lineTo(x2,y2);cx.stroke();cx.beginPath();cx.moveTo(x2,y2);cx.lineTo(x2-hl*Math.cos(a-.45),y2-hl*Math.sin(a-.45));cx.lineTo(x2-hl*Math.cos(a+.45),y2-hl*Math.sin(a+.45));cx.closePath();cx.fill()};
    const draw=extra=>{cx.clearRect(0,0,W,Hh);cx.drawImage(im,0,0,W,Hh);cx.strokeStyle='#e00000';cx.fillStyle='#e00000';cx.lineWidth=lw;cx.lineCap='round';cx.lineJoin='round';
      [...shapes,...(extra?[extra]:[])].forEach(s=>{if(s.t==='crop'){cx.save();cx.strokeStyle='#2563eb';cx.setLineDash([12,8]);cx.strokeRect(Math.min(s.x1,s.x2)*W,Math.min(s.y1,s.y2)*Hh,Math.abs(s.x2-s.x1)*W,Math.abs(s.y2-s.y1)*Hh);cx.restore()}else if(s.t==='c'){cx.beginPath();cx.ellipse((s.x1+s.x2)/2*W,(s.y1+s.y2)/2*Hh,Math.max(2,Math.abs(s.x2-s.x1)/2*W),Math.max(2,Math.abs(s.y2-s.y1)/2*Hh),0,0,Math.PI*2);cx.stroke()}else arrow(s)})};
    const pos=e=>{const r=cv.getBoundingClientRect();return{x:Math.min(1,Math.max(0,(e.clientX-r.left)/r.width)),y:Math.min(1,Math.max(0,(e.clientY-r.top)/r.height))}};
    cv.addEventListener('pointerdown',e=>{e.preventDefault();cv.setPointerCapture(e.pointerId);const q=pos(e);drag={t:tool,x1:q.x,y1:q.y,x2:q.x,y2:q.y}});
    cv.addEventListener('pointermove',e=>{if(!drag)return;const q=pos(e);drag.x2=q.x;drag.y2=q.y;draw(drag)});
    cv.addEventListener('pointerup',e=>{if(!drag)return;const q=pos(e);drag.x2=q.x;drag.y2=q.y;const dpx=Math.hypot((drag.x2-drag.x1)*W,(drag.y2-drag.y1)*Hh);
      if(drag.t==='crop'){const x=Math.min(drag.x1,drag.x2)*W,y=Math.min(drag.y1,drag.y2)*Hh,w=Math.abs(drag.x2-drag.x1)*W,hh=Math.abs(drag.y2-drag.y1)*Hh;if(w>20&&hh>20){const cut=document.createElement('canvas');cut.width=Math.round(w);cut.height=Math.round(hh);cut.getContext('2d').drawImage(cv,x,y,w,hh,0,0,cut.width,cut.height);obj.p=cut.toDataURL('image/jpeg',.9);delete obj.p0;delete obj.ann;ov.remove();annotatePhoto(obj,onDone);return}}else if(dpx<W*.02){if(drag.t==='c'){const rx=.07,ry=.07*W/Hh;shapes.push({t:'c',x1:drag.x1-rx,x2:drag.x1+rx,y1:drag.y1-ry,y2:drag.y1+ry})}}else shapes.push(drag);drag=null;draw()});
    const tb=(l,fn,on)=>h('button',{type:'button',class:'btn'+(on?' on':''),onClick:fn},l);const ov=h('div',{class:'annov'});
    const bar=h('div',{class:'annt'});
    const rotate=async dir=>{const base=document.createElement('canvas');base.width=W;base.height=Hh;base.getContext('2d').drawImage(im,0,0);const m0=jpegGetMeta(src),meta=m0&&m0.W===W&&m0.H===Hh?m0:null;if(meta)await unstampCanvas(base,meta);
      const t=document.createElement('canvas');t.width=Hh;t.height=W;const q=t.getContext('2d');q.translate(t.width/2,t.height/2);q.rotate(dir*Math.PI/2);q.drawImage(base,-W/2,-Hh/2);obj.p=meta?stampedUrl(t,meta.lines,meta.pos):t.toDataURL('image/jpeg',.9);delete obj.p0;delete obj.ann;ov.remove();annotatePhoto(obj,onDone)};
    const render2=()=>{bar.replaceChildren(tb('⭕ '+L('Circle','دائرة'),()=>{tool='c';render2()},tool==='c'),tb('↗ '+L('Arrow','سهم'),()=>{tool='a';render2()},tool==='a'),tb('✂ '+L('Crop & rotate','قص وتدوير'),async()=>{draw();const base=document.createElement('canvas');base.width=W;base.height=Hh;base.getContext('2d').drawImage(cv,0,0);const m0=jpegGetMeta(src),meta=m0&&m0.W===W&&m0.H===Hh?m0:null;if(meta)await unstampCanvas(base,meta);
      photoCropper(base,out=>{if(!out)return;obj.p=meta?stampedUrl(out,meta.lines,meta.pos):out.toDataURL('image/jpeg',.9);delete obj.p0;delete obj.ann;ov.remove();annotatePhoto(obj,onDone)})}),tb('↶ '+L('Rotate left','تدوير يسار'),()=>rotate(-1)),tb('↷ '+L('Rotate right','تدوير يمين'),()=>rotate(1)),tb('↩ '+L('Undo','تراجع'),()=>{shapes.pop();draw()}),tb('🗑 '+L('Clear','مسح'),()=>{shapes=[];draw()}),
      tb(L('Cancel','إلغاء'),()=>ov.remove()),h('button',{type:'button',class:'btn p',onClick:()=>{draw();if(shapes.length){obj.p0=obj.p0||obj.p;obj.p=cv.toDataURL('image/jpeg',.88);obj.ann=shapes}else{if(obj.p0){obj.p=obj.p0;delete obj.p0}delete obj.ann}ov.remove();onDone&&onDone()}},'✔ '+L('Done','تم')))};
    render2();ov.append(h('div',{class:'annc'},cv),bar);document.body.append(ov);draw()};
  im.onerror=()=>alert(L('Could not open the photo.','تعذر فتح الصورة.'));im.src=src}
/* ---------- voice / keypad entry for the measurement tables ---------- */
const SPEECH_NORM=w=>String(w||'').toLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫]/g,'.').replace(/(\d)[,،](\d)/g,'$1.$2');
const SP_UNITS={واحد:1,واحده:1,اتنين:2,اثنين:2,اثنان:2,تنين:2,تلاته:3,ثلاثه:3,تلات:3,ثلاث:3,اربعه:4,اربع:4,خمسه:5,خمس:5,سته:6,ست:6,سبعه:7,سبع:7,تمانيه:8,ثمانيه:8,تمن:8,ثمان:8,تماني:8,تسعه:9,تسع:9,عشره:10,عشر:10,
  حداشر:11,احداشر:11,اتناشر:12,تلتاشر:13,تلاتاشر:13,اربعتاشر:14,اربعطاشر:14,خمستاشر:15,خمسطاشر:15,ستاشر:16,سطاشر:16,سبعتاشر:17,سبعطاشر:17,تمنتاشر:18,تمانتاشر:18,تمنطاشر:18,تسعتاشر:19,تسعطاشر:19,
  عشرين:20,تلاتين:30,ثلاثين:30,اربعين:40,خمسين:50,ستين:60,سبعين:70,تمانين:80,ثمانين:80,تسعين:90,
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};
const SP_FRAC={نص:.5,نصف:.5,ربع:.25,half:.5,quarter:.25};
const SP_SIGN={زائد:'+',زايد:'+',زياده:'+',زياد:'+',بلس:'+',موجب:'+',فوق:'+',plus:'+','+':'+',ناقص:'-',نقص:'-',ناقصه:'-',مينص:'-',مينوس:'-',سالب:'-',تحت:'-',minus:'-','-':'-'};
const SP_ZERO=new Set(['صفر','مظبوط','مضبوط','ظبط','تمام','صح','مطابق','zero','ok','okay']);
const SP_DEC=new Set(['فاصله','نقطه','point']),SP_SIZEW=new Set(['مقاس','size','المقاس']);
const SP_CMD1={التالي:'SKIP',التاليه:'SKIP',بعده:'SKIP',تخطي:'SKIP',skip:'SKIP',next:'SKIP',رجوع:'BACK',ارجع:'BACK',السابق:'BACK',back:'BACK',previous:'BACK',امسح:'UNDO',مسح:'UNDO',احذف:'UNDO',undo:'UNDO',delete:'UNDO',وقف:'STOP',stop:'STOP'};
const SP_CMD2={'نقطه جديده':'ROW','نقطه تانيه':'ROW','نقطه تاليه':'ROW','صف جديد':'ROW','new point':'ROW','next point':'ROW','جدول جديد':'TABLE','قطعه جديده':'PIECE','قطعه تانيه':'PIECE','القطعه التاليه':'PIECE','قطعه تاليه':'PIECE','new piece':'PIECE','next piece':'PIECE','مقاس جديد':'SIZE','مقاس تاني':'SIZE','المقاس التالي':'SIZE','مقاس تالي':'SIZE','new size':'SIZE','next size':'SIZE','جدول جديد':'TABLE','جدول تاني':'TABLE','جدول تالي':'TABLE','الجدول التالي':'TABLE','new table':'TABLE','next table':'TABLE'};
const spKnown=w=>SP_UNITS[w]!=null||SP_FRAC[w]!=null||/^\d+(\.\d+)?$/.test(w)||SP_SIGN[w]!=null||SP_ZERO.has(w);
const spNum=w=>SP_UNITS[w]!=null?SP_UNITS[w]:SP_FRAC[w]!=null?SP_FRAC[w]:/^\d+(\.\d+)?$/.test(w)?parseFloat(w):null;
const spFmt=v=>String(Math.round(v*100)/100);
function parseSpoken(text){
  const raw=SPEECH_NORM(text).replace(/([+\-])/g,' $1 ').split(/\s+/).filter(Boolean),toks=[];
  raw.forEach(w=>{if(w.length>1&&w[0]==='و'&&spKnown(w.slice(1))){toks.push('و');toks.push(w.slice(1))}else toks.push(w)});
  const items=[];let cur=null,joined=false,dec=false,szMode=false;const flush=()=>{if(cur){items.push({t:szMode?'sz':'n',v:cur.v});szMode=false;cur=null}};
  for(let k=0;k<toks.length;k++){const w=toks[k],two=w+' '+(toks[k+1]||'');
    if(SP_CMD2[two]){flush();items.push({t:'c',c:SP_CMD2[two]});k++;joined=false;continue}
    if(SP_CMD1[w]){flush();items.push({t:'c',c:SP_CMD1[w]});joined=false;continue}
    if(SP_SIZEW.has(w)){flush();szMode=true;joined=false;continue}
    if(w==='و'||w==='and'||w==='a'){joined=true;continue}
    if(SP_SIGN[w]){flush();items.push({t:'s',s:SP_SIGN[w]});joined=false;continue}
    if(SP_ZERO.has(w)){flush();items.push({t:'z'});joined=false;continue}
    if(SP_DEC.has(w)){dec=true;continue}
    if((w==='ارباع'||w==='quarters')&&cur&&cur.v===3){cur.v=.75;joined=false;continue}
    const v=spNum(w);if(v==null)continue;const isFrac=SP_FRAC[w]!=null;
    if(dec&&cur&&!isFrac&&v<10){cur.v+=v/10;dec=false;joined=false;continue}
    if(cur&&joined){if(isFrac&&Number.isInteger(cur.v)){cur.v+=v;joined=false;continue}
      if(!isFrac&&Number.isInteger(cur.v)&&((cur.v<10&&v>=20)||(cur.v>=20&&v<10))){cur.v+=v;joined=false;continue}}
    if(cur&&!joined&&cur.w&&/\D/.test(w)&&!isFrac&&Number.isInteger(cur.v)&&cur.v>=20&&cur.v%10===0&&v>0&&v<10){cur.v+=v;continue}
    flush();cur={v,w:/\D/.test(w)};joined=false}
  flush();
  const out=[];let pre=null;
  for(let i=0;i<items.length;i++){const it=items[i];
    if(it.t==='c'){out.push({c:it.c});pre=null;continue}
    if(it.t==='sz'){out.push({c:'SETSIZE',v:spFmt(it.v)});continue}
    if(it.t==='z'){out.push({v:'0'});const nx=items[i+1];if(nx&&nx.t==='s')nx.consumed=true;continue}
    if(it.t==='s'){if(!it.consumed)pre=it.s;continue}
    const nx=items[i+1];let sg='';if(nx&&nx.t==='s'){sg=nx.s;nx.consumed=true}else if(pre){sg=pre;pre=null}
    out.push({v:spFmt(it.v)+sg})}
  return out}
function measureMode(kind,onClose){
  /* order used on the floor: piece 1 -> every point (Waist, Back, Sleeve), piece 2 -> every point ..., then the next size */
  const blocks=D.meas[kind],GS=[0,4,8,12];let b=0,g=0,k=0,r=0,sgn='-',listening=false,rec=null,heard='',note='';const hist=[];
  if(!(D.measPer>=1&&D.measPer<=4))D.measPer=4;
  const per=()=>D.measPer,lim=()=>Math.min(per(),MG[g]),rows=()=>blocks[b].rows,cur=()=>rows()[r].c,idx=()=>GS[g]+k;
  outer:for(let bi=0;bi<blocks.length;bi++)for(let gi=0;gi<4;gi++)for(let ki=0;ki<Math.min(per(),MG[gi]);ki++)for(let ri=0;ri<blocks[bi].rows.length;ri++)if(!blocks[bi].rows[ri].c[GS[gi]+ki]){b=bi;g=gi;k=ki;r=ri;break outer}
  const nextTable=()=>{g=0;k=0;r=0;b=Math.min(b+1,blocks.length-1)};
  const nextSize=()=>{k=0;r=0;g++;if(g>=4){g=0;if(b>=blocks.length-1){g=3;note=L('End of the tables.','انتهت الجداول.')}else b++}};
  const nextPiece=()=>{r=0;k++;if(k>=lim())nextSize()};
  const adv=()=>{r++;if(r>=rows().length){r=0;k++;if(k>=lim()){nextSize();if(note)k=lim()-1,r=rows().length-1;return}}note=''};
  const back=()=>{r--;if(r<0){k--;if(k<0){g--;if(g<0){b--;if(b<0){b=0;g=0;k=0;r=0;return}g=3}k=lim()-1}r=rows().length-1}};
  const put=v=>{cur()[idx()]=v;dirty=true;hist.push([b,g,k,r]);adv()};
  const apply=items=>{items.forEach(it=>{if(it.c==='SETSIZE'){blocks[b].heads[g]=it.v;dirty=true}
    else if(it.v!==undefined)put(it.v);
    else if(it.c==='SKIP'||it.c==='ROW')adv();else if(it.c==='BACK')back();
    else if(it.c==='UNDO'){const x=hist.pop();if(x){[b,g,k,r]=x}else back();cur()[idx()]='';dirty=true}
    else if(it.c==='PIECE')nextPiece();else if(it.c==='SIZE')nextSize();else if(it.c==='TABLE')nextTable();
    else if(it.c==='STOP')stopL()});draw()};
  const title=h('div',{style:'font-weight:700;font-size:14px'}),prev=h('div',{class:'mprev'}),nextEl=h('div',{style:'font-size:26px;font-weight:700;color:#22d3ee'}),hearEl=h('div',{class:'mheard'}),noteEl=h('div',{class:'hint',style:'color:#9fb3c6'}),micB=h('button',{type:'button',class:'btn p',style:'min-height:52px;font-size:17px'}),stat=h('div',{class:'hint',style:'color:#9fb3c6'});
  const sizeIn=h('input',{placeholder:L('Size (e.g. 24)','المقاس (مثلاً 24)'),style:'flex:1;color:#000;font-weight:700',onInput:e=>{blocks[b].heads[g]=e.target.value;dirty=true}}),perB=h('div',{class:'row',style:'gap:6px;flex:0 0 auto'});
  const lang=h('select',{style:'width:auto;min-height:44px'},h('option',{value:'ar-EG'},'العربية (مصر)'),h('option',{value:'en-US'},'English'));
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;let nativeMic=false;
  function draw(){const hd=blocks[b].heads[g]||'';title.textContent=`${gName(kind)} · ${L('Table','جدول')} ${b+1}/${blocks.length} · ${L('Size','المقاس')} ${g+1}/4${hd?' ('+hd+')':''} · ${L('Piece','القطعة')} ${k+1}/${lim()}`;
    if(document.activeElement!==sizeIn)sizeIn.value=hd;
    nextEl.textContent='▶ '+rows()[r].name;
    prev.style.gridTemplateColumns=`72px repeat(${MG[g]},1fr)`;
    prev.replaceChildren(h('div',{style:'font-size:11px;color:#9fb3c6'}),...Array.from({length:MG[g]},(_,q)=>h('div',{style:'font-size:11px;text-align:center;color:'+(q<lim()?'#fff':'#5b6b7d')},L('Piece','قطعة')+' '+(q+1))),
      ...rows().flatMap((row,ri)=>[h('div',{style:'font-size:12px;font-weight:700;align-self:center;overflow:hidden;text-overflow:ellipsis'},row.name),...Array.from({length:MG[g]},(_,q)=>h('button',{type:'button',class:'mc'+(ri===r&&q===k?' cur':''),style:q<lim()?'':'opacity:.35',onClick:()=>{if(q<lim()){k=q;r=ri;draw()}}},row.c[GS[g]+q]||'·'))]));
    perB.replaceChildren(h('span',{style:'font-size:12px;color:#9fb3c6;align-self:center'},L('Pieces per size','عدد القطع للمقاس')),...[1,2,3,4].map(n=>h('button',{type:'button',class:'btn s'+(per()===n?' on':''),style:'min-height:40px;min-width:40px',onClick:()=>{D.measPer=n;dirty=true;if(k>=lim()){k=0;r=0}draw()}},String(n))));
    hearEl.textContent=heard||(listening?L('Listening… say the value, e.g. “نص ناقص”','جاري الاستماع… قل القياس مثل «نص ناقص»'):L('Tap a value below, or start the microphone.','اضغط قيمة بالأسفل أو شغّل الميكروفون.'));noteEl.textContent=note;
    micB.textContent=listening?'⏹ '+L('Stop microphone','إيقاف الميكروفون'):'🎤 '+L('Start microphone','تشغيل الميكروفون');micB.className='btn '+(listening?'d':'p')}
  function stopL(){listening=false;if(nativeMic&&window.AQLNativeSpeech){nativeMic=false;window.AQLNativeSpeech.stop().catch(()=>{});}try{rec&&rec.stop()}catch(e){}rec=null;stat.textContent='';draw()}
  async function startL(){
    if(window.AQLNativeSpeech&&window.AQLNativeSpeech.isNative()){
      if(listening)return;listening=true;nativeMic=true;stat.textContent=L('Requesting native microphone permission…','جارٍ طلب إذن الميكروفون من التطبيق…');draw();
      try{await window.AQLNativeSpeech.start({language:lang.value||'ar-EG',onResult:t=>{if(!listening)return;const items=parseSpoken(t);heard=t+(items.length?'  →  '+items.map(x=>x.c?(x.c==='SETSIZE'?'SIZE '+x.v:x.c):x.v).join('  '):'  →  ?');apply(items)},onError:e=>{stat.textContent=L('Speech recognition error: ','خطأ في التعرف على الصوت: ')+(e&&e.message||String(e));listening=false;nativeMic=false;draw()},onEnd:()=>{if(nativeMic){listening=false;nativeMic=false;draw()}}});stat.textContent=L('Listening… tap Stop when finished.','جاري الاستماع… اضغط إيقاف عند الانتهاء.');}
      catch(e){listening=false;nativeMic=false;stat.textContent=L('Could not start microphone: ','تعذر تشغيل الميكروفون: ')+(e&&e.message||String(e));draw()}return;
    }
    if(!SR){stat.textContent=L('Voice recognition is not supported in this browser. Open this page in Google Chrome and use the keypad if needed.','التعرف على الصوت غير مدعوم في هذا المتصفح. افتح الصفحة في Google Chrome أو استخدم الأزرار.');return}
    if(!window.isSecureContext){stat.textContent=L('Microphone requires a secure HTTPS page. Open the official https:// address.','الميكروفون يحتاج إلى صفحة آمنة تبدأ بـ HTTPS. افتح رابط المنصة الرسمي.');return}
    if(listening)return;
    stat.textContent=L('Checking microphone permission…','جارٍ التحقق من إذن الميكروفون…');
    try{
      if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        stream.getTracks().forEach(track=>track.stop());
      }
    }catch(e){
      const denied=e&&(['NotAllowedError','PermissionDeniedError','SecurityError'].includes(e.name));
      stat.textContent=denied?L('Allow microphone access in your browser/site settings, then try again.','اسمح باستخدام الميكروفون من إعدادات المتصفح/الموقع ثم حاول مرة أخرى.'):L('Could not access the microphone. Check that it is connected and not blocked by another app.','تعذر الوصول للميكروفون. تأكد أنه يعمل وأن تطبيقًا آخر لا يمنع استخدامه.');
      return;
    }
    try{
      rec=new SR();rec.lang=lang.value||'ar-EG';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
      rec.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript||'';if(e.results[i].isFinal){const items=parseSpoken(t);heard=t+(items.length?'  →  '+items.map(x=>x.c?(x.c==='SETSIZE'?'SIZE '+x.v:x.c):x.v).join('  '):'  →  ?');apply(items)}else interim+=t}if(interim)stat.textContent=L('Hearing: ','أسمع: ')+interim};
      rec.onerror=e=>{const m={'not-allowed':L('Microphone permission denied. Allow it in site settings.','تم رفض إذن الميكروفون. اسمح به من إعدادات الموقع.'),'service-not-allowed':L('Speech service is blocked. Check browser permissions and internet.','خدمة التعرف على الصوت محجوبة. راجع الأذونات والإنترنت.'),'no-speech':L('No speech detected. Speak clearly and try again.','لم أسمع كلامًا. تحدث بوضوح وحاول مرة أخرى.'),'network':L('Speech recognition needs internet access.','التعرف على الصوت يحتاج إلى اتصال بالإنترنت.'),'audio-capture':L('No microphone found.','لم يتم العثور على ميكروفون.'),'aborted':''};stat.textContent=m[e.error]??L('Microphone error: ','خطأ في الميكروفون: ')+e.error;if(['not-allowed','service-not-allowed','audio-capture','network'].includes(e.error))listening=false;draw()};
      rec.onend=()=>{if(listening){try{rec.start()}catch(e){listening=false;stat.textContent=L('Voice stopped. Tap Start microphone to try again.','توقف الصوت. اضغط تشغيل الميكروفون للمحاولة مجددًا.');draw()}}else draw()};
      listening=true;rec.start();stat.textContent=L('Microphone is on. Speak now.','الميكروفون يعمل، تحدث الآن.');draw();
    }catch(e){listening=false;stat.textContent=L('Could not start speech recognition. Try Google Chrome on HTTPS.','تعذر بدء التعرف على الصوت. جرّب Google Chrome مع رابط HTTPS.');draw()}
  }
  micB.addEventListener('click',()=>listening?stopL():startL());lang.addEventListener('change',()=>{if(listening){stopL();startL()}});
  const KP=[0.25,0.5,0.75,1,1.25,1.5,2,2.5,3,4,5,6],kp=h('div',{class:'mkp'}),sgnB=h('div',{class:'row',style:'gap:8px'});
  const drawSgn=()=>sgnB.replaceChildren(h('button',{type:'button',class:'btn'+(sgn==='-'?' on':''),style:'flex:1;min-height:54px;font-size:24px',onClick:()=>{sgn='-';drawSgn()}},'−'),h('button',{type:'button',class:'btn'+(sgn==='+'?' on':''),style:'flex:1;min-height:54px;font-size:24px',onClick:()=>{sgn='+';drawSgn()}},'+'));drawSgn();
  kp.append(h('button',{type:'button',class:'btn p',style:'min-height:54px',onClick:()=>apply([{v:'0'}])},'0 ✓'),...KP.map(v=>h('button',{type:'button',class:'btn',style:'min-height:54px;font-size:17px;font-weight:700',onClick:()=>apply([{v:spFmt(v)+sgn}])},String(v))));
  const custom=h('input',{placeholder:L('Type e.g. 1.25- or 82.5','اكتب مثلاً 1.25- أو 82.5'),style:'flex:1;color:#000'});const addC=()=>{const t=custom.value.trim();if(!t)return;apply([{v:t}]);custom.value=''};custom.addEventListener('keydown',e=>{if(e.key==='Enter')addC()});
  const nb=(l,fn)=>h('button',{type:'button',class:'btn',style:'flex:1 1 40%;min-height:46px',onClick:fn},l);
  const ov=h('div',{class:'mvo'},h('div',{class:'row',style:'justify-content:space-between;align-items:center'},title,h('button',{type:'button',class:'btn',onClick:()=>{stopL();ov.remove();onClose&&onClose()}},'✔ '+L('Done','تم'))),
    h('div',{class:'row',style:'align-items:center;gap:8px'},sizeIn,perB),prev,nextEl,hearEl,noteEl,
    SR?h('div',{class:'row wrap',style:'align-items:center'},micB,lang):h('div',{class:'warn'},L('Voice recognition is not available here (use Chrome on Android). The keypad works everywhere.','التعرف على الصوت غير متاح هنا (استخدم Chrome على أندرويد). الأزرار تعمل في كل مكان.')),stat,
    sgnB,kp,h('div',{class:'row'},custom,h('button',{type:'button',class:'btn p',onClick:addC},'↵')),
    h('div',{class:'row wrap'},nb('◀ '+L('Back','رجوع'),()=>{back();draw()}),nb(L('Skip','تخطي')+' ▶',()=>{adv();draw()}),nb('⤵ '+L('Next piece','القطعة التالية'),()=>apply([{c:'PIECE'}])),nb('⇥ '+L('Next size','المقاس التالي'),()=>apply([{c:'SIZE'}])),nb('⇩ '+L('Next table','الجدول التالي'),()=>apply([{c:'TABLE'}])),nb('⌫ '+L('Clear cell','مسح الخانة'),()=>{cur()[idx()]='';dirty=true;draw()})),
    h('div',{class:'hint',style:'color:#9fb3c6'},L('Order: piece 1 → every point, then piece 2 → every point, then the next size. Say: “نص ناقص”, “واحد زائد”, “صفر” · commands: التالي، رجوع، امسح، قطعة جديدة، مقاس جديد، مقاس 24، جدول جديد، وقف','الترتيب: القطعة 1 كل النقاط ثم القطعة 2 ثم المقاس التالي. قل: «نص ناقص»، «واحد زائد»، «صفر» · أوامر: التالي، رجوع، امسح، قطعة جديدة، مقاس جديد، مقاس 24، جدول جديد، وقف')));
  document.body.append(ov);draw()}

function reportPages(i,ed){
  const A=i.aql,basis=A?A.countBasis:'pieces',val=d=>num(basis==='occurrences'?d.occurrences:d.pieces);const by={};
  i.defs.forEach(d=>{const k=d.defectId||d.id;by[k]=by[k]||{name:defNm(d),critical:0,major:0,minor:0};if(SEV.includes(d.severity))by[k][d.severity]+=val(d)});
  const rows=Object.values(by),tot=c=>rows.reduce((a,r)=>a+r[c],0),NR=Math.max(15,rows.length+1);
  const decided=['approved','rejected'].includes(i.status),out=decided?(i.result==='accepted'?'pass':'fail'):(ed&&A&&A.result?A.result:'pending');
  const hv=(k,v,at,rr)=>ed?ed.inp(k,at,rr):v;
  const hb=(r,c)=>h('div',{class:'hb'+(c?' '+c:'')},r.map(([k,v])=>h('div',{},h('b',{},k),h('span',{},v==null?'':v))));
  const packing=i.packingPct?(String(i.packingPct).includes('%')?i.packingPct:i.packingPct+'%'):'';
  const smp=A?A.sampleSize:(i.sampleSize||'');
  const nz=v=>(v===0||v==='0')?'0':v;
  const rate=c=>{const f=A?A.cats[c].found:tot(c);return num(smp)>0?(f/num(smp)*100).toFixed(1)+'%':''};
  const pc=(c,t)=>h('div',{class:'pc '+c},h('div',{class:'pt'},t),[['AQL',A?A.cats[c].aql:''],[L('Sample size','حجم العينة'),smp],[L('Defect Allowed','المسموح'),A?A.cats[c].ac:''],[L('Defect Found','الموجود'),A?A.cats[c].found:tot(c)],[L('Defect %','نسبة العيوب'),rate(c)]].map(([k,v])=>h('div',{class:'pr'},h('span',{},k),h('span',{},nz(v)))));
  const cn=c=>A&&(A.cats[c].aql==='0'||A.cats[c].aql==='NA')?L('Not Allowed','غير مسموح'):(A?A.cats[c].aql:'');
  const ptxt=(A&&A.procedure)||(A?`Sampling inspection based on ${A.planName}. AQL: Critical ( ${cn('critical')} ), Major ( ${cn('major')} ), Minor ( ${cn('minor')} ).`:L('No AQL plan applied: manual decision.','لم تُطبّق خطة AQL: قرار يدوي.'));
  const P=[['packaging','Packaging','التعبئة'],['labeling','Labeling','الليبلات'],['spec','Product Specification','مواصفات المنتج'],['approvedSample','Approved Sample','العينة المعتمدة'],['measurement','Measurement Audit','مراجعة المقاسات'],['visual','Visual Inspection','الفحص البصري']];
  let dtRows;if(ed)dtRows=ed.rows(NR);else{dtRows=[...rows.map(r=>h('tr',{},h('td',{},r.name),h('td',{class:'n'},r.critical||''),h('td',{class:'n'},r.major||''),h('td',{class:'n'},r.minor||'')))];
  while(dtRows.length<NR)dtRows.push(h('tr',{},h('td'),h('td'),h('td'),h('td')));}
  const tc=ed?' tap':'';
  const prRows=P.map(([k,en,ar])=>h('tr',{},h('td',{},L(en,ar)),h('td',{class:'n'+tc,onClick:ed?()=>ed.prop(k,'yes'):null},i.props[k]==='yes'?'√':''),h('td',{class:'n'+tc,onClick:ed?()=>ed.prop(k,'no'):null},i.props[k]==='no'?'√':'')));
  while(prRows.length<NR+1)prRows.push(h('tr',{},h('td'),h('td'),h('td')));
  const cl=String(i.comment||'').split('\n');const cm=[];for(let k=0;k<6;k++)cm.push(k<5?(cl[k]||''):cl.slice(5).join(' '));
  const ava=h('div',{class:'ava'});ava.append(h('img',{src:setOf(i).avatar||DEF_AVATAR}));
  const fw=String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean);
  const logo=h('div',{class:'rlh'},h('img',{class:'rlogo',src:S.settings.logo||DEF_LOGO}),h('div',{class:'rlogotxt'},fw.length>1?fw.map(w=>h('div',{},w)):S.settings.factoryName));
  const procBlock=ed?h('div',{class:'procE','data-live':'proc'},h('div',{class:'ptxt'},ptxt),h('div',{class:'pcs'},pc('critical',L('CRITICAL DEFECTS','عيوب حرجة')),pc('major',L('MAJOR DEFECTS','عيوب رئيسية')),pc('minor',L('MINOR DEFECTS','عيوب ثانوية')))):
    h('div',{class:'two2'},h('div',{class:'pl'},h('div',{class:'ptxt'},ptxt),pc('critical',L('CRITICAL DEFECTS','عيوب حرجة'))),h('div',{class:'pl2'},pc('major',L('MAJOR DEFECTS','عيوب رئيسية')),pc('minor',L('MINOR DEFECTS','عيوب ثانوية'))));
  const photos=mapDefPhotos(i);
  const ip=(i.itemPhotos||[]).map(x=>({p:x.p,cap:x.cap||''}));
  const defCap=x=>[h('b',{},x.name),' ',x.sev?h('i',{style:'color:'+sevColor[x.sev]},'('+L(...sevL[x.sev])+')'):null];
  const pblock=(arr,title,cap)=>[h('div',{class:'phead'},title),h('div',{class:'pg'},arr.map(x=>x?h('figure',{},h('img',{src:x.p}),h('figcaption',{},cap(x))):h('figure',{class:'empty'},h('div',{class:'eimg'}),h('figcaption',{}))))];
  const T_DEF=L('Photos of Defects','صور العيوب'),T_ITEM=L('Photos Presenting The Actual Item','صور المنتج الفعلي');
  const p1=h('div',{class:ed?'sheet':'rpage'},logo,h('div',{class:'rtitle'},L('INSPECTION REPORT','تقرير الفحص')),
    h('div',{class:'hrow'},hb([[L('Customer','العميل'),ed?ed.cust():i.customer],[L('Po Customer','PO العميل'),hv('poCustomer',i.poCustomer,{},true)],[L('Model','الموديل'),hv('model',i.model)]]),
      hb([[L('Item','الصنف'),(ed?ed.item():gName(i.garmentType).toUpperCase())],[L('Style','الستايل'),hv('style',i.style)],[L('Sales order','أمر البيع'),hv('salesOrder',i.salesOrder)]]),
      hb([[L('Quantity','الكمية'),hv('orderQty',i.orderQty,{type:'number',min:0},true)],[L('Actual quantity','الكمية الفعلية'),hv('actualQty',i.actualQty,{type:'number',min:0},true)],[L('Packing','التعبئة'),ed?h('span',{'data-live':'pk'},pack(i)):pack(i)]]),
      hb([[L('Date','التاريخ'),hv('date',fmtDate(i.date),{type:'datetime-local'})],[L('Inspection No.','عدد الفحص'),ed?ed.sel('round',RND_OPTS()):optTxt(RND_OPTS(),i.round)],[L('Inspection Type','نوع الفحص'),ed?ed.sel('inspType',TYPE_OPTS()):optTxt(TYPE_OPTS(),i.inspType)]],'hbred')),
    ed?[h('div',{class:'bar1'},'• '+L('Order & Sampling','الطلبية والعينة')),ed.basics()]:null,
    h('div',{class:'bar1'},'• '+L('Inspection Procedure & Results','إجراء الفحص والنتائج')),procBlock,
    h('div',{class:'two2',style:'margin-top:20px'},
      h('table',{class:'dt'},h('colgroup',{},h('col',{style:'width:55%'}),h('col',{style:'width:15%'}),h('col',{style:'width:15%'}),h('col',{style:'width:15%'})),h('tr',{},h('th',{class:'g'},L('Details of Defect Found','تفاصيل العيوب')),h('th',{class:'cc'},L('CRITICAL','حرج')),h('th',{class:'cm'},L('MAJOR','رئيسي')),h('th',{class:'cn'},L('MINOR','ثانوي'))),dtRows,
        h('tr',{class:'tot','data-live':'tot'},h('td',{},L('Defect Total','الإجمالي')),h('td',{class:'n'},tot('critical')),h('td',{class:'n'},tot('major')),h('td',{class:'n'},tot('minor')))),
      h('table',{class:'pt2'},h('colgroup',{},h('col',{style:'width:48%'}),h('col',{style:'width:24%'}),h('col',{style:'width:28%'})),h('tr',{},h('th',{class:'o'},L('Inspection Property','بند الفحص')),h('th',{class:'o2'},L('Confirmed','مطابق')),h('th',{class:'o3'},L('NON - Confirmed','غير مطابق'))),prRows)),
    h('div',{class:'bar2'},'• '+L('Inspection Result','نتيجة الفحص')),
    h('div',{class:'resrow','data-live':'res'},['pass','fail','pending'].map(o=>h('div',{class:'resc'},h('div',{class:'resbox r-'+o},L(o.toUpperCase(),({pass:'ناجح',fail:'مرفوض',pending:'معلّق'})[o]),h('div',{class:'ck'},out===o?'✓':''))))),
    ed&&!decided?h('p',{class:'hint','data-live':'resn',style:'text-align:center;margin:4px 0 0'},A&&A.result?L('Provisional result per AQL plan; final decision is the reviewer\u2019s.','نتيجة مؤقتة حسب خطة AQL؛ القرار النهائي للمراجع.'):L('Awaiting reviewer decision.','بانتظار قرار المراجع.')):null,
    h('div',{class:'crow'},h('table',{class:'cmt'},h('tr',{},h('th',{},L('Comment','تعليق'))),cm.map((t,k)=>h('tr',{},h('td',{},ed?ed.cm(k,t,cm):t)))),
      h('div',{class:'ins'},h('div',{class:'ihead'},ava,h('div',{class:'ititle'},L('Inspector','المفتش'))),h('div',{class:'irow'},h('b',{},L('Name.','الاسم.')),h('span',{class:'nm'},ed?ed.inp('inspectorName',{list:'dl-inspectors',autocomplete:'off',readonly:!isMgr()}):i.inspectorName)),h('div',{class:'irow'},h('b',{},L('From.','من.')),h('u',{},S.settings.fromText||S.settings.factoryName)))),
    ed?[h('div',{class:'phead'},T_DEF),ed.defPhotos()]:null,ed?[h('div',{class:'phead'},T_ITEM),ed.itemPhotos()]:null,ed?ed.meas():null);
  const pages=[p1];
  if(!ed){const pd=padPages(photos,setOf(i).minDefPages??2),pi=padPages(ip,setOf(i).minItemPages??0);
    for(let k=0;k<pd.length;k+=15)pages.push(h('div',{class:'rpage'},pblock(pd.slice(k,k+15),T_DEF,defCap)));
    for(let k=0;k<pi.length;k+=15)pages.push(h('div',{class:'rpage'},pblock(pi.slice(k,k+15),T_ITEM,x=>x.cap)));
    if(i.measOn)measPages(i).forEach(x=>pages.push(x))}
  return pages}
/* ---------- Excel export (same design as the PDF / the factory's AQL Report sheet) ---------- */
function cropCover(src,w,h){return new Promise((res,rej)=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);
  const r=Math.max(c.width/im.width,c.height/im.height),dw=im.width*r,dh=im.height*r;x.drawImage(im,(c.width-dw)/2,(c.height-dh)/2,dw,dh);res(c.toDataURL('image/jpeg',.85))};im.onerror=()=>rej(new Error('image'));im.src=src})}
async function makeXlsx(i){
  if(!window.ExcelJS)throw new Error('Excel library missing');
  const wb=new ExcelJS.Workbook();wb.creator=S.settings.factoryName||'AQL Inspection';wb.created=new Date();wb.calcProperties={fullCalcOnLoad:true};
  const ws=wb.addWorksheet('AQL Report',{views:[{showGridLines:false}],properties:{defaultRowHeight:15}});
  for(let c=1;c<=18;c++)ws.getColumn(c).width=6.4;            /* 18 equal columns A..R like the factory sheet */
  const COLPX=45,ROWPT=20;
  const fill=c=>({type:'pattern',pattern:'solid',fgColor:{argb:'FF'+c}});
  const th={style:'thin',color:{argb:'FF7F7F7F'}},bd={top:th,left:th,bottom:th,right:th};
  const adr=(c,r)=>String.fromCharCode(64+c)+r,H=(r,h)=>{ws.getRow(r).height=h};
  function M(c1,r1,c2,r2,val,o){o=o||{};if(c1!==c2||r1!==r2)ws.mergeCells(`${adr(c1,r1)}:${adr(c2,r2)}`);
    for(let r=r1;r<=r2;r++)for(let c=c1;c<=c2;c++){const x=ws.getCell(adr(c,r));if(o.fill)x.fill=fill(o.fill);if(o.border)x.border=bd}
    const t=ws.getCell(adr(c1,r1));if(val!==undefined&&val!==null)t.value=val;
    t.font={name:'Calibri',size:o.size||9,bold:o.bold!==false,italic:!!o.i,underline:o.u?'single':undefined,color:{argb:'FF'+(o.color||'000000')}};
    t.alignment={horizontal:o.h||'left',vertical:o.v||'middle',wrapText:!!o.wrap,shrinkToFit:!!o.shrink,indent:o.h==='left'&&o.ind?o.ind:0};if(o.nf)t.numFmt=o.nf;return t}
  const A=i.aql,basis=A?A.countBasis:'pieces',val=d=>num(basis==='occurrences'?d.occurrences:d.pieces),by={};
  i.defs.forEach(d=>{const k=d.defectId||d.id;by[k]=by[k]||{name:defNm(d),critical:0,major:0,minor:0};if(SEV.includes(d.severity))by[k][d.severity]+=val(d)});
  const rows=Object.values(by),tot=c=>rows.reduce((a,r)=>a+r[c],0),NR=Math.max(14,rows.length);
  const decided=['approved','rejected'].includes(i.status),out=decided?(i.result==='accepted'?'pass':'fail'):'pending';
  const smp=A?A.sampleSize:(num(i.sampleSize)||'');
  const cn=c=>A&&(A.cats[c].aql==='0'||A.cats[c].aql==='NA')?'Not Allowed':(A?A.cats[c].aql:'');
  const ptxt=(A&&A.procedure)||(A?`Sampling inspection based on ${A.planName}. AQL: Critical ( ${cn('critical')} ), Major ( ${cn('major')} ), Minor ( ${cn('minor')} ).`:'No AQL plan applied: manual decision.');
  const W='FFFFFF',DK='404040',BL='1F4E79',RED='FF0000',ORG='FFC000',YEL='FFFF00';
  /* header: logo + name, title */
  H(1,15);H(2,15);H(3,15);
  const logoId=wb.addImage({base64:S.settings.logo||DEF_LOGO,extension:'jpeg'});ws.addImage(logoId,{tl:{col:0.08,row:0.1},ext:{width:38,height:44},editAs:'oneCell'});
  const words=String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean);
  [0,1,2].forEach(k=>M(2,k+1,4,k+1,words.length>1?(words[k]||'').split('').join(' '):(k===0?S.settings.factoryName:''),{size:8,color:'2E75B6'}));
  H(4,22);M(1,4,18,4,L('INSPECTION REPORT','تقرير الفحص'),{size:14});H(5,6);
  /* header boxes (rows 6-8) */
  [6,7,8].forEach(r=>H(r,16));
  const labR=(c1,c2,r,t)=>M(c1,r,c2,r,t,{fill:'C62828',color:W}),vlR=(c1,c2,r,v,o)=>M(c1,r,c2,r,v,Object.assign({fill:'C62828',color:W,h:'right',shrink:true},o||{}));
  const lab=(c1,c2,r,t)=>M(c1,r,c2,r,t,{fill:DK,color:W}),vl=(c1,c2,r,v,o)=>M(c1,r,c2,r,v,Object.assign({fill:DK,color:W,h:'right',shrink:true},o||{}));
  lab(1,2,6,L('Customer','العميل'));vl(3,5,6,i.customer);lab(1,2,7,L('Po Customer','PO العميل'));vl(3,5,7,i.poCustomer);lab(1,2,8,L('Model','الموديل'));vl(3,5,8,i.model);
  lab(7,8,6,L('Item','الصنف'));vl(9,10,6,gName(i.garmentType).toUpperCase());lab(7,8,7,L('Style','الستايل'));vl(9,10,7,i.style);lab(7,8,8,L('Sales order','أمر البيع'));vl(9,10,8,i.salesOrder);
  lab(12,13,6,L('Quantity','الكمية'));vl(14,14,6,num(i.orderQty)||null,{h:'center'});lab(12,13,7,L('Actual quantity','الكمية الفعلية'));vl(14,14,7,num(i.actualQty)||null,{h:'center'});
  lab(12,13,8,L('Packing','التعبئة'));const pk=num(i.orderQty)>0&&num(i.actualQty)>0?num(i.actualQty)/num(i.orderQty):'';
  vl(14,14,8,{formula:'IF(N6=0,"",N7/N6)',result:pk},{h:'center',nf:'0%'});
  labR(16,16,6,L('Date','التاريخ'));vlR(17,18,6,fmtDate(i.date));labR(16,16,7,L('Inspection No.','عدد الفحص'));vlR(17,18,7,optTxt(RND_OPTS(),i.round),{h:'center'});labR(16,16,8,L('Inspection Type','نوع الفحص'));vlR(17,18,8,optTxt(TYPE_OPTS(),i.inspType),{h:'center'});
  H(9,6);H(10,22);M(1,10,18,10,'• '+L('Inspection Procedure & Results','إجراء الفحص والنتائج'),{fill:BL,color:W,size:12,h:'center'});H(11,6);
  /* procedure block (rows 12-17) */
  for(let r=12;r<=17;r++)H(r,16);
  M(1,12,6,17,ptxt,{fill:'A6A6A6',size:8,h:'center',wrap:true});
  const FOUND=16,TOTROW=20+NR;
  const colBlock=(c1,c2,vc,fillc,title,cat,ftot)=>{M(c1,12,vc,12,title,{fill:fillc,size:8,h:'center'});
    const f=A?A.cats[cat].found:tot(cat),al=A?A.cats[cat].ac:'';
    const data=[[L('AQL','AQL'),cat==='critical'?0:(A?(cat==='major'?2.5:'4.0'):'')],[L('Sample size','حجم العينة'),smp],[L('Defect Allowed','المسموح'),al],[L('Defect Found','الموجود'),{formula:`${ftot}${TOTROW}`,result:f}],[L('Defect %','نسبة العيوب'),{formula:`IF(${adr(vc,14)}=0,"",${adr(vc,16)}/${adr(vc,14)})`,result:(num(smp)>0?f/num(smp):''),nf:'0.0%'}]];
    data.forEach(([l,v],k)=>{const r=13+k;M(c1,r,vc-1,r,l,{fill:'A6A6A6',size:9});const isF=v&&typeof v==='object';M(vc,r,vc,r,isF?{formula:v.formula,result:v.result}:v,{fill:'A6A6A6',h:'right',size:9,nf:isF&&v.nf?v.nf:undefined})})};
  const aqlv=c=>A?A.cats[c].aql:'';
  colBlock(8,10,10,RED,L('CRITICAL DEFECTS','عيوب حرجة'),'critical','H');colBlock(12,14,14,ORG,L('MAJOR DEFECTS','عيوب رئيسية'),'major','I');colBlock(16,18,18,YEL,L('MINOR DEFECTS','عيوب ثانوية'),'minor','J');
  /* AQL values come from the plan snapshot when present */
  if(A){ws.getCell('J13').value=aqlv('critical')==='NA'?0:(isNaN(+aqlv('critical'))?aqlv('critical'):+aqlv('critical'));ws.getCell('N13').value=isNaN(+aqlv('major'))?aqlv('major'):+aqlv('major');ws.getCell('R13').value=aqlv('minor')}
  H(18,8);
  /* tables */
  H(19,18);M(1,19,7,19,L('Details of Defect Found','تفاصيل العيوب'),{fill:'548235',color:W,size:10,h:'center'});
  M(8,19,8,19,L('CRITICAL','حرج'),{fill:RED,size:7,h:'center'});M(9,19,9,19,L('MAJOR','رئيسي'),{fill:ORG,size:7,h:'center'});M(10,19,10,19,L('MINOR','ثانوي'),{fill:YEL,size:7,h:'center'});
  M(12,19,14,19,L('Inspection Property','بند الفحص'),{fill:'ED7D31',color:W,h:'center'});M(15,19,16,19,L('Confirmed','مطابق'),{fill:'F4B183',size:8,h:'center'});M(17,19,18,19,L('NON - Confirmed','غير مطابق'),{fill:'FBE5D6',size:8,h:'center'});
  const P=[['packaging','Packaging','التعبئة'],['labeling','Labeling','الليبلات'],['spec','Product Specification','مواصفات المنتج'],['approvedSample','Approved Sample','العينة المعتمدة'],['measurement','Measurement Audit','مراجعة المقاسات'],['visual','Visual Inspection','الفحص البصري']];
  for(let k=0;k<NR;k++){const r=20+k,fc=k%2?'EFEFEF':'D9D9D9',d=rows[k];H(r,17);
    M(1,r,7,r,d?d.name:'',{fill:fc,border:true,size:9,shrink:true});
    ['critical','major','minor'].forEach((c,j)=>M(8+j,r,8+j,r,d&&d[c]?d[c]:null,{fill:fc,border:true,h:'center',size:10}));
    const p=P[k];M(12,r,14,r,p?L(p[1],p[2]):'',{fill:fc,border:true,size:9});M(15,r,16,r,p&&i.props[p[0]]==='yes'?'√':'',{fill:fc,border:true,h:'center',size:12});M(17,r,18,r,p&&i.props[p[0]]==='no'?'√':'',{fill:fc,border:true,h:'center',size:12})}
  H(TOTROW,17);M(1,TOTROW,7,TOTROW,L('Defect Total','الإجمالي'),{fill:'D9D9D9',border:true,h:'right'});
  ['H','I','J'].forEach((cl,j)=>M(8+j,TOTROW,8+j,TOTROW,{formula:`SUM(${cl}20:${cl}${TOTROW-1})`,result:tot(SEV[j])},{fill:'D9D9D9',border:true,h:'center',size:10}));
  M(12,TOTROW,14,TOTROW,'',{fill:'D9D9D9',border:true});M(15,TOTROW,16,TOTROW,'',{fill:'D9D9D9',border:true});M(17,TOTROW,18,TOTROW,'',{fill:'D9D9D9',border:true});
  /* result */
  const RB=TOTROW+2;H(TOTROW+1,8);H(RB,20);M(1,RB,18,RB,'• '+L('Inspection Result','نتيجة الفحص'),{fill:BL,color:W,size:10,h:'center'});H(RB+1,18);H(RB+2,20);
  const ok=A&&A.authoritative&&(i.history||[]).some(x=>String(x.action).startsWith('auto_'));
  const guard='OR(J14=0,N14=0,R14=0)';
  const passF=`IF(${guard},"",IF(AND(J16<=J15,N16<=N15,R16<=R15),"✔",""))`,failF=`IF(${guard},"",IF(OR(J16>J15,N16>N15,R16>R15),"✔",""))`;
  const box=(c1,c2,t,fc,tick)=>{M(c1,RB+1,c2,RB+1,t,{fill:fc,color:W,size:10,h:'center'});M(c1,RB+2,c2,RB+2,tick===undefined?'':tick,{fill:fc,color:'000000',size:14,h:'center'})};
  box(2,4,L('PASS','ناجح'),'548235',ok?{formula:passF,result:out==='pass'?'✔':''}:(out==='pass'?'✔':''));
  box(8,11,L('FAIL','مرفوض'),RED,ok?{formula:failF,result:out==='fail'?'✔':''}:(out==='fail'?'✔':''));
  box(14,17,L('PENDING','معلّق'),'BF9000',out==='pending'?'✔':'');
  H(RB+3,18);
  /* comment + inspector */
  const c0=RB+4,cl=String(i.comment||'').split('\n');
  H(c0,22);M(1,c0,10,c0,L('Comment','تعليق'),{fill:'595959',color:W,size:11,h:'center',border:true});
  for(let k=1;k<=6;k++){H(c0+k,k<3?24:18);M(1,c0+k,10,c0+k,k<6?(cl[k-1]||''):cl.slice(5).join(' '),{border:false,fill:W,size:9,bold:false,shrink:true});for(let cc=1;cc<=10;cc++){const cell=ws.getCell(c0+k,cc);cell.border={left:cc===1?th:undefined,right:cc===10?th:undefined,top:k===1?th:undefined,bottom:k===6?th:undefined}}}
  M(13,c0,15,c0+2,'',{fill:W,border:true});M(16,c0,18,c0+2,L('Inspector','المفتش'),{fill:'595959',color:W,size:12,h:'center',border:true});
  M(13,c0+3,14,c0+3,L('Name:','الاسم:'),{fill:W,border:true,size:10});M(15,c0+3,18,c0+3,i.inspectorName,{fill:W,border:true,color:'000080',h:'center',size:10,shrink:true});
  M(13,c0+4,18,c0+4,'',{fill:W,border:true});M(13,c0+5,14,c0+5,L('From:','من:'),{fill:W,border:true,size:10});M(15,c0+5,18,c0+5,S.settings.fromText||S.settings.factoryName,{fill:W,border:true,u:true,h:'center',size:10,shrink:true});M(13,c0+6,18,c0+6,'',{fill:W,border:true});
  const avW=COLPX*3-4,avH=Math.round((22+24+24)*96/72)-4;
  const avId=wb.addImage({base64:await cropCover(setOf(i).avatar||DEF_AVATAR,avW,avH),extension:'jpeg'});ws.addImage(avId,{tl:{col:12,row:c0-1},br:{col:15,row:c0+2},editAs:'twoCell'});
  let row=c0+8;const breaks=[c0+6];
  /* photo pages: header + 5 rows x 3 photos, 36 rows per page like the factory sheet */
  const blocks=[[1,6],[8,12],[14,18]];
  async function photoPages(title,list,cap){
    for(let k=0;k<list.length;k+=15){const page=list.slice(k,k+15);H(row,24);M(1,row,18,row,title,{fill:BL,color:W,size:14,h:'center'});row++;
      for(let rr=0;rr<5;rr++){const its=page.slice(rr*3,rr*3+3);if(!its.length)break;
        for(let j=0;j<6;j++)H(row+j,ROWPT);H(row+6,16);
        for(let b=0;b<its.length;b++){const [c1,c2]=blocks[b],it=its[b],w=(c2-c1+1)*COLPX-2,h=Math.round(6*ROWPT*96/72)-2;
          M(c1,row,c2,row+5,'',{border:true,fill:W});const t=M(c1,row+6,c2,row+6,'',{border:true,size:8,fill:W,shrink:true});if(it){t.value=cap(it);
          const id=wb.addImage({base64:await cropCover(it.p,w,h),extension:'jpeg'});ws.addImage(id,{tl:{col:c1-1,row:row-1},br:{col:c2,row:row+5},editAs:'twoCell'})}}
        row+=7}
      breaks.push(row-1)}}
  const photos=padPages(mapDefPhotos(i),setOf(i).minDefPages??2);
  await photoPages(L('Photos of Defects','صور العيوب'),photos,x=>({richText:[{text:x.name+' ',font:{name:'Calibri',size:8,bold:true}},...(x.sev?[{text:'('+L(...sevL[x.sev])+')',font:{name:'Calibri',size:8,color:{argb:'FFF5A800'}}}]:[])]}));
  await photoPages(L('Photos Presenting The Actual Item','صور المنتج الفعلي'),padPages((i.itemPhotos||[]).map(x=>({p:x.p,cap:x.cap||''})),setOf(i).minItemPages??0),x=>x.cap||'');
  if(i.measOn){const logoX=wb.addImage({base64:S.settings.logo||DEF_LOGO,extension:'jpeg'}),nv=v=>(v!==''&&v!=null&&!isNaN(+v))?+v:(v||'');
    for(const k of measKinds(i.garmentType)){const blocks=(i.meas&&i.meas[k])||[],per=k==='trousers'?5:4;
      for(let st=0;st<Math.max(blocks.length,1);st+=per){
        for(let q=0;q<3;q++)H(row+q,15);ws.addImage(logoX,{tl:{col:0.08,row:row-1+0.1},ext:{width:38,height:44},editAs:'oneCell'});
        [0,1,2].forEach(q=>M(2,row+q,4,row+q,words.length>1?(words[q]||'').split('').join(' '):(q===0?S.settings.factoryName:''),{size:8,color:'2E75B6'}));row+=3;
        H(row,22);M(1,row,18,row,L('MEASUREMENT REPORT','تقرير المقاسات'),{size:14});row++;H(row,6);row++;
        const bx=(c1,c2,c3,c4,data)=>data.forEach(([a,b],q)=>{H(row+q,22);M(c1,row+q,c2,row+q,a,{border:true,fill:W,size:8,wrap:true});M(c3,row+q,c4,row+q,b,{border:true,fill:W,size:9,h:'center',shrink:true})});
        bx(1,2,3,5,[[L('Customer','العميل'),i.customer],[L('Po Customer','PO العميل'),i.poCustomer],[L('Model','الموديل'),i.model]]);
        bx(7,8,9,10,[[L('Item','الصنف'),gName(i.garmentType).toUpperCase()],[L('Style','الستايل'),i.style],[L('Sales order','أمر البيع'),nv(i.salesOrder||i.orderNo)]]);
        bx(12,13,14,14,[[L('No.Of Samples Measured','عدد العينات المقاسة'),nv(i.measSamples)],[L('Number Of Size','عدد المقاسات'),nv(i.measSizes||autoSizes(i))],[L('Color','اللون'),i.color]]);
        bx(16,16,17,18,[[L('Date','التاريخ'),fmtDate(i.date)],[L('Order No','رقم الطلبية'),nv(i.orderNo)],[L('Inspector','المفتش'),i.inspectorName]]);
        row+=3;H(row,10);row++;
        for(const b of blocks.slice(st,st+per)){H(row,22);const dg=M(1,row,1,row,'',{border:true,fill:W});dg.border=Object.assign({},bd,{diagonal:{up:true,down:false,style:'thin',color:{argb:'FF000000'}}});
          M(2,row,2,row,'Tol +',{border:true,fill:W,size:8,h:'center'});M(3,row,3,row,'Tol -',{border:true,fill:W,size:8,h:'center'});
          let c=4;MG.forEach((n,g)=>{M(c,row,c+n-1,row,b.heads[g]||'',{border:true,fill:W,size:9,h:'center',shrink:true});c+=n});row++;
          for(const r of b.rows){H(row,22);M(1,row,1,row,r.name,{border:true,fill:W,size:9,shrink:true});M(2,row,2,row,nv(r.tp),{border:true,fill:W,h:'center',size:9});M(3,row,3,row,nv(r.tm),{border:true,fill:W,h:'center',size:9});
            for(let q=0;q<15;q++){const bad=measOutOfTolerance(b,r,q);M(4+q,row,4+q,row,nv(r.c[q]),{border:true,fill:bad?'FF0000':W,color:bad?'FFFFFF':'000000',h:'center',size:9,bold:bad})}row++}
          H(row,10);row++}
        breaks.push(row-1)}}}
  const last=Math.max(row-1,c0+6);breaks.pop();breaks.forEach(r=>ws.getRow(r).addPageBreak());
  ws.pageSetup={paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,horizontalCentered:true,margins:{left:.4,right:.4,top:.4,bottom:.4,header:.2,footer:.2},printArea:`A1:R${last}`};
  const buf=await wb.xlsx.writeBuffer();return new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})}

/* ---------- A4 PDF export for any data page (added 19 Nov 2026) ---------- */
const PAGE_PDF_ROUTES=['','archive','reports','library','aql'];
function pagePdfBar(){const a=ROUTE.split('/')[1]||'';if(!PAGE_PDF_ROUTES.includes(a))return null;const nav=NAV.find(n=>n[0]==='#/'+a)||NAV[0];
 return h('div',{class:'noprint',style:'margin-bottom:10px'},h('button',{type:'button',class:'btn s',onClick:e=>pageToPdf(e.currentTarget,L(nav[2],nav[3]),nav[2])},'⬇ '+L('Export PDF (A4)','تصدير PDF (A4)')))}
async function pageToPdf(btn,title,en){const t=btn.textContent;btn.disabled=true;btn.textContent=L('Preparing…','جارٍ التجهيز…');
 try{const d=new Date(),p=n=>String(n).padStart(2,'0');const blob=await makePagePdf(title);cmpSaveBlob(blob,`${en.replace(/[^\w]+/g,'-')}-${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}.pdf`);await audit('page_pdf_exported',null,{page:en})}
 catch(e){alert(L('Export failed: ','فشل التصدير: ')+(e&&e.message||e))}finally{btn.disabled=false;btn.textContent=t}}
async function makePagePdf(title){
 if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
 const view=document.getElementById('view');if(!view)throw new Error('Nothing to export');
 try{await document.fonts.ready}catch(e){}
 const scale=Math.max(.8,Math.min(2,26000/Math.max(1,view.scrollHeight)));let cuts=[],cssW=794;
 const canvas=await window.html2canvas(view,{scale,backgroundColor:'#ffffff',useCORS:true,logging:false,windowWidth:794,
  onclone:(doc)=>{const v=doc.getElementById('view');if(!v)return;
   doc.querySelectorAll('.noprint,button,.btn,input[type=file]').forEach(n=>n.remove());
   doc.querySelectorAll('input,textarea').forEach(n=>{if(!n.value&&n.type!=='checkbox'&&n.type!=='radio')n.remove()});doc.querySelectorAll('select').forEach(n=>{if(n.selectedIndex<=0)n.remove()});
   const d=new Date(),logo=h('img',{class:'rlogo',src:S.settings.logo||DEF_LOGO});
   const factoryWords=String(S.settings.factoryName||'').toUpperCase().split(/\s+/).filter(Boolean);
   const factoryHeader=h('div',{class:'rlh',style:'margin-bottom:8px'},logo,h('div',{class:'rlogotxt'},factoryWords.map(w=>h('div',{},w))));
   const reportMeta=h('div',{style:'border-bottom:2px solid #0e7490;padding:0 0 8px;margin:0 0 12px'},h('div',{style:'font-weight:800;font-size:15px'},title),h('div',{style:'font-size:11px;color:#555;margin-top:3px'},d.toLocaleDateString()+' '+d.toLocaleTimeString().slice(0,5)));
   v.prepend(factoryHeader,reportMeta);
   v.style.background='#fff';v.style.padding='14px';v.style.maxWidth='none';v.style.width='794px';v.style.boxSizing='border-box';
   const top=v.getBoundingClientRect().top;cssW=v.getBoundingClientRect().width||794;
   cuts=[...v.querySelectorAll(':scope > *, .stack > *, .list > *, .card, tbody > tr, .item, .item2, .grid > *')].map(n=>Math.round(n.getBoundingClientRect().bottom-top)).filter(y=>y>0);}});
 const W=canvas.width,H=canvas.height,pageH=Math.floor(W*277/190),cs=[...new Set(cuts.map(y=>Math.round(y*scale)))].sort((a,b)=>a-b);
 const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true}),ranges=[];let s=0;
 while(s<H-2){let e=Math.min(H,s+pageH);if(e<H){const c=cs.filter(y=>y>s+pageH*.5&&y<=e).pop();if(c)e=c}ranges.push([s,e]);s=e}
 ranges.forEach(([a,b],k)=>{const sl=document.createElement('canvas');sl.width=W;sl.height=b-a;const x=sl.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,b-a);x.drawImage(canvas,0,a,W,b-a,0,0,W,b-a);
  if(k)pdf.addPage();pdf.addImage(sl.toDataURL('image/jpeg',.92),'JPEG',10,10,190,(b-a)*190/W,undefined,'FAST');pdf.setFontSize(8);pdf.setTextColor(120);pdf.text((k+1)+' / '+ranges.length,105,291,{align:'center'})});
 return pdf.output('blob')}

async function makePdf(i){if(!window.jspdf||!window.html2canvas)throw new Error('PDF library missing');
  const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',orientation:'portrait',compress:true});const stage=h('div',{class:'stage',style:'position:fixed;left:-12000px;top:0;width:794px'});document.body.append(stage);
  try{const pages=reportPages(i);for(let k=0;k<pages.length;k++){stage.replaceChildren(pages[k]);try{await document.fonts.load("700 12px CalibriX");await document.fonts.load("400 12px CalibriX");await document.fonts.ready}catch(e){}await new Promise(r=>setTimeout(r,80));
    const c=await window.html2canvas(pages[k],{scale:3,backgroundColor:'#ffffff',useCORS:true,logging:false});if(k)pdf.addPage();pdf.addImage(c.toDataURL('image/jpeg',.93),'JPEG',0,0,210,297,undefined,'FAST')}}
  finally{stage.remove()}try{const kw=await pdfEmbed(i);if(kw)pdf.setProperties({keywords:kw})}catch(e){}return pdf.output('blob')}
function vReport(){const id=ROUTE.split('/')[2],i=S.ins.find(x=>x.id===id);if(!i||(!isMgr()&&!mine(i)))return h('div',{class:'card empty'},h('h2',{},L('Inspection not found','الفحص غير موجود')));
  const z=Math.min(1,(innerWidth-(innerWidth>=900?300:24))/794);const pages=reportPages(i);pages.forEach(p=>p.style.zoom=z);
  const resultSuffix=['approved','rejected'].includes(i.status)?(i.result==='accepted'?'PASS':'FAIL'):'PENDING';
  const fname=`AQL-Inspection-Report-${(i.orderNo||i.id).replace(/[^\w-]+/g,'_')}-${resultSuffix}.pdf`;
  const run=async(b,fn)=>{const t=b.textContent;b.disabled=true;b.textContent=L('Preparing…','جارٍ التجهيز…');try{await fn()}catch(e){alert(L('Export failed: ','فشل التصدير: ')+(e&&e.message||e))}b.disabled=false;b.textContent=t};
  const dl=(blob,nm)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nm||fname;document.body.append(a);a.click();a.remove()};
  return h('div',{},h('div',{class:'rtools noprint'},
    h('button',{class:'btn p',onClick:e=>run(e.currentTarget,async()=>{dl(await makePdf(i));await audit('report_pdf_downloaded',i.id)})},'⬇ '+L('Download PDF','تحميل PDF')),
    h('button',{class:'btn',onClick:e=>run(e.currentTarget,async()=>{const blob=await makePdf(i);const f=new File([blob],fname,{type:'application/pdf'});
      if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:fname});await audit('report_pdf_shared',i.id)}else{dl(blob);alert(L('Sharing files is not supported here. The PDF was downloaded; attach it in WhatsApp manually.','المشاركة المباشرة غير مدعومة هنا. تم تحميل الـPDF؛ أرفقه يدوياً في واتساب.'))}})},'📤 '+L('Share (WhatsApp)','مشاركة (واتساب)')),
    h('button',{class:'btn',onClick:e=>run(e.currentTarget,async()=>{dl(await makeXlsx(i),fname.replace(/\.pdf$/,'.xlsx'));await audit('report_xlsx_downloaded',i.id)})},'📊 '+L('Download Excel','تحميل Excel')),h('button',{class:'btn',onClick:()=>print()},'🖨 '+L('Print','طباعة')),(isMgr()&&['approved','rejected'].includes(i.status)?h('button',{class:'btn',onClick:()=>reopenIns(i)},'🔓 '+L('Reopen for correction','إعادة فتح للتصحيح')):null),(isMgr()&&i.orderNo?h('a',{class:'btn',href:'#/compare/'+encodeURIComponent(i.orderNo)},'⚖️ '+L('Compare with customer report','مقارنة مع تقرير العميل')):null),h('a',{class:'btn',href:'#/i/'+i.id},L('Open record','فتح السجل'))),
    h('div',{class:'rwrap'},pages))}
/* ---------- members, sign-in, manager panel (this device only) ---------- */
const hash53=(str,seed=0)=>{let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677)}h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);return(4294967296*(2097151&h2)+(h1>>>0)).toString(16)};
const fbHash=(pin,salt)=>'f'+hash53(salt+':'+pin)+hash53(salt+':'+pin,7);
async function pinHash(pin,salt){try{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pin));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}}catch(e){}return fbHash(pin,salt)}
async function verifyPin(m,pin){return(await pinHash(pin,m.salt))===m.hash||fbHash(pin,m.salt)===m.hash}
const saveMembers=()=>DB.put('kv',{id:'members',items:S.members});
const mgrCount=()=>S.members.filter(m=>m.role==='manager'&&m.active).length;
async function addMember(name,role,pin){const salt=uid(8),m={id:'m_'+uid(8),name,role,salt,hash:await pinHash(pin,salt),active:true,createdAt:Date.now()};S.members.push(m);await saveMembers();return m}
async function startSession(m,remember){S.me=m;SS.set('meId',m.id);if(remember)LS.set('meId',m.id);else LS.del('meId');ROUTE=isMgr()?'#/':'#/new';try{history.replaceState(null,'',ROUTE)}catch(e){}await route()}
function signOut(){SS.del('meId');LS.del('meId');S.me=null;D=null;dirty=false;render()}
const langBtn=()=>h('button',{class:'btn s',onClick:()=>{switchLang()}},S.lang==='en'?'العربية':'English');
const pinOk=p=>/^\d{4,8}$/.test(p||'');
function vSetup(){const nm=h('input',{placeholder:L('Your full name','اسمك الكامل'),autocomplete:'off'}),p1=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:L('PIN (4–8 digits)','رقم سري (4–8 أرقام)')}),p2=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:L('Repeat the PIN','أعد كتابة الرقم السري')}),msg=h('p',{class:'err'});
  return h('div',{class:'auth-wrap'},h('div',{class:'auth-visual'},h('img',{src:'./images/aql-login-inspector.png',alt:'AQL Inspection quality inspector'})),h('div',{class:'card form auth-card',style:'max-width:460px;width:100%'},h('div',{class:'row',style:'justify-content:space-between;align-items:center'},h('h2',{style:'margin:0'},L('Create the manager account','إنشاء حساب المدير')),h('div',{class:'row'},themeButton(),langBtn())),
    h('p',{class:'hint'},L('The manager adds or removes members, manages the AQL plan, defects and settings, and sees the dashboard. Sign-in protects this device only; it is not a replacement for a server.','المدير يضيف الأعضاء ويحذفهم ويدير خطة AQL والعيوب والإعدادات ويرى لوحة المعلومات. الدخول يحمي هذا الجهاز فقط وليس بديلاً عن خادم.')),nm,p1,p2,msg,
    h('button',{class:'btn p',onClick:async()=>{if(nm.value.trim().length<2)return msg.textContent=L('Enter your name.','أدخل اسمك.');if(!pinOk(p1.value))return msg.textContent=L('PIN must be 4–8 digits.','الرقم السري 4–8 أرقام.');if(p1.value!==p2.value)return msg.textContent=L('The PINs do not match.','الرقمان غير متطابقين.');
      const m=await addMember(nm.value.trim(),'manager',p1.value);await audit('member_created',m.id);await startSession(m,true)}},L('Create and sign in','إنشاء ودخول'))))}
function vLogin(){const act=S.members.filter(m=>m.active),sel=h('select',{},act.map(m=>h('option',{value:m.id},m.name+' — '+(m.role==='manager'?L('Manager','مدير'):L('Inspector','مفتش'))))),pin=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:L('PIN','الرقم السري')}),rem=h('input',{type:'checkbox'}),msg=h('p',{class:'err'});
  const go1=async()=>{const m=S.members.find(x=>x.id===sel.value);if(m&&await verifyPin(m,pin.value)){await audit('sign_in',m.id);await startSession(m,rem.checked)}else msg.textContent=L('Wrong PIN.','الرقم السري غير صحيح.')};
  pin.addEventListener('keydown',e=>{if(e.key==='Enter')go1()});
  return h('div',{class:'auth-wrap'},h('div',{class:'auth-visual'},h('img',{src:'./images/aql-login-inspector.png',alt:'AQL Inspection quality inspector'})),h('div',{class:'card form auth-card',style:'max-width:460px;width:100%'},h('div',{class:'row',style:'justify-content:space-between;align-items:center'},h('h2',{style:'margin:0'},'MEYAR'),h('div',{class:'row'},themeButton(),langBtn())),h('p',{class:'hint'},S.settings.factoryName),sel,pin,
    h('label',{class:'chk'},rem,L('Stay signed in on this device','ابقَ مسجلاً على هذا الجهاز')),msg,h('button',{class:'btn p',onClick:go1},L('Sign in','دخول')),
    h('button',{class:'lnk',onClick:async()=>{if(prompt(L('This removes ALL members (inspections are kept). Type RESET to continue:','سيحذف كل الأعضاء (تبقى الفحوصات). اكتب RESET للمتابعة:'))==='RESET'){S.members=[];await saveMembers();signOut()}}},L('Forgot the manager PIN?','نسيت الرقم السري للمدير؟'))))}
function customerList(){const seen=new Map();[...custNames(),...S.ins.map(i=>String(i.customer||'').trim())].filter(Boolean).forEach(n=>{const k=norm(n);if(!seen.has(k))seen.set(k,n)});return[...seen.values()].sort((a,b)=>a.localeCompare(b))}
function inspectorList(){return[...new Set([...S.members.filter(m=>m.active).map(m=>m.name),...S.ins.map(i=>i.inspectorName)].filter(Boolean))].sort((a,b)=>a.localeCompare(b))}
function vMembers(){const nm=h('input',{placeholder:L('Full name','الاسم الكامل'),autocomplete:'off'}),pin=h('input',{type:'password',inputmode:'numeric',maxlength:8,placeholder:L('PIN (4–8 digits)','رقم سري (4–8 أرقام)')}),role=h('select',{},h('option',{value:'inspector'},L('Inspector','مفتش')),h('option',{value:'manager'},L('Manager','مدير'))),msg=h('p',{class:'err'});
  const roleName=r=>r==='manager'?L('Manager','مدير'):L('Inspector','مفتش');
  return h('div',{class:'card form'},h('h3',{},L('Members','الأعضاء')),
    S.members.map(m=>{const me=m.id===S.me.id;return h('div',{class:'row wrap item2'},h('div',{style:'flex:1;min-width:140px'},h('b',{},m.name),h('div',{class:'hint'},roleName(m.role)+(m.active?'':' · '+L('inactive','معطّل'))+(me?' · '+L('you','أنت'):''))),
      h('button',{class:'btn s',onClick:async()=>{const v=prompt(L('New PIN (4–8 digits):','رقم سري جديد (4–8 أرقام):'));if(v==null)return;if(!pinOk(v))return alert(L('PIN must be 4–8 digits.','الرقم السري 4–8 أرقام.'));m.salt=uid(8);m.hash=await pinHash(v,m.salt);await saveMembers();await audit('member_pin_reset',m.id);alert(L('PIN changed.','تم تغيير الرقم السري.'))}},L('Reset PIN','تغيير الرقم'))
      ,me?null:[h('select',{value:m.role,onChange:async e=>{if(m.role==='manager'&&e.target.value!=='manager'&&mgrCount()<2){alert(L('At least one manager is required.','يلزم مدير واحد على الأقل.'));return render()}m.role=e.target.value;await saveMembers();await audit('member_role',m.id,{role:m.role});render()}},h('option',{value:'inspector'},L('Inspector','مفتش')),h('option',{value:'manager'},L('Manager','مدير'))),
        h('button',{class:'btn s',onClick:async()=>{if(m.active&&m.role==='manager'&&mgrCount()<2)return alert(L('At least one active manager is required.','يلزم مدير نشط واحد على الأقل.'));m.active=!m.active;await saveMembers();await audit('member_active',m.id,{active:m.active});render()}},m.active?L('Deactivate','تعطيل'):L('Activate','تفعيل')),
        h('button',{class:'btn s d',onClick:async()=>{if(m.role==='manager'&&mgrCount()<2)return alert(L('At least one manager is required.','يلزم مدير واحد على الأقل.'));if(!confirm(L('Remove '+m.name+'? Their saved inspections are kept.','حذف '+m.name+'؟ تبقى فحوصاته المحفوظة.')))return;S.members=S.members.filter(x=>x.id!==m.id);await saveMembers();await audit('member_removed',m.id,{name:m.name});render()}},'🗑 '+L('Remove','حذف'))]) }),
    h('div',{class:'item2'},h('b',{},L('Add a member','إضافة عضو')),h('div',{class:'form',style:'margin-top:6px'},nm,pin,role,msg,
      h('button',{class:'btn p',onClick:async()=>{const n=nm.value.trim();if(n.length<2)return msg.textContent=L('Enter the name.','أدخل الاسم.');if(S.members.some(m=>norm(m.name)===norm(n)))return msg.textContent=L('This name already exists.','هذا الاسم موجود بالفعل.');if(!pinOk(pin.value))return msg.textContent=L('PIN must be 4–8 digits.','الرقم السري 4–8 أرقام.');
        const m=await addMember(n,role.value,pin.value);await audit('member_added',m.id,{name:n,role:m.role});render()}},L('Add member','إضافة العضو')))))}
/* ===== العملاء: سجلات مشتركة (يضيفها ويعدّلها أي عضو، والمسح للمدير) ===== */
const custKey=n=>'cust_'+inspKey(n).slice(8);
const custRecs=()=>(S.custs||[]).filter(c=>!c.deleted).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
const custNames=()=>custRecs().map(c=>c.name);
const custCanon=n=>{const v=String(n||'').trim(),r=(S.custs||[]).find(c=>!c.deleted&&norm(c.name)===norm(v));return r?r.name:v};
const msInC=(a,v)=>Array.isArray(a)?(!a.length||a.some(x=>norm(x)===norm(v))):(!a||norm(a)===norm(v));
async function custSave(rec){rec.updatedAt=Date.now();rec.updatedBy=(S.me&&S.me.name)||'';await DB.put('kv',rec);const i=(S.custs||[]).findIndex(x=>x.id===rec.id);if(i>=0)S.custs[i]=rec;else(S.custs=S.custs||[]).push(rec);try{cloudAuto(true)}catch(e){}}
async function custAdd(name){name=String(name||'').trim();if(!name)return{ok:false,msg:L('Enter a name.','اكتب الاسم.')};
 const dup=(S.custs||[]).find(c=>norm(c.name)===norm(name));
 if(dup&&!dup.deleted)return{ok:false,msg:L('Already in the list.','موجود بالفعل في القائمة.'),rec:dup};
 if(dup&&dup.deleted){dup.deleted=false;dup.name=name;await custSave(dup);return{ok:true,rec:dup}}
 let id=custKey(name);if((S.custs||[]).some(c=>c.id===id))id=id+'_'+uid(3);
 const rec={id,name,deleted:false,createdAt:Date.now(),createdBy:(S.me&&S.me.name)||''};await custSave(rec);return{ok:true,rec}}
async function custDelete(rec){rec.deleted=true;rec.deletedAt=Date.now();await custSave(rec)}
async function custMigrate(kv){S.custs=kv.filter(x=>String(x.id).startsWith('cust_'));
 for(const n of(S.lists.customers||[])){const v=String(n||'').trim();if(!v||S.custs.some(c=>norm(c.name)===norm(v)))continue;const rec={id:custKey(v),name:v,deleted:false,createdAt:Date.now(),createdBy:'',updatedAt:0};await DB.put('kv',rec);S.custs.push(rec)}}
function csPick(cur,onPick){
 const ov=h('div',{class:'msov'}),list=h('div',{class:'mslist'});let q='';
 const close=()=>{ov.remove();document.removeEventListener('keydown',esc)},esc=e=>{if(e.key==='Escape')close()},choose=v=>{close();onPick(v)};
 const draw=()=>{const items=custRecs().filter(c=>!q||norm(c.name).includes(norm(q))),exact=custRecs().some(c=>norm(c.name)===norm(q));
  list.replaceChildren(...[(q.trim()&&!exact)?h('button',{type:'button',class:'msrow cs-add',onClick:async()=>{const r=await custAdd(q);if(r.rec)choose(r.rec.name)}},'＋ '+L('Add “'+q.trim()+'”','إضافة «'+q.trim()+'»')):null,...items.map(c=>h('button',{type:'button',class:'msrow'+(c.name===cur?' on':''),onClick:()=>choose(c.name)},c.name)),(!items.length&&!q.trim())?h('p',{class:'hint',style:'padding:10px'},L('No customers yet. Type a name to add one.','لا يوجد عملاء بعد. اكتب اسماً لإضافته.')):null].filter(Boolean))};
 const search=h('input',{placeholder:L('Search or type a new customer…','ابحث أو اكتب اسم عميل جديد…'),onInput:e=>{q=e.target.value;draw()}});
 ov.append(h('div',{class:'mssheet'},h('div',{class:'row'},h('b',{style:'flex:1;font-size:17px'},L('Customer','العميل')),h('button',{type:'button',class:'btn s',onClick:close},'✕')),search,list));
 ov.addEventListener('click',e=>{if(e.target===ov)close()});document.addEventListener('keydown',esc);document.body.append(ov);draw();setTimeout(()=>search.focus(),50)}
let CUS_F={q:''},CUS_E=null;
function vCustomers(){
 if(CUS_E){const e=CUS_E,msg=h('p',{class:'err'});
  return h('div',{class:'card form'},h('h3',{},e.rec?e.rec.name:L('New customer','عميل جديد')),fld(L('Customer name','اسم العميل'),()=>e.name,v=>e.name=v),
   e.rec?h('p',{class:'hint'},L('Renaming does not change past inspections.','تغيير الاسم لا يغيّر الفحوصات القديمة.')):null,msg,
   h('div',{class:'row'},h('button',{class:'btn p',onClick:async()=>{const n=String(e.name||'').trim();if(!n){msg.textContent=L('Enter a name.','اكتب الاسم.');return}
     if(e.rec){const dup=(S.custs||[]).find(c=>c.id!==e.rec.id&&!c.deleted&&norm(c.name)===norm(n));if(dup){msg.textContent=L('Another customer has this name.','يوجد عميل آخر بنفس الاسم.');return}e.rec.name=n;await custSave(e.rec);await audit('customer_updated',e.rec.id)}
     else{const r=await custAdd(n);if(!r.ok){msg.textContent=r.msg;return}await audit('customer_added',r.rec.id)}
     CUS_E=null;render()}},L('Save','حفظ')),h('button',{class:'btn',onClick:()=>{CUS_E=null;render()}},L('Cancel','إلغاء'))))}
 const box=h('div',{class:'liblist'}),cnt=h('p',{class:'hint',style:'margin:6px 2px 0'});
 const used=n=>S.ins.filter(i=>!i.deletedAt&&norm(i.customer)===norm(n)).length;
 const missing=()=>{const have=new Set((S.custs||[]).map(c=>norm(c.name)));return[...new Set(S.ins.map(i=>String(i.customer||'').trim()).filter(Boolean))].filter(n=>!have.has(norm(n)))};
 const fill=()=>{const r=custRecs().filter(c=>!CUS_F.q||norm(c.name).includes(norm(CUS_F.q)));cnt.textContent=r.length+' '+L('customers','عميل');
  box.replaceChildren(...(r.length?r.map(c=>h('div',{class:'libitem'},h('div',{class:'libname'},h('b',{},c.name),h('span',{class:'hint'},used(c.name)+' '+L('inspections','فحص'))),
    h('button',{type:'button',class:'btn s libedit','aria-label':L('Edit','تعديل'),onClick:()=>{CUS_E={rec:c,name:c.name};render()}},'✏️'),
    isMgr()?h('button',{type:'button',class:'btn s d','aria-label':L('Delete','مسح'),onClick:async()=>{if(!confirm(L('Delete “'+c.name+'”? Past inspections keep the name.','مسح «'+c.name+'»؟ الفحوصات القديمة تحتفظ بالاسم.')))return;await custDelete(c);await audit('customer_deleted',c.id);render()}},'🗑 '+L('Delete','مسح')):null)):[h('div',{class:'card empty'},h('h2',{},L('No customers yet','لا يوجد عملاء بعد')),h('p',{class:'hint'},L('Add the customers you work with.','أضف العملاء اللي بتشتغل معاهم.')))]))};
 fill();const mm=missing();
 return h('div',{},h('div',{class:'libbar'},h('div',{class:'libsearch'},h('span',{},'🔍'),h('input',{value:CUS_F.q,placeholder:L('Search for a customer…','ابحث عن عميل…'),onInput:e=>{CUS_F.q=e.target.value;fill()}})),
   h('button',{class:'btn p',onClick:()=>{CUS_E={rec:null,name:''};render()}},'＋ '+L('Add customer','إضافة عميل'))),
  mm.length?h('div',{class:'row wrap',style:'margin-top:10px'},h('button',{type:'button',class:'btn',onClick:async e=>{e.currentTarget.disabled=true;for(const n of mm)await custAdd(n);await audit('customers_imported','from_inspections',{n:mm.length});render()}},'📥 '+L('Add '+mm.length+' customer(s) found in inspections','إضافة '+mm.length+' عميل موجود في الفحوصات'))):null,cnt,box)}

/* ---------- team follow-up: review queue, per-inspector performance, activity feed (manager panel) ---------- */
let TEAM_P='7';
const agoTxt=t=>{const m=Math.max(0,Math.round((Date.now()-t)/60000));if(m<1)return L('just now','الآن');if(m<60)return L(m+' min ago','منذ '+m+' دقيقة');const hr=Math.floor(m/60);if(hr<24)return L(hr+' h ago','منذ '+hr+' ساعة');const d=Math.floor(hr/24);return L(d+' d ago','منذ '+d+' يوم')};
const subAt=i=>{const x=(i.history||[]).filter(e=>e.action==='submit'||String(e.action).startsWith('auto_')).map(e=>+e.at||0);return x.length?Math.max(...x):(+i.updatedAt||+i.createdAt||0)};
const durTxt=m=>m<60?Math.round(m)+L(' min',' د'):(m/60).toFixed(1)+L(' h',' س');
const actTxt=a=>({inspection_saved:L('saved a draft','حفظ مسودة'),inspection_submitted:L('submitted for review','أرسل للمراجعة'),inspection_auto_approved:L('accepted automatically (AQL)','قبول تلقائي (AQL)'),inspection_auto_rejected:L('rejected automatically (AQL)','رفض تلقائي (AQL)'),inspection_accept:L('approved','اعتمد'),inspection_reject:L('rejected','رفض'),inspection_return:L('returned for correction','أرجع للتصحيح'),inspection_reopened:L('reopened','أعاد فتح'),defect_created:L('added a defect to the library','أضاف عيباً للمكتبة'),defect_updated:L('edited a library defect','عدّل عيباً في المكتبة'),page_pdf_exported:L('exported a page as PDF','صدّر صفحة PDF'),file_added:L('added a file to the archive','أضاف ملفاً للأرشيف'),file_uploaded:L('uploaded a file to the cloud','رفع ملفاً للسحابة'),file_deleted_cloud:L('deleted a file from the cloud','حذف ملفاً من السحابة'),file_removed_local:L('removed a file from the device','مسح ملفاً من الجهاز')})[a]||String(a).replace(/_/g,' ');
function vReviewQueue(){const q=S.ins.filter(i=>i.status==='pending_review').sort((a,b)=>subAt(a)-subAt(b));
 return h('div',{class:'card'},h('div',{class:'row wrap',style:'justify-content:space-between'},h('h3',{style:'margin:0'},'📝 '+L('Awaiting your review','بانتظار مراجعتك')),h('span',{class:'badge pending_review'},q.length)),
  q.length?h('div',{class:'list',style:'margin-top:10px'},q.map(i=>{const late=Date.now()-subAt(i)>864e5;
    return h('div',{class:'item2',style:'display:flex;gap:10px;align-items:center;justify-content:space-between'},
     h('div',{style:'min-width:0'},h('b',{},i.id),' · '+(i.orderNo||''),h('div',{class:'hint'},[i.customer,i.model,i.inspectorName].filter(Boolean).join(' · ')),
      h('div',{class:'hint',style:late?'color:#b42318;font-weight:700':''},'⏱ '+agoTxt(subAt(i))),
      i.aql&&i.aql.result?h('span',{class:'badge '+(i.aql.result==='pass'?'pass':'fail')},'AQL: '+(i.aql.result==='pass'?L('pass','مقبول'):L('fail','مرفوض'))):null),
     h('button',{type:'button',class:'btn s',onClick:()=>go('#/i/'+i.id)},L('Review','مراجعة')))})):h('p',{class:'hint',style:'margin:8px 0 0'},'✅ '+L('Nothing is waiting for review.','لا توجد فحوصات بانتظار المراجعة.')))}
function vTeam(){
 const from=(()=>{const n=new Date();if(TEAM_P==='1'){n.setHours(0,0,0,0);return +n}if(TEAM_P==='all')return 0;return Date.now()-(+TEAM_P)*864e5})();
 const B=new Map(),bucket=n=>{n=n||L('Unspecified','غير محدد');if(!B.has(n))B.set(n,{n,tot:0,ok:0,bad:0,ret:0,defs:0,mins:[],last:0,open:0});return B.get(n)};
 S.ins.forEach(i=>{const b=bucket(i.inspectorName),sa=subAt(i);
  if(['draft','in_progress'].includes(i.status))b.open++;
  else if(sa>=from){b.tot++;if(i.status==='approved')b.ok++;if(i.status==='rejected')b.bad++;b.defs+=(i.defs||[]).reduce((a,d)=>a+num(d.occurrences),0);const m=i.createdAt?Math.round((sa-i.createdAt)/60000):0;if(m>0&&m<1440)b.mins.push(m)}
  b.ret+=(i.history||[]).filter(e=>e.action==='return'&&(+e.at||0)>=from).length;b.last=Math.max(b.last,+i.updatedAt||0)});
 (S.audit||[]).forEach(a=>{if(a.by&&B.has(a.by))B.get(a.by).last=Math.max(B.get(a.by).last,+a.at||0)});
 const rows=[...B.values()].filter(b=>b.tot||b.open||b.ret).sort((a,b)=>b.tot-a.tot||b.last-a.last);
 const chip=(ic,lb,v)=>h('span',{class:'chip'},ic+' '+lb+': ',h('b',{},v));
 const per=h('select',{onChange:e=>{TEAM_P=e.target.value;render()}},[['1',L('Today','اليوم')],['7',L('Last 7 days','آخر 7 أيام')],['30',L('Last 30 days','آخر 30 يوماً')],['all',L('All time','كل الفترة')]].map(([v,t])=>h('option',{value:v,selected:TEAM_P===v},t)));
 const feed=(S.audit||[]).filter(a=>a.by&&a.by!=='-').slice(0,12);
 return h('div',{class:'stack'},
  h('div',{class:'card'},h('div',{class:'row wrap',style:'justify-content:space-between'},h('h3',{style:'margin:0'},'👥 '+L('Team performance','أداء الفريق')),per),
   rows.length?h('div',{class:'list',style:'margin-top:10px'},rows.map(b=>{const dn=b.ok+b.bad,idle=b.last&&Date.now()-b.last>2*864e5;
    return h('div',{class:'item2'},h('div',{class:'row wrap',style:'justify-content:space-between'},h('b',{},b.n),h('span',{class:'hint',style:idle?'color:#b42318':''},'🕒 '+(b.last?agoTxt(b.last):'-'))),
     h('div',{class:'row wrap',style:'gap:6px;margin-top:6px'},chip('📋',L('Submitted','مُرسل'),b.tot),chip('✅',L('Approved','مقبول'),b.ok),chip('❌',L('Rejected','مرفوض'),b.bad),chip('📈',L('Pass rate','نسبة القبول'),dn?Math.round(b.ok/dn*100)+'%':'-'),chip('↩',L('Returned','مُرجع'),b.ret),chip('🔧',L('Open','مفتوح'),b.open),chip('⏱',L('Avg time','متوسط الوقت'),b.mins.length?durTxt(b.mins.reduce((x,y)=>x+y,0)/b.mins.length):'-'),chip('🧵',L('Defects / inspection','عيوب / فحص'),b.tot?(b.defs/b.tot).toFixed(1):'-'))) })):h('p',{class:'hint',style:'margin:8px 0 0'},L('No inspections in this period.','لا توجد فحوصات في هذه الفترة.')),
   h('p',{class:'hint'},L('Avg time = from starting an inspection to submitting it (inspections over 24 h are ignored). Returned = sent back for correction by the reviewer.','متوسط الوقت = من بدء الفحص حتى إرساله (الفحوصات التي تجاوزت 24 ساعة لا تُحسب). مُرجع = أعادها المراجع للتصحيح.'))),
  h('div',{class:'card'},h('h3',{},'🕒 '+L('Recent activity','آخر النشاط')),
   feed.length?h('div',{class:'list'},feed.map(a=>h('div',{class:'item2',style:'font-size:14px'},h('b',{},a.by),' '+actTxt(a.action)+' ',S.ins.some(i=>i.id===a.rec)?h('a',{href:'#/i/'+a.rec,onClick:e=>{e.preventDefault();go('#/i/'+a.rec)}},a.rec):(a.rec?h('span',{class:'hint'},a.rec):null),h('div',{class:'hint'},agoTxt(a.at))))):h('p',{class:'hint'},L('No activity yet.','لا يوجد نشاط بعد.'))))}
function vPanel(){return h('div',{class:'stack'},vReviewQueue(),vDash(),vTeam(),vMembers())}
/* ---------- quiet five-second draft autosave ---------- */
setInterval(async()=>{try{if(!D||!dirty||busy||!EDIT.includes(D.status)||!(ROUTE.startsWith('#/new')||ROUTE.startsWith('#/i/')))return;const copy=structuredClone(D);copy.updatedAt=Date.now();copy.status=copy.defs&&copy.defs.length?'in_progress':'draft';copy.history=copy.history||[];let wp;DB.noKick=true;try{wp=DB.put('inspections',copy)}finally{DB.noKick=false}await wp;dirty=false;{const k=S.ins.findIndex(x=>x.id===copy.id);if(k>=0)S.ins[k]=copy;else S.ins.unshift(copy)}const badge=$('#autosave-status');if(badge){badge.textContent='✓ '+L('Saved','تم الحفظ')+' '+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});badge.classList.remove('err');badge.classList.add('ok')}}catch(e){const badge=$('#autosave-status');if(badge){badge.textContent=L('Auto-save failed','فشل الحفظ التلقائي');badge.classList.remove('ok');badge.classList.add('err')}}},5000);
/* ---------- start ---------- */
(async()=>{try{applyTheme();await DB.open();await loadAll();await route()}catch(e){$('#app').textContent='Storage error: '+e.message+' — open this file in Chrome or Safari (not private mode).'}})();
