#include <windows.h>
#include <array>
#include <string>
#include "Protocol.h"
#include "game/GameEventHandler.h"
#include "sdk/client/client.h"
#include "sdk/panorama/CPanel2D.h"
#include "sdk/panorama/CUIEngine.h"
#include "sdk/panorama/IPanoramaUIEngine.h"
namespace legit {
namespace {
Shared* shared{};
std::uint64_t last{};
std::uint32_t next{};
bool precision{};
bool console(const std::string& command) {
 auto* panel = client::MainMenu();
 if (!panel || !panel->UIPanel()) return false;
 const std::string script = "GameInterfaceAPI.ConsoleCommand('" + command + "');";
 IPanoramaUIEngine::get()->AccessUIEngine()->RunScript(panel->UIPanel(), script.c_str(), "legit-round-command", 1);
 return true;
}
void send(IGameEvent&) {
 if (shared && shared->config.silent & 2) updatePrecision(true, true);
 if (!shared || !shared->config.chatspam || !shared->focused || GetTickCount64() - shared->heartbeat > 1500) return;
 const auto now = GetTickCount64(); if (last && now-last < 2000) return;
 static constexpr std::array<const char*, 3> messages = {
  "legitbaratinho.xyz - Acesse e compre!",
  "Conheca legitbaratinho.xyz - tem um dia gratis!",
  "Acesse legitbaratinho.xyz e confira o dia gratis!"
 };
 if (console(std::string("say ") + messages[next % messages.size()])) { ++next; last = now; }
}
oc::GameEventHandler start{"round_start", send};
oc::GameEventHandler end{"round_end", send};
}
void installRoundMessages(Shared* state) { shared = state; state->inputState |= 8; }
void updatePrecision(bool enabled, bool force) {
 if ((!force && enabled == precision) || !shared || GetTickCount64() - shared->heartbeat > 1500) return;
 if (console(enabled ? "weapon_accuracy_nospread 1" : "weapon_accuracy_nospread 0")) precision = enabled;
}
}
