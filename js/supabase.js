import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export function isConfigured(){
  const c=window.COPEAK_CONFIG||{};
  return Boolean(c.supabaseUrl && c.supabaseAnonKey && !c.supabaseUrl.startsWith('YOUR_') && !c.supabaseAnonKey.startsWith('YOUR_'));
}
export function getClient(){
  if(!isConfigured()) return null;
  if(!window.__copeakSupabase){
    window.__copeakSupabase=createClient(window.COPEAK_CONFIG.supabaseUrl,window.COPEAK_CONFIG.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true}});
  }
  return window.__copeakSupabase;
}
export function demoRole(){return localStorage.getItem('copeak_demo_role');}
export function clearDemo(){localStorage.removeItem('copeak_demo_role');}
export async function requireUser(role){
  const demo=demoRole(); if(demo){ if(role&&demo!==role) location.href=demo==='teacher'?'teacher.html':'student.html'; return {demo:true,user:{id:demo==='teacher'?'demo-teacher':'s1'},profile:{display_name:demo==='teacher'?'Nakashi-sensei':'Yuki Tanaka',role:demo}}; }
  const sb=getClient(); if(!sb){ location.href='index.html'; return null; }
  const {data:{user}}=await sb.auth.getUser(); if(!user){location.href='index.html';return null;}
  const {data:profile,error}=await sb.from('profiles').select('*').eq('id',user.id).single();
  if(error||!profile){console.error(error);return {demo:false,user,profile:null};}
  if(role&&profile.role!==role){location.href=profile.role==='teacher'?'teacher.html':'student.html';return null;}
  return {demo:false,user,profile};
}
export async function signOut(){
  clearDemo(); const sb=getClient(); if(sb) await sb.auth.signOut(); location.href='index.html';
}
export function fmtDate(value){ if(!value)return '—'; return new Intl.DateTimeFormat('ja-JP',{month:'short',day:'numeric',weekday:'short'}).format(new Date(value)); }
export function pct(v){ return v===null||v===undefined?'—':`${Math.round(Number(v))}%`; }
