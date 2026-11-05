#include <windows.h>
#include <array>
#include <cstring>
#include <optional>
#include <unordered_map>
#include "Protocol.h"
#include "CosmeticRefresh.h"
#include "core/log.h"
#include "game/module.h"
#include "game/pattern.h"
#include "game/GameEventHandler.h"
#include "features/changer/Changer.h"
#include "features/changer/loadout/loadout.h"
#include "features/changer/inventory/socache.h"
#include "sdk/client/CCSPlayerController.h"
#include "sdk/client/CCSInventoryManager.h"
#include "sdk/client/C_CSPlayerPawn.h"
#include "sdk/client/C_CSWeaponBase.h"
#include "sdk/client/CModelState.h"
namespace legit {
namespace {
struct SceneNode {
 SDK_CLASS(CGameSceneNode);
 SCHEMA_FIELD(SceneNode*, m_pChild);
 SCHEMA_FIELD(SceneNode*, m_pNextSibling);
 SCHEMA_FIELD(C_BaseEntity*, m_pOwner);
};
struct EntityFields {
 SDK_CLASS(C_BaseEntity);
 SCHEMA_FIELD(SceneNode*, m_pGameSceneNode);
 SCHEMA_FIELD(int, m_iHealth);
};
struct Skeleton { SDK_CLASS(CSkeletonInstance); SCHEMA_FIELD(CModelState,m_modelState); };
CModelState* state(C_BaseEntity* e) {
 auto* n = reinterpret_cast<EntityFields*>(e)->m_pGameSceneNode();
 return n ? &reinterpret_cast<Skeleton*>(n)->m_modelState() : nullptr;
}
using SetModel = void(*)(void*,const char*);
using Subclass = void(*)(void*);
using Clear = void(*)(void*,bool);
using Rebuild = void(*)(void*,bool);
SetModel setModel{}; Subclass subclass{}; Clear clear{}; Rebuild rebuild{};
int component{}, countA{}, countB{};
bool resolved{}, faulted{};
std::uint32_t lastPawn{};
std::unordered_map<std::uint32_t,SkinRefreshLatch> applied;
void invalidate(IGameEvent& event) { if (event.isLocalPlayer("userid")) { applied.clear(); faulted=false; oc::changer::requestSync(); } }
void roundStart(IGameEvent&) { applied.clear(); faulted=false; oc::changer::requestSync(); }
oc::GameEventHandler death{"player_death",invalidate}, spawn{"player_spawn",invalidate}, round{"round_start",roundStart};
std::uintptr_t relative(const std::byte* code,int displacement,int next) {
 std::int32_t value; std::memcpy(&value,code+displacement,4);
 return reinterpret_cast<std::uintptr_t>(code)+next+value;
}
void resolve() {
 if (resolved) return; resolved=true;
 auto model=oc::findPattern(oc::GameModule::Client,"40 53 48 83 EC ? 48 8B D9 4C 8B C2 48 8B 0D ? ? ? ? 48 8D 54 24 40");
 auto sub=oc::findPattern(oc::GameModule::Client,"4C 8B DC 53 48 81 EC ? ? ? ? 48 8B 41");
 if(model) setModel=reinterpret_cast<SetModel>(*model);
 if(sub) subclass=reinterpret_cast<Subclass>(*sub);
 auto command=oc::findPattern(oc::GameModule::Client,"48 83 EC ? E8 ? ? ? ? 48 85 C0 0F 84 ? ? ? ? 48 8B 10");
 if(!command) return;
 auto text=oc::sectionOf(oc::GameModule::Client,".text");
 auto data=oc::sectionOf(oc::GameModule::Client,".rdata");
 const auto begin=reinterpret_cast<std::uintptr_t>(text.data()), end=begin+text.size();
 const char name[]="regenerate_weapon_skins";
 const std::byte* named{};
 for(std::size_t i=0;i+sizeof(name)<=data.size();++i) if(std::memcmp(data.data()+i,name,sizeof(name))==0) { if(named) return; named=data.data()+i; }
 if(!named) return;
 bool registered=false;
 for(std::size_t i=0;i+80<text.size();++i) {
  const auto* c=text.data()+i;
  const unsigned char head[]={0x48,0x8D,0x05}; const unsigned char save[]={0x48,0x89,0x44,0x24,0x30};
  if(std::memcmp(c,head,3)||std::memcmp(c+7,save,5)||relative(c,3,7)!=*command) continue;
  for(int j=12;j<72;++j) {
   const unsigned char lea[]={0x48,0x8D,0x15};
   if(!std::memcmp(c+j,lea,3)&&relative(c+j,3,7)==reinterpret_cast<std::uintptr_t>(named)) registered=true;
  }
 }
 if(!registered) return;
 const int pattern[]={0x83,0xBB,-1,-1,-1,-1,0,0x7F,9,0x83,0xBB,-1,-1,-1,-1,0,0x7E,0x18,0x48,0x8D,0x8B,-1,-1,-1,-1,0xB2,1,0xE8,-1,-1,-1,-1,0x33,0xD2,0x48,0x8B,0xCB,0xE8,-1,-1,-1,-1};
 const auto* body=reinterpret_cast<const std::byte*>(*command);
 const std::byte* match{};
 for(int i=0;i+42<=0x150;++i) {
  bool yes=true; for(int j=0;j<42;++j) if(pattern[j]>=0 && static_cast<unsigned char>(body[i+j])!=pattern[j]) {yes=false;break;}
  if(yes) {if(match) return; match=body+i;}
 }
 if(!match) return;
 std::memcpy(&component,match+21,4);std::memcpy(&countA,match+2,4);std::memcpy(&countB,match+11,4);
 auto a=relative(match,28,32),b=relative(match,38,42);
 if(component<=0||component>0x10000||countA<=component||countB<=component||countA>component+0x1000||countB>component+0x1000||a<begin||a>=end||b<begin||b>=end) return;
 clear=reinterpret_cast<Clear>(a); rebuild=reinterpret_cast<Rebuild>(b);
}
C_BaseEntity* hudFor(C_CSPlayerPawn& pawn,C_CSWeaponBase& weapon) {
 auto* arms=pawn.m_hHudModelArms().get(); if(!arms) return nullptr;
 auto* node=reinterpret_cast<EntityFields*>(arms)->m_pGameSceneNode(); if(!node) return nullptr;
 auto* child=node->m_pChild();
 for(int i=0;child&&i<128;++i,child=child->m_pNextSibling()) {
  auto* owner=child->m_pOwner();
  if(owner&&owner->m_hOwnerEntity().get()==&weapon) return owner;
 }
 return nullptr;
}
void mesh(C_BaseEntity* e,std::uint64_t mask) {
 if(auto* s=state(e)) {
  auto other=mask==1?2ULL:1ULL;
  CModelState::SkeletonMeshGroupMaskChanged(s,e,&other);
  CModelState::SkeletonMeshGroupMaskChanged(s,e,&mask);
 }
}
void maintain() {
 auto* pawn=CCSPlayerController::getLocalPawn();
 if(!pawn||reinterpret_cast<EntityFields*>(pawn)->m_iHealth()<=0) { applied.clear(); lastPawn=0; return; }
 if(lastPawn!=pawn->getHandle()) {applied.clear();lastPawn=pawn->getHandle();faulted=false;}
 if(faulted) return;
 const auto items=oc::changer::Changer::get().loadout();
 if(items->Items.empty()) {applied.clear();return;}
 const auto& cat=oc::changer::Changer::get().catalog();
 const auto team=pawn->m_iTeamNum();
 if(auto* gloves=items->find(team,cat.Ids.Gloves,cat.Ids)) {
  auto& view=pawn->m_EconGloves();
  if(view.getItemId()!=oc::changer::ourItemId(*gloves,cat.Ids)||view.m_iItemDefinitionIndex()!=gloves->Definition) {
   view.setView(gloves->Definition,oc::changer::ourItemId(*gloves,cat.Ids),CCSInventoryManager::get()->getLocalAccountId(),oc::changer::qualityOf(*gloves,cat.Ids),{});
   pawn->m_bNeedToReApplyGloves()=true;
  }
 }
 for(auto* weapon:pawn->getWeapons()) {
  auto& view=weapon->getItem();
  auto definition=view.m_iItemDefinitionIndex();
  auto* record=items->byDefinition(team,definition);
  if(!record&&(definition==42||definition==59||(definition>=500&&definition<=526))) record=items->find(team,cat.Ids.Knife,cat.Ids);
  if(!record) continue;
  const bool changed=view.getItemId()!=oc::changer::ourItemId(*record,cat.Ids)||definition!=record->Definition;
  if(changed) view.setView(record->Definition,oc::changer::ourItemId(*record,cat.Ids),CCSInventoryManager::get()->getLocalAccountId(),oc::changer::qualityOf(*record,cat.Ids),{});
  auto* hud=hudFor(*pawn,*weapon); if(!hud) continue;
  auto* worldState=state(weapon); auto* hudState=state(hud); if(!worldState||!hudState) continue;
  bool legacy=record->Legacy; if(auto* paint=cat.paint(record->Paint)) legacy=paint->LegacyModel;
  SkinRefreshKey key{record->Definition,record->Paint,record->Seed,hud->getHandle(),record->Wear,legacy,record->StatTrak};
  resolve();
  bool empty=false;
  if(clear&&rebuild) empty=*reinterpret_cast<int*>(reinterpret_cast<char*>(weapon)+countA)==0&&*reinterpret_cast<int*>(reinterpret_cast<char*>(weapon)+countB)==0;
  auto& latch=applied[weapon->getHandle()];
  if(!changed&&!latch.wants(key,empty,GetTickCount64())) continue;
  if(record->Slot==cat.Ids.Knife) if(auto* item=cat.item(record->Definition)) {
   weapon->setSubclass(item->Name.c_str());
   if(subclass) subclass(weapon);
   if(setModel) {setModel(weapon,item->Model.c_str());setModel(hud,item->Model.c_str());}
  }
  const std::uint64_t mask=legacy?2:1;
  mesh(weapon,mask);mesh(hud,mask);
  if(clear&&rebuild) {clear(reinterpret_cast<char*>(weapon)+component,true);rebuild(weapon,true);}
  mesh(weapon,mask);mesh(hud,mask);
  latch.completed(key,GetTickCount64());
  OC_LOG("cosmetics","reapplied pawn {} weapon {} hud {} definition {} paint {}",lastPawn,weapon->getHandle(),hud->getHandle(),record->Definition,record->Paint);
 }
}
void logFault() { OC_LOG("cosmetics","maintenance stopped after incompatible game state; retries resume on respawn"); }
}
void maintainCosmetics() {
 __try { maintain(); }
 __except(EXCEPTION_EXECUTE_HANDLER) { faulted=true; logFault(); }
}
}
