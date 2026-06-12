import { test as setup } from '@playwright/test';
import { AUTH_STORAGE, USERS } from '../constants';
import { persistAuthTokenForStorage } from '../helpers/authStorage';
import { DashboardPage, LoginPage } from '../pages';

setup('authenticate as manager', async ({ page }) => {
  await new LoginPage(page).loginWith(USERS.MANAGER);
  await new DashboardPage(page).expectLoaded();
  await persistAuthTokenForStorage(page);
  await page.context().storageState({ path: AUTH_STORAGE.manager });
});
