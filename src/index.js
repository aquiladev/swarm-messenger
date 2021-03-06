import React from 'react';
import ReactDOM from 'react-dom';
import dotenv from 'dotenv';
import { AppContainer } from 'react-hot-loader';
import { HelmetProvider } from 'react-helmet-async';
import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';

import './index.css';
import { createHttpClient } from './base/httpClient';
import { configureStore, history } from './base/redux';
import App from './App';
import * as serviceWorker from './serviceWorker';
import { run as apiRun } from './api';

dotenv.config();

const urlParams = new URLSearchParams(window.location.search);

const httpClient = createHttpClient();
const store = configureStore({
  settings: {
    mode: (urlParams.get('narrow') || '').toLowerCase() === 'true' ? 'narrow' : 'full',
    home: urlParams.get('home') || '/',
    pss: urlParams.get('pss') || null
  }
}, httpClient);

ReactDOM.render(
  <AppContainer>
    <HelmetProvider>
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <App />
        </ConnectedRouter>
      </Provider>
    </HelmetProvider>
  </AppContainer>,
  document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();

// Start APIs
apiRun(store);