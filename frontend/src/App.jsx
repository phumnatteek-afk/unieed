import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
// login/register/forgot-password
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./features/auth/pages/LoginPage.jsx";
import RegisterChoicePage from "./features/auth/pages/RegisterChoicePage.jsx";
import RegisterGeneralPage from "./features/auth/pages/RegisterGeneralPage.jsx";
import RegisterSchoolPage from "./features/auth/pages/RegisterSchoolPage.jsx";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./features/auth/pages/ResetPasswordPage.jsx";
import VerifyEmailPage from "./features/auth/pages/VerifyEmailPage.jsx";
import ResendVerificationPage from "./features/auth/pages/ResendVerificationPage.jsx";

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
import SchoolAppointmentPage from "./features/school/pages/SchoolAppointmentPage.jsx";
import SchoolTestimonialPage from "./features/school/pages/SchoolTestimonialPage.jsx";

import RoleRedirect from "./routes/RoleRedirect.jsx";
import FallbackRedirect from "./routes/FallbackRedirect.jsx";
import QRScanPage from "./features/donate/pages/QRScanPage.jsx";

import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import AdminLoginPage from "./features/admin/pages/AdminLoginPage.jsx";
import AdminBackofficePage from "./features/admin/pages/AdminBackofficePage.jsx";
import AdminSchoolsPage from "./features/admin/pages/AdminSchoolsPage.jsx";
import AdminGuard from "./routes/AdminGuard.jsx";
import AdminLayout from "./features/admin/layouts/AdminLayout.jsx";

import ProjectDetailPage from "./features/project/pages/ProjectDetailPage.jsx";
import DonatePage from "./features/project/pages/Donatepage.jsx";
import DonateMarketPage from "./features/donate/pages/DonateMarketPage.jsx"; // ถ้ายังไม่มี ให้สร้างหน้า placeholder
// ส่วนหน้าเมนู
import DonationProject from "./features/project/pages/DonationProject.jsx";
// market
import PostProductPage from "./features/market/pages/PostProductPage.jsx";
import MarketPage from "./features/market/pages/MarketPage.jsx";
import "./App.css";
import ProductDetailPage from "./features/market/pages/ProductDetailPage.jsx";
import CartPage from "./features/market/pages/CartPage.jsx";
import CheckoutPage from "./features/market/pages/CheckoutPage.jsx";
import { CartProvider } from "./features/market/context/CartContext.jsx";

import PaymentSuccessPage from "./features/market/pages/PaymentSuccessPage.jsx";



export default function App() {
  return (
    <div className="page-container">
      <AuthProvider>
        <BrowserRouter>
          <CartProvider>
            <Routes>
              {/* Public */}
              <Route path="/" element={<RoleRedirect><HomePage /></RoleRedirect>} />
              <Route path="/projects" element={<RoleRedirect><DonationProject /></RoleRedirect>} />
              <Route path="/login" element={<RoleRedirect><LoginPage /></RoleRedirect>} />

              <Route path="/register" element={<RoleRedirect><RegisterChoicePage /></RoleRedirect>} />
              <Route path="/register/general" element={<RoleRedirect><RegisterGeneralPage /></RoleRedirect>} />
              <Route path="/register/school" element={<RoleRedirect><RegisterSchoolPage /></RoleRedirect>} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/resend-verification" element={<ResendVerificationPage />} />

              <Route path="/projects/:requestId" element={<RoleRedirect><ProjectDetailPage /></RoleRedirect>} />
              <Route path="/donate/:requestId" element={<RoleRedirect><DonatePage /></RoleRedirect>} />
              <Route path="/market" element={<RoleRedirect><MarketPage /></RoleRedirect>} />
              <Route path="/sell" element={<RoleRedirect><PostProductPage /></RoleRedirect>} />
              <Route path="/market/:id" element={<RoleRedirect><ProductDetailPage /></RoleRedirect>} />
              <Route path="/cart" element={<RoleRedirect><CartPage /></RoleRedirect>} />
              <Route path="/checkout" element={<RoleRedirect><CheckoutPage /></RoleRedirect>} />
              <Route path="/donate/:projectId/market" element={<RoleRedirect><DonateMarketPage /></RoleRedirect>} />
              <Route path="/checkout/success" element={<PaymentSuccessPage />} />

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
                <Route path="appointments" element={<SchoolAppointmentPage />} />
                <Route path="testimonials" element={<SchoolTestimonialPage />} />

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
              <Route path="*" element={<FallbackRedirect />} />
            </Routes>
          </CartProvider>
        </BrowserRouter>
      </AuthProvider>

    </div>
  );
}
