/**
 * pushService.ts:
 * Handles requesting permission for system notifications and triggering local native alerts.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notifications.');
    return false;
  }

  if (window.Notification.permission === 'granted') {
    return true;
  }

  try {
    const permission = await window.Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

export function showLocalNotification(title: string, body: string) {
  if (!('Notification' in window) || window.Notification.permission !== 'granted') {
    return;
  }

  // Only trigger native system notification if the tab is in the background/inactive
  if (document.visibilityState === 'hidden') {
    try {
      new window.Notification(title, {
        body,
        icon: '/Circle_invite.png' // Use the present KULA asset icon
      });
    } catch (e) {
      console.error('Failed to show system notification:', e);
    }
  }
}
