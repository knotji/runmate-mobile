import { fireEvent, render, screen } from '@testing-library/react';
import { IonApp } from '@ionic/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HealthPage from './HealthPage';

describe('Health hub', () => {
  it('makes core health destinations discoverable without loading their data', () => {
    render(<IonApp><MemoryRouter><HealthPage /></MemoryRouter></IonApp>);

    for (const name of ['Health Calendar', 'Recovery Trends', 'Sleep', 'Strain', 'Nutrition', 'Body Weight', 'Fitness Age', 'Pain & Injury', 'Health Connect']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Log Health Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Settings And Data' })).toBeInTheDocument();
    for (const group of ['Your Body At A Glance', 'See What Is Changing', 'Longer-Term Signals', 'Connected Health Data']) {
      expect(screen.getByRole('heading', { name: group })).toBeInTheDocument();
    }
    expect(screen.getByText('Not synced on this device')).toBeInTheDocument();
  });

  it('opens a health destination from the hub', async () => {
    render(<IonApp><MemoryRouter initialEntries={['/tabs/health']}>
      <Route exact path="/tabs/health"><HealthPage /></Route>
      <Route exact path="/health-calendar"><h1>Calendar Destination</h1></Route>
    </MemoryRouter></IonApp>);

    fireEvent.click(screen.getByRole('button', { name: /Health Calendar/ }));
    expect(await screen.findByRole('heading', { name: 'Calendar Destination' })).toBeInTheDocument();
  });
});
