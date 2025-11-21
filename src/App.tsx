import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { msalInstance } from './authConfig';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import InventoryPage from './pages/InventoryPage';

// Initialize MSAL
await msalInstance.initialize();

function App() {
    return (
        <MsalProvider instance={msalInstance}>
            <BrowserRouter>
                <AuthenticatedTemplate>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                    </Routes>
                </AuthenticatedTemplate>
                <UnauthenticatedTemplate>
                    <LoginPage />
                </UnauthenticatedTemplate>
            </BrowserRouter>
        </MsalProvider>
    );
}

export default App;
