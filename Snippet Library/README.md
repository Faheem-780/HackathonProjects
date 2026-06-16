# 🔐 Collaborative Code Snippet Library

> **Personal code vault with one-click copy and shareable links for teammates**
>
> *Built for NextGenHacks Hackathon 2026*

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-black?logo=flask)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5-purple?logo=bootstrap)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **User Accounts** | Sign up / login with secure bcrypt password hashing |
| 📁 **Projects** | Organize snippets into color-coded projects |
| 💾 **Full CRUD** | Create, read, update, and delete code snippets |
| 🔍 **Real-time Search** | Filter by title, description, language, project, or tag — instantly |
| 🎨 **Syntax Highlighting** | Highlight.js supports 190+ languages |
| 📋 **One-click Copy** | Copy any snippet to clipboard with visual feedback |
| 🔗 **Shareable Links** | Generate public read-only URLs for teammates — no account needed |
| 🚫 **Revoke Access** | Unshare any snippet to invalidate its public link |
| 📱 **Fully Responsive** | Works on desktop, tablet, and mobile |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python, Flask 3.0 |
| **Database** | SQLite + SQLAlchemy ORM |
| **Auth** | Flask-Login + Flask-Bcrypt |
| **Frontend** | HTML5, Bootstrap 5, Vanilla JavaScript |
| **Code Display** | Highlight.js (Atom One Dark theme) |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10 or higher
- pip (Python package manager)

### Installation

```bash
# 1. Clone or navigate to the project
cd snippet-library

# 2. (Optional) Create a virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Run the application
python app.py
```

The server will start at **http://127.0.0.1:5000**

### First Use
1. Click **"Create one"** on the login page to sign up
2. Create a **Project** (e.g., "My Website") via the Projects button
3. Add snippets and assign them to projects
4. Click the **share icon** on any snippet to generate a public link
5. Send the link to a teammate — they can view and copy without an account!

---

## 📂 Project Structure

```
snippet-library/
├── app.py                    # Flask routes (auth, snippets, projects, sharing)
├── models.py                 # SQLAlchemy models (User, Project, Snippet)
├── requirements.txt          # Python dependencies
├── snippets.db               # SQLite database (auto-created)
├── templates/
│   ├── index.html            # Main dashboard (snippet grid + filters)
│   ├── login.html            # Login page
│   ├── signup.html           # Registration page
│   └── shared.html           # Public read-only snippet view
└── static/
    ├── css/
    │   └── style.css         # Custom styles (cards, auth pages, projects)
    └── js/
        └── app.js            # Frontend logic (search, filter, CRUD, sharing)
```

---

## 🎬 2-Minute Demo Script

> Follow this script to record a quick demo video for the hackathon presentation.

### Scene 1: Sign Up (0:00 – 0:15)
1. Open **http://127.0.0.1:5000** in your browser
2. Click **"Create one"** → fill in: username, email, password
3. Show the dashboard with the empty state message

### Scene 2: Create a Project (0:15 – 0:30)
1. Click **"Projects"** in the navbar
2. Create a project: name = "Hackathon App", pick a color
3. Show the project appearing in the project list

### Scene 3: Add Snippets (0:30 – 1:00)
1. Click **"Add Snippet"**
2. Title: "API Route", Language: Python, Project: "Hackathon App"
3. Paste a Flask route as the code
4. Click Save → show the snippet card with the project badge
5. Add a second snippet in a different language (JavaScript fetch example)

### Scene 4: Search & Filter (1:00 – 1:20)
1. Type in the search bar → show instant filtering
2. Select a language from the dropdown → show language filter
3. Select the project from the project filter → show project filter
4. Click **"Clear all"** to reset

### Scene 5: Copy & Share (1:20 – 1:50)
1. Click the **clipboard icon** on a snippet → show "copied" feedback
2. Click the **share icon** → show the share dialog with the URL
3. Click **"Copy"** to copy the link
4. Open the link in an **incognito window** → show the beautiful public view
5. Click **copy** on the public page → show it works without login

### Scene 6: Revoke & Outro (1:50 – 2:00)
1. Go back to the dashboard, click share icon again
2. Click **"Revoke Link"** → show confirmation
3. Try the old link → show 404 page
4. Close with: *"Personal code vault with one-click copy and shareable links — built in Flask for NextGenHacks!"*

---

## 🔒 Security

- Passwords are hashed with **bcrypt** (never stored in plain text)
- Sessions managed via **Flask-Login** with remember-me support
- All snippet/project operations verify **user ownership** (can't access others' data)
- Share tokens use `secrets.token_urlsafe()` — cryptographically secure
- SQL injection prevented by **SQLAlchemy ORM** parameterized queries

---

## 🛠️ API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | Main dashboard |
| POST | `/signup` | ❌ | Create account |
| POST | `/login` | ❌ | Authenticate |
| GET | `/shared/<token>` | ❌ | Public snippet view |
| GET | `/api/snippets` | ✅ | List/filter snippets |
| POST | `/api/snippets` | ✅ | Create snippet |
| PUT | `/api/snippets/<id>` | ✅ | Update snippet |
| DELETE | `/api/snippets/<id>` | ✅ | Delete snippet |
| POST | `/api/snippets/<id>/share` | ✅ | Generate share link |
| POST | `/api/snippets/<id>/unshare` | ✅ | Revoke share link |
| GET | `/api/projects` | ✅ | List projects |
| POST | `/api/projects` | ✅ | Create project |
| PUT | `/api/projects/<id>` | ✅ | Update project |
| DELETE | `/api/projects/<id>` | ✅ | Delete project |

---

## 📝 License

MIT License — Free for personal and commercial use.

---

## 🏆 Hackathon Pitch

> *"Every developer has snippets they reuse — auth flows, API calls, CSS tricks. But they're scattered across files, notes, and bookmarks. Our **Collaborative Code Snippet Library** solves this: a personal code vault where you save, organize by project, and search snippets in real-time. Need to share with a teammate? One click generates a beautiful public link they can view and copy — no account needed. Want it private again? Revoke the link instantly. Built with Flask, Bootstrap 5, and Highlight.js — lightweight, fast, and ready for any team."*

---

*Built with ❤️ for NextGenHacks 2026*
