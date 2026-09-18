# Job Application Tracker

A Flask and SQLite app for tracking job applications, interviews, and offers.
The interface uses a Swiss editorial design with Helvetica Neue, white surfaces,
fine grid lines, and Yves Klein blue. No frontend build step or external font
service is required. The original photography returns as a crossfading landing-page
background, with photo selection and reduced-motion support.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000. Create an account or sign in to view your applications.
Run commands from the repository root so the app uses the correct SQLite database.

## Features

- Search by company or position and filter by status.
- Click application totals to filter the list; click column headings to sort.
- Add and edit application details, job links, salary ranges, and notes.
- Confirm deletions before removing an application.
- Export all applications to CSV, independently of active filters.
- Responsive layouts and keyboard-accessible dialogs with Escape to close.

## Browser smoke test

Install the optional test dependency and ensure Google Chrome is installed:

```sh
pip install playwright
python tests/browser_smoke.py
```

The test starts a temporary local server and uses a separate temporary database.
It covers registration, sign-in errors, application creation/editing/deletion,
search, filters, sorting, export, request-error recovery, mobile/tablet layouts, and slideshow playback and reduced-motion behavior.
Set `SCREENSHOT_DIR` to save screenshots of the test fixtures.
