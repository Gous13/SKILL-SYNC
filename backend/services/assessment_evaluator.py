"""
Auto-evaluation engine for practical skill assessments.
- SQL: Execute on SQLite, compare results
- Python: Run in subprocess with timeout, hidden test cases
- Web (HTML/CSS/JS): Rule-based parsing
- C/C++ / Java: Static code verification (no compile/run)
"""

import json
import re
import sqlite3
import subprocess
import sys
import tempfile
import os
from typing import Dict, List, Tuple, Optional

PYTHON_EXE = sys.executable or ('py' if os.name == 'nt' else 'python3') or 'python'


def evaluate_sql(code: str, expected_output: str, test_cases_json: str) -> Tuple[float, str, dict]:
    """Execute SQL on in-memory SQLite and compare with expected output."""
    try:
        code = (code or '').strip().rstrip(';')
        if not code:
            return 0.0, "No SQL provided", {"passed_count": 0, "total_count": 1, "results": []}

        test_cases = json.loads(test_cases_json) if isinstance(test_cases_json, str) and test_cases_json else []
        if not isinstance(test_cases, list): test_cases = []
        
        # Default case if no test cases provided
        if not test_cases:
            test_cases = [{"setup": "", "expected": expected_output}]

        passed_count = 0
        results = []
        
        for tc in test_cases:
            conn = sqlite3.connect(':memory:')
            cur = conn.cursor()
            setup = tc.get('setup', '')
            exp = str(tc.get('expected', tc.get('expected_output', expected_output or ''))).strip().lower()
            
            res_item = {"passed": False, "expected": exp, "got": ""}
            
            try:
                if setup: cur.executescript(setup)
                cur.execute(code)
                rows = cur.fetchall()
                got = '\n'.join(','.join(str(c) for c in r) for r in rows).lower().strip()
                res_item["got"] = got
                
                exp_n = re.sub(r'\s+', ' ', exp.replace('\n', ' '))
                got_n = re.sub(r'\s+', ' ', got.replace('\n', ' '))
                
                if exp_n == got_n:
                    passed_count += 1
                    res_item["passed"] = True
                elif exp in got or (got and got in exp):
                    passed_count += 0.5
                    res_item["passed"] = True
                    res_item["message"] = "Partial Match"
            except sqlite3.Error as e:
                res_item["message"] = str(e)
                # Removed static check fallback - strictly test case based now
            finally:
                results.append(res_item)
                conn.close()

        total = len(test_cases)
        score = (passed_count / total * 100) if total > 0 else 0
        return float(min(100, score)), f"Passed {int(passed_count)}/{total} test cases", {
            "passed_count": int(passed_count),
            "total_count": total,
            "results": results
        }
    except Exception as e:
        return 0.0, f"Error: {str(e)}", {"passed_count": 0, "total_count": 1, "results": []}


def evaluate_python(code: str, expected_output: str, test_cases_json: str, timeout: int = 10) -> Tuple[float, str, dict]:
    """Run Python in subprocess, execute hidden test cases."""
    try:
        code = (code or '').strip()
        if not code:
            return 0.0, "No code provided", {"passed_count": 0, "total_count": 1, "results": []}

        test_cases = json.loads(test_cases_json) if isinstance(test_cases_json, str) and test_cases_json else (test_cases_json if isinstance(test_cases_json, list) else [])
        
        # Strictly test-case based. If no test cases, we try to run it once.
        if not test_cases:
            try:
                from io import StringIO
                old_stdout = sys.stdout
                sys.stdout = buf = StringIO()
                try:
                    exec(code, {'__builtins__': __builtins__})
                    exec_success = True
                except Exception as e:
                    exec_success = False
                    exec_err = str(e)
                finally:
                    sys.stdout = old_stdout
                
                if exec_success:
                    stdout = buf.getvalue().strip()
                    exp = (expected_output or '').strip()
                    passed = (exp.lower() in stdout.lower()) if exp else True
                    return (100.0 if passed else 0.0), ("Correct" if passed else "Incorrect output"), {
                        "passed_count": 1 if passed else 0,
                        "total_count": 1,
                        "results": [{"passed": passed, "got": stdout, "expected": exp}]
                    }
            except Exception:
                pass
            return 0.0, "Execution failed or no test cases passed", {"passed_count": 0, "total_count": 1, "results": []}

        passed_count = 0
        results = []
        for tc in test_cases:
            inp = tc.get('input', '')
            exp = str(tc.get('expected', '')).strip()
            
            wrapped = f'''
import sys
_stdout = sys.stdout
class _Cap:
    def write(self, x): self.buf = getattr(self, 'buf', '') + x
    def flush(self): pass
sys.stdout = _Cap()
try:
{chr(10).join('    ' + ln for ln in code.split(chr(10)))}
except Exception as e:
    sys.stdout = _stdout
    print(str(e), file=sys.stderr)
sys.stdout = _stdout
res = _Cap.buf.strip() if hasattr(_Cap, 'buf') else ''
print(res)
'''
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                f.write(wrapped)
                path = f.name
            
            current_result = {"passed": False, "input": inp, "expected": exp, "got": ""}
            try:
                proc = subprocess.run(
                    [PYTHON_EXE, path],
                    input=inp,
                    capture_output=True,
                    text=True,
                    timeout=timeout,
                )
                out = (proc.stdout or '').strip()
                current_result["got"] = out
                if exp == out:
                    passed_count += 1
                    current_result["passed"] = True
                elif exp.lower() == out.lower() and exp: # Don't give partial for empty
                    passed_count += 0.8 
                    current_result["passed"] = True
                    current_result["message"] = "Case insensitive match"
            except subprocess.TimeoutExpired:
                current_result["message"] = "Timed out"
            except Exception as e:
                current_result["message"] = str(e)
            finally:
                results.append(current_result)
                try: os.unlink(path)
                except: pass

        total = len(test_cases)
        score = (passed_count / total * 100) if total > 0 else 0
        return float(min(100, score)), f"Passed {int(passed_count)}/{total} test cases", {
            "passed_count": int(passed_count),
            "total_count": total,
            "results": results
        }
    except Exception as e:
        return 0.0, f"Error: {str(e)}", {"passed_count": 0, "total_count": 0, "results": []}


def evaluate_web(html: str, expected_output: str, test_cases_json: str) -> Tuple[float, str, dict]:
    """Rule-based parsing: strictly count required tags."""
    score = 0
    checks = []
    results = []
    text = (html or '').lower()

    criteria = [
        ('<form', 25, 'form'),
        ('<input', 15, 'input'),
        ('<style', 20, 'css'),
        ('<script', 20, 'js'),
        ('validate', 15, 'validation'),
        ('@media', 5, 'responsive')
    ]

    for pattern, pts, name in criteria:
        passed = pattern in text
        if passed:
            score += pts
            checks.append(name)
        results.append({"criterion": name, "passed": passed})

    score = min(100, score)
    # Strictly zero if nothing matches
    if score < 20: score = 0

    passed_count = len(checks)
    total_count = len(criteria)
    
    return float(score), f"Passed {passed_count}/{total_count} criteria", {
        "passed_count": passed_count,
        "total_count": total_count,
        "results": results
    }


def evaluate_static_code(code: str, eval_type: str) -> Tuple[float, str, dict]:
    """Static analysis for C/C++/Java - strictly keyword based, 0 base score."""
    code = (code or '').strip()
    if not code or len(code) < 10: # Increased minimum length
        return 0.0, "No code provided", {"passed_count": 0, "total_count": 1, "results": []}

    score = 0 
    checks = []
    results = []

    if eval_type in ('cpp', 'c'):
        criteria = [
            ('#include', 25, 'headers'),
            ('main', 25, 'main function'),
            ('{', 25, 'logic blocks'),
            (';', 25, 'semicolons')
        ]
    elif eval_type == 'java':
        criteria = [
            ('class', 25, 'class definition'),
            ('public static void main', 25, 'main method'),
            ('System.out', 25, 'output statement'),
            ('{', 25, 'blocks')
        ]
    else:
        criteria = [('{', 50, 'syntax'), ('}', 50, 'structure')]

    for kw, pts, name in criteria:
        passed = kw in code
        if passed:
            score += pts
            checks.append(name)
        results.append({"criterion": name, "passed": passed})

    score = min(100, score)
    passed_count = len(checks)
    total_count = len(criteria)

    return float(score), f"Static check: {passed_count}/{total_count} passed", {
        "passed_count": passed_count,
        "total_count": total_count,
        "results": results
    }


def evaluate(code: str, question: Dict, timeout: int = 10) -> Tuple[float, str, dict]:
    """
    Route to correct evaluator based on evaluation_type.
    Returns (score, message, detail_dict)
    """
    code = (code or '').strip()
    if not code:
        return 0.0, "No code submitted", {"passed_count": 0, "total_count": 1, "results": []}

    eval_type = (question.get('evaluation_type') or 'python').lower()
    expected = question.get('expected_output', '')
    test_cases = question.get('test_cases_json', '[]')

    try:
        if eval_type == 'sql':
            return evaluate_sql(code, expected, test_cases)
        if eval_type == 'python':
            return evaluate_python(code, expected, test_cases, timeout=timeout)
        if eval_type == 'web':
            return evaluate_web(code, expected, test_cases)
        if eval_type in ('cpp', 'c', 'java'):
            return evaluate_static_code(code, eval_type)
        
        # Default/Fallback
        return 50.0, "Generic check", {"passed_count": 1, "total_count": 1, "results": []}
    except Exception as e:
        return 0.0, f"Evaluation error: {str(e)}", {"passed_count": 0, "total_count": 1, "results": []}
