import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTES, SELECTORS, TIMEOUTS, UI } from '../constants';
import type { User } from '../types';

/**
 * Login page 
 */
export class LoginPage {
  readonly page: Page;

  /** 1. page.getByRole() */
  readonly signInButton: Locator;
  /** 2. page.getByTestId() — matches id="login-email" via testIdAttribute in playwright.config */
  readonly emailByTestId: Locator;
  /** 4. page.getByText() */
  readonly subtitle: Locator;
  /** 5. page.getByLabel() */
  readonly usernameField: Locator;
  /** 6. page.getByPlaceholder() */
  readonly passwordField: Locator;
  /** 7. page.getByTitle() — kanban cards and task table rows after login */
  readonly taskRowByTitle: Locator;

  /** Extra helper for invalid-login assertions. */
  readonly errorAlert: Locator;

  constructor(page: Page) {
    this.page = page;

    this.signInButton = page.getByRole('button', { name: UI.signIn });
    this.emailByTestId = page.getByTestId(SELECTORS.login.testIdEmail);
    this.subtitle = page.getByText('Sign in to access the dashboard');
    this.usernameField = page.getByLabel('Email, phone number, or username');
    this.passwordField = page.getByPlaceholder('Enter your password');
    this.taskRowByTitle = page.getByTitle(SELECTORS.login.titleViewTaskDetails);

    this.errorAlert = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
    await this.subtitle.waitFor({ state: 'visible', timeout: TIMEOUTS.navigation });
  }

  async clearSession(): Promise<void> {
    await this.page.context().clearCookies();
    await this.goto();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }

  async fillCredentials(user: User): Promise<void> {
    await this.usernameField.fill(user.username);
    await this.passwordField.fill(user.password);
  }

  async submit(): Promise<void> {
    await this.signInButton.click();
  }

  async login(user: User): Promise<void> {
    await this.fillCredentials(user);
    await this.submit();
  }

  async loginWith(user: User): Promise<void> {
    await this.goto();
    await this.login(user);
  }

  async expectOnLoginPage(): Promise<void> {
    await expect(this.page).toHaveURL(ROUTES.login);
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.errorAlert).toContainText(UI.invalidCredentials);
  }

  /** 3. page.getByAltText() — developer profile photos in KPI Analytics (alt = developer name). */
  developerAvatarByAlt(developerName: string): Locator {
    return this.page.getByAltText(developerName);
  }

  /** Asserts locator strategies #1, #2, #4, #5, #6 visible on the login screen (#3 and #7 used post-login). */
  async expectLoginLocatorsVisible(): Promise<void> {
    await expect(this.signInButton).toBeVisible();
    await expect(this.emailByTestId).toBeVisible();
    await expect(this.subtitle).toBeVisible();
    await expect(this.usernameField).toBeVisible();
    await expect(this.passwordField).toBeVisible();
  }
}
