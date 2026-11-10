import http from "node:http";
import { PLANS,planById,displayPrice,parseTelegramStart } from "./catalog.js";
import { normalizeLang,t,LANGS } from "./strings.js";
import {connectDb,initDb,getOffset,saveOffset,upsertUser,setUserLanguage,setUserMarket,tryRefer,getReferralCount,lookupCoupon,adminCreateCoupon,listOrders,adminStats} from "./db.js";

const token=String(process.env.TELEGRAM_BOT_TOKEN||"").trim();
const username=String(process.env.TELEGRAM_BOT_USERNAME||"LegitCheatsCFBot").trim().replace(/^@/,"");
const siteUrl=String(process.env.WEBSITE_URL||"https://legitbaratinho.xyz").replace(/\/$/,"");
const supportUrl=String(process.env.SUPPORT_URL||siteUrl+"/#faq");
const admins=new Set(String(process.env.TELEGRAM_ADMIN_IDS||"").split(",").map(x=>x.trim()).filter(Boolean));
const port=Number(process.env.PORT||3211);

function keyboard(rows){return {inline_keyboard:rows.map(row=>row.map(([label,data,url])=>url?{text:label,url}:{text:label,callback_data:data}))};}
function homeButtons(lang){return keyboard([
 [[t(lang,"shop"),"shop"],[t(lang,"orders"),"orders"]],
 [[t(lang,"coupons"),"coupons"],[t(lang,"referrals"),"referrals"]],
 [[t(lang,"language"),"language"],[t(lang,"region"),"region"]],
 [[t(lang,"support"),"support"]]
]);}
function back(lang){return keyboard([[[t(lang,"back"),"home"]]]);}
function platformButtons(lang){return keyboard([
 [[t(lang,"android"),"platform:android"]],
 [[t(lang,"ios"),"platform:ios"]],
 [[t(lang,"back"),"home"]]
]);}
function languageButtons(lang){return keyboard([
 [["🇧🇷 Português","lang:pt"],["🇺🇸 English","lang:en"]],
 [["🇪🇸 Español","lang:es"],["🇷🇺 Русский","lang:ru"]],
 [[t(lang,"back"),"home"]]
]);}
function regionButtons(lang){return keyboard([
 [[t(lang,"br"),"market:BR"]],
 [[t(lang,"intl"),"market:INTL"]],
 [[t(lang,"back"),"home"]]
]);}
function planButtons(lang,platform,market){
 const buttons=PLANS.map(p=>[[p.days+" "+t(lang,p.days===1?"day":"days")+" • "+displayPrice(p,market),"plan:"+platform+":"+p.id]]);
 buttons.push([[t(lang,"back"),"shop"]]);
 return keyboard(buttons);
}
function quoteButtons(lang,platform,planId,market){
 const params=new URLSearchParams({product:"counterframe",platform,plan:planId,lang,market:market==="BR"?"br":"intl"});
 const rows=[];
 // Existing website checkout settles in BRL: no false USD-price promise.
 if(market==="BR")rows.push([[t(lang,"visitSite"),"",siteUrl+"/checkout?"+params.toString()]]);
 rows.push([[t(lang,"starsLater"),"pay:disabled"]]);
 rows.push([[t(lang,"back"),"platform:"+platform]]);
 return keyboard(rows);
}
async function api(method,data={},timeoutMs=35000){
 if(!token)throw new Error("TELEGRAM_BOT_TOKEN missing");
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const response=await fetch("https://api.telegram.org/bot"+token+"/"+method,{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),signal:ctrl.signal
  });
  const json=await response.json().catch(()=>null);
  if(!response.ok||!json?.ok)throw new Error(method+" "+response.status+": "+(json?.description||"Telegram request failed"));
  return json.result;
 }finally{clearTimeout(timer);}
}
async function send(chatId,txt,replyMarkup=null){
 return api("sendMessage",{chat_id:chatId,text:txt,disable_web_page_preview:true,...(replyMarkup?{reply_markup:replyMarkup}:{})},12000);
}
async function say(chatId,lang,txt,buttons=back(lang)){return send(chatId,txt,buttons);}
async function home(chatId,user,extra=""){
 const msg=t(user.language,"welcome")+(extra?"\n\n"+extra:"");
 return say(chatId,user.language,msg,homeButtons(user.language));
}
async function shop(chatId,user){
 return say(chatId,user.language,t(user.language,"choosePlatform"),platformButtons(user.language));
}
async function platformMenu(chatId,user,platform){
 const warning=platform==="ios"?t(user.language,"iosWarning")+"\n\n":"";
 return say(chatId,user.language,warning+t(user.language,"choosePlan"),planButtons(user.language,platform,user.market));
}
async function quote(chatId,user,platform,planId){
 const plan=planById(planId);
 if(!plan)return shop(chatId,user);
 const lang=user.language;
 const msg=t(lang,"selected",{platform:platform==="ios"?"iOS":"Android",days:plan.days,price:displayPrice(plan,user.market)})
   +(platform==="ios"?"\n\n"+t(lang,"iosWarning"):"")
   +"\n\n"+t(lang,"paymentSoon");
 return say(chatId,lang,msg,quoteButtons(lang,platform,planId,user.market));
}
async function referral(chatId,user){
 const url="https://t.me/"+username+"?start=ref_"+user.id;
 const count=await getReferralCount(user.id);
 return say(chatId,user.language,t(user.language,"referral",{url})+"\n\nReferrals: "+count);
}
async function orders(chatId,user){
 const list=await listOrders(user.id);
 const msg=list.length
   ?list.map(order=>"#"+order.id+" • "+order.platform+" • "+order.plan_id+" • "+order.status).join("\n")
   :t(user.language,"noOrders");
 return say(chatId,user.language,msg);
}
async function act(chatId,user,data){
 const lang=user.language;
 if(data==="home")return home(chatId,user);
 if(data==="shop")return shop(chatId,user);
 if(data==="orders")return orders(chatId,user);
 if(data==="coupons")return say(chatId,lang,t(lang,"couponHelp"));
 if(data==="referrals")return referral(chatId,user);
 if(data==="language")return say(chatId,lang,t(lang,"language"),languageButtons(lang));
 if(data==="region")return say(chatId,lang,t(lang,"chooseMarket"),regionButtons(lang));
 if(data==="support")return say(chatId,lang,t(lang,"supportText")+"\n"+supportUrl);
 if(data==="pay:disabled")return say(chatId,lang,t(lang,"notReady"));
 if(data.startsWith("lang:")){
  const chosen=data.slice(5);
  if(!LANGS.includes(chosen))return;
  await setUserLanguage(user.id,chosen);user.language=chosen;
  return home(chatId,user,t(chosen,"languageSaved"));
 }
 if(data.startsWith("market:")){
  const market=data.slice(7);
  if(!["BR","INTL"].includes(market))return;
  await setUserMarket(user.id,market);user.market=market;
  return home(chatId,user,t(lang,"regionSaved"));
 }
 if(data.startsWith("platform:")){
  const platform=data.slice(9);
  return ["android","ios"].includes(platform)?platformMenu(chatId,user,platform):null;
 }
 if(data.startsWith("plan:")){
  const found=/^plan:(android|ios):(d1|d7|d15|d30)$/.exec(data);
  return found?quote(chatId,user,found[1],found[2]):null;
 }
 return home(chatId,user,t(lang,"unknown"));
}
async function message(chatId,from,raw){
 const user=await upsertUser({id:from.id,username:from.username,lang:normalizeLang(from.language_code)});
 const [rawCommand,...parts]=String(raw||"").trim().split(/\s+/);
 const command=rawCommand.toLowerCase().split("@")[0];
 const value=parts.join(" ");
 if(command==="/start"){
  const deepLink=parseTelegramStart(value);
  let extra="";
  if(deepLink?.type==="referral"){
   if(await tryRefer(user.id,deepLink.userId))extra=t(user.language,"referralSaved");
  }
  await home(chatId,user,extra);
  if(deepLink?.type==="catalog")return quote(chatId,user,deepLink.platform,deepLink.planId);
  return;
 }
 if(command==="/shop")return shop(chatId,user);
 if(command==="/orders"||command==="/mykeys")return orders(chatId,user);
 if(command==="/language")return say(chatId,user.language,t(user.language,"language"),languageButtons(user.language));
 if(command==="/region")return say(chatId,user.language,t(user.language,"chooseMarket"),regionButtons(user.language));
 if(command==="/referral"||command==="/affiliate")return referral(chatId,user);
 if(command==="/support"||command==="/paysupport")return say(chatId,user.language,t(user.language,"supportText")+"\n"+supportUrl);
 if(command==="/coupon"){
  if(!value)return say(chatId,user.language,t(user.language,"couponHelp"));
  const coupon=await lookupCoupon(value);
  const text=coupon?t(user.language,"couponValid",{code:coupon.code,pct:coupon.discount_percent}):t(user.language,"couponInvalid");
  return say(chatId,user.language,text);
 }
 if(command==="/admincoupon"){
  if(!admins.has(String(from.id)))return say(chatId,user.language,t(user.language,"adminOnly"));
  const [code,pct,limit]=parts;
  try{
   await adminCreateCoupon({code,pct:Number(pct),maxUses:Number(limit),adminId:from.id});
   return say(chatId,user.language,t(user.language,"couponCreated"));
  }catch(err){return say(chatId,user.language,"/admincoupon CODE 10 100\n"+err.message);}
 }
 if(command==="/adminstats"){
  if(!admins.has(String(from.id)))return say(chatId,user.language,t(user.language,"adminOnly"));
  return say(chatId,user.language,JSON.stringify(await adminStats()));
 }
 if(command==="/help"||command==="/status")return home(chatId,user,t(user.language,"status"));
 return home(chatId,user,t(user.language,"unknown"));
}
async function handleUpdate(update){
 const callback=update.callback_query;
 if(callback){
  await api("answerCallbackQuery",{callback_query_id:callback.id},12000);
  if(callback.message?.chat?.type!=="private")return;
  const u=await upsertUser({id:callback.from.id,username:callback.from.username,lang:normalizeLang(callback.from.language_code)});
  return act(callback.message.chat.id,u,String(callback.data||""));
 }
 const m=update.message;
 if(!m||m.chat?.type!=="private"||!m.from||typeof m.text!=="string")return;
 return message(m.chat.id,m.from,m.text);
}
async function installCommands(){
 const cmds=[
  ["start","Start"],["shop","Shop"],["orders","Orders"],["mykeys","My licenses"],
  ["coupon","Coupon"],["referral","Referral link"],["region","Pricing region"],
  ["language","Language"],["support","Support"],["paysupport","Payment support"]
 ].map(([command,description])=>({command,description}));
 await api("setMyCommands",{commands:cmds},12000);
 const translations={
  pt:["Iniciar","Comprar","Pedidos","Licenças","Cupom","Indicações","Região","Idioma","Suporte","Pagamento"],
  es:["Iniciar","Tienda","Pedidos","Licencias","Cupón","Referidos","Región","Idioma","Soporte","Pagos"],
  ru:["Старт","Магазин","Заказы","Лицензии","Купон","Рефералы","Регион","Язык","Поддержка","Оплата"]
 };
 for(const [language_code,labels] of Object.entries(translations)){
  try{
   await api("setMyCommands",{language_code,commands:cmds.map((x,i)=>({command:x.command,description:labels[i]}))},12000);
  }catch(error){console.warn("Commands for",language_code,"failed",error.message);}
 }
}
async function main(){
 if(!/^[a-zA-Z0-9_]{5,32}$/.test(username))throw new Error("Invalid TELEGRAM_BOT_USERNAME");
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error("TELEGRAM_BOT_TOKEN missing/invalid");
 if(process.env.PAYMENTS_ENABLED==="true"||process.env.DELIVERY_ENABLED==="true")
  throw new Error("This MVP deliberately disables payment and license fulfillment.");
 connectDb();await initDb();
 http.createServer((req,res)=>{
  if(req.url!=="/health"){res.writeHead(404);res.end("not_found");return;}
  res.writeHead(200,{"Content-Type":"application/json"});
  res.end(JSON.stringify({ok:true,service:"counterframe-telegram-bot",payments_enabled:false,delivery_enabled:false}));
 }).listen(port,"0.0.0.0");
 await installCommands();
 let offset=await getOffset();
 console.info("Counter-Frame Telegram menus ready; payments disabled.");
 while(true){
  try{
   const updates=await api("getUpdates",{offset,timeout:25,limit:20,allowed_updates:["message","callback_query"]},35000);
   for(const update of updates){
    try{await handleUpdate(update);}catch(error){console.error("Telegram update",update.update_id,error?.message||error);}
    offset=Math.max(offset,Number(update.update_id)+1);
    await saveOffset(offset);
   }
  }catch(error){
   console.error("Telegram polling",error?.message||error);
   await new Promise(resolve=>setTimeout(resolve,3000));
  }
 }
}
main().catch(error=>{console.error("Bot startup failed:",error?.message||error);process.exit(1);});
