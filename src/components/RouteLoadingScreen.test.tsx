import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RouteLoadingScreen } from './RouteLoadingScreen';
import { loadingDetailsForPath } from './routeLoadingDetails';

describe('RouteLoadingScreen', () => {
  it('uses a page skeleton instead of the app boot logo for Health Connect navigation', () => {
    window.history.pushState({}, '', '/health-connect');
    const { container } = render(<RouteLoadingScreen />);
    expect(screen.getByText('Health Connect')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading Health Connect' })).toBeInTheDocument();
    expect(container.querySelector('.app-boot-logo')).not.toBeInTheDocument();
  });

  it('uses matching skeletons for tab, trend, and dynamic detail routes', () => {
    expect(loadingDetailsForPath('/tabs/activity')).toEqual({ title: 'Activity', variant: 'activity' });
    expect(loadingDetailsForPath('/nutrition-trends')).toEqual({ title: 'Nutrition Trends', variant: 'nutrition' });
    expect(loadingDetailsForPath('/activity/workout/workout-1')).toEqual({ title: 'Workout Detail', variant: 'detail' });
    expect(loadingDetailsForPath('/activity/meal/meal-1')).toEqual({ title: 'Meal Detail', variant: 'detail' });
    expect(loadingDetailsForPath('/activity/health/health-1')).toEqual({ title: 'Health Detail', variant: 'detail' });
  });
});
