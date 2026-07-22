describe('RunMate Mobile Navigation and Key Features', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('renders login header and authentication choices correctly', () => {
    cy.location('pathname').should('eq', '/login');
    cy.contains('h1', 'Know Your Body').should('be.visible');
    cy.contains('button', 'Continue With Google').should('be.visible');
  });

  it('expands email login drawer and validates form inputs', () => {
    cy.contains('summary', 'Sign In With Email').click();
    cy.get('ion-input[type="email"]').should('be.visible');
    cy.get('ion-input[type="password"]').should('be.visible');
    cy.contains('ion-button', 'Sign In').should('be.visible');
  });

  it('prevents empty form submission and shows validation alert', () => {
    cy.contains('summary', 'Sign In With Email').click();
    cy.contains('ion-button', 'Sign In').click();
    cy.contains('[role="alert"]', 'Enter your email and password.').should('be.visible');
  });
});
