// Authentication JavaScript
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm")
  const registerForm = document.getElementById("registerForm")

  // Helper to clear existing error messages
  function clearErrors() {
    document.querySelectorAll(".error-message").forEach(el => {
      el.textContent = ""
      el.style.display = "none"
    })
  }

  // Login Form Handler
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      clearErrors()

      const email = document.getElementById("email").value
      const password = document.getElementById("password").value

      // Basic validation
      if (!email.endsWith(".edu")) {
        showError("emailError", "Please use a valid university email (.edu)")
        return
      }

      try {
        // Real API call to your Node.js/Express backend
        const response = await fetch("http://localhost:5000/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        })

        const data = await response.json()

        if (!response.ok) {
          showError("emailError", data.error || "Login failed")
          return
        }

        // Store the JWT token securely for future authenticated requests
        localStorage.setItem("token", data.token)
        
        alert("Login successful! Redirecting...")
        window.location.href = "/"
      } catch (error) {
        console.error("Login error:", error)
        alert("An error occurred during login. Please try again.")
      }
    })
  }

  // Register Form Handler
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault()
      clearErrors()

      const fullname = document.getElementById("fullname").value
      const email = document.getElementById("email").value
      const password = document.getElementById("password").value
      const confirmPassword = document.getElementById("confirmPassword").value

      // Validation
      if (!email.endsWith(".edu")) {
        showError("emailError", "Please use a valid university email (.edu)")
        return
      }

      if (password !== confirmPassword) {
        showError("confirmError", "Passwords do not match")
        return
      }

      if (password.length < 8) {
        alert("Password must be at least 8 characters long")
        return
      }

      try {
        // Real API call to your Node.js/Express backend
        const response = await fetch("http://localhost:5000/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: fullname, email, password })
        })

        const data = await response.json()

        if (!response.ok) {
          showError("emailError", data.error || "Registration failed")
          return
        }

        alert("Registration successful! Please login.")
        window.location.href = "/login"
      } catch (error) {
        console.error("Registration error:", error)
        alert("An error occurred during registration. Please try again.")
      }
    })
  }

  function showError(elementId, message) {
    const errorElement = document.getElementById(elementId)
    if (errorElement) {
      errorElement.textContent = message
      errorElement.style.display = "block"
    }
  }
})