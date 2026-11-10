import test from "node:test";
import assert from "node:assert/strict";
import { PLANS, planById, displayPrice, parseTelegramStart } from "../src/catalog.js";
import { LANGS, normalizeLang, t } from "../src/strings.js";

test("30 day pricing is BRL 35 and USD 10", () => {
  assert.equal(planById("d30").brlCents, 3500);
  assert.equal(planById("d30").usdCents, 1000);
  assert.equal(displayPrice(planById("d30"),"BR"),"R$ 35,00");
  assert.equal(displayPrice(planById("d30"),"INTL"),"$10.00 USD");
});
test("catalog only has 1, 7, 15, 30-day Counter-Frame plans",()=>{
  assert.deepEqual(PLANS.map(p=>p.days),[1,7,15,30]);
});
test("deep links validate",()=>{
  assert.deepEqual(parseTelegramStart("cf_ios_d30"),{type:"catalog",platform:"ios",planId:"d30"});
  assert.deepEqual(parseTelegramStart("ref_123"),{type:"referral",userId:"123"});
  assert.equal(parseTelegramStart("cf_ios_d999"),null);
});
test("all four languages are available",()=>{
  assert.deepEqual(LANGS,["pt","en","es","ru"]);
  assert.equal(normalizeLang("pt-BR"),"pt");
  assert.ok(t("ru","iosWarning").includes("предзаказ"));
  for(const lang of LANGS) {
    assert.ok(t(lang,"featureList").includes("ESP"));
    assert.ok(t(lang,"featureList").includes("FOV"));
    assert.ok(t(lang,"features").length>3);
  }
});
