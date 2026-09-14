import {getClient,isConfigured,clearDemo} from './supabase.js';

const $=s=>document.querySelector(s);
let mode='login'; let role='student';
const form=$('#authForm'), nameField=$('#nameField'), submit=$('#submitBtn'), switchBtn=$('#switchMode'), msg=$('#message');
function show(text,type='info'){msg.className=`alert ${type}`;msg.textContent=text;msg.classList.remove('hidden');}
function sync(){
  nameField.classList.toggle('hidden',mode==='login');
  submit.textContent=mode==='login'?'Sign in':'Create account';
  switchBtn.textContent=mode==='login'?'初めて使う方：アカウント作成':'すでにアカウントがある方：Sign in';
  $('#formTitle').textContent=mode==='login'?'Welcome back':'Create your account';
}
$('#roleStudent').onclick=()=>{role='student';$('#roleStudent').classList.add('active');$('#roleTeacher').classList.remove('active');};
$('#roleTeacher').onclick=()=>{role='teacher';$('#roleTeacher').classList.add('active');$('#roleStudent').classList.remove('active');};
switchBtn.onclick=()=>{mode=mode==='login'?'signup':'login';msg.classList.add('hidden');sync();};
form.onsubmit=async e=>{
  e.preventDefault(); clearDemo();
  if(!isConfigured()){show('Supabaseがまだ接続されていません。下のDemoボタンで画面を確認できます。','error');return;}
  const sb=getClient(), email=$('#email').value.trim(), password=$('#password').value;
  submit.disabled=true;
  try{
    if(mode==='login'){
      const {data,error}=await sb.auth.signInWithPassword({email,password}); if(error)throw error;
      const {data:p,error:pe}=await sb.from('profiles').select('role').eq('id',data.user.id).single(); if(pe)throw pe;
      location.href=p.role==='teacher'?'teacher.html':'student.html';
    }else{
      const display_name=$('#displayName').value.trim(); if(!display_name)throw new Error('名前を入力してください。');
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{display_name,role}}}); if(error)throw error;
      if(data.session){location.href=role==='teacher'?'teacher.html':'student.html';}
      else show('登録しました。Supabaseでメール確認を有効にしている場合は、確認メール後にSign inしてください。','ok');
    }
  }catch(err){show(err.message||String(err),'error');}finally{submit.disabled=false;}
};
$('#demoStudent').onclick=()=>{localStorage.setItem('copeak_demo_role','student');location.href='student.html';};
$('#demoTeacher').onclick=()=>{localStorage.setItem('copeak_demo_role','teacher');location.href='teacher.html';};
if(!isConfigured()) $('#setupNote').classList.remove('hidden');
sync();
