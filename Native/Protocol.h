#pragma once
#include <cstdint>
#include <cstddef>
namespace legit {
constexpr std::uint32_t Magic = 0x3542474c, Version = 1, MaxChoices = 64;
struct Choice { std::uint32_t definition, category, paint, seed; float wear; std::uint32_t legacy, stattrak, counter; };
struct Config {
  std::uint32_t magic, version, size, generation;
  std::uint32_t automatic, count, spin, silent, bhop, strafe, thirdperson, chatspam;
  float spinSpeed, thirdDistance;
  std::uint32_t inputRva, controllerRva, pawnRva, healthOffset, flagsOffset, moveTypeOffset, velocityOffset;
  Choice choices[MaxChoices];
};
struct Shared {
 Config config;
 volatile std::uint32_t state, appliedGeneration, aimGeneration, inputState, viewOpen, focused, aimValid;
 float aimPitch, aimYaw;
 std::uint64_t aimExpires, heartbeat;
 char message[512];
};
static_assert(sizeof(Choice) == 32);
static_assert(sizeof(Config) == 2132);
static_assert(offsetof(Shared, message) == 2184);
bool installInput(Shared*);
void installRoundMessages(Shared*);
void updatePrecision(bool, bool force = false);
void updateInputLifecycle();
}
