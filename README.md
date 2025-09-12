# Laundry Management System

A full-stack Laundry Management web application. The frontend is built with HTML/CSS and Bootstrap, the backend is powered by a Python Flask server, and core data operations are handled by a custom-built C executable for performance. Features include user authentication, a digital closet, laundry history tracking, and missing item reports.

## Features

- **User Authentication:** Secure user signup and login system.
- **Digital Closet:** Add, view, and manage your clothes. Upload images for each item.
- **Laundry Management:** Send clothes to laundry and track their status. The system maintains a history of your laundry cycles.
- **Missing Items:** Mark clothes as missing to keep a separate list of lost items.
- **Dashboard:** Get a quick overview of your wardrobe with stats on total, available, in-laundry, and missing clothes.
- **Custom Categories:** Add your own custom categories for clothes.

## Technology Stack

- **Backend:** Python (Flask)
- **Data Operations:** C
- **Frontend:** HTML, CSS, Bootstrap 5
- **Version Control:** Git & GitHub

## Setup and Installation

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Praneeth-236/Laundry-Management-System.git
    cd Laundry-Management-System
    ```

2.  **Set up a Python virtual environment:**
    ```bash
    # For Windows
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Install dependencies:**
    The only major dependency is Flask.
    ```bash
    pip install Flask
    ```

4.  **Compile the C backend:**
    You will need a C compiler like GCC (MinGW on Windows).
    ```bash
    gcc main.c -o a.exe
    ```

5.  **Run the Flask application:**
    ```bash
    flask run
    ```
    The application will be available at `http://127.0.0.1:5000`.

## Usage

1.  Navigate to the application URL.
2.  Sign up for a new account or log in with existing credentials.
3.  Use the "Closet" page to add your clothes.
4.  Use the "Laundry" page to send items to laundry and track their return.
5.  View missing items and overall stats on the Dashboard.
