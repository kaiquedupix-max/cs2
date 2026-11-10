import net from "node:net";

// Server-side IP country lookup. Fail closed to INTL: an unknown/non-BR IP
// must never unlock BRL pricing. Only trust proxy headers when configured.
const cache=new Map();
const CACHE_TTL_MS=4*60*60*1000;
const MAX_CACHE=2500;
function ipAddress(value) {
  let candidate=String(value||"").split(",")[0].trim();
  if(candidate.startsWith("::ffff:"))candidate=candidate.slice(7);
  if(candidate.startsWith("[")&&candidate.includes("]"))candidate=candidate.slice(1,candidate.indexOf("]"));
  return net.isIP(candidate)?candidate:null;
}
export function visitorIp(req) {
  if(process.env.GEO_TRUST_CF==="true"){
    const cloudflare=ipAddress(req.headers?.["cf-connecting-ip"]);
    if(cloudflare)return cloudflare;
  }
  if(process.env.GEO_TRUST_PROXY==="true"){
    const forwarded=ipAddress(req.headers?.["x-forwarded-for"]);
    if(forwarded)return forwarded;
  }
  return ipAddress(req.socket?.remoteAddress);
}
function isPublicIp(ip){
  if(!ip)return false;
  if(net.isIP(ip)===4){
    const octets=ip.split(".").map(Number);
    if(octets[0]===0||octets[0]===10||octets[0]===127||octets[0]>=224)return false;
    if(octets[0]===169&&octets[1]===254)return false;
    if(octets[0]===172&&octets[1]>=16&&octets[1]<=31)return false;
    if(octets[0]===192&&octets[1]===168)return false;
    if(octets[0]===100&&octets[1]>=64&&octets[1]<=127)return false;
    return true;
  }
  return net.isIP(ip)===6 && ip!=="::1" && !/^f[cd]/i.test(ip) && !/^fe[89ab]/i.test(ip);
}
export async function visitorCountry(req) {
  // CF-IPCountry is only reliable when direct origin traffic is blocked
  // and the incoming header was set by Cloudflare.
  if(process.env.GEO_TRUST_CF==="true"){
    const country=String(req.headers?.["cf-ipcountry"]||"").toUpperCase();
    if(/^[A-Z]{2}$/.test(country)&&!["XX","T1"].includes(country))
      return country;
  }
  const ip=visitorIp(req);
  if(!isPublicIp(ip))return null;
  const now=Date.now();
  const cached=cache.get(ip);
  if(cached&&cached.expires>now)return cached.country;
  let country=null;
  try{
    const response=await fetch(
      "https://free.freeipapi.com/api/v1/json/"+encodeURIComponent(ip),
      {signal:AbortSignal.timeout(2300),headers:{"Accept":"application/json"}}
    );
    if(response.ok){
      const data=await response.json();
      const result=String(data?.countryCode||"").toUpperCase();
      if(/^[A-Z]{2}$/.test(result))country=result;
    }
  }catch{
    // Do not infer Brazil from language, cookies, timezone or user input.
  }
  if(cache.size>=MAX_CACHE)cache.delete(cache.keys().next().value);
  cache.set(ip,{country,expires:now+(country?CACHE_TTL_MS:60_000)});
  return country;
}
export async function visitorMarket(req) {
  const country=await visitorCountry(req);
  return {market:country==="BR"?"BR":"INTL",country,geolocated:Boolean(country)};
}
