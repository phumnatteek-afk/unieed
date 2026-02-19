import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";

import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./features/auth/pages/LoginPage.jsx";

import RegisterChoicePage from "./features/auth/pages/RegisterChoicePage.jsx";
import RegisterGeneralPage from "./features/auth/pages/RegisterGeneralPage.jsx";
import RegisterSchoolPage from "./features/auth/pages/RegisterSchoolPage.jsx";

// school pages/layout
import SchoolLayout from "./features/school/layouts/SchoolLayout.jsx";
import SchoolPendingPage from "./features/school/pages/SchoolPendingPage.jsx";
import SchoolWelcomePage from "./features/school/pages/SchoolWelcomePage.jsx";
import SchoolDashboardPage from "./features/school/pages/SchoolDashboardPage.jsx";
import SchoolProjectManageGatePage from "./features/school/pages/SchoolProjectManageGatePage.jsx";
import SchoolRequestCreatePage from "./features/school/pages/SchoolRequestCreatePage.jsx";
import SchoolRequestManagePage from "./features/school/pages/SchoolRequestManagePage.jsx";
import SchoolDonationsPage from "./features/school/pages/SchoolDonationsPage.jsx"; // ถ้ายังไม่มี ให้สร้างหน้า placeholder
import EditProjectPage from "./features/school/components/EditProjectPage.jsx"



import ProtectedRoute from "./routes/ProtectedRoute.jsx";

import AdminLoginPage from "./features/admin/pages/AdminLoginPage.jsx";
import AdminBackofficePage from "./features/admin/pages/AdminBackofficePage.jsx";
import AdminSchoolsPage from "./features/admin/pages/AdminSchoolsPage.jsx";
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

        {/* welcome เป็นหน้าเดี่ยว ไม่ต้องอยู่ใน SchoolLayout */}
        <Route
          path="/school/welcome"
          element={
            <ProtectedRoute allowRoles={["school_admin"]}>
              <SchoolWelcomePage />
            </ProtectedRoute>
          }
        />

        {/* โซนที่มี sidebar + outlet */}
        <Route
          path="/school"
          element={
            <ProtectedRoute allowRoles={["school_admin"]}>
              <SchoolLayout />
            </ProtectedRoute>
          }
        >
          {/* default ของ /school */}
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<SchoolDashboardPage />} />
          <Route path="projects/manage" element={<SchoolProjectManageGatePage />} />
          <Route path="request/new" element={<SchoolRequestCreatePage />} />
          <Route path="projects/:requestId" element={<SchoolRequestManagePage />} />
          <Route path="donations" element={<SchoolDonationsPage />} />
          <Route path="/school/projects/:id/edit" element={<EditProjectPage />} />

        </Route>


            {/* Admin */}
            <Route path="/admin/login" element={<AdminLoginPage />} />

            <Route element={<AdminGuard />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<Navigate to="/admin/backoffice" replace />} />
                <Route path="/admin/backoffice" element={<AdminBackofficePage />} />
                <Route path="/admin/schools" element={<AdminSchoolsPage />} />
    
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
