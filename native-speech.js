import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
let listener = null;
let stateListener = null;
let settleTimer = null;
let latestText = '';
let currentCallbacks = {};
async function clearListener(){ if(listener){ try{await listener.remove()}catch{} listener=null; } if(stateListener){ try{await stateListener.remove()}catch{} stateListener=null; } if(settleTimer){clearTimeout(settleTimer);settleTimer=null;} }
window.AQLNativeSpeech = {
  isNative(){ return Capacitor.isNativePlatform(); },
  async start({language='en-US',onResult=()=>{},onError=()=>{},onEnd=()=>{}}={}){
    currentCallbacks={onResult,onError,onEnd}; latestText=''; await clearListener();
    const permission=await SpeechRecognition.requestPermissions();
    if(permission.speechRecognition==='denied') throw new Error('Speech recognition permission denied.');
    stateListener=await SpeechRecognition.addListener('listeningState',({status})=>{if(status==='stopped')currentCallbacks.onEnd?.();});
    listener=await SpeechRecognition.addListener('partialResults',({matches=[]})=>{
      const text=String(matches[0]||'').trim(); if(!text)return; latestText=text;
      if(settleTimer)clearTimeout(settleTimer);
      settleTimer=setTimeout(()=>{if(latestText){currentCallbacks.onResult(latestText);latestText='';}},1000);
    });
    try{await SpeechRecognition.start({language,maxResults:3,partialResults:true,popup:false});}
    catch(e){await clearListener();currentCallbacks.onError(e);throw e;}
  },
  async stop(){
    try{await SpeechRecognition.stop()}catch{}
    if(settleTimer&&latestText){clearTimeout(settleTimer);currentCallbacks.onResult(latestText);latestText='';}
    await clearListener();
  }
};
