import { expect, type Locator, type Page } from '@playwright/test';
import { ROUTES, SELECTORS, TIMEOUTS, UI } from '../constants';
import type { User } from '../types';

export class LoginPage {
  readonly page: Page;
  readonly signInButton: Locator;
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly subtitle: Locator;
  readonly errorAlert: Locator;
  readonly taskRowByTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.signInButton = page.getByRole('button', { name: UI.signIn });
    this.emailField = page.getByLabel('Email, phone number, or username');
    this.passwordField = page.getByPlaceholder('Enter your password');
    this.subtitle = page.getByText('Sign in to access the dashboard');
    this.errorAlert = page.getByRole('alert');
    this.taskRowByTitle = page.getByTitle(SELECTORS.login.titleViewTaskDetails);
  }

  async goto(): Promise<void> {
    await this.page.goto(ROUTES.login);
    await this.subtitle.waitFor({ state: 'visible', timeout: TIMEOUTS.navigation });
  }

  async clearSession(): Promise<void> {
    await this.page.context().clearCookies();
    await this.page.goto(ROUTES.login, { waitUntil: 'domcontentloaded' });
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await this.signInButton.waitFor({ state: 'visible', timeout: TIMEOUTS.navigation });
  }

  async login(user: User): Promise<void> {
    await this.usernameField.fill(user.username);
    await this.passwordField.fill(user.password);
    await this.signInButton.click();
  }

  async loginWith(user: User): Promise<void> {
    await this.goto();
    await this.login(user);
  }

  async typeCredentials(user: User, delayMs = 150): Promise<void> {
    await this.emailField.click();
    await this.emailField.pressSequentially(user.username, { delay: delayMs });
    await this.passwordField.click();
    await this.passwordField.pressSequentially(user.password, { delay: delayMs });
  }

  async submit(): Promise<void> {
    await this.signInButton.click();
  }

  async expectLoginFormVisible(): Promise<void> {
    await expect(this.signInButton).toBeVisible();
    await expect(this.page.getByTestId(SELECTORS.login.testIdEmail)).toBeVisible();
    await expect(this.subtitle).toBeVisible();
    await expect(this.emailField).toBeVisible();
    await expect(this.passwordField).toBeVisible();
  }

  async expectInvalidCredentialsError(): Promise<void> {
    await expect(this.errorAlert).toContainText(UI.invalidCredentials);
  }

  developerAvatar(developerName: string): Locator {
    return this.page.getByAltText(developerName);
  }

  /** Alias kept for specs that use emailField naming from codegen. */
  get usernameField(): Locator {
    return this.emailField;
  }
}
