#pragma once
#include <algorithm>
#include <cmath>
namespace legit::math {
constexpr float Pi = 3.14159265358979323846f;
inline float yaw(float a) { return std::remainder(a, 360.f); }
inline float spin(unsigned long long ms, float speed) { return yaw(static_cast<float>(ms % 360000ULL) * std::clamp(speed, 1.f, 1440.f) * .001f); }
struct Move { float forward, left; };
inline Move rotate(Move move, float oldYaw, float newYaw) {
 const float d = (oldYaw - newYaw) * Pi / 180.f;
 return {std::clamp(move.forward * std::cos(d) - move.left * std::sin(d), -1.f, 1.f), std::clamp(move.forward * std::sin(d) + move.left * std::cos(d), -1.f, 1.f)};
}
inline Move strafe(float vx, float vy, float view, int parity) {
 const float speed = std::hypot(vx, vy);
 if (speed < 15.f) return {1, 0};
 const float velocityYaw = std::atan2(vy, vx) * 180.f / Pi;
 const float delta = yaw(view - velocityYaw);
 const float ideal = std::atan2(15.f, speed) * 180.f / Pi;
 const float side = std::abs(delta) < ideal ? (parity & 1 ? 1.f : -1.f) : (delta > 0 ? 1.f : -1.f);
 const float wish = velocityYaw + side * (90.f - ideal);
 const float relative = yaw(wish - view) * Pi / 180.f;
 return {std::cos(relative), std::sin(relative)};
}
}
