import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";

import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./features/auth/pages/LoginPage.jsx";

import RegisterChoicePage from "./features/auth/pages/RegisterChoicePage.jsx";
import RegisterGeneralPage from "./features/auth/pages/RegisterGeneralPage.jsx";
import RegisterSchoolPage from "./features/auth/pages/RegisterSchoolPage.jsx";

import SchoolPendingPage from "./features/school/pages/SchoolPendingPage.jsx";
import SchoolWelcomePage from "./features/school/pages/SchoolWelcomePage.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import AdminLoginPage from "./features/admin/pages/AdminLoginPage.jsx";
import AdminBackofficePage from "./features/admin/pages/AdminBackofficePage.jsx";
import AdminSchoolsPage from "./features/admin/pages/AdminSchoolsPage.jsx";
import AdminSchoolDetailPage from "./features/admin/pages/AdminSchoolDetailPage.jsx";
import AdminGuard from "./routes/AdminGuard.jsx";
import AdminLayout from "./features/admin/layouts/AdminLayout.jsx";
import "./App.css";

export default function App() {
  return (
    <div className="page-container">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />

            <Route path="/register" element={<RegisterChoicePage />} />
            <Route path="/register/general" element={<RegisterGeneralPage />} />
            <Route path="/register/school" element={<RegisterSchoolPage />} />

            {/* School */}
            <Route path="/school/pending" element={<SchoolPendingPage />} />
            <Route
              path="/school/welcome"
              element={
                <ProtectedRoute allowRoles={["school_admin"]}>
                  <SchoolWelcomePage />
                </ProtectedRoute>
              }
            />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/backoffice" replace />} />
                <Route path="/admin/backoffice" element={<AdminBackofficePage />} />
                <Route path="/admin/schools" element={<AdminSchoolsPage />} />
                <Route path="/admin/schools/:id" element={<AdminSchoolDetailPage />} />
              </Route>
            </Route>


            {/* fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
