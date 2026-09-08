(function(){
  const roles={
    cxo:{email:'ceo@soxibeta.com',password:'ceo2026',label:'CEO Suite (#ceo)'},
    chro:{email:'chro@soxibeta.com',password:'chro2026',label:'CHRO Workspace (#chro)'},
    hrbp:{email:'hrbp@soxibeta.com',password:'hrbp2026',label:'HRBP Workspace (#hrbp)'},
    manager:{email:'manager@soxibeta.com',password:'manager2026',label:'Manager Workspace (#manager)'},
    employee:{email:'employee@soxibeta.com',password:'employee2026',label:'Employee Workspace (#employee)'}
  };
  const form=document.getElementById('login-form');
  const email=document.getElementById('email');
  const password=document.getElementById('password');
  const hint=document.getElementById('role-hint');
  const creds=document.getElementById('active-credentials');
  const error=document.getElementById('login-error');
  const submit=document.getElementById('submit-btn');
  document.querySelectorAll('.role-btn').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const r=roles[btn.dataset.role];
    email.value=r.email; password.value=r.password; hint.textContent='Directs to '+r.label; creds.textContent=r.email+' / '+r.password; error.textContent='';
  }));
  form.addEventListener('submit',async e=>{
    e.preventDefault(); error.textContent=''; submit.disabled=true; submit.textContent='SIGNING IN…';
    try{
      const res=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({email:email.value,password:password.value})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||'Login failed');
      const verify = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      if (!verify.ok) throw new Error('Login succeeded but session was not created. Restart server and try again.');
      window.location.replace('/dashboard');
    }catch(err){error.textContent=err.message; submit.disabled=false; submit.textContent='SIGN IN TO HRMS →';}
  });
})();
