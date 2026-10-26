import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.tsx';
import { RelationshipProvider } from './hooks/useRelationship.tsx';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RelationshipProvider>
          <App />
        </RelationshipProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);