#!/usr/bin/env bash
set -e

echo "Upgrading pip..."
pip install --upgrade pip

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Installing gunicorn..."
pip install gunicorn

echo "Build complete."
