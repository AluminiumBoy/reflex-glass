import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { sdk } from '@farcaster/miniapp-sdk';
import App from './App.jsx';

/**
 * MiniAppWrapper
 * 
 * Ez a wrapper meghívja az sdk.actions.ready()-t amikor az app betöltött,
 * ami elrejti a Base/Farcaster loading splash screen-t és megjeleníti az appot.
 */
function MiniAppWrapper() {
  useEffect(() => {
    // Jelezzük a Base/Farcaster appnak hogy az appunk készen áll
    sdk.actions.ready();
    
    console.log('Reflex Glass Mini App initialized');
  }, []);

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MiniAppWrapper />
  </React.StrictMode>
);
