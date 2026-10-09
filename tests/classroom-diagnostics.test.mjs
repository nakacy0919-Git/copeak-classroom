import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source=await readFile(new URL('../js/classroom-diagnostics.js',import.meta.url),'utf8');
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
const {reportClassroomDiagnostic:report,flushClassroomDiagnostics:flush}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
let calls=[];let error=null;const client={rpc:async(name,args)=>{calls.push({name,args});return {error};}};
const queued=()=>JSON.parse([...storage.values()][0]||'[]');
await test('offline diagnostics remain queued without any network calls',()=>{
 report(client,'student','assignment','submission_save_failed','offline');report(client,'student','assignment','submission_save_failed','offline');
 assert.equal(queued().length,1);assert.equal(calls.length,0);assert(!JSON.stringify(queued()).includes('accuracy'));
});
await test('shared device never sends another account’s queued reports',async()=>{
 navigator.onLine=true;await flush(client,'different-student');assert.equal(calls.length,0);assert.equal(queued().length,1);
});
await test('transient failure keeps reports; reconnect sends once and removes',async()=>{
 error={code:'503'};await flush(client,'student');assert.equal(queued().length,1);
 error=null;await flush(client,'student');assert.equal(queued().length,0);assert.equal(calls[1].args.p_reason,'offline');
 await flush(client,'student');assert.equal(calls.length,2);
});
await test('storage unavailable never interrupts calling flow',()=>{
 localStorage.setItem=()=>{throw Error('quota');};navigator.onLine=false;assert.doesNotThrow(()=>report(client,'student','assignment','submission_save_failed'));
});
