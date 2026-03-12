import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    replacements = {
        r'\bbg-white\b': 'bg-gray-900',
        r'\bbg-gray-50\b': 'bg-gray-950',
        r'\bbg-gray-100\b': 'bg-gray-800',
        r'\btext-gray-900\b': 'text-white',
        r'\btext-gray-800\b': 'text-gray-200',
        r'\btext-gray-700\b': 'text-gray-300',
        r'\btext-gray-600\b': 'text-gray-400',
        r'\border-gray-200\b': 'border-gray-800',
        r'\border-gray-300\b': 'border-gray-700',
        r'\bbg-primary-100\b': 'bg-purple-900/30',
        r'\bbg-accent-100\b': 'bg-purple-900/30',
        r'\btext-accent-700\b': 'text-primary-300',
        r'\bbg-accent-600\b': 'bg-primary-600',
        r'\bbg-accent-700\b': 'bg-primary-700',
        r'\btext-primary-700\b': 'text-primary-300',
        r'\btext-accent-600\b': 'text-primary-400',
    }

    new_content = content
    for pattern, replacement in replacements.items():
        new_content = re.sub(pattern, replacement, new_content)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.jsx') and file not in ['ExamPage.jsx', 'ExamMentorPage.jsx', 'Login.jsx', 'Register.jsx', 'Layout.jsx']:
            process_file(os.path.join(root, file))

print("Done")
