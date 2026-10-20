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
const THEME_KEY='aql-theme';
const S={lang:LS.get('lang')||'en',theme:LS.get(THEME_KEY)||'light',settings:null,lib:[],plans:[],ins:[],audit:[],members:[],me:null,lists:{id:'lists',customers:[]}};
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
function mapDefPhotos(i){const gs=garmentsOf(i.garmentType),defs=(i.defs||[]).filter(d=>gs.includes(d.garment)),seq=[];defs.forEach(d=>{const n=Math.max(0,num(d.pieces));for(let k=0;k<n;k++)seq.push({p:null,defId:d.id,severity:d.severity,name:defNm(d)})});
  return(i.defPhotos||[]).map(ph=>{const d=ph.defId?defs.find(x=>x.id===ph.defId):(seq.find(x=>x.defId===ph.defId)||seq.shift()||null);return{p:ph.p,name:d?defNm(d):'',sev:d?d.severity:'',auto:!ph.defId,defId:d?d.id:''}})}
function padPages(arr,min){const pages=Math.max(num(min),Math.ceil(arr.length/15));return arr.concat(Array(pages*15-arr.length).fill(null))}
const sevL={critical:['Critical','حرج'],major:['Major','رئيسي'],minor:['Minor','ثانوي']};
const stL=s=>({draft:L('Draft','مسودة'),in_progress:L('In progress','قيد التنفيذ'),pending_review:L('Pending review','بانتظار المراجعة'),approved:L('Approved','معتد'),rejected:L('Rejected','مرفوض')}[s]||L(s,s));
function applyTheme(){const theme=S.theme||'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme==='dark'?'dark':'light';LS.set(THEME_KEY,theme)}
function setTheme(theme){S.theme=theme;applyTheme();render();}
