import { LocalNotifications } from '@capacitor/local-notifications';

export const azanService = {
  /**
   * Request displayed push notification permissions for Azan alarms.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display === 'granted') {
        return true;
      }
      const request = await LocalNotifications.requestPermissions();
      return request.display === 'granted';
    } catch (err) {
      console.warn('[Azan Service] Native notifications permission check not available in this environment:', err);
      return false;
    }
  },

  /**
   * Schedules a single Azan alarm notification based on time "HH:mm".
   * 
   * @param id Unique numeric ID for this prayer alarm (e.g., 1001 for Subuh)
   * @param namaShalat The prayer name (e.g., "Zuhur")
   * @param jamStr Time format "HH:mm" (e.g., "11:49")
   */
  async scheduleSingleAzan(id: number, namaShalat: string, jamStr: string): Promise<boolean> {
    if (!jamStr || !jamStr.includes(':')) {
      console.warn(`[Azan Service] Invalid time string format: "${jamStr}" for ${namaShalat}`);
      return false;
    }

    try {
      // 1. Parse time
      const [hoursStr, minutesStr] = jamStr.trim().split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      if (isNaN(hours) || isNaN(minutes)) {
        console.warn(`[Azan Service] Failed to parse hours/minutes from "${jamStr}"`);
        return false;
      }

      // 2. Compute date target
      const now = new Date();
      const targetDate = new Date();
      targetDate.setHours(hours, minutes, 0, 0);

      // If the target prayer time has already elapsed today, schedule for tomorrow (+1 Day)
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      console.log(`[Azan Service] Scheduling alarm ${namaShalat} (ID: ${id}) for:`, targetDate.toString());

      // 3. Clear any existing schedule on this ID to avoid duplicate queues
      try {
        await LocalNotifications.cancel({
          notifications: [{ id }]
        });
      } catch (cancelErr) {
        // Safe to ignore if didn't exist
      }

      // 4. Request display/alarm privileges
      await this.requestPermission();

      // 5. Schedule via Capacitor
      await LocalNotifications.schedule({
        notifications: [
          {
            title: `Panggilan Shalat ${namaShalat}`,
            body: `Telah masuk waktu shalat ${namaShalat} untuk wilayah Anda. Mari tunaikan ibadah shalat tepat waktu.`,
            id: id,
            schedule: {
              at: targetDate,
              allowWhileIdle: true
            },
            sound: 'azan.mp3', // Calls native android/app/src/main/res/raw/azan.mp3
            attachments: [],
            actionTypeId: '',
            extra: {
              prayerName: namaShalat,
              scheduledFor: targetDate.toISOString()
            }
          }
        ]
      });

      return true;
    } catch (err) {
      console.warn(`[Azan Service] Could not schedule native Azan notification for ${namaShalat}:`, err);
      return false;
    }
  },

  /**
   * Cancels a single scheduled Azan alarm by ID.
   * 
   * @param id Unique numeric ID
   */
  async cancelSingleAzan(id: number): Promise<boolean> {
    try {
      await LocalNotifications.cancel({
        notifications: [{ id }]
      });
      console.log(`[Azan Service] Successfully cancelled alarm ID: ${id}`);
      return true;
    } catch (err) {
      console.warn(`[Azan Service] Native notification cancellation failed or not available for ID: ${id}:`, err);
      return false;
    }
  }
};
