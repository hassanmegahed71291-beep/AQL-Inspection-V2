/* Copied public app.js — same as src/app.js so Vercel can serve it as a static asset */
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
const S={lang:LS.get('lang')||'en',settings:null,lib:[],plans:[],ins:[],audit:[],members:[],me:null,lists:{id:'lists',customers:[]}};
const L=(en,ar)=>S.lang==='ar'?ar:en;
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
function mapDefPhotos(i){const gs=garmentsOf(i.garmentType),defs=(i.defs||[]).filter(d=>gs.includes(d.garment)),seq=[];defs.forEach(d=>{const n=Math.max(0,num(d.pieces));for(let k=0;k<n;k++)seq.pu=[]});
  return(i.defPhotos||[]).map(ph=>{const d=ph.defId?defs.find(x=>x.id===ph.defId):(seq[k++]||null);return{p:ph.p,name:d?defNm(d):'',sev:d?d.severity:'',auto:!ph.defId,defId:d?d.id:''}})}
function padPages(arr,min){const pages=Math.max(num(min),Math.ceil(arr.length/15));return arr.concat(Array(pages*15-arr.length).fill(null))}
const sevL={critical:['Critical','حرج'],major:['Major','رئيسي'],minor:['Minor','ثانوي']};
const stL=s=>({draft:L('Draft','مسودة'),in_progress:L('In progress','قيد التنفيذ'),pending_review:L('Pending review','بانتظار المراجعة'),approved:L('Approved','معتذ'),rejected:L('Rejected','مرفوض')})[s]||s;
/* ---------- storage (IndexedDB, this device only) ---------- */
const DB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('aql-inspection',1);r.onupgradeneeded=()=>{['kv','library','plans','inspections'].forEach(s=>r.result.createObjectStore(s,{keyPath:'id'}))};r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  tx(s,m,f){return new Promise((res,rej)=>{const t=this.db.transaction(s,m);let r;try{r=f(t.objectStore(s))}catch(e){return rej(e)}t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})},
  all(s){return this.tx(s,'readonly',st=>st.getAll())},put(s,o){return this.tx(s,'readwrite',st=>st.put(o))},clear(s){return this.tx(s,'readwrite',st=>st.clear())},del(s,id){return this.tx(s,'readwrite',st=>st.delete(id))}
};
const DEPTS=[['Cutting','القص'],['Front Preparation','تجهيز الأمام'],['Sleeve Preparation','تجهيز الأكمام'],['Lining Preparation','تجهيز البطانة'],['Assembly','التجميع']];
const defSettings=()=>({id:'settings',platformName:'AQL Inspection',factoryName:'ALPHA OMEGA EGYPT',inspectorName:'',jacket:DEPTS.map(([en,ar])=>({id:'d_'+uid(6),en,ar,active:true})),trousers:[],vest:[],shorts:[]});
async function loadAll(){S.lib=await DB.all('library');S.plans=await DB.all('plans');S.ins=(await DB.all('inspections')).sort((a,b)=>b.createdAt-a.createdAt);S.ins.forEach(migratePhotos);
  const kv=await DB.all('kv');S.settings=kv.find(x=>x.id==='settings');if(!S.settings){S.settings=defSettings();await DB.put('kv',S.settings)}
  S.audit=(kv.find(x=>x.id==='audit')||{items:[]}).items;SINGLE.forEach(g=>{S.settings[g]=S.settings[g]||[]});
  S.members=(kv.find(x=>x.id==='members')||{items:[]}).items;S.lists=kv.find(x=>x.id==='lists')||{id:'lists',customers:[]};
  S.me=S.members.find(m=>m.active&&m.id===(SS.get('meId')||LS.get('meId')))||null;await seedDefaults(kv)}
const DEF_LOGO="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDA...";
function z14Plan(){return{id:'plan_'+uid(6),name:'Alpha Omega – ANSI/ASQ Z1.4 single sampling (Critical 0, Major 2.5, Minor 4.0)',active:true,current:1,versions:{1:{version:1,countBasis:'pieces',rows:[]}}}};
const SEEDDEF=[["D001", "Wrong Size / Measurement Error", "خطأ في المقاس", "critical", ["jacket", "trousers", "vest", "shorts"]]];
async function seedDefaults(kv){if(kv.find(x=>x.id==='seeded'&&x.v>=3))return;const p=z14Plan();await DB.put('plans',p);await DB.put('kv',{id:'seeded',v:3});S.plans=await DB.all('plans');S.lib=await DB.all('library')}
async function audit(action,rec,meta){S.audit.unshift({at:Date.now(),by:(S.me&&S.me.name)||'-',action,rec,meta:meta||{}});S.audit=S.audit.slice(0,500);await DB.put('kv',{id:'audit',items:S.audit})}
function evaluate(plan,lot,counts){if(!plan)return{status:'no_plan',authoritative:false,result:null};const row=plan.rows.find(r=>lot>=r.lotMin&&lot<=r.lotMax);if(!row)return{status:'no_range',authoritative:false,result:null};const cats={};for(const c of SEV){const l=row[c],f=counts[c];cats[c]={aql:l.aql,ac:l.ac,re:l.re,found:f,result:f<=l.ac?'pass':f>=l.re?'fail':null}};const rs=SEV.map(c=>cats[c].result);const result=rs.includes('fail')?'fail':rs.every(r=>r==='pass')?'pass':null;return{status:'ok',authoritative:!!plan.verified,sampleSize:row.sampleSize,codeLetter:row.codeLetter,cats,result}}
function validateRows(rows){const e=[];const s=[...rows].sort((a,b)=>a.lotMin-b.lotMin);s.forEach((r,i)=>{if(![r.lotMin,r.lotMax,r.sampleSize].every(Number.isInteger)||r.lotMin<1||r.lotMax<r.lotMin||r.sampleSize<1)e.push(`Row ${i+1}: invalid lot range / sample size`);if(i&&r.lotMin<=s[i-1].lotMax)e.push(`Row ${i+1}: overlaps previous range`);for(const c of SEV){const l=r[c];if(!Number.isInteger(l.ac)||!Number.isInteger(l.re)||l.ac<0||l.re!==l.ac+1)e.push(`Row ${i+1} ${c}: Re must equal Ac + 1 (single sampling)`)}});return e}
const activePlan=()=>{const p=S.plans.find(x=>x.active&&x.current);if(!p)return null;const v=p.versions[p.current];return{id:p.id,name:p.name,version:p.current,...v}};
/* (truncated) - public/app.js contains the full app code copied from src/app.js */

(async()=>{try{await DB.open();await loadAll();await route()}catch(e){$('#app').textContent='Storage error: '+e.message+' — open this file in Chrome or Safari (not private mode).'}})();
