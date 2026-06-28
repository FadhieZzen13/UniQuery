import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import OnboardingPage from "./pages/OnboardingPage";
import Dashboard from "./pages/Dashboard";
import QuestionDetail from "./pages/QuestionDetail";
import Moderation from "./pages/Moderation";
import Admin from "./pages/Admin";
import Search from "./pages/Search";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user && (!user.onboardingCompleted || user.needsCourseEnrollment)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

// Role-gated route - authenticated + onboarded users whose role is allowed.
// Students hitting an admin/moderation URL are bounced to their dashboard.
const RoleRoute = ({
  allowedRoles,
  children,
}: {
  allowedRoles: Array<"ADMIN" | "FACULTY" | "STUDENT">;
  children: React.ReactNode;
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user && (!user.onboardingCompleted || user.needsCourseEnrollment)) {
    return <Navigate to="/onboarding" replace />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Onboarding route - requires auth but not completed onboarding
const OnboardingRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (user && user.onboardingCompleted && !user.needsCourseEnrollment) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Index route - redirect if already authenticated
const IndexRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user && (!user.onboardingCompleted || user.needsCourseEnrollment)) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// Auth route - redirect if already authenticated
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user && (!user.onboardingCompleted || user.needsCourseEnrollment)) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<IndexRoute><Index /></IndexRoute>} />
    <Route
      path="/auth"
      element={
        <AuthRoute>
          <AuthPage />
        </AuthRoute>
      }
    />
    <Route
      path="/onboarding"
      element={
        <OnboardingRoute>
          <OnboardingPage />
        </OnboardingRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/question/:id"
      element={
        <ProtectedRoute>
          <QuestionDetail />
        </ProtectedRoute>
      }
    />
    <Route
      path="/moderation"
      element={
        <RoleRoute allowedRoles={["FACULTY", "ADMIN"]}>
          <Moderation />
        </RoleRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <RoleRoute allowedRoles={["ADMIN"]}>
          <Admin />
        </RoleRoute>
      }
    />
    <Route
      path="/search"
      element={
        <ProtectedRoute>
          <Search />
        </ProtectedRoute>
      }
    />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
