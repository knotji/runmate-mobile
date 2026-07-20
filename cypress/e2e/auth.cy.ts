describe('RunMate Mobile authentication', () => {
  it('shows the focused email/password sign-in screen', () => {
    cy.visit('/');

    cy.location('pathname').should('eq', '/login');
    cy.contains('h1', 'Know Your Body');
    cy.contains('See your Recovery, Strain, and Sleep metrics.');
    cy.contains('ion-button', 'Continue With Google').should('be.visible');
    cy.contains('summary', 'Sign In With Email').click();
    cy.get('ion-input[type="email"]').should('be.visible');
    cy.get('ion-input[type="password"]').should('be.visible');
    cy.contains('ion-button', 'Sign In').should('be.visible');
  });

  it('validates missing credentials without sending a request', () => {
    cy.visit('/login');
    cy.contains('summary', 'Sign In With Email').click();
    cy.contains('ion-button', 'Sign In').click();
    cy.contains('[role="alert"]', 'Enter your email and password.').should('be.visible');
  });
});
