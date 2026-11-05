using System.Reflection;
using System.Reflection.Metadata;
using System.Text.RegularExpressions;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Classes
{
    internal class OffsetGetter
    {
        private static readonly Dictionary<string, int> offsets = []; // holds the resolved offsets
        private static readonly HttpClient httpClient = new();
        private static Dictionary<string, Dictionary<string, int>> classOffsets = new();
        private static string _offsetRegex = @"public const nint ([\w\+]+) = (0x[0-9A-Fa-f]+);";

        static OffsetGetter()
        {
            try
            {
                httpClient.Timeout = TimeSpan.FromSeconds(10);
                httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
            }
            catch (Exception e)
            {
                Console.WriteLine($"[OFFSETS FINDER] ERROR: {e.Message}");
            }
        }
        // urls to pull the dumper outputs from
        private const string PrimaryBaseUrl = "https://raw.githubusercontent.com/JulianG59/cs2-off/main/";
        private const string SecondaryBaseUrl = "https://raw.githubusercontent.com/sezzyaep/CS2-OFFSETS/main/";
        private const string OffsetsUrl = PrimaryBaseUrl + "offsets.cs";
        private const string SecondaryOffsetsUrl = SecondaryBaseUrl + "offsets.cs";
        private const string ClientDllUrl = PrimaryBaseUrl + "client_dll.cs";
        private const string SecondaryClientDllUrl = SecondaryBaseUrl + "client_dll.cs";
        private const string ButtonsUrl = PrimaryBaseUrl + "buttons.cs";
        private const string SecondaryButtonsUrl = SecondaryBaseUrl + "buttons.cs";
        private const string Engine2Url = PrimaryBaseUrl + "engine2_dll.cs";
        private const string SecondaryEngine2Url = SecondaryBaseUrl + "engine2_dll.cs";
        private const string AnimationSystemUrl = PrimaryBaseUrl + "animationsystem_dll.cs";
        private const string SecondaryAnimationSystemUrl = SecondaryBaseUrl + "animationsystem_dll.cs";

        private static string OffsetsContent = string.Empty;
        private static string ClientDllContent = string.Empty;
        private static string ButtonsContent = string.Empty;
        private static string Engine2Content = string.Empty;
        private static string AnimationSystemContent = string.Empty;

        public static bool Updated = false;

        private class Offset(string name, string? className = null)
        {
            public string Name { get; } = name;
            public string? ClassName { get; } = className;
        }


        private static readonly Dictionary<string, List<Offset>> FieldNameMappings = new()
        {
            { "dwViewMatrix", new() { new Offset("dwViewMatrix") } },
            { "dwEntityList", new() { new Offset("dwEntityList") } },
            { "dwLocalPlayerPawn", new() { new Offset("dwLocalPlayerPawn") } },
            { "dwLocalPlayerController", new() { new Offset("dwLocalPlayerController") } },
            { "dwViewAngles", new() { new Offset("dwViewAngles") } },
            { "dwGlobalVars", new() { new Offset("dwGlobalVars") } },
            { "dwPlantedC4", new() { new Offset("dwPlantedC4") } },
            { "dwGameRules", new() { new Offset("dwGameRules") } },
            { "dwSensitivity", new() { new Offset("dwSensitivity") } },
            { "dwSensitivity_sensitivity", new() { new Offset("dwSensitivity_sensitivity") } },
            { "dwCSGOInput", new() { new Offset("dwCSGOInput") } },
            { "dwGameEntitySystem", new() { new Offset("dwGameEntitySystem") } },
            { "dwGameEntitySystem_highestEntityIndex", new() { new Offset("dwGameEntitySystem_highestEntityIndex") } },
            { "dwGlowManager", new() { new Offset("dwGlowManager") } },
            { "dwPrediction", new() { new Offset("dwPrediction") } },
            { "dwViewRender", new() { new Offset("dwViewRender") } },
            { "dwWeaponC4", new() { new Offset("dwWeaponC4") } },
            { "attack", new() { new Offset("attack"), new Offset("+attack") } },
            { "jump", new() { new Offset("jump"), new Offset("+jump") } },
            { "left", new() { new Offset("left"), new Offset("+left") } },
            { "right", new() { new Offset("right"), new Offset("+right") } },
            { "forward", new() { new Offset("forward"), new Offset("+forward") } },
            { "m_pCameraServices", new() { new Offset("m_pCameraServices"), new Offset("m_CameraServices") } },
            { "m_iFOV", new() { new Offset("m_iFOV"), new Offset("m_iDesiredFOV") } },
            { "m_bIsScoped", new() { new Offset("m_bIsScoped"), new Offset("m_bIsScopedIn") } },
            { "m_iHealth", new() { new Offset("m_iHealth") } },
            { "m_bSpotted", new() { new Offset("m_bSpotted"), new Offset("m_bSpottedBy") } },
            { "m_iIDEntIndex", new() { new Offset("m_iIDEntIndex") } },
            { "m_pSceneNode", new() { new Offset("m_pSceneNode"), new Offset("m_pRenderingNode") } },
            { "m_vecViewOffset", new() { new Offset("m_vecViewOffset"), new Offset("m_vViewOffset") } },
            { "m_lifeState", new() { new Offset("m_lifeState") } },
            { "m_vOldOrigin", new() { new Offset("m_vOldOrigin") } },
            { "m_iTeamNum", new() { new Offset("m_iTeamNum") } },
            { "m_hPlayerPawn", new() { new Offset("m_hPlayerPawn") } },
            { "m_flFlashScreenshotAlpha", new() { new Offset("m_flFlashScreenshotAlpha"), new Offset("m_flFlashDuration") } },
            { "m_flFlashBangTime", new() { new Offset("m_flFlashBangTime"), new Offset("m_flFlashDuration") } },
            { "m_modelState", new() { new Offset("m_modelState") } },
            { "m_pGameSceneNode", new() { new Offset("m_pGameSceneNode") } },
            { "m_flC4Blow", new() { new Offset("m_flC4Blow"), new Offset("m_flDetonateTime") } },
            { "current_time", new() { new Offset("current_time"), new Offset("m_flCurrentTime") } },
            { "m_bBombPlanted", new() { new Offset("m_bBombPlanted"), new Offset("m_bBombTicking") } },
            { "m_pClippingWeapon", new() { new Offset("m_pClippingWeapon") } },
            { "m_iItemDefinitionIndex", new() { new Offset("m_iItemDefinitionIndex", "C_EconItemView") } },
            { "m_iItemIDHigh", new() { new Offset("m_iItemIDHigh", "C_EconItemView") } },
            { "m_nFallbackPaintKit", new() { new Offset("m_nFallbackPaintKit", "C_EconEntity") } },
            { "m_nFallbackStatTrak", new() { new Offset("m_nFallbackStatTrak", "C_EconEntity") } },
            { "m_nFallbackSeed", new() { new Offset("m_nFallbackSeed", "C_EconEntity") } },
            { "m_flFallbackWear", new() { new Offset("m_flFallbackWear", "C_EconEntity") } },
            { "m_AttributeList", new() { new Offset("m_AttributeList", "C_EconItemView") } },
            { "m_Attributes", new() { new Offset("m_Attributes", "CAttributeList") } },
            { "m_hHudModelArms", new() { new Offset("m_hHudModelArms", "C_CSPlayerPawn") } },
            { "m_pChild", new() { new Offset("m_pChild", "CGameSceneNode") } },
            { "m_pNextSibling", new() { new Offset("m_pNextSibling", "CGameSceneNode") } },
            { "m_pOwner", new() { new Offset("m_pOwner", "CGameSceneNode") } },
            { "m_MeshGroupMask", new() { new Offset("m_MeshGroupMask", "CModelState") } },
            { "m_iAttributeDefinitionIndex", new() { new Offset("m_iAttributeDefinitionIndex", "CEconItemAttribute") } },
            { "m_flValue", new() { new Offset("m_flValue", "CEconItemAttribute") } },
            { "m_flInitialValue", new() { new Offset("m_flInitialValue", "CEconItemAttribute") } },
            { "m_iClip1", new() { new Offset("m_iClip1", "C_BasePlayerWeapon") } },
            { "m_nNextPrimaryAttackTick", new() { new Offset("m_nNextPrimaryAttackTick", "C_BasePlayerWeapon") } },
            { "m_nTickBase", new() { new Offset("m_nTickBase", "CBasePlayerController") } },
            { "m_nSubclassID", new() { new Offset("m_nSubclassID", "C_BaseEntity") } },
            { "m_EconGloves", new() { new Offset("m_EconGloves", "C_CSPlayerPawn") } },
            { "m_nEconGlovesChanged", new() { new Offset("m_nEconGlovesChanged", "C_CSPlayerPawn") } },
            { "m_NetworkedDynamicAttributes", new() { new Offset("m_NetworkedDynamicAttributes", "C_EconItemView") } },
            { "m_iItemID", new() { new Offset("m_iItemID", "C_EconItemView") } },
            { "m_iItemIDLow", new() { new Offset("m_iItemIDLow", "C_EconItemView") } },
            { "m_iAccountID", new() { new Offset("m_iAccountID", "C_EconItemView") } },
            { "m_OriginalOwnerXuidLow", new() { new Offset("m_OriginalOwnerXuidLow", "C_EconEntity") } },
            { "m_bVisualsDataSet", new() { new Offset("m_bVisualsDataSet", "C_CSWeaponBase") } },
            { "dwNetworkGameClient", new() { new Offset("dwNetworkGameClient") } },
            { "dwNetworkGameClient_signOnState", new() { new Offset("dwNetworkGameClient_signOnState") } },
            { "dwNetworkGameClient_deltaTick", new() { new Offset("dwNetworkGameClient_deltaTick") } },
            { "m_bNeedToReApplyGloves", new() { new Offset("m_bNeedToReApplyGloves", "C_CSPlayerPawn") } },
            { "m_bInitialized", new() { new Offset("m_bInitialized", "C_EconItemView") } },
            { "m_bDisallowSOC", new() { new Offset("m_bDisallowSOC", "C_EconItemView") } },
            { "m_iEntityQuality", new() { new Offset("m_iEntityQuality", "C_EconItemView") } },
            { "m_iRarityOverride", new() { new Offset("m_iRarityOverride", "C_EconItemView") } },
            { "m_szCustomNameOverride", new() { new Offset("m_szCustomNameOverride", "C_EconItemView") } },
            { "m_szCustomNameOverride2", new() { new Offset("m_szCustomNameOverride2", "C_EconItemView") } },
            { "m_szCustomNameOverride3", new() { new Offset("m_szCustomNameOverride3", "C_EconItemView") } },
            { "m_szCustomName", new() { new Offset("m_szCustomName", "C_EconItemView") } },
            { "m_bInitializedTags", new() { new Offset("m_bInitializedTags", "C_EconItemView") } },
            { "m_SkyTint", new() { new Offset("m_vTintColor", "C_EnvSky") } },
            { "m_SkyBrightness", new() { new Offset("m_flBrightnessScale", "C_EnvSky") } },
            { "m_SkyDesignerName", new() { new Offset("m_designerName", "CEntityIdentity") } },
            { "m_bSpottedByMask", new() { new Offset("m_bSpottedByMask") } },
            { "m_pWeaponServices", new() { new Offset("m_pWeaponServices") } },
            { "m_hActiveWeapon", new() { new Offset("m_hActiveWeapon") } },
            { "m_vecAbsVelocity", new() { new Offset("m_vecAbsVelocity") } },
            { "m_fFlags", new() { new Offset("m_fFlags") } },
            { "m_MoveType", new() { new Offset("m_MoveType", "C_BaseEntity") } },
            { "m_hMyWeapons", new() { new Offset("m_hMyWeapons") } },
            { "m_aimPunchAngle", new() { new Offset("m_aimPunchAngle") } },
            { "m_nCurrentTickThisFrame", new() { new Offset("m_nCurrentTickThisFrame") } },
            { "m_ArmorValue", new() { new Offset("m_ArmorValue") } },
            { "m_pInGameMoneyServices", new() { new Offset("m_pInGameMoneyServices") } },
            { "m_iAccount", new() { new Offset("m_iAccount") } },
            { "m_iTotalCashSpent", new() { new Offset("m_iTotalCashSpent") } },
            { "m_iCashSpentThisRound", new() { new Offset("m_iCashSpentThisRound") } },
            { "m_bIsDefusing", new() { new Offset("m_bIsDefusing") } },
            { "m_bInBombZone", new() { new Offset("m_bInBombZone") } },
            { "m_bIsBuyMenuOpen", new() { new Offset("m_bIsBuyMenuOpen") } },
            { "m_aimPunchCache", new() { new Offset("m_aimPunchCache") } },
            { "m_iAmmo", new() { new Offset("m_iAmmo") } },
            { "m_iPing", new() { new Offset("m_iPing") } },
            { "m_bIsWalking", new() { new Offset("m_bIsWalking") } },
            { "m_totalHitsOnServer", new() { new Offset("m_totalHitsOnServer") } },
            { "m_angEyeAngles", new() { new Offset("m_angEyeAngles") } },
            { "m_iSpectatorSlotCount", new() { new Offset("m_iSpectatorSlotCount") } },
            { "m_iShotsFired", new() { new Offset("m_iShotsFired") } },
            { "m_vecAbsOrigin", new() { new Offset("m_vecAbsOrigin") } },
            { "m_GunGameImmunityColor", new() { new Offset("m_GunGameImmunityColor") } },
            { "m_flEmitSoundTime", new() { new Offset("m_flEmitSoundTime") } },
            { "m_vecMins", new() { new Offset("m_vecMins") } },
            { "m_vMinBounds", new() { new Offset("m_vMinBounds") } },
            { "m_vMaxBounds", new() { new Offset("m_vMaxBounds") } },
            { "m_flShapeRadius", new() { new Offset("m_flShapeRadius") } },
            { "m_sBoneName", new() { new Offset("m_sBoneName") } },
            { "m_name", new() { new Offset("m_name") } },
            { "m_nShapeType", new() { new Offset("m_nShapeType") } },
            { "m_sSurfaceProperty", new() { new Offset("m_sSurfaceProperty") } },
            { "m_vecMaxs", new() { new Offset("m_vecMaxs") } },
            { "v_angle", new() { new Offset("v_angle") } },
            { "m_Collision", new() { new Offset("m_Collision") } },
            { "m_CHitboxComponent", new() { new Offset("m_CHitboxComponent") } },
            { "m_bDormant", new() { new Offset("m_bDormant") } },
            { "m_nSmokeEffectTickBegin", new() { new Offset("m_nSmokeEffectTickBegin") } },
            { "m_pEntity", new() { new Offset("m_pEntity", "CEntityInstance") } },
            { "m_designerName", new() { new Offset("m_designerName") } },
            { "m_bSmokeEffectSpawned", new() { new Offset("m_bSmokeEffectSpawned") } },
            { "m_bSmokeVolumeDataReceived", new() { new Offset("m_bSmokeVolumeDataReceived") } },
            { "m_nVoxelUpdate", new() { new Offset("m_nVoxelUpdate") } },
            { "m_hOwnerEntity", new() { new Offset("m_hOwnerEntity") } },
            { "m_nodeToWorld", new() { new Offset("m_nodeToWorld") } },
            { "m_nBombSite", new() { new Offset("m_nBombSite") } },
            { "m_bBeingDefused", new() { new Offset("m_bBeingDefused") } },
            { "m_bC4Activated", new() { new Offset("m_bC4Activated") } },
            { "m_pObserverServices", new() { new Offset("m_pObserverServices") } },
            { "m_hObserverTarget", new() { new Offset("m_hObserverTarget") } },
            { "m_hPawn", new() { new Offset("m_hPawn") } },

            { "m_pAimPunchServices", new() { new Offset("m_pAimPunchServices") } },
            { "m_predictableBaseAngle", new() { new Offset("m_predictableBaseAngle") } },
            { "m_predictableBaseAngleVel", new() { new Offset("m_predictableBaseAngleVel") } },
            { "m_hInfernoPointsSnapshot", new() { new Offset("m_hInfernoPointsSnapshot") } },
            { "m_hInfernoFillerPointsSnapshot", new() { new Offset("m_hInfernoFillerPointsSnapshot") } },
            { "m_hInfernoDecalsSnapshot", new() { new Offset("m_hInfernoDecalsSnapshot") } },
            { "m_firePositions", new() { new Offset("m_firePositions") } },
            { "m_fireCount", new() { new Offset("m_fireCount") } },
            { "m_hInfernoOutlinePointsSnapshot", new() { new Offset("m_hInfernoOutlinePointsSnapshot", "C_Inferno") } },
            { "m_hInfernoClimbingOutlinePointsSnapshot", new() { new Offset("m_hInfernoClimbingOutlinePointsSnapshot", "C_Inferno") } },


            // EXPLICIT CLASS THING
            { "m_pActionTrackingServices", new() { new Offset("m_pActionTrackingServices", "CCSPlayerController") } },
            { "m_pBulletServices", new() { new Offset("m_pBulletServices", "C_CSPlayerPawn") } },
            { "m_flTotalRoundDamageDealt", new() { new Offset("m_flTotalRoundDamageDealt", "CCSPlayerController_ActionTrackingServices") } },
            { "m_iNumRoundKills", new() { new Offset("m_iNumRoundKills", "CCSPlayerController_ActionTrackingServices") } },
            { "m_iNumRoundKillsHeadshots", new() { new Offset("m_iNumRoundKillsHeadshots", "CCSPlayerController_ActionTrackingServices") } },
            { "m_entitySpottedState", new() { new Offset("m_entitySpottedState", "C_CSPlayerPawn") } },
            { "m_vecOrigin", new() { new Offset("m_vecOrigin", "CGameSceneNode") } },
            { "m_angRotation", new() { new Offset("m_angRotation", "CGameSceneNode") } },
            { "m_vSmokeColor", new() { new Offset("m_vSmokeColor", "C_SmokeGrenadeProjectile") } },
            { "m_vSmokeDetonationPos", new() { new Offset("m_vSmokeDetonationPos", "C_SmokeGrenadeProjectile") } },
            { "m_VoxelFrameData", new() { new Offset("m_VoxelFrameData", "C_SmokeGrenadeProjectile") } },
            { "m_nVoxelFrameDataSize", new() { new Offset("m_nVoxelFrameDataSize", "C_SmokeGrenadeProjectile") } },
            { "m_nRandomSeed", new() { new Offset("m_nRandomSeed", "C_SmokeGrenadeProjectile") } },
            { "m_bDidSmokeEffect", new() { new Offset("m_bDidSmokeEffect", "C_SmokeGrenadeProjectile") } },
            { "m_nInButtonsWhichAreToggles", new() { new Offset("m_nInButtonsWhichAreToggles", "CBasePlayerController") } },
            { "m_CommandContext", new() { new Offset("m_CommandContext", "CBasePlayerController") } },
            { "m_iszPlayerName", new() { new Offset("m_iszPlayerName", "CBasePlayerController") } },
            { "m_AttributeManager", new() { new Offset("m_AttributeManager", "C_EconEntity") } },
            { "m_Item", new() { new Offset("m_Item", "C_AttributeContainer") } },
            { "m_ModelName", new() { new Offset("m_ModelName", "CModelState") } },
            //{ "m_bBombPlanted", new() { new Offset("m_bBombPlanted", "C_CSGameRules") } },

        };

        private static bool triedSecondary;
        public static async Task UpdateOffsetsAsync(Action<string>? progress = null)
        {
            Updated = false;
            triedSecondary = false;
            progress?.Invoke("Baixando dados do CS2 (limite de 20 s)...");
            string[] primary = [OffsetsUrl, ClientDllUrl, ButtonsUrl, Engine2Url, AnimationSystemUrl];
            string[] backup = [SecondaryOffsetsUrl, SecondaryClientDllUrl, SecondaryButtonsUrl, SecondaryEngine2Url, SecondaryAnimationSystemUrl];
            var data = await Task.WhenAll(primary.Select(DownloadFile)).ConfigureAwait(false);
            var missing = Enumerable.Range(0, data.Length).Where(i => string.IsNullOrWhiteSpace(data[i])).ToArray();
            if (missing.Length > 0)
            {
                progress?.Invoke("Tentando a fonte alternativa de dados...");
                var replacements = await Task.WhenAll(missing.Select(i => DownloadFile(backup[i]))).ConfigureAwait(false);
                for (int i = 0; i < missing.Length; i++) data[missing[i]] = replacements[i];
            }
            if (data.Any(string.IsNullOrWhiteSpace))
                throw new InvalidOperationException("Não foi possível baixar os dados do CS2 das duas fontes. Verifique a conexão com raw.githubusercontent.com e tente novamente.");
            OffsetsContent = data[0]; ClientDllContent = data[1]; ButtonsContent = data[2]; Engine2Content = data[3]; AnimationSystemContent = data[4];
            progress?.Invoke("Lendo os dados do CS2...");
            ParseCurrentSources();
        }

        private static void ParseCurrentSources()
        {
            offsets.Clear();
            classOffsets = SchemaOffsets.Parse(ClientDllContent);
            ParseOffsetsFile(OffsetsContent); ParseClientDllFile(ClientDllContent);
            ParseButtonsFile(ButtonsContent); ParseEngine2File(Engine2Content); ParseAnimationSystemFile(AnimationSystemContent);
            UpdateOffsetsClass();
        }

        public static async Task CheckIfOffsetsAreValid()
        {
            var memory = GameState.memory;
            if (memory == null || GameState.client == 0) { Updated = false; return; }
            // ViewMatrix contains floats, not an entity pointer. A zero matrix
            // while changing maps must not trigger endless network downloads.
            bool Ready() => memory.TryRead(GameState.client + Offsets.dwEntityList, out nint list) && list.ToInt64() >= 0x10000;
            if (!Ready() && !triedSecondary)
            {
                triedSecondary = true;
                await FetchSecondarySource().ConfigureAwait(false);
                ParseCurrentSources();
            }
            Updated = Ready();
        }

        public static void ApplySecondarySources()
        {
            if (Updated)
                return;

            ParseOffsetsFile(OffsetsContent);
            ParseClientDllFile(ClientDllContent);
            ParseButtonsFile(ButtonsContent);
            ParseEngine2File(Engine2Content);
            ParseAnimationSystemFile(AnimationSystemContent);
            UpdateOffsetsClass();
        }

        public static async Task FetchSecondarySource()
        {
            var data = await Task.WhenAll(new[] { SecondaryOffsetsUrl, SecondaryClientDllUrl, SecondaryButtonsUrl, SecondaryEngine2Url, SecondaryAnimationSystemUrl }.Select(DownloadFile)).ConfigureAwait(false);
            if (!string.IsNullOrWhiteSpace(data[0])) OffsetsContent = data[0];
            if (!string.IsNullOrWhiteSpace(data[1])) ClientDllContent = data[1];
            if (!string.IsNullOrWhiteSpace(data[2])) ButtonsContent = data[2];
            if (!string.IsNullOrWhiteSpace(data[3])) Engine2Content = data[3];
            if (!string.IsNullOrWhiteSpace(data[4])) AnimationSystemContent = data[4];
        }

        private static async Task<string> DownloadFile(string url)
        {
            try
            {
                Console.WriteLine($"[OFFSET FINDER] Downloading {url}");
                string content = await httpClient.GetStringAsync(url).ConfigureAwait(false);

                Console.WriteLine($"[OFFSET FINDER] Downloaded {url}, length={content.Length}");
                return content;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OFFSET FINDER] Error downloading {url}: {ex.Message}");
                return string.Empty;
            }
        }


        private static void ParseOffsetsFile(string content)
        {
            // regex to match the offsets (global constants)
            var matches = Regex.Matches(content, _offsetRegex);
            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} Offsets In File offsets.cs");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                offsets[name] = value;
            }
        }

        private static void ParseClientDllFile(string content)
        {
            ParseClassOffsets(content, "C_BaseEntity");

            // regex fallback for any extra global consts
            var matches = Regex.Matches(content, _offsetRegex);
            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} additional offsets in client_dll.cs");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                if (!offsets.ContainsKey(name))
                {
                    offsets[name] = value;
                }
            }
        }

        private static void ParseAnimationSystemFile(string animationSystemContent)
        {
            // regex to match the offsets (global constants)
            var matches = Regex.Matches(animationSystemContent, _offsetRegex);
            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} Offsets In File offsets.cs");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                offsets[name] = value;
            }
        }

        private static void ParseClassOffsets(string content, string className) // explicitly parse a given class
        {
            if (!classOffsets.TryGetValue(className, out var members)) return;
            foreach (var member in members) offsets[member.Key] = member.Value;
        }

        private static void ParseButtonsFile(string content)
        {
            // regex to match the offsets
            var matches = Regex.Matches(content, _offsetRegex);
            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} Offsets In File buttons.cs");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                offsets[name] = value;
            }
        }

        private static void ParseEngine2File(string content)
        {
            // regex to match the offsets
            var matches = Regex.Matches(content, _offsetRegex);
            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} Offsets In File engine2.cs");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                offsets[name] = value;
            }
        }

        private static void UpdateOffsetsClass()
        {
            // grab the static Offsets class
            Type offsetsType = typeof(Mac1ota_Menu.Data.Game.Offsets);
            FieldInfo[] fields = offsetsType.GetFields(BindingFlags.Public | BindingFlags.Static);

            int updatedCount = 0;
            foreach (FieldInfo field in fields)
            {
                string fieldName = field.Name;

                if (FieldNameMappings.TryGetValue(fieldName.Trim(), out List<Offset>? sources))
                {
                    bool found = false;
                    foreach (var source in sources)
                    {
                        if (source.ClassName != null)
                        {
                            if (classOffsets.TryGetValue(source.ClassName, out var members) && members.TryGetValue(source.Name, out int member))
                            {
                                field.SetValue(null, member); updatedCount++; found = true; break;
                            }
                            continue;
                        }

                        if (!offsets.TryGetValue(source.Name, out int value))
                            continue;

                        int? currentValue = (int?)field?.GetValue(null);
                        field?.SetValue(null, value);

                        Console.WriteLine(
                            $"[OFFSET FINDER] Updated {fieldName} From 0x{currentValue:X} To 0x{value:X} (Source: {source.Name}, Class: {source.ClassName ?? "global"})");
                        updatedCount++;
                        found = true;
                        break;
                    }

                    if (!found)
                    {
                        Console.WriteLine($"[OFFSET FINDER] ERROR: No Offset Found {fieldName} (Tried: {string.Join(", ", sources.Select(s => s.Name))})");
                    }
                }
                else
                {
                    Console.WriteLine($"[OFFSET FINDER] ERROR: {fieldName} Is Not Mapped");
                }
            }

            Console.WriteLine($"[OFFSET FINDER] Updated: {updatedCount}/{fields.Length} Offsets");
        }
    }
}
