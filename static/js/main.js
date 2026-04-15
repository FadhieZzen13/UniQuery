// Main Feed JavaScript
document.addEventListener("DOMContentLoaded", () => {
  // Sample data
  const sampleQuestions = [
    {
      id: 1,
      title: "How do I apply for bursary at our university?",
      preview: "I'm a first-year student and I'm trying to understand the bursary application process...",
      votes: 24,
      answers: 3,
      tags: ["Bursary", "Financial-Aid", "FYP"],
      author: "Sarah Johnson",
      authorInitials: "SJ",
      timestamp: "2 hours ago",
      category: "administrative",
    },
    {
      id: 2,
      title: "What are the prerequisites for Advanced Calculus?",
      preview:
        "I want to register for Advanced Calculus next semester. Can someone tell me what the prerequisites are?",
      votes: 15,
      answers: 5,
      tags: ["Math", "Registration", "Academic"],
      author: "Mike Chen",
      authorInitials: "MC",
      timestamp: "5 hours ago",
      category: "academic",
    },
    {
      id: 3,
      title: "When does the library close on weekends?",
      preview: "I need to study this weekend but I can't find the library hours anywhere.",
      votes: 8,
      answers: 2,
      tags: ["Library", "Facilities", "Study"],
      author: "Lisa Park",
      authorInitials: "LP",
      timestamp: "1 day ago",
      category: "hostel",
    },
    {
      id: 4,
      title: "Looking for study partners for Computer Science 101",
      preview: "Hey everyone! I'm struggling with some concepts in CS101 and would love to form a study group.",
      votes: 12,
      answers: 7,
      tags: ["Study-Group", "CS101", "Computer-Science"],
      author: "David Wilson",
      authorInitials: "DW",
      timestamp: "3 hours ago",
      category: "student-life",
    },
    {
      id: 5,
      title: "How to reset my student portal password?",
      preview: "I forgot my password and can't access the student portal. What should I do?",
      votes: 6,
      answers: 4,
      tags: ["Portal", "IT-Support", "Help"],
      author: "Emma Davis",
      authorInitials: "ED",
      timestamp: "6 hours ago",
      category: "administrative",
    },
  ]

  let currentCategory = "all"

  // Render questions
  function renderQuestions(questions) {
    const feedContainer = document.getElementById("questionsFeed")
    if (!feedContainer) return

    feedContainer.innerHTML = ""

    const filteredQuestions =
      currentCategory === "all" ? questions : questions.filter((q) => q.category === currentCategory)

    filteredQuestions.forEach((question) => {
      const card = createQuestionCard(question)
      feedContainer.appendChild(card)
    })
  }

  // Create question card element
  function createQuestionCard(question) {
    const card = document.createElement("div")
    card.className = "question-card"
    card.onclick = () => (window.location.href = `/question/${question.id}`)

    card.innerHTML = `
            <div class="vote-section">
                <button class="vote-btn vote-up" onclick="event.stopPropagation(); vote(${question.id}, 1)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 4l8 8H4l8-8z" fill="currentColor"/>
                    </svg>
                </button>
                <span class="vote-count">${question.votes}</span>
                <button class="vote-btn vote-down" onclick="event.stopPropagation(); vote(${question.id}, -1)">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M12 20l-8-8h16l-8 8z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
            <div class="question-card-content">
                <h3 class="question-card-title">${question.title}</h3>
                <p class="question-card-preview">${question.preview}</p>
                <div class="question-card-tags">
                    ${question.tags.map((tag) => `<span class="tag">#${tag}</span>`).join("")}
                </div>
                <div class="question-card-footer">
                    <div class="author-info">
                        <div class="author-avatar-small">${question.authorInitials}</div>
                        <span>${question.author}</span>
                    </div>
                    <span>${question.timestamp}</span>
                    <span class="answer-count">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M2 2h12v10H4l-2 2V2z" stroke="currentColor" stroke-width="2" fill="none"/>
                        </svg>
                        ${question.answers} Answers
                    </span>
                </div>
            </div>
        `

    return card
  }

  // Vote function
  window.vote = (questionId, direction) => {
    console.log(`Voted ${direction > 0 ? "up" : "down"} on question ${questionId}`)
    // Here you would make an API call to your Flask backend
    alert(`Vote ${direction > 0 ? "up" : "down"} recorded!`)
  }

  // Hamburger menu toggle
  const hamburger = document.getElementById("hamburger")
  const sidebar = document.getElementById("sidebar")

  if (hamburger && sidebar) {
    hamburger.addEventListener("click", () => {
      sidebar.classList.toggle("active")
    })
  }

  // Category filter
  const categoryItems = document.querySelectorAll(".category-item")
  categoryItems.forEach((item) => {
    item.addEventListener("click", function () {
      categoryItems.forEach((i) => i.classList.remove("active"))
      this.classList.add("active")
      currentCategory = this.dataset.category
      renderQuestions(sampleQuestions)

      // Update header
      const feedHeader = document.querySelector(".feed-header h1")
      if (feedHeader) {
        const categoryText =
          currentCategory === "all" ? "All Questions" : this.querySelector("span:last-child").textContent
        feedHeader.textContent = categoryText
      }
    })
  })

  // Ask Question Modal
  const askQuestionBtn = document.getElementById("askQuestionBtn")
  const modal = document.getElementById("askQuestionModal")
  const closeModal = document.getElementById("closeModal")
  const cancelBtn = document.getElementById("cancelBtn")
  const questionForm = document.getElementById("questionForm")

  if (askQuestionBtn && modal) {
    askQuestionBtn.addEventListener("click", () => {
      modal.classList.add("active")
    })
  }

  if (closeModal) {
    closeModal.addEventListener("click", () => {
      modal.classList.remove("active")
    })
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      modal.classList.remove("active")
    })
  }

  // Close modal when clicking outside
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active")
      }
    })
  }

  // Question Form Submit
  if (questionForm) {
    questionForm.addEventListener("submit", (e) => {
      e.preventDefault()

      const formData = {
        title: document.getElementById("questionTitle").value,
        body: document.getElementById("questionBody").value,
        category: document.getElementById("questionCategory").value,
        tags: document
          .getElementById("questionTags")
          .value.split(",")
          .map((t) => t.trim()),
      }

      console.log("New question:", formData)

      // Here you would make an API call to your Flask backend
      alert("Question posted successfully!")
      modal.classList.remove("active")
      questionForm.reset()
    })
  }

  // Initial render
  renderQuestions(sampleQuestions)
})
