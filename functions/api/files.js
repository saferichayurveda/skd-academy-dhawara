import { isAuthenticated, json, originIsSame } from "../_lib/auth.js";
const PREFIX="school-office/";
const MAX=10*1024*1024;
const cleanName=(s)=>String(s||"file").replace(/[\\/\\0-\\x1f\\x7f]/g,"_").replace(/\.\./g,"_").slice(0,180)||"file";
export async function onRequest({request,env}){
 if(!(await isAuthenticated(request,env)))return json({error:"पहले School Office में Admin Login करें।"},401);
 if(!env.SCHOOL_FILES)return json({error:"Cloudflare Pages में SCHOOL_FILES नाम का R2 bucket binding सेट करना आवश्यक है।"},503);
 try{
  const url=new URL(request.url);
  if(request.method==="GET"){
   const key=url.searchParams.get("key");
   if(key){
    if(!key.startsWith(PREFIX))return json({error:"गलत फ़ाइल key।"},400);
    const obj=await env.SCHOOL_FILES.get(key);if(!obj)return json({error:"फ़ाइल नहीं मिली।"},404);
    return new Response(obj.body,{headers:{"Content-Type":obj.httpMetadata?.contentType||"application/octet-stream","Content-Disposition":'attachment; filename="'+cleanName(obj.customMetadata?.originalName||key.split("/").pop())+'"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
   }
   const listed=await env.SCHOOL_FILES.list({prefix:PREFIX,limit:500});
   return json({files:(listed.objects||[]).map(o=>({key:o.key,name:o.customMetadata?.originalName||o.key.slice(PREFIX.length),size:o.size,uploaded:o.uploaded?.toISOString?.()||""})).sort((a,b)=>b.uploaded.localeCompare(a.uploaded))});
  }
  if(!originIsSame(request))return json({error:"अनुरोध अस्वीकार किया गया।"},403);
  if(request.method==="POST"){
   const form=await request.formData(),file=form.get("file");
   if(!(file instanceof File))return json({error:"अपलोड करने के लिए फ़ाइल चुनें।"},400);
   if(file.size<1||file.size>MAX)return json({error:"फ़ाइल खाली है या 10 MB से बड़ी है।"},413);
   const name=cleanName(file.name),key=PREFIX+crypto.randomUUID()+"-"+name;
   await env.SCHOOL_FILES.put(key,file.stream(),{httpMetadata:{contentType:"application/octet-stream"},customMetadata:{originalName:name,contentType:file.type||"application/octet-stream"}});
   return json({ok:true,name,size:file.size,key},201);
  }
  if(request.method==="DELETE"){
   const key=url.searchParams.get("key");if(!key||!key.startsWith(PREFIX))return json({error:"गलत फ़ाइल key।"},400);
   await env.SCHOOL_FILES.delete(key);return json({ok:true,deleted:true});
  }
  return json({error:"Method not allowed"},405,{Allow:"GET,POST,DELETE"});
 }catch(e){console.error("School file storage error",e);return json({error:"फ़ाइल स्टोरेज अनुरोध पूरा नहीं हुआ। R2 binding और permissions जाँचें।"},500)}
}