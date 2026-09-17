using System.Numerics;
using Mac1ota_Menu.Data.Game.Types;

namespace Mac1ota_Menu.Data.Game.C4
{
    public class C4
    {
        public IntPtr Address { get; set; } = IntPtr.Zero;
        public BombSite PlantedSite = BombSite.Unknown;
        public Vector3 Position { get; set; }
        public Vector2 Position2D { get; set; }
        public float ExplosionTime { get; set; } = 40;
        public bool BeingDefused { get; set; }
        public bool Planted { get; set; }
        public float[]? Matrix { get; set; }
    }
}
