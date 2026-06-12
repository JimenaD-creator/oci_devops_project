import { test as setup } from '@playwright/test';
import { AUTH_STORAGE, USERS } from '../constants';
import { persistAuthTokenForStorage } from '../helpers/authStorage';
import { LoginPage, MyTasksPage } from '../pages';

setup('authenticate as developer', async ({ page }) => {
  await new LoginPage(page).loginWith(USERS.DEVELOPER);
  await new MyTasksPage(page).expectLoaded();
  await persistAuthTokenForStorage(page);
  await page.context().storageState({ path: AUTH_STORAGE.developer });
});
