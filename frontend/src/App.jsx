import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./features/auth/pages/LoginPage.jsx";
import RegisterChoicePage from "./features/auth/pages/RegisterChoicePage.jsx";
import RegisterGeneralPage from "./features/auth/pages/RegisterGeneralPage.jsx";
import RegisterSchoolPage from "./features/auth/pages/RegisterSchoolPage.jsx";
import SchoolPendingPage from "./features/school/pages/SchoolPendingPage.jsx";
import SchoolDashboardPage from "./features/school/pages/SchoolDashboardPage.jsx";
import AdminSchoolsPage from "./features/admin/pages/AdminSchoolsPage.jsx";
import AdminSchoolDetailPage from "./features/admin/pages/AdminSchoolDetailPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterChoicePage />} />
          <Route path="/register/general" element={<RegisterGeneralPage />} />

          {/* สมัครโรงเรียน: ไม่ต้อง login */}
          <Route path="/register/school" element={<RegisterSchoolPage />} />

          {/* School admin */}
          <Route
            path="/school/pending"
            element={
              <ProtectedRoute allowRoles={["school_admin"]}>
                <SchoolPendingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/school/dashboard"
            element={
              <ProtectedRoute allowRoles={["school_admin"]}>
                <SchoolDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Platform admin */}
          <Route
            path="/admin/schools"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <AdminSchoolsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/schools/:id"
            element={
              <ProtectedRoute allowRoles={["admin"]}>
                <AdminSchoolDetailPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
