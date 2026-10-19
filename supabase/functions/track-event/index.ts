// AppHub audit ingestion: deploy with Supabase Edge Functions JWT verification enabled.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';
const allowedOrigin = Deno.env.get('APPHUB_ORIGIN') || 'https://rishikarot.github.io';
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin':origin, 'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin' });
const respond=(status:number,body:unknown,headers:Record<string,string>)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
function parseUA(ua:string){
 const browser=/Edg\//.test(ua)?'Edge':/OPR\//.test(ua)?'Opera':/CriOS\//.test(ua)?'Chrome':/Chrome\//.test(ua)?'Chrome':/FxiOS\//.test(ua)?'Firefox':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Other';
 const os=/iPad|iPhone|iPod/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac OS X|Macintosh/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other';
 const device=/iPad|Tablet/.test(ua)?'Tablet':/Mobi|Android|iPhone/.test(ua)?'Mobile':'Desktop';
 return {browser,os,device_type:device};
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const h=cors(allowedOrigin);
 if(req.method==='OPTIONS')return origin===allowedOrigin?new Response(null,{status:204,headers:h}):new Response(null,{status:403});
 if(req.method!=='POST'||origin!==allowedOrigin)return respond(403,{error:'Origin not permitted'},h);
 try{
  const base=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return respond(401,{error:'Missing token'},h);
  const token=bearer.slice(7);
  const auth=createClient(base,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user||user.is_anonymous)return respond(401,{error:'Authentication required'},h);
  // Password and Google users must both belong to the active AppHub allowlist.
  const membershipDb=createClient(base,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:member}=await membershipDb.from('apphub_members').select('enabled').eq('user_id',user.id).maybeSingle();
  if(!member?.enabled)return respond(403,{error:'AppHub access not authorized'},h);
  let body;
  try{body=await req.json()}catch{return respond(400,{error:'Invalid JSON'},h)}
  const type=body?.event_type;
  if(!['login','visit','launch','logout'].includes(type))return respond(400,{error:'Invalid event'},h);
  const db=createClient(base,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  let app:{id:string,name:string,url:string}|null=null;
  if(type==='launch'){
   if(typeof body.application_id!=='string')return respond(400,{error:'Application required'},h);
   const {data,error}=await db.from('applications').select('id,name,url,visibility').eq('id',body.application_id).maybeSingle();
   if(error||!data)return respond(404,{error:'Application not found'},h);
   if(data.visibility!=='published'){
    const {data:admin}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!admin)return respond(403,{error:'Application not available'},h);
   }
   app=data;
  }
  // Approximate IP geography, resolved server side. Do not store the IP address.
  const ip=(req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'').trim();
  let place:{city?:string,region?:string,country?:string}={};
  if(ip && !/^(127\.|10\.|192\.168\.|::1$)/.test(ip)){
   try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),1200);
    try{const r=await fetch('https://ipwho.is/'+encodeURIComponent(ip)+'?fields=success,city,region,country',{signal:controller.signal});const g=await r.json();if(g.success)place={city:g.city,region:g.region,country:g.country}}finally{clearTimeout(timeout)}}catch{/* location remains unavailable */}
  }
  const ua=(req.headers.get('user-agent')||'').slice(0,512);
  const {error:insertError}=await db.from('access_events').insert({user_id:user.id,user_email:user.email||'',event_type:type,application_id:app?.id||null,application_name:app?.name||null,target_url:app?.url||null,...parseUA(ua),city:place.city||null,region:place.region||null,country:place.country||null,session_id:(typeof user.aud==='string'?user.aud:'authenticated')});
  if(insertError){console.error('Audit insert error',insertError);return respond(500,{error:'Could not record event'},h)}
  return respond(200,{ok:true},h);
 }catch(e){console.error('Track error',e);return respond(500,{error:'Internal error'},h)}
});
