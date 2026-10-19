// sampling.js — smart random sampling calculator based on simplified Z1.4 table
(function(){
  if(window.AQLSampling) return;
  // simplified Z1.4 table (lotMin, lotMax, sampleSize)
  const Z14 = [
    [2,8,2],[9,15,3],[16,25,5],[26,50,8],[51,90,13],[91,150,20],[151,280,32],[281,500,50],[501,1200,80],[1201,3200,125],[3201,10000,200],[10001,35000,315],[35001,150000,500]
  ];

  function findRow(lot){
    for(const [a,b,n] of Z14){ if(lot>=a && lot<=b) return {lotMin:a,lotMax:b,sampleSize:n}; }
    // fallback: largest
    return {lotMin:Z14[Z14.length-1][0],lotMax:Z14[Z14.length-1][1],sampleSize:Z14[Z14.length-1][2]};
  }

  // Returns sampling guidance: sampleSize, and an array of indices (1..lot) to select randomly
  function recommend(lotSize,seeded=false){
    const lot = Math.max(1,Math.floor(Number(lotSize)||0));
    const row = findRow(lot);
    const sample = Math.min(lot, row.sampleSize);
    // generate sample indices by pseudo-random selection without replacement
    const indices = Array.from({length:lot},(_,i)=>i+1);
    // simple Fisher-Yates shuffle with seed option
    let rnd = Math.random;
    if(seeded){ let s=lot; rnd=()=>{s=(s*9301+49297)%233280; return s/233280}; }
    for(let i=indices.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
    return {lot, sampleSize:sample, codeLetter:row.codeLetter||null, sampleIndices:indices.slice(0,sample), note:`Based on simplified Z1.4 mapping (lot ${row.lotMin}-${row.lotMax}).` };
  }

  // Utility to present step-by-step random selection guidance (carton sampling)
  function samplingSteps(lotSize,boxesPerCarton=1){
    const r = recommend(lotSize);
    const cartons = boxesPerCarton>1?Math.ceil(r.lot/boxesPerCarton):r.lot;
    const sampleCartons = Math.min(cartons, Math.ceil(r.sampleSize/boxesPerCarton));
    return { cartonnCount:cartons, sampleCartons, sampleSize:r.sampleSize, sampleIndices:r.sampleIndices.map(i=>boxesPerCarton>1?Math.ceil(i/boxesPerCarton):i), guidance:`Select ${sampleCartons} cartons at random from ${cartons} cartons. Within each selected carton, inspect all pieces or ${boxesPerCarton>1?boxesPerCarton+' boxes per carton':''}.` };
  }

  window.AQLSampling = { recommend, samplingSteps, _Z14:Z14 };
})();
