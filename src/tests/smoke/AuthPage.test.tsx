/**
 * Smoke Test: AuthPage Component
 * 
 * Week 7 — Proves the React Testing Library pipeline works end-to-end.
 * Verifies the AuthPage renders login form elements correctly.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mock the AuthContext ─────────────────────────────────────────
const mockLogin = jest.fn();
const mockRegister = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    register: mockRegister,
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: jest.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ─── Mock the toast hook ──────────────────────────────────────────
const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => mockToast(...args),
  useToast: () => ({ toast: mockToast }),
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
  beforeEach(() => {
    mockLogin.mockReset();
    mockRegister.mockReset();
    mockToast.mockReset();
    mockLogin.mockResolvedValue(undefined);
    mockRegister.mockResolvedValue(undefined);
  });

  it('should render the UniQuery heading', () => {
    renderWithProviders(<AuthPage />);

    expect(screen.getByText('UniQuery')).toBeInTheDocument();
    expect(screen.getByText('Your Campus Q&A Community')).toBeInTheDocument();
  });

  it('should render the email input field', () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('your.name@student.university.edu.my');
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('type', 'text');
    expect(emailInput).toHaveAttribute('inputMode', 'email');
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

  it('shows validation toast when fields are missing', () => {
    renderWithProviders(<AuthPage />);
    fireEvent.click(screen.getByText('Login with Student Mail'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Missing information' })
    );
  });

  it('shows password length validation toast', () => {
    renderWithProviders(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText('your.name@student.university.edu.my'), {
      target: { value: 'student@university.edu' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByText('Login with Student Mail'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Password too short' })
    );
  });

  it('can switch back to login from register', () => {
    renderWithProviders(<AuthPage />);

    fireEvent.click(screen.getByText('Register'));
    expect(screen.getByText('Create Account')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Login'));
    expect(screen.getByText('Login with Student Mail')).toBeInTheDocument();
  });

  it('accepts Malaysian university emails', () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('your.name@student.university.edu.my');
    fireEvent.change(emailInput, { target: { value: '218319@student.upm.edu.my' } });

    expect(screen.queryByText(/Please use a valid university email address/)).not.toBeInTheDocument();
  });

  it('shows email validation error for non-edu addresses', () => {
    renderWithProviders(<AuthPage />);

    const emailInput = screen.getByPlaceholderText('your.name@student.university.edu.my');
    fireEvent.change(emailInput, { target: { value: 'user@gmail.com' } });

    expect(screen.getByText(/Please use a valid university email address/)).toBeInTheDocument();
  });

  it('submits login successfully', async () => {
    renderWithProviders(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText('your.name@student.university.edu.my'), {
      target: { value: 'student@university.edu' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Login with Student Mail'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('student@university.edu', 'password123');
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Welcome back!' }));
  });

  it('submits registration successfully', async () => {
    renderWithProviders(<AuthPage />);

    fireEvent.click(screen.getByText('Register'));
    fireEvent.change(screen.getByPlaceholderText('your.name@student.university.edu.my'), {
      target: { value: 'student@university.edu' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Create Account'));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('student@university.edu', 'password123');
    });
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Account created!' }));
  });

  it('shows login failure toast when auth throws', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    renderWithProviders(<AuthPage />);

    fireEvent.change(screen.getByPlaceholderText('your.name@student.university.edu.my'), {
      target: { value: 'student@university.edu' },
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByText('Login with Student Mail'));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Login failed', description: 'Invalid credentials' })
      );
    });
  });
});
