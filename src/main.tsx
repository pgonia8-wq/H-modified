import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { MiniKit } from '@worldcoin/minikit-js';

const Root = () => {
  useEffect(() => {
    // Inicializa MiniKit, necesario para detectar si estamos dentro de World App
    MiniKit.install();

    // DEBUG: log para verificar instalación
    if (MiniKit.isInstalled()) {
      console.log('MiniKit is installed: running inside World App');
    } else {
      console.log('MiniKit is not installed: outside World App');
    }
  }, []);

  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
