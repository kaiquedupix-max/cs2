using System;
using System.Collections.Generic;
using System.Text;

namespace Mac1ota_Menu.Notifications
{
    public class Notification
    {
        public string NotificationTitle = string.Empty;
        public string NotificationMessage = string.Empty;
        public float DisappearDelay = 5f;
        public float SlideInProgress = 0f;
        public float SlideOutProgress = 0f;
        public float PositionY = 0f;
    }
}
