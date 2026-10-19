// AppHub account management: Supabase Auth admin API is server-side only.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const allowedOrigin = Deno.env.get('APPHUB_ORIGIN') || 'https://rishikarot.github.io';
const cors = {'Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Content-Type':'application/json'};
const respond = (status:number,body:unknown) => new Response(JSON.stringify(body),{status,headers:cors});
const roles = ['super_admin','admin','viewer'];
Deno.serve(async req => {
 const origin=req.headers.get('origin')||'';
 if(req.method==='OPTIONS')return new Response(null,{status:origin===allowedOrigin?204:403,headers:cors});
 if(req.method!=='POST'||origin!==allowedOrigin)return respond(403,{error:'Forbidden'});
 try {
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return respond(401,{error:'Login required'});
  const endpoint=Deno.env.get('SUPABASE_URL')!,publishable=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const auth=createClient(endpoint,publishable,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(bearer.slice(7));
  if(authError||!user||user.is_anonymous)return respond(401,{error:'Login required'});
  const db=createClient(endpoint,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor}=await db.from('apphub_members').select('enabled,role').eq('user_id',user.id).maybeSingle();
  if(!actor?.enabled||actor.role!=='super_admin')return respond(403,{error:'Super Admin access required'});
  const body=await req.json().catch(()=>null);
  if(!body||typeof body.action!=='string')return respond(400,{error:'Invalid request'});
  if(body.action==='list'){
   const {data,error}=await db.from('apphub_members').select('user_id,email,display_name,enabled,role,created_at').order('created_at',{ascending:false}).limit(500);
   if(error)throw error;
   return respond(200,{users:data||[]});
  }
  if(body.action==='create'){
   const email=String(body.email||'').trim().toLowerCase(),name=String(body.name||'').trim(),password=String(body.password||'');
   const role=String(body.role||'viewer');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||!name||name.length>120||password.length<12||password.length>128||!['viewer','admin'].includes(role))return respond(400,{error:'Valid email, name, role and a 12–128 character password are required.'});
   const {data:created,error:createError}=await db.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name}});
   if(createError||!created.user)return respond(400,{error:createError?.message||'Cannot create user'});
   const {error:insertError}=await db.from('apphub_members').insert({user_id:created.user.id,email,display_name:name,enabled:true,role});
   if(insertError){await db.auth.admin.deleteUser(created.user.id);throw insertError;}
   if(role==='admin'){
    const {error:e}=await db.from('admin_users').insert({user_id:created.user.id,email});
    if(e){await db.auth.admin.deleteUser(created.user.id);throw e;}
   }
   return respond(200,{ok:true});
  }
  const userId=String(body.user_id||'');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId))return respond(400,{error:'Invalid user ID'});
  if(userId===user.id)return respond(400,{error:'You cannot change your own Super Admin account here'});
  const {data:target}=await db.from('apphub_members').select('user_id,email,enabled,role').eq('user_id',userId).maybeSingle();
  if(!target)return respond(404,{error:'Account not found'});
  if(target.role==='super_admin')return respond(403,{error:'Super Admin account is protected'});
  if(body.action==='set_status'){
   if(typeof body.enabled!=='boolean')return respond(400,{error:'Invalid status'});
   // Ban/unban Supabase Auth first; RLS checks enabled status even for previously issued tokens.
   const {error:banError}=await db.auth.admin.updateUserById(userId,{ban_duration:body.enabled?'none':'876000h'});
   if(banError)throw banError;
   const {error:updateError}=await db.from('apphub_members').update({enabled:body.enabled,updated_at:new Date().toISOString()}).eq('user_id',userId);
   if(updateError)throw updateError;
   return respond(200,{ok:true});
  }
  if(body.action==='set_role'){
   const role=String(body.role||'');
   if(!['viewer','admin'].includes(role))return respond(400,{error:'Invalid role'});
   if(role==='admin'){
    const {error:e}=await db.from('admin_users').upsert({user_id:userId,email:target.email});if(e)throw e;
   }else{
    const {error:e}=await db.from('admin_users').delete().eq('user_id',userId);if(e)throw e;
   }
   const {error:e}=await db.from('apphub_members').update({role,updated_at:new Date().toISOString()}).eq('user_id',userId);if(e)throw e;
   return respond(200,{ok:true});
  }
  if(body.action==='reset_password'){
   const password=String(body.password||'');
   if(password.length<12||password.length>128)return respond(400,{error:'Password must be 12–128 characters'});
   const {error:e}=await db.auth.admin.updateUserById(userId,{password});if(e)throw e;
   return respond(200,{ok:true});
  }
  return respond(400,{error:'Unsupported action'});
 }catch(e){console.error('AppHub user management',e);return respond(500,{error:'Account operation failed. Check Edge Function logs.'});}
});
