import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

let listener = null;
let stateListener = null;
let settleTimer = null;
let latestText = '';
let currentCallbacks = {};

async function clearListener(){
  if(listener){
    try{listener.remove();}catch{}
    listener = null;
  }
  if(stateListener){
    try{stateListener.remove();}catch{}
    stateListener = null;
  }
  if(settleTimer){
    clearTimeout(settleTimer); settleTimer = null;
  }
}

// AQLNativeSpeech: unified API for native (Capacitor) and Web Speech recognition.
// start(options): { language, onResult(text, meta), onError(err), onEnd(), continuous, interim, target } 
// target can be: DOM element id (string), a callback function (text)=>void, or omitted.

window.AQLNativeSpeech = {
  isNative(){ return Capacitor.isNativePlatform && Capacitor.isNativePlatform(); },
  async start({language='ar-EG', onResult=()=>{}, onError=()=>{}, onEnd=()=>{}, continuous=false, interim=true, target=null}={}){
    currentCallbacks = {onResult,onError,onEnd,target}; latestText=''; await clearListener();

    // Helper to deliver text to target
    function deliver(text){
      try{
        if(typeof target === 'function') return target(text);
        if(typeof target === 'string'){ const el = document.getElementById(target); if(el){ el.value = (el.value?el.value+'\n':'') + text; el.dispatchEvent(new Event('input')); return; } }
        // default: call onResult
        onResult(text);
      }catch(e){ console.warn('AQLNativeSpeech deliver error',e); }
    }

    // Use Capacitor native plugin if available
    try{
      const permission = await SpeechRecognition.requestPermissions();
      if(permission && permission.speechRecognition==='denied') throw new Error('Speech recognition permission denied.');
      stateListener = await SpeechRecognition.addListener('listeningState', ({status})=>{ if(status==='stopped') onEnd(); });
      listener = await SpeechRecognition.addListener('partialResults', ({matches=[]})=>{
        const text = String(matches[0]||'').trim(); if(!text) return; latestText = text;
        if(settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(()=>{ if(latestText){ deliver(latestText); latestText=''; } }, 800);
      });
      try{ await SpeechRecognition.start({language, maxResults:3, partialResults:interim, popup:false}); }
      catch(e){ await clearListener(); onError(e); throw e; }
      return;
    }catch(err){
      // fall back to Web Speech API
      console.warn('Native speech not available or failed, falling back to Web Speech', err);
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR) throw new Error('No speech recognition available');
    if(!window.isSecureContext) throw new Error('Microphone requires secure context (HTTPS)');

    const rec = new SR(); rec.lang = language; rec.continuous = !!continuous; rec.interimResults = !!interim; rec.maxAlternatives = 1;
    rec.onresult = (e)=>{
      let interimText = '';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t = e.results[i][0].transcript || '';
        if(e.results[i].isFinal){ deliver(t.trim()); }
        else { interimText = t; }
      }
      if(interimText) currentCallbacks.onResult && currentCallbacks.onResult(interimText, {interim:true});
    };
    rec.onerror = (e)=>{ onError(e); };
    rec.onend = ()=>{ onEnd(); };
    try{ rec.start(); }
    catch(e){ throw e; }

    // store reference so stop can access
    listener = { _rec: rec, remove: ()=>{ try{ rec.onresult = null; rec.onerror=null; rec.onend=null; }catch(e){} } };
  },
  async stop(){
    try{
      if(listener){
        try{ if(listener._rec && typeof listener._rec.stop === 'function') listener._rec.stop(); }catch(e){}
      }
    }catch(e){}
    if(settleTimer && latestText){ clearTimeout(settleTimer); currentCallbacks.onResult && currentCallbacks.onResult(latestText); latestText=''; }
    await clearListener();
  }
};
