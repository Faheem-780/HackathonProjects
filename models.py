"""
Database models for the Collaborative Code Snippet Library.
Uses SQLAlchemy ORM with SQLite database.
Includes User authentication, Project, and Snippet models.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
import secrets
from datetime import datetime

# Initialize SQLAlchemy instance
db = SQLAlchemy()


# ============================================================================
# User Model - Authentication & Account Management
# ============================================================================

class User(db.Model, UserMixin):
    """
    User model for authentication and account management.

    Fields:
        - id: Unique identifier (Primary Key)
        - username: Unique username for login
        - email: Unique email address
        - password_hash: Bcrypt hashed password
        - display_name: Optional display name shown in the UI
        - created_at: Account creation timestamp
    """

    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    display_name = db.Column(db.String(100), nullable=True)
    occupation = db.Column(db.String(100), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    location = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One-to-many relationship: User -> Snippets
    snippets = db.relationship('Snippet', backref='author', lazy=True, cascade='all, delete-orphan')

    # One-to-many relationship: User -> Projects
    projects = db.relationship('Project', backref='owner', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        """Convert User object to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'display_name': self.display_name or self.username,
            'occupation': self.occupation or '',
            'bio': self.bio or '',
            'location': self.location or '',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'snippet_count': len(self.snippets),
            'project_count': len(self.projects)
        }

    def __repr__(self):
        return f'<User {self.username}>'


# ============================================================================
# Project Model - Organize Snippets into Projects
# ============================================================================

class Project(db.Model):
    """
    Project model for organizing snippets into logical groups.
    Each project belongs to a specific user.

    Fields:
        - id: Unique identifier (Primary Key)
        - name: Project name
        - description: Brief description of the project
        - color: Hex color code for visual identification
        - user_id: Foreign key linking to the owning User
        - created_at: Timestamp when project was created
    """

    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    color = db.Column(db.String(7), default='#0d6efd')  # Hex color, default Bootstrap blue
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # One-to-many: Project -> Snippets
    snippets = db.relationship('Snippet', backref='project', lazy=True)

    def to_dict(self):
        """Convert Project object to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'color': self.color,
            'user_id': self.user_id,
            'snippet_count': len(self.snippets),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<Project {self.name}>'


# ============================================================================
# Snippet Model - Code Snippet Storage
# ============================================================================

class Snippet(db.Model):
    """
    Snippet model representing a code snippet in the library.
    Each snippet is owned by a specific user and can optionally belong to a project.

    Fields:
        - id: Unique identifier (Primary Key)
        - title: Name/title of the snippet
        - description: Brief description of what the snippet does
        - code_content: The actual code content
        - language: Programming language (e.g., Python, C#, JS)
        - tags: Comma-separated tags for categorization
        - user_id: Foreign key linking to the owning User
        - project_id: Optional foreign key linking to a Project
        - created_at: Timestamp when snippet was created
        - updated_at: Timestamp when snippet was last updated
    """

    __tablename__ = 'snippets'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    code_content = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(50), nullable=False)
    tags = db.Column(db.String(500), nullable=True)  # Comma-separated tags
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    share_token = db.Column(db.String(32), unique=True, nullable=True, index=True)  # null = not shared
    is_public = db.Column(db.Boolean, default=False, nullable=False)  # True = visible on Explore page
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One-to-many: Snippet -> Versions
    versions = db.relationship('SnippetVersion', backref='snippet', lazy=True,
                               order_by='SnippetVersion.version_number.desc()',
                               cascade='all, delete-orphan')

    def to_dict(self):
        """
        Convert Snippet object to dictionary for JSON serialization.

        Returns:
            dict: Dictionary representation of the snippet
        """
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'code_content': self.code_content,
            'language': self.language,
            'tags': self.tags.split(',') if self.tags else [],
            'user_id': self.user_id,
            'project_id': self.project_id,
            'project_name': self.project.name if self.project else None,
            'project_color': self.project.color if self.project else None,
            'share_token': self.share_token,
            'is_public': self.is_public,
            'version_count': len(self.versions) if self.versions else 0,
            'author_name': self.author.display_name or self.author.username if self.author else 'Unknown',
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def generate_share_token(self):
        """Generate a unique share token for public sharing."""
        self.share_token = secrets.token_urlsafe(16)
        return self.share_token

    def revoke_share(self):
        """Revoke the share token (make snippet private again)."""
        self.share_token = None

    def __repr__(self):
        """String representation of the Snippet object."""
        return f'<Snippet {self.title}>'


# ============================================================================
# SnippetVersion Model - Edit History / Versioning
# ============================================================================

class SnippetVersion(db.Model):
    """
    Version history for code snippets.
    A new version is saved each time a snippet is updated, preserving the previous state.

    Fields:
        - id: Unique identifier (Primary Key)
        - snippet_id: Foreign key linking to the parent Snippet
        - version_number: Auto-incrementing version counter per snippet
        - code_content: The code content at this point in time
        - title: The snippet title at this version
        - description: The snippet description at this version
        - language: The language at this version
        - tags: The tags at this version
        - created_at: When this version was saved
    """

    __tablename__ = 'snippet_versions'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    snippet_id = db.Column(db.Integer, db.ForeignKey('snippets.id'), nullable=False, index=True)
    version_number = db.Column(db.Integer, nullable=False, default=1)
    code_content = db.Column(db.Text, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    language = db.Column(db.String(50), nullable=False)
    tags = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert SnippetVersion to dictionary for JSON serialization."""
        return {
            'id': self.id,
            'snippet_id': self.snippet_id,
            'version_number': self.version_number,
            'code_content': self.code_content,
            'title': self.title,
            'description': self.description,
            'language': self.language,
            'tags': self.tags.split(',') if self.tags else [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

    def __repr__(self):
        return f'<SnippetVersion snippet={self.snippet_id} v{self.version_number}>'
