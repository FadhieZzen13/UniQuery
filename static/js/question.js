// Question Detail Page JavaScript
document.addEventListener("DOMContentLoaded", () => {
  // Hamburger menu toggle
  const hamburger = document.getElementById("hamburger")
  const sidebar = document.getElementById("sidebar")

  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }

  // Vote buttons
  const voteButtons = document.querySelectorAll(".vote-btn")
  voteButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault()
      const direction = this.classList.contains("vote-up") ? 1 : -1
      const id = this.dataset.id || "answer"

      console.log(`Voted ${direction > 0 ? "up" : "down"} on ${id}`)

      // Update vote count (demo purposes)
      const voteCount = this.parentElement.querySelector(".vote-count")
      if (voteCount) {
        const currentVotes = Number.parseInt(voteCount.textContent)
        voteCount.textContent = currentVotes + direction
      }

      // Here you would make an API call to your Flask backend
      alert(`Vote ${direction > 0 ? "up" : "down"} recorded!`)
    })
  })

  // Answer Form Submit
  const answerForm = document.getElementById("answerForm")
  if (answerForm) {
    answerForm.addEventListener("submit", (e) => {
      e.preventDefault()

      const answerBody = document.getElementById("answerBody").value

      console.log("New answer:", answerBody)

      // Here you would make an API call to your Flask backend
      alert("Answer posted successfully!")
      answerForm.reset()

      // Optionally scroll to top or refresh answers
      window.scrollTo({ top: 0, behavior: "smooth" })
    })
  }
})
