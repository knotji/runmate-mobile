import { render, screen } from '@testing-library/react';
import { AppBootScreen } from './AppBootScreen';

describe('AppBootScreen', () => {
  it('shows the RunMate brand while the app starts', () => {
    render(<AppBootScreen message="Checking Your Account" />);

    expect(screen.getByRole('status', { name: 'Checking Your Account' })).toBeInTheDocument();
    expect(screen.getByText('RunMate')).toBeInTheDocument();
    expect(screen.getByText('Checking Your Account')).toBeInTheDocument();
  });
});
