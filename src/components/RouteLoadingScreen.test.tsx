import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteLoadingScreen } from './RouteLoadingScreen';

describe('RouteLoadingScreen', () => {
  it('uses a page skeleton instead of the app boot logo for Health Connect navigation', () => {
    window.history.pushState({}, '', '/health-connect');
    const { container } = render(<RouteLoadingScreen />);
    expect(screen.getByText('Health Connect')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Health Connect' })).toBeInTheDocument();
    expect(container.querySelector('.app-boot-logo')).not.toBeInTheDocument();
  });
});
