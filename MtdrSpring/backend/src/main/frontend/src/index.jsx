/*
## MyToDoReact version 1.0.
##
## Copyright (c) 2021 Oracle, Inc.
## Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl/
*/

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { AppThemeProvider } from './ThemeContext';
import App from './app/App';
import Login from './features/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';
import { installAuthFetchInterceptor } from './utils/auth';

installAuthFetchInterceptor();

ReactDOM.render(
  <React.StrictMode>
    <AppThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <App />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppThemeProvider>
  </React.StrictMode>,
  document.getElementById('root'),
);