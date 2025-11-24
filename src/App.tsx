import { MsalProvider, AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { msalInstance } from './authConfig';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import InventoryPage from './pages/InventoryPage';
import RentalPage from './pages/RentalPage';

// Initialize MSAL
// Initialize MSAL
// await msalInstance.initialize(); // Moved to main.tsx

function App() {
    return (
        <MsalProvider instance={msalInstance}>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
                <AuthenticatedTemplate>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/inventory" element={<InventoryPage />} />
                        <Route path="/rental" element={<RentalPage />} />
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
