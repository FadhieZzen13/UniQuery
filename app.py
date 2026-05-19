from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def landing():
    return render_template('home.html')

@app.route('/home')
def home():
    return render_template('home.html')

@app.route('/index')
def index():
    return render_template('index.html')

@app.route('/feed')
def feed():
    return render_template('index.html')

@app.route('/login')
def login():
    return render_template('login.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/question/<int:question_id>')
def question(question_id):
    return render_template('question.html')

if __name__ == '__main__':
    app.run(debug=True)
