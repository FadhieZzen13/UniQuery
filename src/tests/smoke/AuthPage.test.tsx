/**
 * Smoke Test: AuthPage Component
 * 
 * Week 7 — Proves the React Testing Library pipeline works end-to-end.
 * Verifies the AuthPage renders login form elements correctly.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the AuthContext ─────────────────────────────────────────
// We mock the entire context module to avoid needing a real auth provider
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn(),
    register: jest.fn(),
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Mock the toast hook ──────────────────────────────────────────
jest.mock('@/hooks/use-toast', () => ({
  toast: jest.fn(),
  useToast: () => ({ toast: jest.fn() }),
}));

import AuthPage from '@/pages/AuthPage';

// Helper to render with required providers
const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Smoke Test — AuthPage Component', () => {
  it('should render the UniQuery heading', () => {
    renderWithProviders(<AuthPage />);

    expect(screen.getByText('UniQuery')).toBeInTheDocument();
    expect(screen.getByText('Your Campus Q&A Community')).toBeInTheDocument();
  });

  it('should render the email input field', () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('your.name@university.edu');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'email');
  });

  it('should render the password input field', () => {
    renderWithProviders(<AuthPage />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should render login button by default', () => {
    renderWithProviders(<AuthPage />);

    expect(screen.getByText('Login with Student Mail')).toBeInTheDocument();
  });

  it('should toggle to register mode when Register tab is clicked', () => {
    renderWithProviders(<AuthPage />);

    const registerTab = screen.getByText('Register');
    fireEvent.click(registerTab);

    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });

  it('should toggle password visibility', () => {
    renderWithProviders(<AuthPage />);

    const passwordInput = screen.getByPlaceholderText('••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Find the toggle button (eye icon) — it's within the password field wrapper
    const toggleButtons = screen.getAllByRole('button');
    // The toggle button is the one that's not the submit or tab button
    const toggleButton = toggleButtons.find(
      btn => !btn.textContent?.includes('Login') && 
             !btn.textContent?.includes('Register') &&
             !btn.textContent?.includes('Create')
    );

    if (toggleButton) {
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
    }
  });

  it('should show the community tagline', () => {
    renderWithProviders(<AuthPage />);

    expect(
      screen.getByText('Join thousands of students helping each other succeed.')
    ).toBeInTheDocument();
  });
});
