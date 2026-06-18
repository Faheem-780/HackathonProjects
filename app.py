"""
Collaborative Code Snippet Library - Main Flask Application
A CRUD web app for saving, viewing, searching, and copying code snippets.
Includes user authentication (signup/login), project management, and per-account storage.
Built for NextGenHacks hackathon.
"""

from flask import Flask, render_template, request, jsonify, redirect, url_for, flash, Response, send_file, session, abort
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from models import db, Snippet, User, Project, SnippetVersion
import os
import io
import json
import zipfile
import secrets
import time
import requests as http_requests
from datetime import datetime
from functools import wraps
from urllib.parse import urlparse

# Load environment variables from .env file (optional)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# AI client setup (optional - supports Gemini, Groq, or OpenAI)
AI_CLIENT = None
AI_MODEL = os.environ.get('AI_MODEL', 'gemini-2.0-flash')
try:
    from openai import OpenAI
    # Priority: GROQ > GEMINI > OPENAI
    _groq_key = os.environ.get('GROQ_API_KEY')
    _gemini_key = os.environ.get('GEMINI_API_KEY')
    _openai_key = os.environ.get('OPENAI_API_KEY')

    if _groq_key:
        _base_url = os.environ.get('AI_BASE_URL', 'https://api.groq.com/openai/v1')
        AI_CLIENT = OpenAI(api_key=_groq_key, base_url=_base_url)
        print(f"AI client initialized (Groq) with model: {AI_MODEL}")
    elif _gemini_key:
        _base_url = os.environ.get('AI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta/openai/')
        AI_CLIENT = OpenAI(api_key=_gemini_key, base_url=_base_url)
        print(f"AI client initialized (Gemini) with model: {AI_MODEL}")
    elif _openai_key:
        _base_url = os.environ.get('AI_BASE_URL', 'https://api.openai.com/v1')
        AI_CLIENT = OpenAI(api_key=_openai_key, base_url=_base_url)
        print(f"AI client initialized (OpenAI) with model: {AI_MODEL}")
    else:
        print("AI: No API key found (set GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY in .env). AI explain disabled.")
except ImportError:
    print("AI: 'openai' package not installed. AI explain disabled.")

# ============================================================================
# App Configuration
# ============================================================================

app = Flask(__name__)

# Database configuration (SQLite local database)
basedir = os.path.abspath(os.path.dirname(__file__))
# Use Render persistent disk (/data) when available, fallback to local directory
data_dir = os.environ.get('RENDER_DISK_PATH', basedir)
os.makedirs(data_dir, exist_ok=True)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(data_dir, 'snippets.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# Use env var for secret key; generate a secure random one as fallback
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))

# Initialize extensions
db.init_app(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access your snippets.'
login_manager.login_message_category = 'info'


# ============================================================================
# CSRF Protection Helpers
# ============================================================================

def generate_csrf_token():
    """Generate a CSRF token and store it in the session."""
    if 'csrf_token' not in session:
        session['csrf_token'] = secrets.token_hex(32)
    return session['csrf_token']


def validate_csrf_token():
    """Validate the CSRF token from request headers or form data."""
    token = (
        request.headers.get('X-CSRFToken')
        or request.headers.get('X-CSRF-Token')
        or request.form.get('csrf_token')
    )
    if not token or token != session.get('csrf_token'):
        abort(403)


def csrf_protect(f):
    """Decorator to protect a route from CSRF attacks."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
            validate_csrf_token()
        return f(*args, **kwargs)
    return decorated


# ============================================================================
# Simple In-Memory Rate Limiter
# ============================================================================

_rate_limit_store = {}  # key -> list of timestamps

def rate_limit(max_requests, window_seconds):
    """
    Decorator that limits requests per IP address.
    Usage: @rate_limit(max_requests=5, window_seconds=60) → 5 requests per minute
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            key = f"{f.__name__}:{request.remote_addr}"
            now = time.time()
            # Clean old entries
            _rate_limit_store.setdefault(key, [])
            _rate_limit_store[key] = [t for t in _rate_limit_store[key] if now - t < window_seconds]
            if len(_rate_limit_store[key]) >= max_requests:
                return jsonify({'error': 'Too many requests. Please slow down.'}), 429
            _rate_limit_store[key].append(now)
            return f(*args, **kwargs)
        return decorated
    return decorator


# Inject CSRF token into all rendered templates
@app.context_processor
def inject_csrf():
    return {'csrf_token': generate_csrf_token()}


# Global CSRF check on all state-changing requests (skip login/signup — no session yet)
@app.before_request
def csrf_protect_global():
    if request.method in ('POST', 'PUT', 'DELETE', 'PATCH'):
        # Skip CSRF for routes that don't have a session yet
        if request.endpoint in ('login', 'signup', 'static'):
            return
        validate_csrf_token()


@login_manager.user_loader
def load_user(user_id):
    """Flask-Login callback to load a user by ID from the session."""
    return db.session.get(User, int(user_id))


# ============================================================================
# Supported Programming Languages (used in templates and validation)
# ============================================================================

SUPPORTED_LANGUAGES = [
    'Python', 'JavaScript', 'TypeScript', 'C', 'C++', 'C#', 'Java',
    'Kotlin', 'Swift', 'Go', 'Rust', 'Ruby', 'PHP', 'Dart', 'Scala',
    'R', 'Perl', 'Lua', 'Haskell', 'Elixir', 'Clojure', 'Shell',
    'SQL', 'HTML', 'CSS', 'YAML', 'JSON', 'XML', 'Markdown',
    'Assembly', 'MATLAB', 'Objective-C', 'Groovy', 'PowerShell', 'Other'
]


# ============================================================================
# Authentication Routes (Signup / Login / Logout)
# ============================================================================

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    """
    User registration page.
    GET: Render signup form.
    POST: Create new user account with hashed password.
    """
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        display_name = request.form.get('display_name', '').strip()

        # Validation
        if not username or not email or not password:
            flash('Username, email, and password are required.', 'danger')
            return render_template('signup.html')

        if len(password) < 6:
            flash('Password must be at least 6 characters long.', 'danger')
            return render_template('signup.html')

        # Check if username or email already exists
        if User.query.filter_by(username=username).first():
            flash('Username already taken. Please choose another.', 'danger')
            return render_template('signup.html')

        if User.query.filter_by(email=email).first():
            flash('Email already registered. Please use another.', 'danger')
            return render_template('signup.html')

        # Create new user with hashed password
        hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
        new_user = User(
            username=username,
            email=email,
            password_hash=hashed_password,
            display_name=display_name or username
        )

        db.session.add(new_user)
        db.session.commit()

        # Log the user in automatically after signup
        login_user(new_user)
        flash(f'Welcome, {new_user.display_name}! Your account has been created.', 'success')
        return redirect(url_for('index'))

    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
@rate_limit(max_requests=10, window_seconds=60)  # 10 login attempts per minute
def login():
    """
    User login page.
    GET: Render login form.
    POST: Authenticate user with username/email and password.
    """
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    if request.method == 'POST':
        identifier = request.form.get('identifier', '').strip()  # username or email
        password = request.form.get('password', '')

        if not identifier or not password:
            flash('Please enter your username/email and password.', 'danger')
            return render_template('login.html')

        # Find user by username or email
        user = User.query.filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()

        if user and bcrypt.check_password_hash(user.password_hash, password):
            login_user(user, remember=True)
            flash(f'Welcome back, {user.display_name}!', 'success')

            # Redirect to the page the user was trying to access, or index
            # Validate next_page to prevent open redirect attacks
            next_page = request.args.get('next')
            if next_page:
                parsed = urlparse(next_page)
                # Only allow relative redirects (same origin)
                if parsed.netloc and parsed.netloc != request.host:
                    next_page = None
            return redirect(next_page or url_for('index'))
        else:
            flash('Invalid username/email or password.', 'danger')

    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    """Log out the current user and redirect to login page."""
    logout_user()
    flash('You have been logged out successfully.', 'info')
    return redirect(url_for('login'))


# ============================================================================
# Profile API Routes (Edit user profile)
# ============================================================================

@app.route('/api/profile', methods=['GET'])
@login_required
def get_profile():
    """Get the current user's profile data."""
    return jsonify(current_user.to_dict())


@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    """
    Update the current user's profile.

    Expected JSON body (all optional):
        - display_name: Display name shown in UI
        - occupation: Job title or role
        - bio: Short bio/about text
        - location: City, country, or region
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided.'}), 400

    user = current_user

    if 'display_name' in data:
        val = data['display_name'].strip()
        if val:
            user.display_name = val

    if 'occupation' in data:
        user.occupation = data['occupation'].strip()[:100]

    if 'bio' in data:
        user.bio = data['bio'].strip()[:500]

    if 'location' in data:
        user.location = data['location'].strip()[:100]

    # Optionally update email
    if 'email' in data:
        new_email = data['email'].strip()
        if new_email and new_email != user.email:
            existing = User.query.filter(User.email == new_email, User.id != user.id).first()
            if existing:
                return jsonify({'error': 'That email is already in use.'}), 400
            user.email = new_email

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully.', 'profile': user.to_dict()})


# ============================================================================
# Page Routes
# ============================================================================

@app.route('/')
@login_required
def index():
    """
    Render the main index page with the current user's snippets and projects.
    """
    snippets = Snippet.query.filter_by(user_id=current_user.id)\
        .order_by(Snippet.created_at.desc()).all()
    projects = Project.query.filter_by(user_id=current_user.id)\
        .order_by(Project.created_at.desc()).all()
    return render_template('index.html', snippets=snippets, projects=projects,
                           languages=SUPPORTED_LANGUAGES,
                           ai_enabled=AI_CLIENT is not None)


# ============================================================================
# Snippet API Routes (JSON endpoints for AJAX operations)
# ============================================================================

@app.route('/api/snippets', methods=['GET'])
@login_required
def get_snippets():
    """
    Get all snippets for the current user, with optional filtering.

    Query Parameters:
        - language: Filter by programming language
        - tag: Filter by tag
        - search: General search across title, description, and tags
        - project_id: Filter by project ID

    Returns:
        JSON array of snippet objects (only the current user's snippets)
    """
    query = Snippet.query.filter_by(user_id=current_user.id)

    # Apply filters
    language = request.args.get('language', '').strip()
    tag = request.args.get('tag', '').strip()
    search = request.args.get('search', '').strip()
    project_id = request.args.get('project_id', '').strip()

    if language:
        query = query.filter(Snippet.language.ilike(f'%{language}%'))

    if tag:
        query = query.filter(Snippet.tags.ilike(f'%{tag}%'))

    if project_id:
        if project_id == 'none':
            query = query.filter(Snippet.project_id.is_(None))
        else:
            query = query.filter(Snippet.project_id == int(project_id))

    if search:
        query = query.filter(
            db.or_(
                Snippet.title.ilike(f'%{search}%'),
                Snippet.description.ilike(f'%{search}%'),
                Snippet.tags.ilike(f'%{search}%'),
                Snippet.language.ilike(f'%{search}%')
            )
        )

    snippets = query.order_by(Snippet.created_at.desc()).all()
    return jsonify([snippet.to_dict() for snippet in snippets])


@app.route('/api/snippets/<int:snippet_id>', methods=['GET'])
@login_required
def get_snippet(snippet_id):
    """Get a single snippet by ID (must belong to current user)."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()
    return jsonify(snippet.to_dict())


@app.route('/api/snippets', methods=['POST'])
@login_required
def create_snippet():
    """
    Create a new code snippet for the current user.

    Expected JSON body:
        - title: Snippet title (required)
        - description: Brief description (optional)
        - code_content: The actual code (required)
        - language: Programming language (required)
        - tags: Comma-separated tags (optional)
        - project_id: Optional project ID to link to
    """
    data = request.get_json()

    if not data or not data.get('title') or not data.get('code_content') or not data.get('language'):
        return jsonify({'error': 'Title, code_content, and language are required fields.'}), 400

    # Handle optional project_id
    project_id = None
    if data.get('project_id'):
        pid = int(data['project_id'])
        # Verify the project belongs to the current user
        project = Project.query.filter_by(id=pid, user_id=current_user.id).first()
        if project:
            project_id = pid

    new_snippet = Snippet(
        title=data['title'].strip(),
        description=data.get('description', '').strip(),
        code_content=data['code_content'],
        language=data['language'].strip(),
        tags=','.join([tag.strip() for tag in data.get('tags', '').split(',') if tag.strip()]),
        user_id=current_user.id,
        project_id=project_id,
        is_public=bool(data.get('is_public', False))
    )

    db.session.add(new_snippet)
    db.session.commit()

    return jsonify(new_snippet.to_dict()), 201


@app.route('/api/snippets/<int:snippet_id>', methods=['PUT'])
@login_required
def update_snippet(snippet_id):
    """Update an existing snippet (must belong to current user). Saves a version snapshot first."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided for update.'}), 400

    # Save current state as a version before applying changes
    max_version = db.session.query(db.func.max(SnippetVersion.version_number))\
        .filter_by(snippet_id=snippet.id).scalar() or 0
    new_version = SnippetVersion(
        snippet_id=snippet.id,
        version_number=max_version + 1,
        code_content=snippet.code_content,
        title=snippet.title,
        description=snippet.description,
        language=snippet.language,
        tags=snippet.tags
    )
    db.session.add(new_version)

    if 'title' in data:
        snippet.title = data['title'].strip()
    if 'description' in data:
        snippet.description = data['description'].strip()
    if 'code_content' in data:
        snippet.code_content = data['code_content']
    if 'language' in data:
        snippet.language = data['language'].strip()
    if 'tags' in data:
        snippet.tags = ','.join([tag.strip() for tag in data['tags'].split(',') if tag.strip()])
    if 'is_public' in data:
        snippet.is_public = bool(data['is_public'])
    if 'project_id' in data:
        if data['project_id'] is None or data['project_id'] == '' or data['project_id'] == 'none':
            snippet.project_id = None
        else:
            pid = int(data['project_id'])
            project = Project.query.filter_by(id=pid, user_id=current_user.id).first()
            if project:
                snippet.project_id = pid

    db.session.commit()

    return jsonify(snippet.to_dict())


@app.route('/api/snippets/<int:snippet_id>', methods=['DELETE'])
@login_required
def delete_snippet(snippet_id):
    """Delete a snippet (must belong to current user)."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()

    db.session.delete(snippet)
    db.session.commit()

    return jsonify({'message': f'Snippet "{snippet.title}" deleted successfully.'})


# ============================================================================
# Project API Routes (JSON endpoints for AJAX operations)
# ============================================================================

@app.route('/api/projects', methods=['GET'])
@login_required
def get_projects():
    """Get all projects for the current user."""
    projects = Project.query.filter_by(user_id=current_user.id)\
        .order_by(Project.created_at.desc()).all()
    return jsonify([project.to_dict() for project in projects])


@app.route('/api/projects', methods=['POST'])
@login_required
def create_project():
    """
    Create a new project for the current user.

    Expected JSON body:
        - name: Project name (required)
        - description: Brief description (optional)
        - color: Hex color code (optional, defaults to blue)
    """
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({'error': 'Project name is required.'}), 400

    new_project = Project(
        name=data['name'].strip(),
        description=data.get('description', '').strip(),
        color=data.get('color', '#0d6efd'),
        user_id=current_user.id
    )

    db.session.add(new_project)
    db.session.commit()

    return jsonify(new_project.to_dict()), 201


@app.route('/api/projects/<int:project_id>', methods=['PUT'])
@login_required
def update_project(project_id):
    """Update an existing project (must belong to current user)."""
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first_or_404()
    data = request.get_json()

    if not data:
        return jsonify({'error': 'No data provided for update.'}), 400

    if 'name' in data:
        project.name = data['name'].strip()
    if 'description' in data:
        project.description = data['description'].strip()
    if 'color' in data:
        project.color = data['color']

    db.session.commit()

    return jsonify(project.to_dict())


@app.route('/api/projects/<int:project_id>', methods=['DELETE'])
@login_required
def delete_project(project_id):
    """
    Delete a project (must belong to current user).
    Snippets in the project are NOT deleted — they become unassigned.
    """
    project = Project.query.filter_by(id=project_id, user_id=current_user.id).first_or_404()

    # Unassign all snippets from this project
    for snippet in project.snippets:
        snippet.project_id = None

    project_name = project.name
    db.session.delete(project)
    db.session.commit()

    return jsonify({'message': f'Project "{project_name}" deleted. Snippets moved to unassigned.'})




# ============================================================================
# Shareable Links - Public Snippet Sharing
# ============================================================================

@app.route('/shared/<token>')
def view_shared_snippet(token):
    """
    Public read-only view of a shared snippet.
    No login required. Anyone with the link can view and copy the code.
    """
    snippet = Snippet.query.filter_by(share_token=token).first_or_404()
    return render_template('shared.html', snippet=snippet)


@app.route('/api/snippets/<int:snippet_id>/share', methods=['POST'])
@login_required
def share_snippet(snippet_id):
    """
    Generate a shareable link for a snippet.
    Creates a unique token that allows public read-only access.
    """
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()

    # Generate token if not already shared
    if not snippet.share_token:
        snippet.generate_share_token()
        db.session.commit()

    # Build the full share URL
    share_url = request.host_url.rstrip('/') + url_for('view_shared_snippet', token=snippet.share_token)

    return jsonify({
        'share_token': snippet.share_token,
        'share_url': share_url,
        'message': f'Shareable link created for "{snippet.title}"'
    })


@app.route('/api/snippets/<int:snippet_id>/unshare', methods=['POST'])
@login_required
def unshare_snippet(snippet_id):
    """
    Revoke the shareable link for a snippet.
    The token is removed and the public link stops working.
    """
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()

    snippet.revoke_share()
    db.session.commit()

    return jsonify({'message': f'Shareable link revoked for "{snippet.title}"'})


# ============================================================================
# AI-Powered Snippet Explanation (Optional - requires GROQ_API_KEY or OPENAI_API_KEY)
# ============================================================================

@app.route('/api/snippets/<int:snippet_id>/explain', methods=['POST'])
@login_required
@rate_limit(max_requests=15, window_seconds=60)  # 15 AI requests per minute
def explain_snippet(snippet_id):
    """
    AI-powered code explanation. Returns a plain-English summary of what the code does,
    plus suggested tags. Requires GROQ_API_KEY or OPENAI_API_KEY in environment.
    """
    if not AI_CLIENT:
        return jsonify({'error': 'AI is not configured. Set GROQ_API_KEY or OPENAI_API_KEY in a .env file.'}), 503

    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()

    try:
        prompt = (
            f"You are a code expert. Analyze this {snippet.language} code snippet titled "
            f"'{snippet.title}'.\n\nCode:\n```\n{snippet.code_content}\n```\n\n"
            "Respond in this exact JSON format (no markdown):\n"
            '{"explanation": "A clear 2-3 sentence explanation of what this code does", '
            '"tags": ["tag1", "tag2", "tag3"], '
            '"complexity": "beginner|intermediate|advanced"}'
        )
        response = AI_CLIENT.chat.completions.create(
            model=AI_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500
        )
        content = response.choices[0].message.content.strip()
        # Try to parse as JSON; fallback to raw text
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            result = {'explanation': content, 'tags': [], 'complexity': 'unknown'}
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'AI request failed: {str(e)}'}), 500


# ============================================================================
# Snippet Version History
# ============================================================================

@app.route('/api/snippets/<int:snippet_id>/versions', methods=['GET'])
@login_required
def get_snippet_versions(snippet_id):
    """Get the edit version history for a snippet (must belong to current user)."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()
    versions = SnippetVersion.query.filter_by(snippet_id=snippet.id)\
        .order_by(SnippetVersion.version_number.desc()).all()
    return jsonify([v.to_dict() for v in versions])


# ============================================================================
# Toggle Public Visibility (for Explore feed)
# ============================================================================

@app.route('/api/snippets/<int:snippet_id>/toggle-public', methods=['POST'])
@login_required
def toggle_public_snippet(snippet_id):
    """Toggle the is_public flag on a snippet (must belong to current user)."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()
    snippet.is_public = not snippet.is_public
    db.session.commit()
    state = 'public' if snippet.is_public else 'private'
    return jsonify({'is_public': snippet.is_public,
                    'message': f'Snippet "{snippet.title}" is now {state}.'})


# ============================================================================
# Analytics Dashboard
# ============================================================================

@app.route('/stats')
@login_required
def stats_page():
    """Render the analytics dashboard page."""
    return render_template('stats.html')


@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    """
    Return aggregated statistics for the current user:
    - Total snippets, projects, shared, public counts
    - Snippets per language
    - Snippets per project
    - Top 15 most-used tags
    - Activity data (snippets created per month, last 12 months)
    """
    user_snippets = Snippet.query.filter_by(user_id=current_user.id).all()
    user_projects = Project.query.filter_by(user_id=current_user.id).all()

    # Language breakdown
    lang_counts = {}
    for s in user_snippets:
        lang_counts[s.language] = lang_counts.get(s.language, 0) + 1

    # Project breakdown
    proj_counts = {}
    for s in user_snippets:
        key = s.project.name if s.project else 'Unassigned'
        proj_counts[key] = proj_counts.get(key, 0) + 1

    # Tag frequency (top 15)
    tag_counts = {}
    for s in user_snippets:
        if s.tags:
            for tag in s.tags.split(','):
                tag = tag.strip().lower()
                if tag:
                    tag_counts[tag] = tag_counts.get(tag, 0) + 1
    top_tags = sorted(tag_counts.items(), key=lambda x: x[1], reverse=True)[:15]

    # Monthly activity (last 12 months)
    monthly = {}
    now = datetime.utcnow()
    for i in range(11, -1, -1):
        d = now.month - i
        y = now.year
        while d <= 0:
            d += 12
            y -= 1
        key = f"{y}-{d:02d}"
        monthly[key] = 0
    for s in user_snippets:
        if s.created_at:
            key = f"{s.created_at.year}-{s.created_at.month:02d}"
            if key in monthly:
                monthly[key] += 1

    return jsonify({
        'total_snippets': len(user_snippets),
        'total_projects': len(user_projects),
        'total_shared': sum(1 for s in user_snippets if s.share_token),
        'total_public': sum(1 for s in user_snippets if s.is_public),
        'language_breakdown': lang_counts,
        'project_breakdown': proj_counts,
        'top_tags': [{'tag': t, 'count': c} for t, c in top_tags],
        'monthly_activity': monthly
    })


# ============================================================================
# Public Explore Feed
# ============================================================================

@app.route('/explore')
def explore_page():
    """Render the public explore feed page (login not required to view)."""
    return render_template('explore.html')


@app.route('/api/explore', methods=['GET'])
def get_explore_snippets():
    """
    Return all publicly shared snippets (is_public=True) across all users.
    Supports ?search=, ?language= query filters.
    """
    query = Snippet.query.filter_by(is_public=True)

    language = request.args.get('language', '').strip()
    search = request.args.get('search', '').strip()

    if language:
        query = query.filter(Snippet.language.ilike(f'%{language}%'))
    if search:
        query = query.filter(
            db.or_(
                Snippet.title.ilike(f'%{search}%'),
                Snippet.description.ilike(f'%{search}%'),
                Snippet.tags.ilike(f'%{search}%')
            )
        )

    snippets = query.order_by(Snippet.created_at.desc()).limit(100).all()
    return jsonify([s.to_dict() for s in snippets])


# ============================================================================
# Export Snippets (JSON / ZIP / single-file download / Markdown copy)
# ============================================================================

@app.route('/api/snippets/export', methods=['GET'])
@login_required
def export_snippets():
    """
    Export all user snippets.
    Query params:
        - format: 'json' (default) or 'zip'
    """
    snippets = Snippet.query.filter_by(user_id=current_user.id).all()
    fmt = request.args.get('format', 'json').lower()

    snippet_data = [s.to_dict() for s in snippets]

    if fmt == 'zip':
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add a manifest JSON
            zf.writestr('snippets_manifest.json', json.dumps(snippet_data, indent=2))
            # Add each snippet as an individual file
            ext_map = {
                'python': '.py', 'javascript': '.js', 'typescript': '.ts',
                'java': '.java', 'c': '.c', 'c++': '.cpp', 'c#': '.cs',
                'go': '.go', 'rust': '.rs', 'ruby': '.rb', 'php': '.php',
                'kotlin': '.kt', 'swift': '.swift', 'html': '.html',
                'css': '.css', 'sql': '.sql', 'shell': '.sh',
                'yaml': '.yaml', 'json': '.json', 'xml': '.xml',
                'markdown': '.md', 'dart': '.dart', 'r': '.r',
            }
            for s in snippets:
                ext = ext_map.get(s.language.lower(), '.txt')
                safe_title = ''.join(c if c.isalnum() or c in ('_', '-', ' ') else '_' for c in s.title)
                filename = f"snippets/{safe_title}{ext}"
                zf.writestr(filename, s.code_content)
        buf.seek(0)
        return send_file(buf, mimetype='application/zip',
                         as_attachment=True, download_filename='snippet_library_export.zip')

    # Default: JSON export
    return Response(
        json.dumps(snippet_data, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': 'attachment; filename=snippet_library_export.json'}
    )


@app.route('/api/snippets/<int:snippet_id>/download', methods=['GET'])
@login_required
def download_snippet(snippet_id):
    """Download a single snippet as its native file type."""
    snippet = Snippet.query.filter_by(id=snippet_id, user_id=current_user.id).first_or_404()

    ext_map = {
        'python': '.py', 'javascript': '.js', 'typescript': '.ts',
        'java': '.java', 'c': '.c', 'c++': '.cpp', 'c#': '.cs',
        'go': '.go', 'rust': '.rs', 'ruby': '.rb', 'php': '.php',
        'kotlin': '.kt', 'swift': '.swift', 'html': '.html',
        'css': '.css', 'sql': '.sql', 'shell': '.sh',
        'yaml': '.yaml', 'json': '.json', 'xml': '.xml',
        'markdown': '.md', 'dart': '.dart', 'r': '.r',
    }
    ext = ext_map.get(snippet.language.lower(), '.txt')
    safe_title = ''.join(c if c.isalnum() or c in ('_', '-', ' ') else '_' for c in snippet.title)
    filename = f"{safe_title}{ext}"

    return Response(
        snippet.code_content,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


# ============================================================================
# GitHub Gist Import
# ============================================================================

@app.route('/api/gists/import', methods=['POST'])
@login_required
def import_gist():
    """
    Import files from a GitHub Gist URL.
    Expected JSON body: { "url": "https://gist.github.com/user/gist_id" }
    Fetches the Gist via GitHub API and creates one snippet per file.
    """
    data = request.get_json()
    gist_url = (data or {}).get('url', '').strip()

    if not gist_url or 'gist.github.com' not in gist_url:
        return jsonify({'error': 'Please provide a valid GitHub Gist URL.'}), 400

    # Convert browser URL to API URL
    # e.g. https://gist.github.com/user/abc123 -> https://api.github.com/gists/abc123
    try:
        if 'api.github.com' not in gist_url:
            parts = gist_url.rstrip('/').split('/')
            gist_id = parts[-1]
            api_url = f'https://api.github.com/gists/{gist_id}'
        else:
            api_url = gist_url

        resp = http_requests.get(api_url, timeout=10)
        if resp.status_code != 200:
            return jsonify({'error': f'GitHub returned status {resp.status_code}. Is the Gist public?'}), 400

        gist_data = resp.json()
        files = gist_data.get('files', {})

        if not files:
            return jsonify({'error': 'No files found in this Gist.'}), 400

        lang_map = {
            '.py': 'Python', '.js': 'JavaScript', '.ts': 'TypeScript',
            '.java': 'Java', '.c': 'C', '.cpp': 'C++', '.cs': 'C#',
            '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby', '.php': 'PHP',
            '.kt': 'Kotlin', '.swift': 'Swift', '.html': 'HTML',
            '.css': 'CSS', '.sql': 'SQL', '.sh': 'Shell',
            '.yaml': 'YAML', '.yml': 'YAML', '.json': 'JSON',
            '.xml': 'XML', '.md': 'Markdown', '.dart': 'Dart',
            '.r': 'R', '.txt': 'Other',
        }

        created = []
        for filename, file_info in files.items():
            ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else '.txt'
            language = file_info.get('language') or lang_map.get(ext, 'Other')
            # Normalize language to match SUPPORTED_LANGUAGES
            for supported in SUPPORTED_LANGUAGES:
                if supported.lower() == language.lower():
                    language = supported
                    break

            snippet = Snippet(
                title=file_info.get('filename', filename),
                description=f'Imported from Gist: {gist_url}',
                code_content=file_info.get('content', ''),
                language=language,
                tags='gist-import,github',
                user_id=current_user.id
            )
            db.session.add(snippet)
            created.append(filename)

        db.session.commit()
        return jsonify({
            'message': f'Successfully imported {len(created)} file(s) from Gist.',
            'files': created
        }), 201

    except http_requests.RequestException as e:
        return jsonify({'error': f'Failed to fetch Gist: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Import failed: {str(e)}'}), 500


# ============================================================================
# Browser Extension API (CORS-enabled endpoints for the Chrome extension)
# ============================================================================

@app.after_request
def add_cors_for_extension(response):
    """Allow the browser extension to communicate with the local server.
    Restricts CORS to same-origin and Chrome extension contexts only.
    Also adds security headers."""
    origin = request.headers.get('Origin', '')
    # Allow same-origin requests and Chrome extension requests
    if origin.startswith('chrome-extension://') or origin == request.host_url.rstrip('/'):
        response.headers['Access-Control-Allow-Origin'] = origin
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRFToken, Cookie'
    response.headers['Access-Control-Allow-Credentials'] = 'true'

    # Security headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

    return response


# ============================================================================
# Database Initialization
# ============================================================================

def init_db():
    """Initialize the database and create all tables.
    If the schema is outdated (missing columns/tables), drops and recreates."""
    with app.app_context():
        import sqlite3
        db_path = os.path.join(data_dir, 'snippets.db')
        needs_rebuild = False

        # Check if existing DB has the correct schema
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)

                # Check snippets table for required columns
                cursor = conn.execute("PRAGMA table_info(snippets)")
                snippet_columns = [row[1] for row in cursor.fetchall()]

                # Check if projects table exists
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
                )
                projects_table_exists = cursor.fetchone() is not None

                # Check if snippet_versions table exists
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='snippet_versions'"
                )
                versions_table_exists = cursor.fetchone() is not None

                conn.close()

                # Check users table for profile columns
                cursor = conn.execute("PRAGMA table_info(users)")
                user_columns = [row[1] for row in cursor.fetchall()]

                if 'user_id' not in snippet_columns or 'project_id' not in snippet_columns \
                        or 'share_token' not in snippet_columns or not projects_table_exists \
                        or 'is_public' not in snippet_columns or not versions_table_exists \
                        or 'occupation' not in user_columns:
                    needs_rebuild = True
                    print("Outdated schema detected. Rebuilding database...")
            except Exception:
                needs_rebuild = True

        if needs_rebuild:
            db.drop_all()

        db.create_all()
        print("Database initialized.")


# ============================================================================
# Application Entry Point
# ============================================================================

if __name__ == '__main__':
    init_db()

    print("\n" + "="*60)
    print("  Collaborative Code Snippet Library")
    print("  NextGenHacks Hackathon Project")
    print("="*60)
    print("  Server running at: http://127.0.0.1:5000")
    print("  Press Ctrl+C to stop the server")
    print("="*60 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5000)
