/* Copeak Focus Mode: presentation-only UTF-16 ranges over trimmed lesson text. */
(function () {
  'use strict';
  const colors = ['#b91c1c','#1d4ed8','#047857','#b45309','#7e22ce'];
  const names = ['赤','青','緑','オレンジ','紫'];
  const editors = new Map();
  const MAX = 60;
  const highlights = ['#fff18a','#baf2ca','#b9e5ff','#ffc5de','#e5e7eb'];
  const highlightNames = ['黄','緑','青','ピンク','グレー'];
  // Palette indices remain compatible with legacy [start,end,color] tuples.
  // Extended tuples: [start,end,foregroundIndex,highlightIndex,flags].
  // -1 = no color; flag 1 = bold, flag 2 = underline.
  const contrastColors = ['#991b1b','#1e40af','#065f46','#92400e','#6b21a8'];
  function unpack(r) {
    return [r[2],r.length===5?r[3]:-1,r.length===5?r[4]:0];
  }
  function pack(a,b,c,h,f) {
    if(c<0&&h<0&&!f)return null;
    return h<0&&!f?[a,b,c]:[a,b,c,h,f];
  }
  function merge(ranges) {
    const out=[];
    for(const r of ranges.sort((x,y)=>x[0]-y[0])){
      const last=out[out.length-1];
      if(last&&last[1]===r[0]&&unpack(last).every((v,i)=>v===unpack(r)[i]))last[1]=r[1];
      else out.push(r.slice());
    }
    return out;
  }
  function clean(value,text) {
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{return [];}}
    if(!Array.isArray(value))return [];
    const limit=typeof text==='string'?text.length:Number.MAX_SAFE_INTEGER;
    const result=[];
    for(const r of value.slice(0,MAX)){
      if(!Array.isArray(r)||![3,5].includes(r.length))continue;
      const [a,b]=r,[c,h,f]=unpack(r);
      if(![a,b,c,h,f].every(Number.isSafeInteger)||a<0||b<=a||b>limit||c< -1||c>=colors.length||h< -1||h>=highlights.length||f<0||f>3)continue;
      if(result.some(x=>a<x[1]&&b>x[0]))continue;
      const packed=pack(a,b,c,h,f);if(packed)result.push(packed);
    }
    return merge(result);
  }
  function replaceRange(ranges,a,b,kind,value) {
    const cuts=[...new Set([a,b,...ranges.flatMap(r=>[r[0],r[1]])])].sort((x,y)=>x-y);
    const inside=cuts.slice(0,-1).filter((x,i)=>x>=a&&cuts[i+1]<=b);
    const flag=kind==='bold'?1:kind==='underline'?2:0;
    const turnOff=flag&&inside.every(x=>{const r=ranges.find(r=>r[0]<=x&&x<r[1]);return r&&(unpack(r)[2]&flag)!==0;});
    const out=[];
    for(let i=0;i<cuts.length-1;i++){
      const start=cuts[i],end=cuts[i+1],prior=ranges.find(r=>r[0]<=start&&end<=r[1]);
      let [c,h,f]=prior?unpack(prior):[-1,-1,0];
      if(start>=a&&end<=b){
        if(kind==='foreground')c=value;
        else if(kind==='highlight')h=value;
        else if(flag)f=turnOff?f&~flag:f|flag;
        else if(kind==='clear'){c=-1;h=-1;f=0;}
      }
      const r=pack(start,end,c,h,f);if(r)out.push(r);
    }
    return merge(out);
  }
  function decorate(el,r,reading=false){
    const [c,h,f]=unpack(r);
    if(c>=0){
      if(reading){el.classList.add('copeak-focus-word');el.style.setProperty('--copeak-focus-color',h>=0?contrastColors[c]:colors[c]);}
      else el.style.color=h>=0?contrastColors[c]:colors[c];
    }
    if(h>=0){
      if(reading){el.classList.add('copeak-focus-highlight');el.style.setProperty('--copeak-focus-highlight',highlights[h]);if(c<0)el.style.setProperty('--copeak-focus-color','#1e293b');}
      else{el.style.backgroundColor=highlights[h];if(c<0)el.style.color='#1e293b';}
    }
    if(f&1){if(reading)el.classList.add('copeak-focus-bold');else el.style.fontWeight='800';}
    if(f&2){if(reading)el.classList.add('copeak-focus-underline');else{el.style.textDecoration='underline';el.style.textUnderlineOffset='0.15em';}}
  }
  function sync(state) {
    const next = state.input.value.trim(), old = state.text;
    if (next === old) return;
    let a=0, tail=0;
    while (a < old.length && a < next.length && old[a] === next[a]) a++;
    while (tail < old.length-a && tail < next.length-a && old[old.length-1-tail] === next[next.length-1-tail]) tail++;
    const oldEnd = old.length-tail, delta = next.length-old.length;
    state.ranges = state.ranges.flatMap(r => r[1] <= a ? [r] : r[0] >= oldEnd ? [[r[0]+delta,r[1]+delta,...r.slice(2)]] : []);
    state.text = next;
  }
  function paintPreview(state) {
    state.preview.replaceChildren();
    let pos = 0;
    for (const range of state.ranges) {
      const [a,b] = range;
      state.preview.append(document.createTextNode(state.text.slice(pos,a)));
      const span = document.createElement('span');
      decorate(span,range);
      span.textContent = state.text.slice(a,b);
      state.preview.append(span);
      pos=b;
    }
    state.preview.append(document.createTextNode(state.text.slice(pos)));
    state.preview.hidden = !state.ranges.length;
    state.status.textContent = state.ranges.length ? state.ranges.length + ' 箇所を強調中' : '英文の一部を選択して文字色・ハイライト・太字・下線を指定してください。';
  }
  function mount(id) {
    if (editors.has(id)) return editors.get(id);
    const input = document.getElementById(id);
    if (!input) return null;
    const panel = document.createElement('div');
    panel.className = 'copeak-focus-editor';
    panel.style.cssText = 'margin:8px 0;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;color:#334155;font-size:13px;line-height:1.5';
    const heading = document.createElement('strong');
    heading.textContent = 'Focus Mode｜表現意識';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:8px 0';
    const preview = document.createElement('div');
    preview.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;padding:8px;background:white;border-radius:5px;color:#334155;font-size:16px;max-height:240px;overflow:auto';
    const status = document.createElement('div');
    status.setAttribute('aria-live','polite');
    status.style.cssText = 'margin:5px 0;font-size:12px';
    const state = {input,preview,status,text:input.value.trim(),ranges:[],selection:null};
    editors.set(id,state);
    function remember() {
      if (input.selectionEnd > input.selectionStart) state.selection = [input.selectionStart,input.selectionEnd,input.value];
    }
    input.addEventListener('select',remember);
    input.addEventListener('keyup',remember);
    input.addEventListener('pointerup',remember);
    input.addEventListener('input',()=>{ state.selection=null; sync(state); paintPreview(state); });
    function choose(kind,value) {
      sync(state);
      const raw=input.value, leading=raw.length-raw.trimStart().length;
      let selection = input.selectionEnd > input.selectionStart ? [input.selectionStart,input.selectionEnd,raw] : state.selection;
      if (!selection || selection[2] !== raw) { status.textContent='先に英文の強調したい部分を選択してください。'; return; }
      let a=Math.max(0,selection[0]-leading), b=Math.min(state.text.length,selection[1]-leading);
      while (a<b && /\s/u.test(state.text[a])) a++;
      while (b>a && /\s/u.test(state.text[b-1])) b--;
      if (a>=b) return;
      // Whole-word coloring keeps the existing pace and speech tokenization unchanged.
      while (a>0 && !/\s/u.test(state.text[a-1])) a--;
      while (b<state.text.length && !/\s/u.test(state.text[b])) b++;
      const next = replaceRange(state.ranges,a,b,kind,value);
      if (next.length>MAX) { status.textContent='強調は最大60箇所です。'; return; }
      state.ranges=next; paintPreview(state);
    }
    function group(label) {
      const row=document.createElement('div');row.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:6px;width:100%';
      row.setAttribute('role','group');row.setAttribute('aria-label',label);
      const caption=document.createElement('span');caption.textContent=label;caption.style.cssText='font-weight:800;min-width:84px';row.append(caption);controls.append(row);return row;
    }
    function button(row,label,color,action,background='white') {
      const el=document.createElement('button');
      el.type='button'; el.textContent=label;
      el.style.cssText='border:1px solid #cbd5e1;border-radius:6px;background:'+background+';color:'+(color||'#334155')+';padding:6px 10px;font-weight:700;cursor:pointer;min-height:44px';
      el.addEventListener('pointerdown',()=>{if(document.activeElement===input)remember();});
      el.addEventListener('mousedown',event=>event.preventDefault());
      el.addEventListener('click',action); row.append(el);
    }
    const foregroundRow=group('文字色');
    colors.forEach((c,i)=>button(foregroundRow,'● '+names[i],c,()=>choose('foreground',i)));
    button(foregroundRow,'文字色解除',null,()=>choose('foreground',-1));
    const highlightRow=group('ハイライト');
    highlights.forEach((h,i)=>button(highlightRow,highlightNames[i],'#1e293b',()=>choose('highlight',i),h));
    button(highlightRow,'背景色解除',null,()=>choose('highlight',-1));
    const formatRow=group('装飾');
    button(formatRow,'B 太字',null,()=>choose('bold'));
    button(formatRow,'U 下線',null,()=>choose('underline'));
    button(formatRow,'選択解除',null,()=>choose('clear'));
    button(formatRow,'全解除',null,()=>{state.ranges=[];state.selection=null;state.text=input.value.trim();paintPreview(state);});
    const tip=document.createElement('p');tip.textContent='色だけではなく、太字・下線も組み合わせられます。太字・下線は同じ範囲を再選択して押すと解除できます。';tip.style.cssText='margin:3px 0;color:#475569;font-size:12px';controls.append(tip);
    panel.append(heading,controls,status,preview); input.insertAdjacentElement('afterend',panel);
    paintPreview(state); return state;
  }
  function restore(id,value) {
    const s=mount(id); if(!s)return;
    s.text=s.input.value.trim();s.ranges=clean(value,s.text);s.selection=null;paintPreview(s);
  }
  function get(id,text) {
    const s=mount(id); if(!s)return [];
    sync(s); paintPreview(s);
    return typeof text==='string' && text!==s.text ? [] : clean(s.ranges,s.text);
  }
  function fromUrl(url,text) {
    try { return clean(new URL(url,location.href).searchParams.get('focus'),text); } catch { return []; }
  }
  function withUrl(existing,base,ranges,text) {
    const safe=clean(ranges,text);
    if(!existing&&!safe.length)return null;
    const canonical=new URL(base), url=new URL(existing||base,base);
    if(url.origin!==canonical.origin)return existing||null;
    url.searchParams.delete('focus');
    if(safe.length)url.searchParams.set('focus',JSON.stringify(safe));
    return url.href;
  }
  function apply(container,lesson) {
    if(!container||!lesson||lesson.type==='dialogue')return;
    const text=String(lesson.eng||''), ranges=clean(lesson.focusRanges,text);
    if(!ranges.length)return;
    let cursor=0;
    for(const word of container.querySelectorAll('.pace-word')) {
      const value=word.textContent, start=text.indexOf(value,cursor);
      if(start<0)continue;
      cursor=start+value.length;
      const range=ranges.find(([a,b])=>a<cursor&&b>start);
      if(range && !word.querySelector('.text-transparent')) {
        decorate(word,range,true);
      }
    }
  }
  const style=document.createElement('style');
  style.textContent=`
.copeak-focus-word{color:var(--copeak-focus-color)!important}
.copeak-focus-highlight{background-color:var(--copeak-focus-highlight)!important;color:var(--copeak-focus-color)!important;border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone}
.copeak-focus-bold{font-weight:800!important}
.copeak-focus-underline{text-decoration:underline!important;text-underline-offset:.15em;text-decoration-thickness:.09em}
.karaoke-active .pace-word.copeak-focus-word{background-image:linear-gradient(to right,#7e22ce 50%,var(--copeak-focus-color) 50%)}
.karaoke-active .pace-word.copeak-focus-highlight{background-image:none!important;background-clip:padding-box!important;-webkit-background-clip:padding-box!important;-webkit-text-fill-color:var(--copeak-focus-color)!important}
.karaoke-active .pace-word.copeak-focus-highlight.paced-highlight{outline:2px solid #7e22ce;outline-offset:1px}
.karaoke-active .pace-word.copeak-focus-highlight.paced-read{box-shadow:inset 0 -2px #7e22ce}
@media(forced-colors:active){.copeak-focus-highlight{outline:1px solid CanvasText}.copeak-focus-word{text-decoration:underline}.karaoke-active .pace-word.copeak-focus-highlight{-webkit-text-fill-color:CanvasText!important}}
`;
  document.head.append(style);
  window.CopeakFocus={clean,restore,get,fromUrl,withUrl,apply};
  function init(){mount('customEng');mount('assignmentText');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();