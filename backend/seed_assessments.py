"""
Seed skill assessment MCQ questions for popular skills
"""

from app import create_app
from extensions import db
from models.skill_assessment import SkillAssessment

# Assessment questions: (skill_name, question_text, option_a, option_b, option_c, option_d, correct)
ASSESSMENTS = [
    # Python
    ('Python', 'What does the `len()` function return?', 'Number of elements in a sequence', 'Length of a string only', 'Memory usage', 'Index of last element', 'a'),
    ('Python', 'Which keyword is used to define a function in Python?', 'func', 'def', 'function', 'define', 'b'),
    ('Python', 'What is a Python list?', 'An immutable sequence', 'A mutable ordered sequence', 'A key-value pair', 'A single value', 'b'),
    ('Python', 'What does `import` do in Python?', 'Exports a module', 'Loads a module for use', 'Deletes a module', 'Renames a module', 'b'),
    ('Python', 'Which of these is NOT a valid Python data type?', 'int', 'float', 'string', 'char', 'd'),
    # JavaScript
    ('JavaScript', 'What is the correct way to declare a variable in modern JS?', 'var x', 'let x', 'variable x', 'Both a and b', 'd'),
    ('JavaScript', 'What does `===` compare?', 'Value only', 'Value and type', 'Reference only', 'Neither', 'b'),
    ('JavaScript', 'What is an arrow function?', 'A function with => syntax', 'A function that returns arrows', 'A deprecated function', 'A type of loop', 'a'),
    ('JavaScript', 'What does `null` represent?', 'Zero', 'Empty string', 'Intentional absence of value', 'Undefined', 'c'),
    ('JavaScript', 'Which method adds an element to the end of an array?', 'push()', 'append()', 'add()', 'insert()', 'a'),
    # React
    ('React', 'What is JSX?', 'A JavaScript extension', 'HTML in JavaScript', 'A templating language', 'A and B', 'd'),
    ('React', 'Which hook runs after render?', 'useEffect', 'useState', 'useRender', 'useAfter', 'a'),
    ('React', 'What does `useState` return?', 'A value only', 'A value and setter function', 'A component', 'Nothing', 'b'),
    ('React', 'What is a React component?', 'A function or class that returns UI', 'A HTML tag', 'A CSS file', 'A database query', 'a'),
    ('React', 'Which is used to pass data to a component?', 'props', 'state', 'context', 'store', 'a'),
    # SQL
    ('SQL', 'What does SELECT do?', 'Updates rows', 'Retrieves rows', 'Deletes rows', 'Creates tables', 'b'),
    ('SQL', 'Which clause filters rows?', 'SELECT', 'WHERE', 'FROM', 'ORDER BY', 'b'),
    ('SQL', 'What is a primary key?', 'A duplicate identifier', 'A unique identifier for a row', 'A foreign reference', 'An index', 'b'),
    ('SQL', 'Which keyword combines rows from two tables?', 'MERGE', 'JOIN', 'COMBINE', 'UNION', 'b'),
    ('SQL', 'What does GROUP BY do?', 'Sorts results', 'Filters results', 'Aggregates rows by column', 'Limits results', 'c'),
    # Machine Learning
    ('Machine Learning', 'What is supervised learning?', 'Learning without labels', 'Learning with labeled data', 'Reinforcement only', 'None of these', 'b'),
    ('Machine Learning', 'What does overfitting mean?', 'Model too simple', 'Model fits training data too closely', 'Model has no bias', 'Model is fast', 'b'),
    ('Machine Learning', 'What is a neural network?', 'A single linear function', 'Layers of connected neurons', 'A database', 'A visualization tool', 'b'),
    ('Machine Learning', 'What is cross-validation used for?', 'Training faster', 'Estimating model performance', 'Deploying models', 'Data cleaning', 'b'),
    ('Machine Learning', 'What does gradient descent optimize?', 'Data', 'Model parameters', 'Hardware', 'Users', 'b'),
    # Flask
    ('Flask', 'What is a Flask route?', 'A database table', 'A URL pattern that maps to a function', 'A CSS file', 'A frontend component', 'b'),
    ('Flask', 'What decorator defines a route?', '@route', '@app.route', '@flask.route', '@path', 'b'),
    ('Flask', 'How do you get JSON from a request?', 'request.data', 'request.get_json()', 'request.json', 'Both b and c', 'd'),
    ('Flask', 'What is a Blueprint?', 'A database model', 'A way to organize routes', 'A frontend framework', 'A test runner', 'b'),
    ('Flask', 'Which method sends a response?', 'return jsonify(...)', 'send()', 'response()', 'output()', 'a'),
]


def seed_assessments():
    app = create_app()
    with app.app_context():
        count = 0
        for row in ASSESSMENTS:
            skill_name, q, a, b, c, d, correct = row
            existing = SkillAssessment.query.filter_by(skill_name=skill_name, question_text=q).first()
            if not existing:
                sa = SkillAssessment(
                    skill_name=skill_name,
                    question_text=q,
                    option_a=a,
                    option_b=b,
                    option_c=c,
                    option_d=d,
                    correct_option=correct
                )
                db.session.add(sa)
                count += 1
        db.session.commit()
        print(f"Seeded {count} assessment questions.")


if __name__ == '__main__':
    seed_assessments()
