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
        private const string PrimaryBaseUrl = "https://raw.githubusercontent.com/Davuksl/cs2-offsets/main/output/";
        private const string UpstreamBaseUrl = "https://raw.githubusercontent.com/a2x/cs2-dumper/main/output/";
        private const string SecondaryBaseUrl = "https://raw.githubusercontent.com/sezzyaep/CS2-OFFSETS/main/";
        private const string OffsetsUrl = PrimaryBaseUrl + "offsets.cs";
        private const string UpstreamOffsetsUrl = UpstreamBaseUrl + "offsets.cs";
        private const string SecondaryOffsetsUrl = SecondaryBaseUrl + "offsets.cs";
        private const string ClientDllUrl = PrimaryBaseUrl + "client_dll.cs";
        private const string UpstreamClientDllUrl = UpstreamBaseUrl + "client_dll.cs";
        private const string SecondaryClientDllUrl = SecondaryBaseUrl + "client_dll.cs";
        private const string ButtonsUrl = PrimaryBaseUrl + "buttons.cs";
        private const string UpstreamButtonsUrl = UpstreamBaseUrl + "buttons.cs";
        private const string SecondaryButtonsUrl = SecondaryBaseUrl + "buttons.cs";
        private const string Engine2Url = PrimaryBaseUrl + "engine2_dll.cs";
        private const string UpstreamEngine2Url = UpstreamBaseUrl + "engine2_dll.cs";
        private const string SecondaryEngine2Url = SecondaryBaseUrl + "engine2_dll.cs";
        private const string AnimationSystemUrl = PrimaryBaseUrl + "animationsystem_dll.cs";
        private const string UpstreamAnimationSystemUrl = UpstreamBaseUrl + "animationsystem_dll.cs";
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
            { "m_iItemDefinitionIndex", new() { new Offset("m_iItemDefinitionIndex") } },
            { "m_bSpottedByMask", new() { new Offset("m_bSpottedByMask") } },
            { "m_pWeaponServices", new() { new Offset("m_pWeaponServices") } },
            { "m_hActiveWeapon", new() { new Offset("m_hActiveWeapon") } },
            { "m_vecAbsVelocity", new() { new Offset("m_vecAbsVelocity") } },
            { "m_fFlags", new() { new Offset("m_fFlags") } },
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
            { "m_pEntity", new() { new Offset("m_pEntity") } },
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
            { "m_szCustomName", new() { new Offset("m_szCustomName") } },
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

        public static async Task UpdateOffsetsAsync()
        {
            try
            {
                Console.WriteLine("[OFFSET FINDER] Starting The Offset Finding Process Please Wait...");
                offsets.Clear();

                // download and cache
                OffsetsContent = await DownloadFreshestFile(OffsetsUrl, UpstreamOffsetsUrl);
                ClientDllContent = await DownloadFreshestFile(ClientDllUrl, UpstreamClientDllUrl);
                ButtonsContent = await DownloadFreshestFile(ButtonsUrl, UpstreamButtonsUrl);
                Engine2Content = await DownloadFreshestFile(Engine2Url, UpstreamEngine2Url);
                AnimationSystemContent = await DownloadFreshestFile(AnimationSystemUrl, UpstreamAnimationSystemUrl);

                ParseOffsetsFile(OffsetsContent);
                ParseClientDllFile(ClientDllContent);
                ParseButtonsFile(ButtonsContent);
                ParseEngine2File(Engine2Content);
                ParseAnimationSystemFile(AnimationSystemContent);

                Console.WriteLine($"[OFFSET FINDER] Found: {offsets.Count}");
                UpdateOffsetsClass();

                Console.WriteLine("[OFFSET FINDER] Offsets Updated Successfully!");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[OFFSETS FINDER] ERROR: {ex.Message}");
            }
        }

        public static async Task CheckIfOffsetsAreValid()
        {
            if (GameState.memory == null)
                return;

            if (GameState.CS2Open() && (GameState.memory.ReadPointer(GameState.client, Offsets.dwViewMatrix) == IntPtr.Zero || GameState.memory.ReadPointer(GameState.client, Offsets.dwEntityList) == IntPtr.Zero))
            {
                Console.WriteLine("[OFFSET FINDER] Primary/upstream offsets are invalid, trying secondary source");
                offsets.Clear();
                await FetchSecondarySource();

                ParseOffsetsFile(OffsetsContent);
                ParseClientDllFile(ClientDllContent);
                ParseButtonsFile(ButtonsContent);
                ParseEngine2File(Engine2Content);
                ParseAnimationSystemFile(AnimationSystemContent);
                UpdateOffsetsClass();

                if (GameState.memory.ReadPointer(GameState.client, Offsets.dwViewMatrix) == IntPtr.Zero || GameState.memory.ReadPointer(GameState.client, Offsets.dwEntityList) == IntPtr.Zero)
                {
                    Console.WriteLine("Both are invalid, maybe try dumping yourself?");
                    Updated = true;
                    return;
                }

                Updated = true;
                return;
            }
            else
            {
                Updated = true;
            }
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
            OffsetsContent = await DownloadFile(SecondaryOffsetsUrl);
            ClientDllContent = await DownloadFile(SecondaryClientDllUrl);
            ButtonsContent = await DownloadFile(SecondaryButtonsUrl);
            Engine2Content = await DownloadFile(SecondaryEngine2Url);
            AnimationSystemContent = await DownloadFile(SecondaryAnimationSystemUrl);
        }

        private static async Task<string> DownloadFreshestFile(string primaryUrl, string fallbackUrl)
        {
            string primary = await DownloadFile(primaryUrl);
            string fallback = await DownloadFile(fallbackUrl);

            if (string.IsNullOrWhiteSpace(primary))
                return fallback;
            if (string.IsNullOrWhiteSpace(fallback))
                return primary;

            DateTimeOffset? primaryGenerated = TryGetGeneratedTimestamp(primary);
            DateTimeOffset? fallbackGenerated = TryGetGeneratedTimestamp(fallback);

            if (primaryGenerated.HasValue && fallbackGenerated.HasValue && fallbackGenerated > primaryGenerated)
            {
                Console.WriteLine($"[OFFSET FINDER] Davuksl file is older ({primaryGenerated:O}); using newer upstream dump ({fallbackGenerated:O}).");
                return fallback;
            }

            Console.WriteLine($"[OFFSET FINDER] Using Davuksl/cs2-offsets source ({primaryGenerated?.ToString("O") ?? "timestamp unavailable"}).");
            return primary;
        }

        private static DateTimeOffset? TryGetGeneratedTimestamp(string content)
        {
            Match match = Regex.Match(content, @"(?m)^//\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+UTC\s*$");
            if (!match.Success)
                return null;

            if (DateTimeOffset.TryParse(
                    match.Groups[1].Value + " +00:00",
                    System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.AllowWhiteSpaces,
                    out DateTimeOffset parsed))
            {
                return parsed;
            }

            return null;
        }

        private static async Task<string> DownloadFile(string url)
        {
            try
            {
                Console.WriteLine($"[OFFSET FINDER] Downloading {url}");
                string content = await httpClient.GetStringAsync(url);

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
            string classPattern = $@"public\s+static\s+class\s+{className}\s*\{{([\s\S]*?)\}}";
            var classMatch = Regex.Match(content, classPattern, RegexOptions.Multiline);

            if (!classMatch.Success)
            {
                Console.WriteLine($"[OFFSET FINDER] Could Not Find Class {className}");
                return;
            }

            var matches = Regex.Matches(classMatch.Groups[1].Value, _offsetRegex);

            Console.WriteLine($"[OFFSET FINDER] Found {matches.Count} offsets in class {className}");

            foreach (Match match in matches)
            {
                string name = match.Groups[1].Value;
                int value = Convert.ToInt32(match.Groups[2].Value, 16);
                offsets[name] = value;
            }
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
                            ParseClassOffsets(ClientDllContent, source.ClassName);
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
