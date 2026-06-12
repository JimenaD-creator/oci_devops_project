import type { Page } from '@playwright/test';

/** App stores JWT in sessionStorage by default */
export async function persistAuthTokenForStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const token =
      sessionStorage.getItem('mtdr_auth_token') ?? localStorage.getItem('mtdr_auth_token');
    if (token) {
      localStorage.setItem('mtdr_auth_token', token);
    }
  });
}
