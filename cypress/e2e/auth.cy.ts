describe('RunMate Mobile authentication', () => {
  it('shows the focused email/password sign-in screen', () => {
    cy.visit('/');

    cy.location('pathname').should('eq', '/login');
    cy.contains('h1', 'Know your body');
    cy.contains('Use the same account as RunMate AI.');
    cy.get('ion-input[type="email"]').should('be.visible');
    cy.get('ion-input[type="password"]').should('be.visible');
    cy.contains('ion-button', 'Sign in').should('be.visible');
  });

  it('validates missing credentials without sending a request', () => {
    cy.visit('/login');
    cy.contains('ion-button', 'Sign in').click();
    cy.contains('[role="alert"]', 'Enter your email and password.').should('be.visible');
  });
});
