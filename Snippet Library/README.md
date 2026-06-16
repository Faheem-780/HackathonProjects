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
