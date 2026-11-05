#include <windows.h>
#include <cstring>
#include <string>
#include <atomic>
#include "Protocol.h"
#include "app/app.h"
#include "app/features.h"
#include "core/feature.h"
#include "game/link.h"
#include "game/hook.h"
#include "sdk/sdl3/SDL.h"
#include "features/changer/Changer.h"
#include "features/changer/catalog/catalog.h"
#include "features/changer/loadout/loadout.h"

namespace {
legit::Shared* shared{};
std::atomic<bool> running{};
std::atomic<bool> scheduled{};
std::uint32_t applied{};
legit::Config previousCosmetics{};
bool hasCosmetics{};
void message(std::uint32_t state, const std::string& text) {
 if (!shared) return;
 strncpy_s(shared->message, text.c_str(), _TRUNCATE);
 shared->state = state;
}
void sync(void*) {
 scheduled = false;
 if (!shared || !running) return;
 legit::updateInputLifecycle();
 legit::Config cfg = shared->config;
 MemoryBarrier();
 if (cfg.generation == 0 || cfg.generation & 1 || cfg.generation != shared->config.generation || cfg.magic != legit::Magic || cfg.version != legit::Version || cfg.size != sizeof(cfg) || cfg.count > legit::MaxChoices || applied == cfg.generation) return;
 legit::updatePrecision((cfg.silent & 2) != 0);
 if (hasCosmetics && cfg.automatic == previousCosmetics.automatic && cfg.count == previousCosmetics.count &&
     std::memcmp(cfg.choices, previousCosmetics.choices, sizeof(cfg.choices)) == 0) {
  applied = cfg.generation; shared->appliedGeneration = applied; return;
 }
 auto& changer = oc::changer::Changer::get();
 const auto& cat = changer.catalog();
 auto old = changer.loadout();
 for (const auto& item : old->Items) changer.unequip(item);
 std::string errors;
 if (cfg.automatic) for (std::uint32_t i = 0; i < cfg.count; ++i) {
  const auto& choice = cfg.choices[i];
  const auto* item = cat.item(static_cast<std::uint16_t>(choice.definition));
  if (!item) { errors += "Modelo ausente no schema; "; continue; }
  for (auto team : {cat.Ids.Terrorists, cat.Ids.CounterTerrorists}) {
   if ((item->Teams & (1U << team)) == 0) continue;
   oc::changer::ItemRecord record;
   record.Team = team; record.Slot = item->Slot; record.Definition = item->Definition;
   record.Paint = choice.paint; record.Seed = choice.seed; record.Wear = choice.wear;
   record.Legacy = choice.legacy != 0; record.StatTrak = choice.stattrak != 0;
   record.StatTrakCount = choice.counter;
   if (hasCosmetics && record.StatTrak) {
    for (std::uint32_t j=0;j<previousCosmetics.count;++j) {
     const auto& before = previousCosmetics.choices[j];
     if (std::memcmp(&choice,&before,sizeof(choice)) != 0) continue;
     if (auto* held = old->byDefinition(team, record.Definition)) record.StatTrakCount = held->StatTrakCount;
    }
   }
   // The game resolves its localized model/finish name and rarity from SOC.
   // A custom name here would turn the skin name into a name tag.
   if (auto result = changer.equip(record); !result) errors += result.error() + "; ";
  }
 }
 applied = cfg.generation; shared->appliedGeneration = applied;
 previousCosmetics = cfg; hasCosmetics = true;
 message(errors.empty() ? 2 : 3, errors.empty() ? "Inventário local sincronizado. Confira o HUD e os modelos no jogo." : errors);
}
DWORD WINAPI poll(void*) {
 while (shared && running) {
  if (!scheduled.exchange(true)) {
   if (!SDL::RunOnMainThread(sync, nullptr, false)) scheduled = false;
  }
  Sleep(100);
 }
 return 0;
}
void start(void*) {
 const auto missing = oc::resolveLinks();
 if (missing) { message(3, "Não foi possível resolver " + std::to_string(missing) + " links nativos desta versão do CS2."); return; }
 for (auto* feature : oc::features()) if (!feature->start()) { message(3, "Falha ao iniciar módulo nativo: " + std::string(feature->name())); return; }
 if (!oc::installHooks()) { message(3, "Falha ao instalar hooks nativos de cosméticos."); return; }
 running = true; message(1, "Módulo nativo conectado.");
 legit::installInput(shared);
 legit::installRoundMessages(shared);
 if (auto thread = CreateThread(nullptr, 0, poll, nullptr, 0, nullptr)) CloseHandle(thread);
}
}
namespace oc::app {
bool running() { return ::running; }
void unhook() { oc::removeHooks(); }
void stop() { ::running = false; for (auto* feature : features()) feature->stop(); }
}
extern "C" BOOL WINAPI DllMain(HINSTANCE instance, DWORD reason, LPVOID) {
 if (reason != DLL_PROCESS_ATTACH) return TRUE;
 DisableThreadLibraryCalls(instance);
 const auto name = L"Local\\LegitBridge_" + std::to_wstring(GetCurrentProcessId());
 HANDLE mapping = OpenFileMappingW(FILE_MAP_ALL_ACCESS, FALSE, name.c_str());
 if (!mapping) return FALSE;
 shared = static_cast<legit::Shared*>(MapViewOfFile(mapping, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(legit::Shared)));
 CloseHandle(mapping);
 if (!shared || shared->config.magic != legit::Magic || shared->config.version != legit::Version) return FALSE;
 if (!oc::resolveLink(SDL::RunOnMainThreadLink)) { message(3, "SDL_RunOnMainThread indisponível."); return TRUE; }
 SDL::RunOnMainThread(start, nullptr, false);
 return TRUE;
}
