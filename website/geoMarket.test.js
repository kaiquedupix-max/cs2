import test from "node:test";
import assert from "node:assert/strict";
import { visitorMarket,visitorIp } from "./geoMarket.js";

function request(headers={},remoteAddress="127.0.0.1"){
  return {headers,socket:{remoteAddress}};
}
test("Brazil can use BRL only when trusted geolocation verifies BR",async()=>{
  const before=process.env.GEO_TRUST_CF;
  process.env.GEO_TRUST_CF="true";
  try{
    const br=await visitorMarket(request({"cf-ipcountry":"BR"}));
    assert.deepEqual(br,{market:"BR",country:"BR",geolocated:true});
    const us=await visitorMarket(request({"cf-ipcountry":"US"}));
    assert.equal(us.market,"INTL");
    const unknown=await visitorMarket(request({"cf-ipcountry":"XX"}));
    assert.equal(unknown.market,"INTL");
  }finally{
    if(before===undefined)delete process.env.GEO_TRUST_CF;
    else process.env.GEO_TRUST_CF=before;
  }
});
test("untrusted forwarded headers do not unlock Brazil pricing",async()=>{
  const trustedCf=process.env.GEO_TRUST_CF;
  const trustedProxy=process.env.GEO_TRUST_PROXY;
  delete process.env.GEO_TRUST_CF;
  delete process.env.GEO_TRUST_PROXY;
  try{
    const spoof=request({"cf-ipcountry":"BR","x-forwarded-for":"200.160.2.3"});
    assert.equal(visitorIp(spoof), "127.0.0.1");
    assert.equal((await visitorMarket(spoof)).market,"INTL");
  }finally{
    if(trustedCf!==undefined)process.env.GEO_TRUST_CF=trustedCf;
    if(trustedProxy!==undefined)process.env.GEO_TRUST_PROXY=trustedProxy;
  }
});
test("configured proxy forwards public IP for country lookup",async()=>{
  const trustedProxy=process.env.GEO_TRUST_PROXY;
  const oldFetch=globalThis.fetch;
  delete process.env.GEO_TRUST_CF;
  process.env.GEO_TRUST_PROXY="true";
  globalThis.fetch=async url=>{
    assert.match(String(url),/\/api\/v1\/json\/203\.0\.113\.7$/);
    return {ok:true,json:async()=>({countryCode:"BR"})};
  };
  try{
    assert.equal(visitorIp(request({"x-forwarded-for":"203.0.113.7"})), "203.0.113.7");
    const geo=await visitorMarket(request({"x-forwarded-for":"203.0.113.7"}));
    assert.equal(geo.market,"BR");
  }finally{
    globalThis.fetch=oldFetch;
    if(trustedProxy===undefined)delete process.env.GEO_TRUST_PROXY;else process.env.GEO_TRUST_PROXY=trustedProxy;
  }
});
