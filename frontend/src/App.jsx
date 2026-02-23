import { Routes, Route, Navigate } from "react-router-dom";
import { getToken } from "./utils/authStorage.js";
import { getCachedUser } from "./utils/offlineQueue.js";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Home from "./pages/Home.jsx";
import Treino from "./pages/Treino.jsx";
import Maquinas from "./pages/Maquinas.jsx";
import Rotina from "./pages/Rotina.jsx";
import Relatorio from "./pages/Relatorio.jsx";
import Usuarios from "./pages/Usuarios.jsx";
import SwipeNav from "./components/SwipeNav.jsx";
import InstallBanner from "./components/InstallBanner.jsx";

function PrivateRoute({ children }) {
  return getToken() ? <SwipeNav>{children}</SwipeNav> : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  if (getCachedUser()?.role !== "ADMIN") return <Navigate to="/app" replace />;
  return <SwipeNav>{children}</SwipeNav>;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/app" element={<PrivateRoute><Home /></PrivateRoute>} />
        <Route path="/app/treino" element={<PrivateRoute><Treino /></PrivateRoute>} />
        <Route path="/app/maquinas" element={<PrivateRoute><Maquinas /></PrivateRoute>} />
        <Route path="/app/rotina" element={<PrivateRoute><Rotina /></PrivateRoute>} />
        <Route path="/app/relatorio" element={<PrivateRoute><Relatorio /></PrivateRoute>} />
        <Route path="/app/usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <InstallBanner />
    </>
  );
}
