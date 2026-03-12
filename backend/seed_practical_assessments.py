"""
Seed practical assessment questions and sets for: SQL, Python, HTML/CSS/JavaScript, C/C++, Java.
Each skill: 3-4 question sets, each set = 1 easy + 1 hard.
Questions stored in DB for dynamic delivery.
"""

import json
from app import create_app
from extensions import db
from models.practical_assessment import AssessmentQuestion, AssessmentSet


def create_question(skill_name, difficulty, question_text, starter_code, expected_output, test_cases_json, evaluation_type):
    q = AssessmentQuestion(
        skill_name=skill_name,
        difficulty=difficulty,
        question_text=question_text,
        starter_code=starter_code,
        expected_output=expected_output,
        test_cases_json=test_cases_json,
        evaluation_type=evaluation_type,
    )
    db.session.add(q)
    db.session.flush()
    return q.id


def seed():
    app = create_app()
    with app.app_context():
        db.create_all()  # Ensure tables exist
        # Clear existing to allow re-seed (optional - comment out for production)
        try:
            AssessmentSet.query.delete()
            AssessmentQuestion.query.delete()
            db.session.commit()
        except Exception:
            db.session.rollback()

        def q(sql, diff, text, starter, expected, tc, ev):
            return create_question(sql, diff, text, starter, expected, tc, ev)

        # ----- SQL -----
        # Set 1
        e1 = q('SQL', 'easy', 'Write a SELECT query to fetch all rows from a table named "users" where the column "active" equals 1.', 'SELECT * FROM users', '1|john|1\n2|jane|1', json.dumps([{'setup': 'CREATE TABLE users(id INT, name TEXT, active INT); INSERT INTO users VALUES(1,\'john\',1),(2,\'jane\',1),(3,\'bob\',0);'}, {'setup': '', 'expected': '1|john|1\n2|jane|1'}]), 'sql')
        h1 = q('SQL', 'hard', 'Write a query that JOINs tables "orders" and "customers" on customer_id, and groups by customer_id to show total order count per customer.', 'SELECT c.id, COUNT(o.id) FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id', '1|2\n2|1', json.dumps([{'setup': 'CREATE TABLE customers(id INT, name TEXT); CREATE TABLE orders(id INT, customer_id INT); INSERT INTO customers VALUES(1,\'A\'),(2,\'B\'); INSERT INTO orders VALUES(1,1),(2,1),(3,2);'}]), 'sql')
        db.session.add(AssessmentSet(skill_name='SQL', easy_question_id=e1, hard_question_id=h1))

        # Set 2
        e2 = q('SQL', 'easy', 'Write a SELECT query to get the "name" and "email" columns from table "students" where "grade" is greater than 80.', 'SELECT name, email FROM students WHERE grade > 80', '', json.dumps([]), 'sql')
        h2 = q('SQL', 'hard', 'Write a query that uses INNER JOIN to combine "products" and "categories" on category_id, and filters where category name is "Electronics".', 'SELECT p.* FROM products p INNER JOIN categories c ON p.category_id = c.id WHERE c.name = \'Electronics\'', '', json.dumps([]), 'sql')
        db.session.add(AssessmentSet(skill_name='SQL', easy_question_id=e2, hard_question_id=h2))

        # Set 3
        e3 = q('SQL', 'easy', 'Write a query to count rows in table "items" where status is "sold".', 'SELECT COUNT(*) FROM items WHERE status = \'sold\'', '5', json.dumps([]), 'sql')
        h3 = q('SQL', 'hard', 'Write a query with GROUP BY and HAVING to list departments with more than 3 employees.', 'SELECT dept FROM employees GROUP BY dept HAVING COUNT(*) > 3', '', json.dumps([]), 'sql')
        db.session.add(AssessmentSet(skill_name='SQL', easy_question_id=e3, hard_question_id=h3))

        # Set 4
        e4 = q('SQL', 'easy', 'Write SELECT to get distinct values of column "city" from table "addresses".', 'SELECT DISTINCT city FROM addresses', '', json.dumps([]), 'sql')
        h4 = q('SQL', 'hard', 'Write a query with LEFT JOIN and COALESCE to list all customers and their last order date (null if no orders).', 'SELECT c.name, COALESCE(MAX(o.date), \'N/A\') FROM customers c LEFT JOIN orders o ON c.id = o.customer_id GROUP BY c.id, c.name', '', json.dumps([]), 'sql')
        db.session.add(AssessmentSet(skill_name='SQL', easy_question_id=e4, hard_question_id=h4))

        # ----- Python -----
        # Set 1 - Python: run script, compare stdout
        e5 = q('Python', 'easy', 'Write a Python script that prints the sum of the list [1, 2, 3, 4, 5]. (Expected output: 15)', 'print(sum([1, 2, 3, 4, 5]))', '15', '[]', 'python')
        h5 = q('Python', 'hard', 'Write a Python script that reverses the string "hello" and prints the result.', 'print("hello"[::-1])', 'olleh', '[]', 'python')
        db.session.add(AssessmentSet(skill_name='Python', easy_question_id=e5, hard_question_id=h5))

        # Set 2
        e6 = q('Python', 'easy', 'Write a function that reverses a string and returns it.', 'def reverse_string(s):\n    return ""', 'olleh', json.dumps([{'input': '', 'expected': 'olleh'}]), 'python')
        h6 = q('Python', 'hard', 'Write a function that takes a list and returns only the unique elements preserving order.', 'def unique_list(lst):\n    pass', '[1, 2, 3]', json.dumps([]), 'python')
        db.session.add(AssessmentSet(skill_name='Python', easy_question_id=e6, hard_question_id=h6))

        # Set 3
        e7 = q('Python', 'easy', 'Write a function that returns the maximum of two numbers.', 'def max_two(a, b):\n    pass', '10', json.dumps([]), 'python')
        h7 = q('Python', 'hard', 'Write a function that flattens a nested list one level deep.', 'def flatten(lst):\n    pass', '[1, 2, 3, 4]', json.dumps([]), 'python')
        db.session.add(AssessmentSet(skill_name='Python', easy_question_id=e7, hard_question_id=h7))

        # Set 4
        e8 = q('Python', 'easy', 'Write a function that checks if a string is a palindrome (same forwards and backwards).', 'def is_palindrome(s):\n    return False', 'True', json.dumps([]), 'python')
        h8 = q('Python', 'hard', 'Write a function that merges two sorted lists into one sorted list.', 'def merge_sorted(a, b):\n    pass', '[1, 2, 3, 4, 5]', json.dumps([]), 'python')
        db.session.add(AssessmentSet(skill_name='Python', easy_question_id=e8, hard_question_id=h8))

        # ----- HTML/CSS/JavaScript (Web) -----
        # Set 1
        e9 = q('HTML/CSS/JavaScript', 'easy', 'Create a simple form with a text input for "email" and a submit button. Add basic styling.', '<form>\n  <input type="email" name="email">\n  <button type="submit">Submit</button>\n</form>', '', json.dumps([]), 'web')
        h9 = q('HTML/CSS/JavaScript', 'hard', 'Create a responsive form with email and password fields, CSS styling, and JavaScript validation that prevents empty submit.', '<!DOCTYPE html>\n<html>\n<head><style>form{max-width:400px;margin:0 auto;}</style></head>\n<body>\n<form onsubmit="return validate()">\n  <input type="email" id="em" required>\n  <input type="password" id="pw" required>\n  <button type="submit">Login</button>\n</form>\n<script>\nfunction validate(){ return document.getElementById(\'em\').value && document.getElementById(\'pw\').value; }\n</script>\n</body>\n</html>', '', json.dumps([]), 'web')
        db.session.add(AssessmentSet(skill_name='HTML/CSS/JavaScript', easy_question_id=e9, hard_question_id=h9))

        # Set 2
        e10 = q('HTML/CSS/JavaScript', 'easy', 'Create an HTML page with a form containing a name input and a submit button. Add a <style> block for basic layout.', '<html><head><style>input{width:200px;}</style></head><body><form><input type="text" name="name"><button type="submit">Send</button></form></body></html>', '', json.dumps([]), 'web')
        h10 = q('HTML/CSS/JavaScript', 'hard', 'Create a styled form with flex or grid layout, and a script that validates the form before submit using addEventListener.', '<form id="f"><input type="text"><button>Submit</button></form><script>document.getElementById("f").addEventListener("submit", function(e){ if(!this.querySelector("input").value) e.preventDefault(); });</script>', '', json.dumps([]), 'web')
        db.session.add(AssessmentSet(skill_name='HTML/CSS/JavaScript', easy_question_id=e10, hard_question_id=h10))

        # Set 3
        e11 = q('HTML/CSS/JavaScript', 'easy', 'Write HTML with a form, input, and button. Include at least one <style> or style attribute.', '<form style="padding:10px"><input><button>Go</button></form>', '', json.dumps([]), 'web')
        h11 = q('HTML/CSS/JavaScript', 'hard', 'Create a responsive form using @media or flex/grid, with JavaScript validation.', '<style>@media(min-width:600px){.f{display:flex}}</style><form class="f"><input required><button>Submit</button></form><script>document.forms[0].onsubmit=function(){return this.checkValidity();};</script>', '', json.dumps([]), 'web')
        db.session.add(AssessmentSet(skill_name='HTML/CSS/JavaScript', easy_question_id=e11, hard_question_id=h11))

        # ----- C/C++ -----
        # Set 1
        e12 = q('C/C++', 'easy', 'Write a C/C++ snippet that uses a for loop to print numbers 1 to 5.', '#include <stdio.h>\nint main() {\n  for(int i=1;i<=5;i++) printf("%d ",i);\n  return 0;\n}', '1 2 3 4 5', json.dumps([]), 'cpp')
        h12 = q('C/C++', 'hard', 'Write a function that finds the maximum value in an integer array and returns it.', 'int max_arr(int arr[], int n) {\n  int m = arr[0];\n  for(int i=1;i<n;i++) if(arr[i]>m) m=arr[i];\n  return m;\n}', '', json.dumps([]), 'cpp')
        db.session.add(AssessmentSet(skill_name='C/C++', easy_question_id=e12, hard_question_id=h12))

        # Set 2
        e13 = q('C/C++', 'easy', 'Write a C/C++ function that returns the sum of two integers.', 'int add(int a, int b) { return a + b; }', '', json.dumps([]), 'cpp')
        h13 = q('C/C++', 'hard', 'Write a function that reverses a string in place.', 'void reverse(char *s) { int n=0; while(s[n]) n++; for(int i=0;i<n/2;i++) { char t=s[i]; s[i]=s[n-1-i]; s[n-1-i]=t; } }', '', json.dumps([]), 'cpp')
        db.session.add(AssessmentSet(skill_name='C/C++', easy_question_id=e13, hard_question_id=h13))

        # Set 3
        e14 = q('C/C++', 'easy', 'Write a while loop that prints "Hello" 3 times.', 'int i=0; while(i<3){ printf("Hello"); i++; }', '', json.dumps([]), 'cpp')
        h14 = q('C/C++', 'hard', 'Write a function that checks if a string is a palindrome.', 'int is_palindrome(char *s) { int n=0; while(s[n]) n++; for(int i=0;i<n/2;i++) if(s[i]!=s[n-1-i]) return 0; return 1; }', '', json.dumps([]), 'cpp')
        db.session.add(AssessmentSet(skill_name='C/C++', easy_question_id=e14, hard_question_id=h14))

        # ----- Java -----
        # Set 1
        e15 = q('Java', 'easy', 'Write a Java method that returns the larger of two integers.', 'public int max(int a, int b) { return a > b ? a : b; }', '', json.dumps([]), 'java')
        h15 = q('Java', 'hard', 'Write a Java class with a private field, getter, setter, and a method that uses a loop.', 'public class Item {\n  private String name;\n  public String getName() { return name; }\n  public void setName(String n) { name = n; }\n  public void repeat(int n) { for(int i=0;i<n;i++) System.out.println(name); }\n}', '', json.dumps([]), 'java')
        db.session.add(AssessmentSet(skill_name='Java', easy_question_id=e15, hard_question_id=h15))

        # Set 2
        e16 = q('Java', 'easy', 'Write a Java method that takes an array and returns its length.', 'public int length(int[] arr) { return arr.length; }', '', json.dumps([]), 'java')
        h16 = q('Java', 'hard', 'Write a Java method that uses an ArrayList to collect and return unique elements.', 'public List<Integer> unique(List<Integer> list) {\n  Set<Integer> set = new HashSet<>(list);\n  return new ArrayList<>(set);\n}', '', json.dumps([]), 'java')
        db.session.add(AssessmentSet(skill_name='Java', easy_question_id=e16, hard_question_id=h16))

        # Set 3
        e17 = q('Java', 'easy', 'Write a Java class with a main method that prints "Hello".', 'public class Main { public static void main(String[] args) { System.out.println("Hello"); } }', '', json.dumps([]), 'java')
        h17 = q('Java', 'hard', 'Write a Java class that implements a simple interface with one method.', 'public interface Printable { void print(); }\npublic class Doc implements Printable { public void print() { System.out.println("doc"); } }', '', json.dumps([]), 'java')
        db.session.add(AssessmentSet(skill_name='Java', easy_question_id=e17, hard_question_id=h17))

        db.session.commit()
        print("Seeded practical assessments successfully.")
        print("SQL sets:", AssessmentSet.query.filter_by(skill_name='SQL').count())
        print("Python sets:", AssessmentSet.query.filter_by(skill_name='Python').count())
        print("Web sets:", AssessmentSet.query.filter_by(skill_name='HTML/CSS/JavaScript').count())
        print("C/C++ sets:", AssessmentSet.query.filter_by(skill_name='C/C++').count())
        print("Java sets:", AssessmentSet.query.filter_by(skill_name='Java').count())


if __name__ == '__main__':
    seed()
