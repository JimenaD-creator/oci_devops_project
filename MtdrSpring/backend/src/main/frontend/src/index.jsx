import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import PageLoadingSpinner from './components/common/PageLoadingSpinner';
import './index.css';
import { AppThemeProvider } from './ThemeContext';
import Login from './features/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { installAuthFetchInterceptor } from './utils/auth';
import ResetPasswordPage from './features/auth/ResetPasswordPage';

const App = lazy(() => import('./app/App'));

const BootLoader = () => <PageLoadingSpinner color="#E53935" minHeight="100vh" />;

installAuthFetchInterceptor();

ReactDOM.render(
  <React.StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Suspense fallback={<BootLoader />}>
                  <App />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);
