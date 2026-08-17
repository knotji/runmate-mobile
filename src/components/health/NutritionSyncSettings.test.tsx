import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NutritionSyncSettings } from '@/components/health/NutritionSyncSettings';
import * as nutritionSync from '@/lib/nutritionSync';

afterEach(() => { vi.restoreAllMocks(); });

function renderSettings() {
  render(<IonApp><MemoryRouter><NutritionSyncSettings /></MemoryRouter></IonApp>);
}

// IonToggle communicates state changes via a custom `ionChange` event with a
// `detail.checked` payload, not a plain click/change event, so it has to be
// dispatched by hand rather than through fireEvent.click.
function toggleSwitch(checked: boolean) {
  const toggle = screen.getByLabelText('Share Logged Nutrition With Health Connect');
  fireEvent(toggle, new CustomEvent('ionChange', { detail: { checked } }));
}

describe('NutritionSyncSettings', () => {
  beforeEach(() => {
    vi.spyOn(nutritionSync, 'loadNutritionSyncEnabled').mockReturnValue(false);
    vi.spyOn(nutritionSync, 'saveNutritionSyncEnabled').mockImplementation(() => undefined);
    vi.spyOn(nutritionSync, 'checkNutritionSyncAuthorization').mockResolvedValue('granted');
    vi.spyOn(nutritionSync, 'loadLastNutritionSyncAttempt').mockReturnValue(null);
  });

  it('renders off by default and explains that calories and macros are shared', () => {
    renderSettings();

    expect(screen.getByLabelText('Share Logged Nutrition With Health Connect')).not.toBeChecked();
    expect(screen.getByText(/calories, protein, carbs, and fat/i)).toBeInTheDocument();
  });

  it('requests authorization and turns on only if it is granted', async () => {
    vi.spyOn(nutritionSync, 'requestNutritionSyncAuthorization').mockResolvedValue('granted');
    renderSettings();

    toggleSwitch(true);

    await waitFor(() => expect(nutritionSync.saveNutritionSyncEnabled).toHaveBeenCalledWith(true));
    expect(screen.getByLabelText('Share Logged Nutrition With Health Connect')).toBeChecked();
  });

  it('stays off and shows a status message when Health Connect denies write access', async () => {
    vi.spyOn(nutritionSync, 'requestNutritionSyncAuthorization').mockResolvedValue('denied');
    renderSettings();

    toggleSwitch(true);

    await waitFor(() => expect(nutritionSync.saveNutritionSyncEnabled).toHaveBeenCalledWith(false));
    expect(screen.getByLabelText('Share Logged Nutrition With Health Connect')).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('denied write access');
  });

  it('shows the last sync attempt so a silent failure is diagnosable without device logs', () => {
    vi.spyOn(nutritionSync, 'loadLastNutritionSyncAttempt').mockReturnValue({
      at: '2026-08-14T12:00:00.000Z',
      outcome: 'skipped_not_authorized',
      detail: 'denied',
    });
    renderSettings();

    expect(screen.getByText('Last Sync Attempt')).toBeInTheDocument();
    expect(screen.getByText(/Health Connect write access is not granted/)).toBeInTheDocument();
  });
});
