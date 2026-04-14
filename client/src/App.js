import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./Components/NavBar/Navbar";
import Home from "./Components/Home/Home";
import Footer from "./Components/Footer/Footer";
import Services from "./Components/Services/Services";
import PostPetPage from "./Components/Services/PostPetPage";
import Pets from "./Components/Pets/Pets";
import AdoptForm from "./Components/AdoptForm/AdoptForm";
import AdminLogin from "./Components/AdminPanel/AdminLogin";
import Profile from "./Components/Profile/Profile";
import Auth from "./Components/Auth/Auth";
import { useAuthContext } from './hooks/UseAuthContext';
import { AuthModalProvider } from './Context/AuthModalContext';
import AuthRequiredModal from './Components/AuthRequired/AuthRequiredModal';
import "./App.css";
import FourOhFourPage from "./Components/404/FourOhFourPage";
import Shelters from './Components/Shelters/Shelters';

const Layout = ({ children }) => (
  <>
    <Navbar title="PawFinds" />
    {children}
    <Footer title="PawFinds" />
  </>
);

/** Старые закладки /admin/... → /pawfinds/admin/... */
const LegacyAdminRedirect = () => {
  const { pathname, search, hash } = useLocation();
  const to = pathname.replace(/^\/admin(?=\/|$)/, "/pawfinds/admin") + search + hash;
  return <Navigate to={to} replace />;
};

/** Старый /auth → /pawfinds/auth */
const LegacyAuthRedirect = () => {
  const { search, hash } = useLocation();
  return <Navigate to={`/pawfinds/auth${search}${hash}`} replace />;
};

const App = () => {
  const { user } = useAuthContext();

  return (
    <Router>
      <AuthModalProvider>
        <AuthRequiredModal />
      <Routes>
        <Route 
          path="/" 
          element={
              <Navigate to="/pawfinds" replace />
          } 
        />
        <Route
          path="/pawfinds"
          element={
            <Layout>
              <Home description="Ensure you are fully prepared to provide proper care and attention to your pet before welcoming them into your home." />
            </Layout>
          }
        />
        <Route 
          path="/pawfinds/services"
          element={
              <Layout>
                <Services />
              </Layout>
          } 
        />
        <Route
          path="/pawfinds/post-pet"
          element={
            <Layout>
              <PostPetPage />
            </Layout>
          }
        />
        <Route 
          path="/pawfinds/pets"
          element={
              <Layout>
                <Pets />
              </Layout>
          } 
        />
         <Route 
          path="/pawfinds/profile" 
          element={
              <Layout>
                <Profile />
              </Layout>
          } 
        />
        <Route 
          path="/pawfinds/adopt-form" 
          element={
              <Layout>
                <AdoptForm />
              </Layout>
            } 
          />
          <Route 
            path="/pawfinds/adopt-form/:petId" 
            element={
              <Layout>
                <AdoptForm />
              </Layout>
          } 
        />
        <Route path="/pawfinds/admin/*" element={<AdminLogin />} />
        <Route path="/admin/*" element={<LegacyAdminRedirect />} />
        <Route
          path="/pawfinds/auth"
          element={!user ? <Auth /> : <Navigate to="/pawfinds" replace />}
        />
        <Route path="/auth" element={<LegacyAuthRedirect />} />
          <Route 
          path="/pawfinds/shelters"
            element={
              <Layout>
                <Shelters />
              </Layout>
            } 
          />
         <Route 
          path="/*" 
          element={<FourOhFourPage/>} 
        />
      </Routes>
      </AuthModalProvider>
    </Router>
  );
};

export default App;
