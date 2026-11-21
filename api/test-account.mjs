import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
if(process.env.NUTRAINING_TEST_DB!=='1')throw new Error('Use banco isolado e NUTRAINING_TEST_DB=1.');
const pool=new pg.Pool();const emails=[];const password='Perfil-Integracao-123!';const newPassword='Nova-Senha-Integracao-456!';
async function request(path,token,body,method=body?'POST':'GET'){
  const response=await fetch(`http://127.0.0.1:3101/v1/${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});
  return {status:response.status,data:response.status===204?null:await response.json()};
}
async function account(){const email=`account-test-${randomUUID()}@example.invalid`;emails.push(email);
 const r=await request('auth/register',null,{name:'Conta Teste',email,password,role:'student',deviceLabel:'Android de teste'});assert.equal(r.status,201);return {...r.data,email};}
async function login(user,pwd=password,device='Outro dispositivo'){const r=await request('auth/login',null,{email:user.email,password:pwd,deviceLabel:device});assert.equal(r.status,200);return r.data.token;}
try{
 const user=await account();const other=await account();const admin=await account();
 await pool.query("UPDATE nt_users SET role='admin' WHERE id=$1",[admin.user.id]);
 assert.equal((await request('account/profile')).status,401);
 assert.equal((await request('management/overview',user.token)).status,403);
 assert.equal((await request('management/sessions',other.token)).status,403);
 assert.equal((await request('account/profile',user.token,{name:'Nome Atualizado',bio:'Minha jornada',role:'admin'},'PATCH')).status,200);
 const profile=(await request('account/profile',user.token)).data;
 assert.equal(profile.user.name,'Nome Atualizado');assert.equal(profile.bio,'Minha jornada');assert.equal(profile.user.role,'student');assert.equal(profile.avatar,null);
 assert.equal((await request('account/profile',user.token,{name:'x',bio:''},'PATCH')).status,400);
 assert.equal((await request('account/avatar',user.token,{base64:Buffer.from('<svg></svg>').toString('base64')},'PUT')).status,400);
 assert.equal((await request('account/avatar',user.token,{base64:'a'.repeat(54000)},'PUT')).status,400);
 // A minimal JPEG envelope exercises binary persistence without external files.
 const jpeg=Buffer.from([0xff,0xd8,0xff,0xe0,0,2,0,0,0xff,0xd9]).toString('base64');
 assert.equal((await request('account/avatar',user.token,{base64:jpeg},'PUT')).status,200);
 assert.equal((await request('account/profile',user.token)).data.avatar,`data:image/jpeg;base64,${jpeg}`);
 assert.equal((await request('account/profile',other.token)).data.avatar,null);
 assert.equal((await request('account/avatar',user.token,undefined,'DELETE')).status,204);
 const second=await login(user);
 const sessions=(await request('account/sessions',user.token)).data.sessions;
 assert.equal(sessions.length,2);assert.equal(sessions.filter(s=>s.current).length,1);
 assert.ok(sessions.every(s=>!('token_hash' in s)&&!('token' in s)));
 assert.ok(sessions.some(s=>s.deviceLabel==='Android de teste'));
 const secondary=sessions.find(s=>!s.current);const current=sessions.find(s=>s.current);
 assert.equal((await request(`account/sessions/${secondary.id}`,other.token,undefined,'DELETE')).status,404);
 assert.equal((await request(`account/sessions/${current.id}`,user.token,undefined,'DELETE')).status,400);
 assert.equal((await request(`account/sessions/${secondary.id}`,user.token,undefined,'DELETE')).status,204);
 assert.equal((await request('auth/me',second)).status,401);
 const third=await login(user);
 assert.equal((await request('account/sessions/others',user.token,undefined,'DELETE')).status,204);
 assert.equal((await request('auth/me',third)).status,401);
 const fourth=await login(user);
 assert.equal((await request('account/password',user.token,{currentPassword:'Incorreta123!',newPassword},'PUT')).status,403);
 assert.equal((await request('auth/me',fourth)).status,200);
 assert.equal((await request('account/password',user.token,{currentPassword:password,newPassword:'curta'},'PUT')).status,400);
 const changed=await request('account/password',user.token,{currentPassword:password,newPassword,deviceLabel:'Sessão renovada'},'PUT');
 assert.equal(changed.status,200);assert.ok(changed.data.token);
 assert.equal((await request('auth/me',user.token)).status,401);assert.equal((await request('auth/me',fourth)).status,401);
 assert.equal((await request('auth/me',changed.data.token)).status,200);
 assert.equal((await request('auth/login',null,{email:user.email,password})).status,401);
 const newLogin=await login(user,newPassword);
 const stats=(await request('management/overview',admin.token)).data;
 assert.ok(stats.totalUsers>=3);assert.ok(stats.newUsers7d>=3);assert.ok(stats.activeSessions>=4);
 const listed=(await request(`management/users?q=${encodeURIComponent(user.email)}`,admin.token)).data.users;
 assert.equal(listed.length,1);assert.equal(listed[0].source,'signup');assert.ok(listed[0].lastLoginAt);assert.equal(listed[0].activeSessions,2);
 assert.ok(!('password_hash' in listed[0]));
 const active=(await request(`management/sessions?q=${encodeURIComponent(user.email)}`,admin.token)).data.sessions;
 assert.equal(active.length,2);assert.ok(active.every(s=>!('token_hash' in s)&&!('token' in s)));
 assert.equal((await request(`management/sessions/${active[0].id}`,admin.token,undefined,'DELETE')).status,204);
 assert.equal((await request(`management/sessions?q=${encodeURIComponent(user.email)}`,admin.token)).data.sessions.length,1);
 const events=(await request(`management/events?q=${encodeURIComponent(user.email)}`,admin.token)).data.events;
 assert.ok(events.some(e=>e.event==='password_changed'));assert.ok(events.some(e=>e.event==='session_revoked'));
 assert.ok(!JSON.stringify(events).includes(password));assert.ok(!JSON.stringify(events).includes(newPassword));
 assert.equal((await request('management/users?offset=-1',admin.token)).status,400);
 // Administrators can assign both specialties without a professional relationship.
 const exercise={name:'Remada',sets:3,reps:'10 a 12',restSeconds:60};const meal={name:'Almoço',time:'12:00',foods:'Plano orientado'};
 for(const [kind,item] of [['workout',exercise],['nutrition',meal]]){
  assert.equal((await request('app/plans',admin.token,{kind,userId:other.user.id,title:'Plano do administrador',items:[item]})).status,201);
 }
 assert.equal((await request('account/profile',newLogin)).status===200 || (await request('account/profile',changed.data.token)).status===200,true);
 console.log('OK: perfil, foto, isolamento, sessões, troca de senha, revogação, auditoria, indicadores e atribuição administrativa de treino/dieta.');
}finally{
 await pool.query('DELETE FROM nt_plans WHERE created_by IN(SELECT id FROM nt_users WHERE email=ANY($1::text[]))',[emails]);
 await pool.query('DELETE FROM nt_users WHERE email=ANY($1::text[])',[emails]);await pool.end();
}
