/* Copeak Focus Mode: presentation-only UTF-16 ranges over trimmed lesson text. */
(function () {
  'use strict';
  const colors = ['#b91c1c','#1d4ed8','#047857','#b45309','#7e22ce'];
  const names = ['赤','青','緑','オレンジ','紫'];
  const editors = new Map();
  const MAX = 60;
  function clean(value, text) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
    if (!Array.isArray(value)) return [];
    const limit = typeof text === 'string' ? text.length : Number.MAX_SAFE_INTEGER;
    const result = [];
    for (const r of value.slice(0, MAX)) {
      if (!Array.isArray(r) || r.length !== 3) continue;
      const [a,b,c] = r;
      if (![a,b,c].every(Number.isSafeInteger) || a < 0 || b <= a || b > limit || c < 0 || c >= colors.length) continue;
      if (result.some(x => a < x[1] && b > x[0])) continue;
      result.push([a,b,c]);
    }
    return result.sort((x,y) => x[0]-y[0]);
  }
  function replaceRange(ranges, a, b, color) {
    const out = [];
    for (const [s,e,c] of ranges) {
      if (e <= a || s >= b) out.push([s,e,c]);
      else {
        if (s < a) out.push([s,a,c]);
        if (e > b) out.push([b,e,c]);
      }
    }
    if (color >= 0) out.push([a,b,color]);
    out.sort((x,y)=>x[0]-y[0]);
    const merged = [];
    for (const r of out) {
      const last = merged[merged.length-1];
      if (last && last[1] === r[0] && last[2] === r[2]) last[1] = r[1];
      else merged.push(r);
    }
    return merged;
  }
  function sync(state) {
    const next = state.input.value.trim(), old = state.text;
    if (next === old) return;
    let a=0, tail=0;
    while (a < old.length && a < next.length && old[a] === next[a]) a++;
    while (tail < old.length-a && tail < next.length-a && old[old.length-1-tail] === next[next.length-1-tail]) tail++;
    const oldEnd = old.length-tail, delta = next.length-old.length;
    state.ranges = state.ranges.flatMap(([s,e,c]) => e <= a ? [[s,e,c]] : s >= oldEnd ? [[s+delta,e+delta,c]] : []);
    state.text = next;
  }
  function paintPreview(state) {
    state.preview.replaceChildren();
    let pos = 0;
    for (const [a,b,c] of state.ranges) {
      state.preview.append(document.createTextNode(state.text.slice(pos,a)));
      const span = document.createElement('span');
      span.style.color = colors[c];
      span.textContent = state.text.slice(a,b);
      state.preview.append(span);
      pos=b;
    }
    state.preview.append(document.createTextNode(state.text.slice(pos)));
    state.preview.hidden = !state.ranges.length;
    state.status.textContent = state.ranges.length ? state.ranges.length + ' 箇所を強調中' : '英文の一部を選択して色を指定してください。';
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
    function choose(color) {
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
      const next = replaceRange(state.ranges,a,b,color);
      if (next.length>MAX) { status.textContent='強調は最大60箇所です。'; return; }
      state.ranges=next; paintPreview(state);
    }
    function button(label,color,action) {
      const el=document.createElement('button');
      el.type='button'; el.textContent=label;
      el.style.cssText='border:1px solid #cbd5e1;border-radius:6px;background:white;color:'+(color||'#334155')+';padding:6px 10px;font-weight:700;cursor:pointer;min-height:36px';
      el.addEventListener('pointerdown',()=>{if(document.activeElement===input)remember();});
      el.addEventListener('mousedown',event=>event.preventDefault());
      el.addEventListener('click',action); controls.append(el);
    }
    colors.forEach((c,i)=>button('● '+names[i],c,()=>choose(i)));
    button('選択解除',null,()=>choose(-1));
    button('全解除',null,()=>{state.ranges=[];state.selection=null;state.text=input.value.trim();paintPreview(state);});
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
        word.classList.add('copeak-focus-word');
        word.style.setProperty('--copeak-focus-color',colors[range[2]]);
      }
    }
  }
  const style=document.createElement('style');
  style.textContent='.copeak-focus-word{color:var(--copeak-focus-color)!important}.karaoke-active .pace-word.copeak-focus-word{background-image:linear-gradient(to right,#a855f7 50%,var(--copeak-focus-color) 50%)}';
  document.head.append(style);
  window.CopeakFocus={clean,restore,get,fromUrl,withUrl,apply};
  function init(){mount('customEng');mount('assignmentText');}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();