// Authentication JavaScript
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm")
  const registerForm = document.getElementById("registerForm")

  // Login Form Handler
  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault()

      const email = document.getElementById("email").value
      const password = document.getElementById("password").value

      // Basic validation
      if (!email.endsWith(".edu")) {
        showError("emailError", "Please use a valid university email (.edu)")
        return
      }

      // Here you would typically make an API call to your Flask backend
      console.log("Login attempt:", { email, password })

      // Simulate successful login
      alert("Login successful! Redirecting...")
      window.location.href = "/"
    })
  }

  // Register Form Handler
  if (registerForm) {
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault()

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

      // Here you would typically make an API call to your Flask backend
      console.log("Registration attempt:", { fullname, email, password })

      // Simulate successful registration
      alert("Registration successful! Please login.")
      window.location.href = "/login"
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
