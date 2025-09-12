"""
Laundry Management Flask App
Refactored for clarity, security, and maintainability.
"""
import os
import re
import hashlib
import subprocess
import datetime
import json
from flask import Flask, render_template, request, redirect, url_for, session, flash
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.environ.get('LAUNDRY_SECRET_KEY', 'supersecretkey')

# User data file for simple authentication
USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.txt')
CUSTOM_CATEGORIES_FILE = os.path.join(os.path.dirname(__file__), 'custom_categories.json')

# --- Utility Functions ---
def run_c_program(args):
    """Run the C backend executable with arguments."""
    exe = os.path.join(os.path.dirname(__file__), 'a.exe')
    if not os.path.exists(exe):
        return 'Backend executable not found.'
    try:
        result = subprocess.run([exe] + args, capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except Exception as e:
        return f'Error running backend: {e}'

def ensure_static_dir():
    """Ensure the static directory exists."""
    static_dir = os.path.join(os.path.dirname(__file__), 'static')
    if not os.path.exists(static_dir):
        os.makedirs(static_dir)

def hash_password(password):
    """Hash a password using SHA-256."""
    return hashlib.sha256(password.encode()).hexdigest()

def is_valid_username(username):
    """Validate username (alphanumeric, 3-20 chars)."""
    return bool(re.match(r'^[A-Za-z0-9_]{3,20}$', username))

def is_valid_password(password):
    """Validate password (min 6 chars, at least one number and letter)."""
    return bool(re.match(r'^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$', password))

def register_user(username, password):
    """Register a new user if username is unique."""
    if not is_valid_username(username) or not is_valid_password(password):
        return False
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            pass
    with open(USERS_FILE, 'r') as f:
        for line in f:
            u, _ = line.strip().split(':', 1)
            if u == username:
                return False
    with open(USERS_FILE, 'a') as f:
        f.write(f'{username}:{hash_password(password)}\n')
    return True

def authenticate_user(username, password):
    """Authenticate user credentials (robust to whitespace and case)."""
    if not os.path.exists(USERS_FILE):
        return False
    username = username.strip()
    password_hash = hash_password(password.strip())
    with open(USERS_FILE, 'r') as f:
        for line in f:
            if ':' not in line:
                continue
            u, p = line.strip().split(':', 1)
            if u.strip().lower() == username.lower() and p.strip() == password_hash:
                return True
    return False

def parse_closet_output(output):
    """Parse CSV output from C backend into Python dicts."""
    closet = []
    for line in output.splitlines():
        if line:
            parts = line.split(',')
            while len(parts) < 7:
                parts.append('')
            closet.append({
                'name': parts[0],
                'category': parts[1],
                'is_missing': parts[2] == '1',
                'in_laundry': parts[3] == '1',
                'lost_date': parts[4],
                'image': parts[5],
                'last_washed': parts[6]
            })
    return closet

def get_user_categories(username):
    """Get default and custom categories for a user."""
    default_categories = [
        "Shirt", "T-shirt", "Pants", "Jeans", "Kurta", "Pyjama", "Towels", "Bed Sheets", "Pillow Covers", "Shorts"
    ]
    if not os.path.exists(CUSTOM_CATEGORIES_FILE):
        return default_categories
    with open(CUSTOM_CATEGORIES_FILE, 'r') as f:
        data = json.load(f)
    user_cats = data.get(username, [])
    return default_categories + user_cats

# --- Routes ---
@app.route('/')
def home():
    """Render the home page."""
    return render_template('home.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login route."""
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if authenticate_user(username, password):
            session['username'] = username
            return redirect(url_for('dashboard'))
        else:
                    flash('Invalid username or password', 'danger')
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    """User signup route."""
    laundry_days_list = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if not is_valid_username(username):
            flash('Username must be 3-20 characters, alphanumeric or underscore.')
            return render_template('signup.html', laundry_days_list=laundry_days_list)
        if not is_valid_password(password):
            flash('Password must be at least 8 characters long and contain at least one number and one letter.', 'danger')
            return render_template('signup.html', laundry_days_list=laundry_days_list)
        if register_user(username, password):
            session['username'] = username
            return redirect(url_for('dashboard'))
        else:
            flash('Username already exists. Please choose a different one.', 'warning')
    return render_template('signup.html', laundry_days_list=laundry_days_list)

@app.route('/dashboard')
def dashboard():
    """User dashboard with stats."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    output = run_c_program([username, 'list_clothes'])
    closet = parse_closet_output(output)
    total_clothes = len(closet)
    missing_count = sum(1 for cloth in closet if cloth['is_missing'])
    in_laundry_count = sum(1 for cloth in closet if cloth['in_laundry'])
    available_count = total_clothes - missing_count - in_laundry_count
    return render_template('dashboard.html', 
                           total_clothes=total_clothes, 
                           missing_count=missing_count, 
                           in_laundry_count=in_laundry_count, 
                           available_count=available_count,
                           active_page='dashboard')

@app.route('/add_category', methods=['POST'])
def add_category():
    """Add a new custom category for the user."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    new_category = request.form['new_category'].strip()
    if not new_category:
        flash('Category name cannot be empty.')
        return redirect(url_for('closet'))
    # Load or create custom categories file
    if os.path.exists(CUSTOM_CATEGORIES_FILE):
        with open(CUSTOM_CATEGORIES_FILE, 'r') as f:
            data = json.load(f)
    else:
        data = {}
    user_cats = data.get(username, [])
    if new_category in user_cats:
        flash('Category already exists.')
        return redirect(url_for('closet'))
    user_cats.append(new_category)
    data[username] = user_cats
    with open(CUSTOM_CATEGORIES_FILE, 'w') as f:
        json.dump(data, f)
        flash("New category added!", "success")
    return redirect(url_for('closet'))

@app.route('/closet', methods=['GET', 'POST'])
def closet():
    """Closet management route with search/filter and custom categories."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    ensure_static_dir()
    search_query = request.args.get('search', '').strip().lower()
    filter_category = request.args.get('filter_category', '').strip()
    if request.method == 'POST':
        name = request.form['name']
        category = request.form['category']
        image_file = request.files.get('image')
        image_filename = "None"
        if image_file and image_file.filename:
            image_filename = secure_filename(image_file.filename)
            static_dir = os.path.join(os.path.dirname(__file__), 'static')
            image_path = os.path.join(static_dir, image_filename)
            try:
                image_file.save(image_path)
            except Exception as e:
                flash(f'Image upload failed: {e}')
                return redirect(url_for('closet'))
        if not name or not category:
            flash('Name and category are required!')
            return redirect(url_for('closet'))
        result = run_c_program([username, 'add_cloth', name, category, image_filename])
        if "already exists" in result:
            flash('Duplicate cloth!')
        elif "Backend executable not found" in result or result.startswith('Error running backend'):
            flash(result)
        elif "invalid input" in result:
            flash('Invalid input!')
        else:
                flash("Cloth added successfully!", "success")
        return redirect(url_for('closet'))
    output = run_c_program([username, 'list_clothes'])
    closet = parse_closet_output(output)
    closet = [cloth for cloth in closet if not cloth['is_missing']]
    categories = get_user_categories(username)
    closet_by_category = {cat: [] for cat in categories}
    for cloth in closet:
        if search_query and search_query not in cloth['name'].lower():
            continue
        if filter_category and cloth['category'] != filter_category:
            continue
        if cloth['category'] in closet_by_category:
            closet_by_category[cloth['category']].append(cloth)
        else:
            closet_by_category.setdefault(cloth['category'], []).append(cloth)
    return render_template('closet.html', 
                           closet_by_category=closet_by_category, 
                           categories=categories, 
                           search_query=search_query, 
                           filter_category=filter_category,
                           active_page='closet')

@app.route('/delete_cloth/<name>/<category>')
def delete_cloth(name, category):
    """Delete a cloth from closet."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    run_c_program([username, 'delete_cloth', name, category])
    flash('Cloth deleted!')
    return redirect(url_for('closet'))

@app.route('/mark_missing/<name>/<category>')
def mark_missing(name, category):
    """Mark a cloth as missing."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    run_c_program([username, 'mark_missing', name, category])
    flash('Cloth marked as missing!')
    return redirect(url_for('closet'))

@app.route('/mark_received/<name>/<category>')
def mark_received(name, category):
    """Mark a missing cloth as received."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    run_c_program([username, 'mark_received', name, category])
    flash('Cloth marked as received!')
    return redirect(url_for('closet'))

@app.route('/laundry', methods=['GET', 'POST'])
def laundry():
    """Send selected clothes to laundry and view history."""
    if 'username' not in session:
        return redirect(url_for('login'))

    username = session['username']
    today = datetime.datetime.today()
    current_day = today.strftime('%A')
    
    # Get user's laundry days
    # This is a placeholder. You should store and retrieve this from your user data.
    # For now, let's assume we can get it from the C program or a file.
    # Let's hardcode for now, but this should be dynamic.
    # Assuming we have a function get_user_laundry_days(username)
    user_days = ["Monday", "Thursday"] # Placeholder
    
    can_submit = current_day in user_days and current_day != "Sunday"

    if request.method == 'POST':
        if not can_submit:
            flash(f"You can only submit laundry on your assigned days. Today is {current_day}.", "warning")
            return redirect(url_for('laundry'))
            
        selected_clothes = request.form.getlist('clothes')
        if selected_clothes:
            for item in selected_clothes:
                name, category = item.split('|')
                # The C program now handles history logging internally
                run_c_program([username, 'send_laundry', name, category])
            flash("Laundry sent successfully!", "success")
        else:
            flash("No clothes selected for laundry.", "info")
        return redirect(url_for('laundry'))

    # GET request logic
    # Fetch available clothes for the form
    available_output = run_c_program([username, 'list_available_for_laundry'])
    available_closet = parse_closet_output(available_output)

    # Fetch and parse laundry history
    history_output = run_c_program([username, 'laundry_history'])
    laundry_history = []
    if history_output:
        lines = history_output.strip().splitlines()
        for line in lines:
            if not line.strip():
                continue
            parts = line.strip().split(';')
            if len(parts) == 4:
                laundry_history.append({
                    'send_date': parts[0],
                    'name': parts[1],
                    'category': parts[2],
                    'receive_date': parts[3]
                })
    
    # Sort history items by send date, most recent first
    if laundry_history:
        try:
            laundry_history.sort(key=lambda x: datetime.datetime.strptime(x['send_date'], '%Y-%m-%d'), reverse=True)
        except (ValueError, KeyError):
            # Handle cases with bad data, just in case
            flash("Could not sort laundry history due to inconsistent date formats.", "warning")

    return render_template('laundry.html', 
                           closet=available_closet, 
                           laundry_history=laundry_history,
                           user_days=user_days,
                           can_submit=can_submit,
                           current_day=current_day,
                           active_page='laundry')

@app.route('/mark_received_laundry/<name>/<category>')
def mark_received_laundry(name, category):
    """Mark a cloth as received from laundry."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    run_c_program([username, 'return_laundry', name, category])
    flash('Cloth marked as received from laundry!', 'success')
    return redirect(url_for('laundry'))

@app.route('/mark_missing_laundry/<name>/<category>')
def mark_missing_laundry(name, category):
    """Mark a cloth as missing from laundry."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    run_c_program([username, 'mark_missing', name, category])
    flash('Cloth marked as missing from laundry!')
    return redirect(url_for('closet'))

@app.route('/laundry_management')
def laundry_management():
    """Redirect to closet management."""
    return redirect(url_for('closet'))


@app.route('/logout')
def logout():
    """Logout user and clear session."""
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))

@app.route('/missing_clothes')
def missing_clothes():
    """Show all missing clothes for the logged-in user."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    output = run_c_program([username, 'list_clothes'])
    closet = parse_closet_output(output)
    missing = [cloth for cloth in closet if cloth['is_missing']]
    return render_template('missing_clothes.html', missing=missing, active_page='missing_clothes')

@app.route('/profile', methods=['GET', 'POST'])
def profile():
    """User profile management: change password."""
    if 'username' not in session:
        return redirect(url_for('login'))
    username = session['username']
    if request.method == 'POST':
        current_password = request.form['current_password']
        new_password = request.form['new_password']
        confirm_password = request.form['confirm_password']

        if not authenticate_user(username, current_password):
            flash('Current password is incorrect.', 'danger')
        elif new_password != confirm_password:
            flash('New passwords do not match.', 'danger')
        elif not is_valid_password(new_password):
            flash('New password must be at least 8 characters long and contain at least one number and one letter.', 'danger')
        else:
            # Update password in users.txt
            lines = []
            found = False
            try:
                with open(USERS_FILE, 'r') as f:
                    for line in f:
                        if ':' in line:
                            u, p = line.strip().split(':', 1)
                            if u.strip().lower() == username.lower():
                                lines.append(f'{username}:{hash_password(new_password)}\n')
                                found = True
                            else:
                                lines.append(line)
                        else:
                            lines.append(line)
                
                if found:
                    with open(USERS_FILE, 'w') as f:
                        f.writelines(lines)
                    flash('Password updated successfully.', 'success')
                else:
                    flash('Could not find user to update.', 'danger')

            except Exception as e:
                flash(f'An error occurred: {e}', 'danger')

        return redirect(url_for('profile'))
        
    return render_template('profile.html', active_page='profile')

if __name__ == '__main__':
    app.run(debug=True)
