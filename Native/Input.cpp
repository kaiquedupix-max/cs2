#include <windows.h>
#include <safetyhook.hpp>
#include <algorithm>
#include <cmath>
#include <cstring>
#include <optional>
#include <span>
#include <vector>
#include "Protocol.h"
#include "InputMath.h"
#include "cs_usercmd.pb.h"
#include "game/module.h"
#include "game/pattern.h"
#include "sdk/client/CCSPlayerController.h"
#include "sdk/client/C_CSPlayerPawn.h"
#include "sdk/client/C_CSWeaponBase.h"

namespace legit {
namespace {
Shared* shared{};
safetyhook::InlineHook createMove;
using Construct = void*(*)(void*, int);
using GetCmd = void*(*)(void*, int);
using GetView = float*(*)(void*, int);
Construct construct{}; GetCmd getCmd{}; GetView getView{};
void** arrayGlobal{}; int sequenceOffset{};
void (*thirdOn)(){}; void (*thirdOff)(){};
bool thirdActive{};
bool jumpHeld{};
struct Buttons { void* table; std::uint64_t down, changed, scroll; };
struct Cmd { void* table; std::int64_t number; CSGOUserCmdPB pb; Buttons buttons; char pad[8]; double lastServerTime; bool predicted; int flag, type; };
static_assert(sizeof(Cmd) == 0x98);
static_assert(offsetof(Cmd, buttons) == 0x58);
bool executable(std::uintptr_t p) {
 const auto text = oc::sectionOf(oc::GameModule::Client, ".text");
 const auto begin = reinterpret_cast<std::uintptr_t>(text.data());
 return p >= begin && p < begin + text.size();
}
std::uintptr_t relative(const unsigned char* p, int disp, int length) {
 std::int32_t value{}; std::memcpy(&value, p + disp, 4);
 return reinterpret_cast<std::uintptr_t>(p) + length + value;
}
void button(Cmd& cmd, CBaseUserCmdPB& base, std::uint64_t bit, bool down) {
 const bool before = (cmd.buttons.down & bit) != 0;
 if (down) cmd.buttons.down |= bit; else cmd.buttons.down &= ~bit;
 if (before != down) cmd.buttons.changed |= bit;
 cmd.buttons.scroll &= ~bit;
 auto* pb = const_cast<CInButtonStatePB*>(&base.buttons_pb());
 pb->set_buttonstate1(cmd.buttons.down); pb->set_buttonstate2(cmd.buttons.changed); pb->set_buttonstate3(cmd.buttons.scroll);
}
void setAngles(CMsgQAngle& angle, float pitch, float yaw) {
 angle.set_x(std::clamp(pitch, -89.f, 89.f)); angle.set_y(math::yaw(yaw)); angle.set_z(0);
}
void process(void* input) {
 if (!shared || !shared->focused || GetTickCount64() - shared->heartbeat > 1500) return;
 const Config cfg = shared->config;
 MemoryBarrier();
 if (cfg.generation & 1 || cfg.generation != shared->config.generation) return;
 auto* pawn = CCSPlayerController::getLocalPawn();
 if (!pawn || cfg.healthOffset == 0 || *reinterpret_cast<int*>(reinterpret_cast<char*>(pawn) + cfg.healthOffset) <= 0) return;
 const bool menu = shared->viewOpen != 0;
 const bool wantedThird = cfg.thirdperson != 0;
 if (thirdOn && thirdOff && wantedThird != thirdActive) { if (wantedThird) thirdOn(); else thirdOff(); thirdActive = wantedThird; }
 if (wantedThird && thirdActive) {
  // Validated against the two native third-person console callbacks, not an old SDK offset.
  const float* camera = getView(input, 0);
  auto* third = reinterpret_cast<float*>(static_cast<char*>(input) + 0x230);
  third[0] = camera[0]; third[1] = camera[1]; third[2] = std::clamp(cfg.thirdDistance, 40.f, 250.f);
 }
 if (menu) return;
 auto* controller = CCSPlayerController::getLocal();
 const auto index = CCSPlayerController::getLocalIndex();
 if (!controller || !index) return;
 void* array = construct(*arrayGlobal, static_cast<int>(index) - 1);
 if (!array) return;
 const int sequence = *reinterpret_cast<int*>(static_cast<char*>(array) + sequenceOffset);
 auto* cmd = static_cast<Cmd*>(getCmd(controller, sequence));
 if (!cmd || static_cast<int>(cmd->number) != sequence || !cmd->pb.has_base()) return;
 auto* base = const_cast<CBaseUserCmdPB*>(&cmd->pb.base());
 if (!base->has_viewangles() || !base->has_buttons_pb() || cmd->pb.input_history_size() < 0 || cmd->pb.input_history_size() > 128) return;
 const auto& angle = base->viewangles();
 if (!std::isfinite(angle.x()) || !std::isfinite(angle.y()) || std::abs(angle.x()) > 90 || std::abs(angle.y()) > 720) return;
 shared->inputState |= 2;
 const int moveType = cfg.moveTypeOffset ? *reinterpret_cast<unsigned char*>(reinterpret_cast<char*>(pawn) + cfg.moveTypeOffset) : 0;
 if (moveType == 8 || moveType == 9) return;
 const auto flags = *reinterpret_cast<unsigned*>(reinterpret_cast<char*>(pawn) + cfg.flagsOffset);
 const bool space = (GetAsyncKeyState(VK_SPACE) & 0x8000) != 0;
 if (cfg.bhop && space) {
  const bool grounded = (flags & 1) != 0;
  const bool jump = grounded && !jumpHeld;
  button(*cmd, *base, 2, jump); jumpHeld = jump;
  // Remove stale jump edges produced by the physical held key. Keep analog subticks.
  for (int i=0;i<base->subtick_moves_size();++i) {
   auto* step = base->mutable_subtick_moves(i);
   if (step->button() == 2) { step->set_button(0); step->set_pressed(false); }
  }
  if (cfg.strafe && !grounded && cfg.velocityOffset) {
   const auto* v = reinterpret_cast<float*>(reinterpret_cast<char*>(pawn) + cfg.velocityOffset);
   float desired = angle.y();
   const float f = base->forwardmove(), l = base->leftmove();
   if (std::abs(f) + std::abs(l) > .1f) desired += std::atan2(l, f) * 180.f / math::Pi;
   const auto movement = math::strafe(v[0], v[1], desired, sequence);
   const auto fixed = math::rotate(movement, desired, angle.y());
   base->set_forwardmove(fixed.forward); base->set_leftmove(fixed.left);
  }
 } else jumpHeld = false;
 float pitch = angle.x(), yaw = angle.y();
 bool changed = false;
 bool movementChanged = false;
 const auto aimGeneration = shared->aimGeneration;
 auto aimFlags = shared->aimValid;
 const float aimPitch = shared->aimPitch, aimYaw = shared->aimYaw;
 const auto aimExpires = shared->aimExpires;
 MemoryBarrier();
 if ((aimGeneration & 1) || aimGeneration != shared->aimGeneration) aimFlags = 0;
 if ((aimFlags & 5) == 5 && GetTickCount64() <= aimExpires && cfg.velocityOffset) {
  const auto* v = reinterpret_cast<float*>(reinterpret_cast<char*>(pawn) + cfg.velocityOffset);
  if (std::hypot(v[0], v[1]) > 15) {
   movementChanged = true;
   const float a = angle.y() * math::Pi / 180.f;
   base->set_forwardmove(std::clamp((-v[0]*std::cos(a)-v[1]*std::sin(a))/30.f, -1.f, 1.f));
   base->set_leftmove(std::clamp((v[0]*std::sin(a)-v[1]*std::cos(a))/30.f, -1.f, 1.f));
  }
 }
 if ((cfg.silent & 1) && (aimFlags & 1) && GetTickCount64() <= aimExpires) {
  pitch = aimPitch; yaw = aimYaw;
  changed = std::isfinite(pitch) && std::isfinite(yaw);
  if ((aimFlags & 2) && changed) button(*cmd, *base, 1, true);
 } else if (cfg.spin && !(cmd->buttons.down & (1 | 32 | 2048))) {
  bool grenade = false;
  if (auto* ws = pawn->m_pWeaponServices()) if (auto* weapon = ws->m_hActiveWeapon().get()) {
   const auto def = weapon->getItem().m_iItemDefinitionIndex(); grenade = def >= 43 && def <= 49;
  }
  if (!grenade) { yaw = math::spin(GetTickCount64(), cfg.spinSpeed); pitch = 89; changed = true; }
 }
 if (changed) {
  const auto movement = math::rotate({base->forwardmove(), base->leftmove()}, angle.y(), yaw);
  base->set_forwardmove(movement.forward); base->set_leftmove(movement.left);
  setAngles(*const_cast<CMsgQAngle*>(&angle), pitch, yaw);
  for (int i=0;i<cmd->pb.input_history_size();++i) {
   auto* entry = cmd->pb.mutable_input_history(i);
   if (entry->has_view_angles()) setAngles(*const_cast<CMsgQAngle*>(&entry->view_angles()), pitch, yaw);
  }
 }
 if (changed || movementChanged || (cfg.bhop && space)) {
  button(*cmd, *base, 8, base->forwardmove() > .01f); button(*cmd, *base, 16, base->forwardmove() < -.01f);
  button(*cmd, *base, 512, base->leftmove() > .01f); button(*cmd, *base, 1024, base->leftmove() < -.01f);
 }
}
void guarded(void* input) {
 __try { process(input); }
 __except(EXCEPTION_EXECUTE_HANDLER) { if(shared) shared->inputState |= 0x80000000; }
}
void detour(void* input, int slot, bool active) {
 createMove.original<void(*)(void*, int, bool)>()(input, slot, active);
 if (shared && !(shared->inputState & 0x80000000) && slot == 0 && active) guarded(input);
}
}
void updateInputLifecycle() {
 if (shared && thirdActive && thirdOff && (!shared->config.thirdperson || GetTickCount64()-shared->heartbeat > 1500)) {
  thirdOff(); thirdActive = false;
 }
}
bool installInput(Shared* state) {
 shared = state;
 const auto client = oc::baseOf(oc::GameModule::Client);
 if (!client || !state->config.inputRva) return false;
 void* input = reinterpret_cast<void*>(client + state->config.inputRva);
 auto* entry = reinterpret_cast<unsigned char*>((*reinterpret_cast<void***>(input))[5]);
 if (!executable(reinterpret_cast<std::uintptr_t>(entry)) || entry[0] != 0x85 || entry[1] != 0xD2) return false;
 // Decode the CURRENT CreateMove's controller->input-array->sequence->command dispatch.
 const std::vector<int> pat = {0x48,0x8B,0x0D,-1,-1,-1,-1,0xE8,-1,-1,-1,-1,0x48,0x8B,0xCF,0x4C,0x8B,0xF8,0x44,0x8B,0xB0,-1,-1,-1,-1,0x41,0x8B,0xD6,0xE8,-1,-1,-1,-1};
 unsigned char* dispatch{};
 for (int i=0;i<512-static_cast<int>(pat.size());++i) {
  bool matches = true; for (size_t j=0;j<pat.size();++j) if (pat[j]>=0 && entry[i+j]!=pat[j]) {matches=false;break;}
  if(matches) {if(dispatch) return false; dispatch=entry+i;}
 }
 if (!dispatch) return false;
 arrayGlobal = reinterpret_cast<void**>(relative(dispatch,3,7));
 construct = reinterpret_cast<Construct>(relative(dispatch+7,1,5));
 getCmd = reinterpret_cast<GetCmd>(relative(dispatch+28,1,5));
 std::memcpy(&sequenceOffset,dispatch+21,4);
 if(sequenceOffset<0 || sequenceOffset>0x10000 || !executable(reinterpret_cast<std::uintptr_t>(construct)) || !executable(reinterpret_cast<std::uintptr_t>(getCmd))) return false;
 const auto view = oc::findPattern(oc::GameModule::Client,"4C 8B C1 85 D2 74 ? 48 8D 05");
 if(!view) return false; getView = reinterpret_cast<GetView>(*view);
 const auto on = oc::findPattern(oc::GameModule::Client,"48 83 EC 38 48 8B 0D ? ? ? ? 48 8D 54 24 40 48 8B 01 FF 90 10 03 00 00 83 7C 24 40 00 0F 85");
 const auto off = oc::findPattern(oc::GameModule::Client,"48 83 EC 28 48 8B 0D ? ? ? ? 48 8D 54 24 30 48 8B 01 FF 90 10 03 00 00 83 7C 24 30 00 75 ? 48 8B 05 ? ? ? ? C6 80 29 02 00 00 00 C7 80 A8 06 00 00 00 00 00 00 8B 4C 24 30 E8");
 if(on && off) {thirdOn = reinterpret_cast<void(*)()>(*on); thirdOff = reinterpret_cast<void(*)()>(*off);state->inputState|=4;}
 auto hook = safetyhook::InlineHook::create(entry, &detour);
 if(!hook) return false; createMove=std::move(*hook);state->inputState|=1;return true;
}
}
