# UniQuery - Campus Q&A Forum

A high-fidelity web MVP for a centralized campus Q&A forum for university students, built with Flask.

## Features

- **Authentication**: Login and registration with university email validation
- **Main Feed**: Browse questions by category with voting system
- **Question Detail**: View full questions with answers and verified responses
- **Ask Questions**: Modal interface to post new questions with categories and tags
- **Responsive Design**: Mobile-friendly interface with hamburger menu
- **Vote System**: Upvote/downvote questions and answers

## Installation

1. Install Flask:
```bash
pip install flask
```

2. Run the application:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
├── app.py                 # Flask application
├── templates/             # HTML templates
│   ├── index.html        # Main feed
│   ├── login.html        # Login page
│   ├── register.html     # Registration page
│   └── question.html     # Question detail page
├── static/
│   ├── css/
│   │   └── style.css     # All styles
│   └── js/
│       ├── auth.js       # Authentication logic
│       ├── main.js       # Main feed logic
│       └── question.js   # Question detail logic
└── README.md
```

## Usage

1. **Login/Register**: Start at `/login` or `/register`
2. **Browse Questions**: View all questions on the home page
3. **Filter by Category**: Use sidebar to filter by Academic, Administrative, Hostel, or Student Life
4. **Ask a Question**: Click "Ask Question" button in navbar
5. **View Details**: Click any question card to see full details and answers
6. **Vote**: Use up/down arrows to vote on questions and answers

## Technologies

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Design**: Clean, academic-focused responsive design
- **Icons**: SVG icons for lightweight performance

## Next Steps

To make this production-ready, you'll need to:

1. Add database integration (SQLite, PostgreSQL, etc.)
2. Implement actual authentication with sessions
3. Create API endpoints for voting, posting questions/answers
4. Add form validation on the backend
5. Implement search functionality
6. Add user profiles and reputation system
