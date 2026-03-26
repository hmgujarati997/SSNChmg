import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import UserLayout from "@/pages/user/UserLayout";
import VolunteerDashboard from "@/pages/volunteer/VolunteerDashboard";
import LiveScreen from "@/pages/LiveScreen";
import PublicProfile from "@/pages/PublicProfile";
import InstallPrompt from "@/components/InstallPrompt";

function ProtectedRoute({ children, requiredRole }) {
    const { user, role } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (requiredRole && role !== requiredRole) return <Navigate to="/login" replace />;
    return children;
}

function AppRoutes() {
    const { role } = useAuth();
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/admin/*" element={
                <ProtectedRoute requiredRole="admin"><AdminLayout /></ProtectedRoute>
            } />
            <Route path="/user/*" element={
                <ProtectedRoute requiredRole="user"><UserLayout /></ProtectedRoute>
            } />
            <Route path="/volunteer/*" element={
                <ProtectedRoute requiredRole="volunteer"><VolunteerDashboard /></ProtectedRoute>
            } />
            <Route path="/live/:eventId" element={<LiveScreen />} />
            <Route path="/live" element={<LiveScreen />} />
            <Route path="/profile/:userId" element={<PublicProfile />} />
            <Route path="/" element={
                role === 'admin' ? <Navigate to="/admin" replace /> :
                role === 'user' ? <Navigate to="/user" replace /> :
                role === 'volunteer' ? <Navigate to="/volunteer" replace /> :
                <Navigate to="/login" replace />
            } />
        </Routes>
    );
}

function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
                <Toaster richColors position="top-right" />
                <InstallPrompt />
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
