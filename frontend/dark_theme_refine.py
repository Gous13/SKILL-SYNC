import os
import re

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replacements
    replacements = {
        r'\bbg-green-50\b': 'bg-green-900/10',
        r'\bbg-red-50\b': 'bg-red-900/10',
        r'\bbg-amber-50\b': 'bg-amber-900/10',
        r'\border-gray-100\b': 'border-gray-800',
        r'\bborder-green-100\b': 'border-green-800',
        r'\bborder-red-100\b': 'border-red-800',
        r'\bborder-amber-100\b': 'border-amber-800',
        r'\bshadow-green-50\b': 'shadow-green-900/20',
        r'\bshadow-red-50\b': 'shadow-red-900/20',
        r'\bshadow-primary-100\b': 'shadow-purple-900/50',
        r'\btext-gray-500\b': 'text-gray-400',
        r'\bbg-blue-50\b': 'bg-purple-900/10',
        r'\bborder-blue-200\b': 'border-purple-800',
        r'\btext-gray-800\b': 'text-gray-200',
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
