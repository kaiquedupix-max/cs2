#include <cassert>
#include <cmath>
#include <iostream>
#include "Protocol.h"
#include "InputMath.h"
int main() {
 using namespace legit;
 static_assert(sizeof(Config)==2132 && sizeof(Shared)==2696);
 static_assert(offsetof(Shared,inputState)==2144 && offsetof(Shared,heartbeat)==2176);
 static_assert(offsetof(Shared,aimPitch)==2160 && offsetof(Shared,aimExpires)==2168);
 for(float old : {-179.f,-90.f,0.f,90.f,179.f}) for(float target : {-179.f,-90.f,0.f,90.f,179.f}) {
  auto move = math::rotate({.4f,-.3f},old,target);
  float a=old*math::Pi/180, b=target*math::Pi/180;
  float x=.4f*std::cos(a)+.3f*std::sin(a), y=.4f*std::sin(a)-.3f*std::cos(a);
  float nx=move.forward*std::cos(b)-move.left*std::sin(b), ny=move.forward*std::sin(b)+move.left*std::cos(b);
  if(std::abs(x-nx)>.0001f||std::abs(y-ny)>.0001f) return 1;
 }
 for(int parity : {0,1}) {
  auto move=math::strafe(300,0,0,parity);
  if(!std::isfinite(move.forward)||!std::isfinite(move.left)||std::abs(move.forward)>1||std::abs(move.left)>1) return 2;
 }
 if(std::abs(math::spin(123456,720))>180) return 3;
 std::cout << "PASS: C++/C# protocol layout, movement preservation under spin, bounded air movement and angles.\n";
}
