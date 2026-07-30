import { act, render } from '@testing-library/react';
import { NetworkStatusToast } from './NetworkStatusToast';

describe('NetworkStatusToast', () => {
  it('keeps the saved-data message available while offline and announces recovery', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const { container } = render(<NetworkStatusToast />);
    const toast = container.parentElement?.querySelector('ion-toast');

    expect(toast).toHaveAttribute('message', expect.stringMatching(/showing the latest data saved on this device/i));
    expect(toast).toHaveAttribute('aria-live', 'assertive');

    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });

    expect(toast).toHaveAttribute('message', expect.stringMatching(/new data can sync again/i));
    expect(toast).toHaveAttribute('aria-live', 'polite');
  });
});
