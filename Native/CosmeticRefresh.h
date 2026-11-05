#pragma once
#include <cstdint>
namespace legit {
struct SkinRefreshKey {
 std::uint32_t definition,paint,seed,hud;
 float wear; bool legacy,stattrak;
 bool operator==(const SkinRefreshKey&) const = default;
};
struct SkinRefreshLatch {
 SkinRefreshKey key{};
 bool valid{}; unsigned attempts{}; std::uint64_t nextRetry{};
 bool wants(const SkinRefreshKey& wanted,bool materialsLost,std::uint64_t now) const {
  if(!valid||key!=wanted) return true;
  return (materialsLost || attempts==1) && attempts<5 && now>=nextRetry;
 }
 void completed(const SkinRefreshKey& wanted,std::uint64_t now) {
  attempts=valid&&key==wanted?attempts+1:1;key=wanted;valid=true;nextRetry=now+1000;
 }
};
}
