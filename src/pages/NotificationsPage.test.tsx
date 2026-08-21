import { render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/notificationService', () => ({
  getNotificationPermission: vi.fn().mockResolvedValue('prompt'),
  getNotificationDiagnostics: vi.fn().mockResolvedValue(null),
  refreshNotifications: vi.fn(),
  requestExactReminderPermission: vi.fn(),
  requestNotificationPermission: vi.fn(),
  sendTestNotification: vi.fn(),
}));

import NotificationsPage from './NotificationsPage';

describe('NotificationsPage', () => {
  it('shows the toggle list immediately instead of a full-page skeleton, since preferences are already available synchronously', () => {
    render(<IonApp><MemoryRouter><NotificationsPage /></MemoryRouter></IonApp>);

    // Regression: this page used to hide the entire toggle list (which only needs
    // synchronously-available `prefs`) behind a full-page skeleton on every visit,
    // while it waited on an async permission/diagnostics read it didn't need for this.
    expect(screen.queryByText('Loading Notification Settings')).not.toBeInTheDocument();
    expect(screen.getByText('Bedtime Reminder')).toBeInTheDocument();
    expect(screen.getByText('Missing Sleep Alert')).toBeInTheDocument();
    expect(screen.getByLabelText('Bedtime Reminder')).toBeInTheDocument();
  });
});
