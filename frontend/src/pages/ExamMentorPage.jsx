import React, { useState } from 'react';
import Layout from '../components/Layout';
import { ShieldAlert, BookOpen, CheckSquare, Upload, Users, Search, Edit3, CheckCircle, XCircle, Code, ListPlus, Camera, FileText, XSquare } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../services/api';

const ExamMentorPage = () => {
    const [activeTab, setActiveTab] = useState('prepare'); // prepare, review, assign, monitor, evaluate
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedLiveStudent, setSelectedLiveStudent] = useState(null);
    const [editingScore, setEditingScore] = useState(null);
    const [editScoreValue, setEditScoreValue] = useState('');
    const [editFeedback, setEditFeedback] = useState('');

    const [customQuestions, setCustomQuestions] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [assignedExamsMap, setAssignedExamsMap] = useState({}); // { userId_skill: true } for quick lookup
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [assignSkill, setAssignSkill] = useState('');

    // New state to manage form fields
    const [qType, setQType] = useState('MCQ');
    const [mcqOptions, setMcqOptions] = useState({ A: '', B: '', C: '', D: '' });
    const [correctAnswer, setCorrectAnswer] = useState('A');
    const [questionMarks, setQuestionMarks] = useState(10);
    
    // Coding question fields
    const [codingProblem, setCodingProblem] = useState('');
    const [sampleInput, setSampleInput] = useState('');
    const [sampleOutput, setSampleOutput] = useState('');
    const [testCases, setTestCases] = useState([{ input: '', expected_output: '' }]);

    // AI Question editing state
    const [editingAiQuestion, setEditingAiQuestion] = useState(null);
    const [editAiTitle, setEditAiTitle] = useState('');
    const [editAiSkill, setEditAiSkill] = useState('');

    // Custom question editing state
    const [editingQuestion, setEditingQuestion] = useState(null);
    const [editQuestionData, setEditQuestionData] = useState({ title: '', skill: '', type: '', marks: 10, problem_statement: '', options: {}, correct_answer: '', test_cases: [] });
    const [questionStatusFilter, setQuestionStatusFilter] = useState('all');

    const [aiQuestions, setAiQuestions] = useState([]);
    const [removedStudentIds, setRemovedStudentIds] = useState(() => {
        const saved = localStorage.getItem('removedStudentIds');
        return saved ? new Set(JSON.parse(saved)) : new Set();
    });

    React.useEffect(() => {
        localStorage.setItem('removedStudentIds', JSON.stringify([...removedStudentIds]));
    }, [removedStudentIds]);

    // Live Socket State
    const [liveStreams, setLiveStreams] = useState({});
    const socketRef = React.useRef(null);
    const removedStudentIdsRef = React.useRef(removedStudentIds);
    removedStudentIdsRef.current = removedStudentIds;

    // Fetch results (all) and let individual tabs filter what they need
    const fetchResults = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/exam/results?role=mentor', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();

                // Filter out manually removed students only.
                // Keep all statuses so:
                // - Monitor tab can focus on IN_PROGRESS
                // - Evaluate tab can see COMPLETED / Graded submissions.
                const filteredStudents = data.filter(s => !removedStudentIds.has(s.user_id));

                setStudents(filteredStudents);
            }
        } catch (err) {
            console.error("Failed to load results:", err);
        }
    };

    // Setup socket for live video streaming
    React.useEffect(() => {
        // Prevent duplicate connections
        if (socketRef.current?.connected) {
            return;
        }

        const socket = io('http://localhost:5000', {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id);
            socket.emit('join_proctor_room', { skill: 'all' });
            console.log('[Socket] Joined room: all');
        });

        socket.on('connect_error', (err) => {
            console.error('[Socket] Connection error:', err.message);
            console.error('[Socket] Error type:', err.type);
        });

        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
        });

        socket.on('proctor_frame', (data) => {
            console.log('[Socket] Received frame from:', data.studentName, 'ID:', data.studentId, 'Action:', data.action);
            const studentKey = data.studentId || data.studentName;
            
            // Handle exam completion (student submits or exam ends)
            if (data.action === 'COMPLETED') {
                // Add to removed list so they don't reappear
                if (data.studentId && !removedStudentIdsRef.current.has(data.studentId)) {
                    const newRemovedIds = new Set([...removedStudentIdsRef.current, data.studentId]);
                    setRemovedStudentIds(newRemovedIds);
                    localStorage.setItem('removedStudentIds', JSON.stringify([...newRemovedIds]));
                }
                
                setLiveStreams(prev => {
                    const next = { ...prev };
                    delete next[studentKey];
                    return next;
                });
                fetchResults();
                return;
            }
            
            // Handle exam termination
            if (data.action === 'TERMINATED') {
                // Add to removed list
                if (data.studentId && !removedStudentIdsRef.current.has(data.studentId)) {
                    const newRemovedIds = new Set([...removedStudentIdsRef.current, data.studentId]);
                    setRemovedStudentIds(newRemovedIds);
                    localStorage.setItem('removedStudentIds', JSON.stringify([...newRemovedIds]));
                }
                
                setLiveStreams(prev => {
                    const next = { ...prev };
                    delete next[studentKey];
                    return next;
                });
                fetchResults();
                return;
            }
            
            // Skip if student is manually removed from monitoring (use ref for current value)
            if (data.studentId && removedStudentIdsRef.current.has(data.studentId)) {
                return;
            }
            
            // Update live stream
            setLiveStreams(prev => ({
                ...prev,
                [studentKey]: {
                    frame: data.frame,
                    warnings: data.warnings || 0,
                    verified: data.verified,
                    timestamp: Date.now(),
                    skill: data.skill
                }
            }));
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []);

    // Poll for results every 5 seconds
    React.useEffect(() => {
        fetchResults();
        const intervalId = setInterval(fetchResults, 5000);
        return () => clearInterval(intervalId);
    }, [removedStudentIds]);

    // Fetch all users (students) for the assign exams tab
    const fetchAllUsers = async () => {
        try {
            const res = await api.get('/admin/users/students');
            if (res.data && res.data.users) {
                setAllUsers(res.data.users || []);
            }
        } catch (err) {
            console.error("Failed to load users:", err);
        }
    };

    // Fetch assigned exams for the selected skill
    const fetchAssignedExamsForSkill = async (skill) => {
        if (!skill) {
            setAssignedExamsMap({});
            return;
        }
        try {
            const res = await api.get(`/exam/assigned?skill=${encodeURIComponent(skill)}`);
            if (res.data && res.data.assigned) {
                // Convert to simple map for quick lookup
                const assignedMap = {};
                Object.keys(res.data.assigned).forEach(key => {
                    assignedMap[key] = true;
                });
                setAssignedExamsMap(assignedMap);
            } else {
                setAssignedExamsMap({});
            }
        } catch (err) {
            console.error("Failed to load assigned exams:", err);
            setAssignedExamsMap({});
        }
    };

    // Fetch users when assign tab is active
    React.useEffect(() => {
        if (activeTab === 'assign') {
            fetchAllUsers();
        }
    }, [activeTab]);

    // Fetch assigned exams when skill is selected
    React.useEffect(() => {
        if (activeTab === 'assign' && assignSkill) {
            fetchAssignedExamsForSkill(assignSkill);
        } else if (activeTab === 'assign' && !assignSkill) {
            setAssignedExamsMap({});
        }
    }, [assignSkill, activeTab]);

    const removeFromMonitoring = (student) => {
        // Add to removed list
        const newRemovedIds = new Set([...removedStudentIds, student.user_id]);
        setRemovedStudentIds(newRemovedIds);
        localStorage.setItem('removedStudentIds', JSON.stringify([...newRemovedIds]));
        
        // Remove from live streams
        setLiveStreams(prev => {
            const next = { ...prev };
            delete next[student.user_id];
            delete next[student.user_name];
            return next;
        });
        
        // Remove from displayed students
        setStudents(prev => prev.filter(s => s.user_id !== student.user_id));
    };

    const handleEditScore = async (resultId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/results/${resultId}/edit-score`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    score: parseFloat(editScoreValue),
                    feedback: editFeedback
                })
            });
            if (res.ok) {
                const updatedResult = await res.json();
                setStudents(prev => prev.map(s => s.id === resultId ? updatedResult : s));
                setEditingScore(null);
                setEditScoreValue('');
                setEditFeedback('');
                alert('Score updated successfully!');
            } else {
                const err = await res.json();
                alert('Failed to update score: ' + err.error);
            }
        } catch (err) {
            console.error("Failed to edit score:", err);
            alert('Failed to update score');
        }
    };

    const openEditScore = (student) => {
        setEditingScore(student.id);
        setEditScoreValue(student.overridden_score !== null && student.overridden_score !== undefined ? student.overridden_score : student.score || 0);
        setEditFeedback(student.mentor_feedback || '');
    };

    const handleTerminateStudent = async (student) => {
        if (!window.confirm(`Are you sure you want to terminate the exam for ${student.user_name}? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            
            // Send terminate via socket
            if (socketRef.current) {
                socketRef.current.emit('terminate_student', {
                    skill: student.skill,
                    studentId: student.user_id,
                    studentName: student.user_name,
                    reason: 'Terminated by mentor'
                });
            }
            
            // Also call API to mark as terminated
            const res = await fetch(`/api/exam/attempt/${student.attempt_id}/terminate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    flags: student.proctoring_flags || 0,
                    logs: []
                })
            });
            
            if (res.ok) {
                alert(`Exam terminated for ${student.user_name}`);
                
                // Add to removed list so they don't reappear
                const newRemovedIds = new Set([...removedStudentIds, student.user_id]);
                setRemovedStudentIds(newRemovedIds);
                localStorage.setItem('removedStudentIds', JSON.stringify([...newRemovedIds]));
                
                // Remove from live streams
                setLiveStreams(prev => {
                    const next = { ...prev };
                    delete next[student.user_id];
                    delete next[student.user_name];
                    return next;
                });
                
                fetchResults();
            } else {
                const err = await res.json();
                alert('Failed to terminate: ' + err.error);
            }
        } catch (err) {
            console.error("Failed to terminate student:", err);
            alert('Failed to terminate student');
        }
    };

    const addCustomQuestion = async (e) => {
        e.preventDefault();
        const form = e.target;

        const newQuestion = {
            skill: form.skill.value,
            title: form.title.value,
            type: qType,
            status: 'approved', // custom questions auto-approved
            marks: questionMarks
        };

        if (qType === 'MCQ') {
            newQuestion.options = { ...mcqOptions };
            newQuestion.correct_answer = correctAnswer;
        } else if (qType === 'Short Answer') {
            newQuestion.problem_statement = form.problem_statement?.value || '';
        } else if (qType === 'Coding') {
            newQuestion.problem_statement = codingProblem;
            newQuestion.sample_input = sampleInput;
            newQuestion.sample_output = sampleOutput;
            newQuestion.test_cases = testCases.filter(tc => tc.input && tc.expected_output);
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/exam/questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newQuestion)
            });
            if (res.ok) {
                const q = await res.json();
                setCustomQuestions([...customQuestions, q]);
                form.reset();
                setMcqOptions({ A: '', B: '', C: '', D: '' });
                setCorrectAnswer('A');
                setQuestionMarks(10);
                setCodingProblem('');
                setSampleInput('');
                setSampleOutput('');
                setTestCases([{ input: '', expected_output: '' }]);
                alert("Question added correctly.");
            }
        } catch (err) {
            console.error("Failed adding custom question", err);
        }
    };

    const deleteQuestion = async (questionId) => {
        if (!window.confirm('Are you sure you want to delete this question?')) {
            return;
        }
        
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/questions/${questionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                setCustomQuestions(customQuestions.filter(q => q.id !== questionId));
                alert('Question deleted successfully.');
            } else {
                const err = await res.json();
                alert('Failed to delete: ' + (err.error || 'Unknown error'));
            }
        } catch (err) {
            console.error("Failed to delete question:", err);
            alert('Failed to delete question.');
        }
    };

    const updateQuestion = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/questions/${questionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editQuestionData)
            });
            if (res.ok) {
                const updated = await res.json();
                setCustomQuestions(customQuestions.map(q => q.id === questionId ? updated : q));
                setEditingQuestion(null);
                alert('Question updated successfully.');
            } else {
                const err = await res.json();
                alert('Failed to update: ' + (err.error || 'Unknown error'));
            }
        } catch (err) {
            console.error("Failed to update question:", err);
            alert('Failed to update question.');
        }
    };

    const openEditQuestion = (question) => {
        setEditingQuestion(question.id);
        setEditQuestionData({
            title: question.title || '',
            skill: question.skill || '',
            type: question.type || 'Coding',
            marks: question.marks || 10,
            problem_statement: question.problem_statement || '',
            options: question.options || {},
            correct_answer: question.correct_answer || '',
            test_cases: question.test_cases || []
        });
    };

    const restoreQuestion = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/questions/${questionId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'approved' })
            });
            if (res.ok) {
                setCustomQuestions(customQuestions.map(q => q.id === questionId ? { ...q, status: 'approved' } : q));
                alert('Question restored successfully.');
            }
        } catch (err) {
            console.error("Failed to restore question:", err);
        }
    };

    const finalizeAutoScore = async (resultId) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/evaluate/${resultId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ feedback: 'Auto-score finalized automatically.' })
            });
            if (res.ok) {
                // Refresh latest results and go back to list so mentor sees the update
                await fetchResults();
                alert('Auto-score finalized successfully.');
                setSelectedStudent(null);
            } else {
                let message = 'Failed to finalize auto-score.';
                try {
                    const data = await res.json();
                    if (data?.error) {
                        message += ' ' + data.error;
                    }
                } catch {
                    // ignore JSON parse errors
                }
                alert(message);
            }
        } catch (err) {
            console.error("Error finalizing auto-score:", err);
            alert('Network error while finalizing auto-score. Please try again.');
        }
    };

    const handleApproveAi = async (id) => {
        const question = aiQuestions.find(q => q.id === id);
        if (!question) return;
        
        try {
            const token = localStorage.getItem('token');
            
            // Update the question status to approved in the database
            const res = await fetch(`/api/exam/ai-questions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: 'approved',
                    problem_statement: question.problem_statement || `Write a solution for: ${question.title}`,
                    test_cases: question.test_cases || [],
                    marks: question.marks || 10,
                    type: question.type || 'Coding'
                })
            });
            
            if (res.ok) {
                setAiQuestions(aiQuestions.map(q => q.id === id ? { ...q, status: 'approved' } : q));
                alert('Question approved successfully!');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to approve question');
            }
        } catch (err) {
            console.error("Failed to approve question:", err);
            alert('Failed to approve question. Check console for details.');
        }
    };

    const handleRejectAi = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/ai-questions/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    status: 'rejected'
                })
            });
            
            if (res.ok) {
                setAiQuestions(aiQuestions.map(q => q.id === id ? { ...q, status: 'rejected' } : q));
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to reject question');
            }
        } catch (err) {
            console.error("Failed to reject question:", err);
            alert('Failed to reject question. Check console for details.');
        }
    };

    const generateAiQuestions = async () => {
        const mockQuestions = [
            { 
                title: 'Reverse a String', 
                skill: 'Python', 
                type: 'Coding', 
                status: 'pending', 
                problem_statement: 'Write a function that reverses a string. The input is a string and you should return the reversed string.',
                test_cases: [{ input: '"hello"', expected_output: '"olleh"' }, { input: '"world"', expected_output: '"dlrow"' }],
                marks: 10
            },
            { 
                title: 'Find Maximum in Array', 
                skill: 'Python', 
                type: 'Coding', 
                status: 'pending', 
                problem_statement: 'Write a function that finds the maximum element in an array of integers.',
                test_cases: [{ input: '[1, 5, 3]', expected_output: '5' }, { input: '[-1, -5, -3]', expected_output: '-1' }],
                marks: 10
            },
            { 
                title: 'Binary Search Implementation', 
                skill: 'Python', 
                type: 'Coding', 
                status: 'pending', 
                problem_statement: 'Implement binary search to find a target element in a sorted array. Return the index if found, -1 otherwise.',
                test_cases: [{ input: '[1,2,3,4,5], 3', expected_output: '2' }, { input: '[1,2,3,4,5], 6', expected_output: '-1' }],
                marks: 15
            },
            { 
                title: 'Linked List Reversal', 
                skill: 'Python', 
                type: 'Coding', 
                status: 'pending', 
                problem_statement: 'Reverse a singly linked list. Return the head of the reversed list.',
                test_cases: [{ input: '[1,2,3,4,5]', expected_output: '[5,4,3,2,1]' }],
                marks: 15
            },
            { 
                title: 'Merge Two Sorted Arrays', 
                skill: 'Python', 
                type: 'Coding', 
                status: 'pending', 
                problem_statement: 'Merge two sorted arrays into one sorted array.',
                test_cases: [{ input: '[1,3,5], [2,4,6]', expected_output: '[1,2,3,4,5,6]' }],
                marks: 10
            },
        ];

        try {
            const savedQuestions = [];
            
            for (const q of mockQuestions) {
                const res = await api.post('/exam/ai-questions', {
                    skill: q.skill,
                    title: q.title,
                    type: q.type,
                    status: 'pending',
                    problem_statement: q.problem_statement,
                    test_cases: q.test_cases,
                    marks: q.marks,
                    is_ai_generated: true
                });
                
                if (res.data) {
                    savedQuestions.push(res.data);
                }
            }
            
            if (savedQuestions.length > 0) {
                setAiQuestions(prev => [...prev, ...savedQuestions]);
            } else {
                alert('Failed to save questions to database. Please check backend is running.');
            }
        } catch (err) {
            console.error("Failed to save AI questions:", err);
            alert('Network error: ' + (err.response?.data?.error || err.message));
        }
    };

    const saveAiQuestionEdit = async () => {
        const question = aiQuestions.find(q => q.id === editingAiQuestion);
        if (!question) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/exam/ai-questions/${editingAiQuestion}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    title: editAiTitle,
                    skill: editAiSkill
                })
            });

            if (res.ok) {
                const updated = await res.json();
                setAiQuestions(aiQuestions.map(q => 
                    q.id === editingAiQuestion 
                        ? { ...q, title: editAiTitle, skill: editAiSkill }
                        : q
                ));
            }
        } catch (err) {
            console.error("Failed to save edit:", err);
            // Fallback to local state
            setAiQuestions(aiQuestions.map(q => 
                q.id === editingAiQuestion 
                    ? { ...q, title: editAiTitle, skill: editAiSkill }
                    : q
            ));
        }
        
        setEditingAiQuestion(null);
        setEditAiTitle('');
        setEditAiSkill('');
    };

    const toggleStudentSelection = (userId) => {
        setSelectedStudents(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const handleAssignExam = async () => {
        if (selectedStudents.length === 0) {
            alert('Please select at least one student');
            return;
        }
        if (!assignSkill) {
            alert('Please select a skill to assign');
            return;
        }

        try {
            for (const studentId of selectedStudents) {
                await api.post('/exam/assign', {
                    student_id: studentId,
                    skill: assignSkill
                });
                // Update assigned exams map
                const key = `${studentId}_${assignSkill}`;
                setAssignedExamsMap(prev => ({ ...prev, [key]: true }));
            }
            alert(`Assigned ${assignSkill} exam to ${selectedStudents.length} student(s). They can now start the exam from their dashboard.`);
            setSelectedStudents([]);
            // Refresh assigned exams
            await fetchAssignedExamsForSkill(assignSkill);
        } catch (err) {
            console.error('Error assigning exam:', err);
            alert('Failed to assign exam. Please try again.');
        }
    };

    const handleUnassignExam = async (studentId, skill) => {
        if (!window.confirm(`Are you sure you want to unassign ${skill} exam from this student?`)) {
            return;
        }

        try {
            await api.post('/exam/unassign', {
                student_id: studentId,
                skill: skill
            });
            // Update assigned exams map
            const key = `${studentId}_${skill}`;
            setAssignedExamsMap(prev => {
                const newMap = { ...prev };
                delete newMap[key];
                return newMap;
            });
            alert(`Successfully unassigned ${skill} exam from student.`);
            // Refresh assigned exams
            await fetchAssignedExamsForSkill(skill);
        } catch (err) {
            console.error('Error unassigning exam:', err);
            alert(err.response?.data?.error || 'Failed to unassign exam. Please try again.');
        }
    };

    return (
        <Layout>
            <div className="max-w-7xl mx-auto p-6 mt-4 min-h-screen text-gray-200 bg-gray-950 rounded-2xl border border-gray-900 shadow-soft">
                <h1 className="text-3xl font-bold mb-8 text-white flex items-center">
                    <BookOpen className="w-8 h-8 mr-3 text-primary-400" /> Exam Management Center
                </h1>

                {/* Navigation Tabs */}
                <div className="flex border-b mb-8 space-x-2 md:space-x-8 overflow-x-auto">
                    {[
                        { id: 'prepare', icon: Upload, label: 'Upload Questions' },
                        { id: 'review', icon: ListPlus, label: 'Review AI Qs' },
                        { id: 'assign', icon: Users, label: 'Assign Exams' },
                        { id: 'monitor', icon: ShieldAlert, label: 'Live Monitor' },
                        { id: 'evaluate', icon: CheckSquare, label: 'Evaluate & Grade' }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                className={`pb-4 px-2 font-bold border-b-2 flex items-center whitespace-nowrap transition-colors ${activeTab === tab.id
                                    ? 'border-primary-400 text-primary-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                                    }`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                <Icon className="w-5 h-5 mr-2" /> {tab.label}
                            </button>
                        )
                    })}
                </div>

                {activeTab === 'prepare' && (
                    <div className="bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-800">
                        <h2 className="text-xl font-bold mb-6 text-white">Upload Custom Questions</h2>
                        <p className="text-gray-400 mb-6">Manually inject problem statements tailored to specific skills into the exam generator pool.</p>

                        <form onSubmit={addCustomQuestion} className="bg-gray-800 p-6 rounded-lg border border-gray-700 space-y-4 mb-8">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <input
                                    type="text" name="skill" required placeholder="Target Skill e.g. Node.js"
                                    className="border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500"
                                />
                                <input
                                    type="text" name="title" required placeholder="Question Title / Prompt"
                                    className="md:col-span-2 border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500"
                                />
                                <select
                                    name="type"
                                    value={qType}
                                    onChange={(e) => setQType(e.target.value)}
                                    className="border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white shadow-sm"
                                >
                                    <option value="MCQ">Multiple Choice</option>
                                    <option value="Short Answer">Short Answer</option>
                                    <option value="Coding">Coding Problem</option>
                                </select>
                            </div>

                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">Question Marks</label>
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={questionMarks}
                                    onChange={(e) => setQuestionMarks(parseInt(e.target.value) || 10)}
                                    className="border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white w-32"
                                />
                                <span className="ml-2 text-sm text-gray-400">points</span>
                            </div>

                            {qType === 'MCQ' && (
                                <div className="mt-4 p-4 border border-purple-500/30 bg-purple-900/20 rounded-lg">
                                    <h4 className="text-sm font-bold text-gray-200 mb-3">Define MCQ Options & Correct Answer</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {['A', 'B', 'C', 'D'].map((opt) => (
                                            <div key={opt} className="flex items-center gap-2">
                                                <span className="font-bold text-gray-300 w-6">{opt}.</span>
                                                <input
                                                    type="text"
                                                    required
                                                    placeholder={`Option ${opt}`}
                                                    value={mcqOptions[opt]}
                                                    onChange={e => setMcqOptions({ ...mcqOptions, [opt]: e.target.value })}
                                                    className="border border-gray-700 p-2 rounded focus:ring-2 focus:ring-primary-500 flex-1 bg-gray-900 text-white text-sm placeholder-gray-500"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-4">
                                        <label className="font-bold text-sm text-gray-300">Correct Answer:</label>
                                        <div className="flex gap-4">
                                            {['A', 'B', 'C', 'D'].map((opt) => (
                                                <label key={opt} className="flex items-center cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="correct"
                                                        value={opt}
                                                        checked={correctAnswer === opt}
                                                        onChange={() => setCorrectAnswer(opt)}
                                                        className="mr-1 text-primary-500 focus:ring-primary-500 bg-gray-900 border-gray-700"
                                                    />
                                                    <span className="font-bold text-gray-300">{opt}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {qType === 'Short Answer' && (
                                <div className="mt-4 p-4 border border-blue-500/30 bg-blue-900/20 rounded-lg">
                                    <h4 className="text-sm font-bold text-gray-200 mb-3">Short Answer Question</h4>
                                    <textarea
                                        name="problem_statement"
                                        required
                                        placeholder="Enter the problem statement/question..."
                                        className="w-full border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500 h-24"
                                    />
                                </div>
                            )}

                            {qType === 'Coding' && (
                                <div className="mt-4 p-4 border border-green-500/30 bg-green-900/20 rounded-lg space-y-4">
                                    <h4 className="text-sm font-bold text-gray-200 mb-3">Coding Problem Details</h4>
                                    
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Problem Statement *</label>
                                        <textarea
                                            required
                                            placeholder="Describe the problem..."
                                            value={codingProblem}
                                            onChange={e => setCodingProblem(e.target.value)}
                                            className="w-full border border-gray-700 p-3 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500 h-24"
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Sample Input</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. [1,2,3]"
                                                value={sampleInput}
                                                onChange={e => setSampleInput(e.target.value)}
                                                className="w-full border border-gray-700 p-2 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Sample Output</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. [1,2,3]"
                                                value={sampleOutput}
                                                onChange={e => setSampleOutput(e.target.value)}
                                                className="w-full border border-gray-700 p-2 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium text-gray-300">Test Cases</label>
                                            <button
                                                type="button"
                                                onClick={() => setTestCases([...testCases, { input: '', expected_output: '' }])}
                                                className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                                            >
                                                + Add Test Case
                                            </button>
                                        </div>
                                        {testCases.map((tc, idx) => (
                                            <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2 p-2 bg-gray-900/50 rounded">
                                                <input
                                                    type="text"
                                                    placeholder={`Test ${idx + 1} Input`}
                                                    value={tc.input}
                                                    onChange={e => {
                                                        const newCases = [...testCases];
                                                        newCases[idx].input = e.target.value;
                                                        setTestCases(newCases);
                                                    }}
                                                    className="border border-gray-700 p-2 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500 text-sm"
                                                />
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Expected Output"
                                                        value={tc.expected_output}
                                                        onChange={e => {
                                                            const newCases = [...testCases];
                                                            newCases[idx].expected_output = e.target.value;
                                                            setTestCases(newCases);
                                                        }}
                                                        className="border border-gray-700 p-2 rounded focus:ring-2 focus:ring-primary-500 bg-gray-900 text-white placeholder-gray-500 flex-1 text-sm"
                                                    />
                                                    {testCases.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))}
                                                            className="text-red-400 hover:text-red-300 px-2"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button className="bg-primary-600 text-white px-8 py-3 rounded-lg font-bold shadow hover:bg-primary-500 transition">
                                Add to Database
                            </button>
                        </form>

                        <div>
                            <div className="flex justify-between items-center mb-4 border-b border-gray-700 pb-2">
                                <h3 className="font-semibold text-gray-300 uppercase tracking-wider text-sm">
                                    Question Bank ({customQuestions.length})
                                </h3>
                                <select
                                    value={questionStatusFilter}
                                    onChange={(e) => setQuestionStatusFilter(e.target.value)}
                                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-white"
                                >
                                    <option value="all">All Status</option>
                                    <option value="approved">Approved</option>
                                    <option value="pending">Pending</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <ul className="space-y-3">
                                {customQuestions.map((q) => (
                                    <li key={q.id} className="bg-gray-800 p-4 border border-gray-700 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex flex-col flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-white">{q.title}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                                                    q.status === 'approved' ? 'bg-green-900/50 text-green-400 border border-green-500/30' :
                                                    q.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30' :
                                                    'bg-red-900/50 text-red-400 border border-red-500/30'
                                                }`}>
                                                    {q.status}
                                                </span>
                                            </div>
                                            <span className="text-sm font-medium text-gray-400">Skill: {q.skill} | Marks: {q.marks}</span>
                                            {q.problem_statement && (
                                                <span className="text-xs text-gray-500 mt-1 line-clamp-2">{q.problem_statement.substring(0, 100)}...</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-purple-900/50 text-primary-300 border border-purple-500/30 text-xs px-3 py-1 rounded-full font-bold self-start md:self-auto">{q.type}</span>
                                            {q.status === 'rejected' ? (
                                                <button
                                                    onClick={() => restoreQuestion(q.id)}
                                                    className="bg-green-900/30 hover:bg-green-800 text-green-400 border border-green-700/50 px-3 py-1 rounded-lg text-sm font-medium transition"
                                                >
                                                    Restore
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => openEditQuestion(q)}
                                                        className="bg-blue-900/30 hover:bg-blue-800 text-blue-400 border border-blue-700/50 px-3 py-1 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => deleteQuestion(q.id)}
                                                        className="bg-red-900/30 hover:bg-red-800 text-red-400 border border-red-700/50 px-3 py-1 rounded-lg text-sm font-medium transition"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'review' && (
                    <div className="bg-gray-900 p-8 rounded-xl shadow border border-gray-800">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-white">Review AI-Generated Questions</h2>
                                <p className="text-gray-400">Inspect, approve, edit, or reject the dynamic coding questions generated by the AI engine.</p>
                            </div>
                            <button
                                onClick={generateAiQuestions}
                                className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-500"
                            >
                                Generate AI Questions
                            </button>
                        </div>

                        {aiQuestions.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <p>No AI questions generated yet.</p>
                                <p className="text-sm mt-2">Click "Generate AI Questions" to create sample questions.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 mt-6">
                                {aiQuestions.map((q) => (
                                    <div key={q.id} className="border border-gray-800 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center transition hover:shadow-md hover:border-gray-700">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="bg-purple-900/40 text-primary-400 font-bold px-2 py-0.5 rounded text-xs border border-purple-500/30">AI DRAFT</span>
                                                <h3 className="font-bold text-lg text-gray-200">{q.title}</h3>
                                            </div>
                                            <p className="text-sm text-gray-500 font-medium">Target Skill: {q.skill} | Configured Test Cases: {q.test_cases?.length || q.testCases || 0}</p>
                                        </div>

                                        <div className="mt-4 md:mt-0 flex items-center gap-3">
                                            {q.status === 'pending' ? (
                                                <>
                                                    <button 
                                                        onClick={() => {
                                                            setEditingAiQuestion(q.id);
                                                            setEditAiTitle(q.title);
                                                            setEditAiSkill(q.skill);
                                                        }} 
                                                        className="flex items-center text-sm font-bold text-gray-400 hover:text-primary-400 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded border border-gray-700 transition"
                                                    >
                                                        <Edit3 className="w-4 h-4 mr-1" /> Edit
                                                    </button>
                                                    <button onClick={() => handleApproveAi(q.id)} className="flex items-center text-sm font-bold text-green-400 hover:text-white bg-green-900/20 hover:bg-green-600 px-3 py-2 rounded border border-green-800 transition">
                                                        <CheckCircle className="w-4 h-4 mr-1" /> Approve
                                                    </button>
                                                    <button onClick={() => handleRejectAi(q.id)} className="flex items-center text-sm font-bold text-red-400 hover:text-white bg-red-900/20 hover:bg-red-600 px-3 py-2 rounded border border-red-800 transition">
                                                        <XCircle className="w-4 h-4 mr-1" /> Reject
                                                    </button>
                                                </>
                                            ) : (
                                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${q.status === 'approved' ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
                                                    {q.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Edit AI Question Modal */}
                        {editingAiQuestion && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                                <div className="bg-gray-900 rounded-lg max-w-md w-full p-6 border border-gray-700">
                                    <h3 className="text-xl font-bold text-white mb-4">Edit AI Question</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                                            <input
                                                type="text"
                                                value={editAiTitle}
                                                onChange={(e) => setEditAiTitle(e.target.value)}
                                                className="w-full border border-gray-700 p-3 rounded bg-gray-800 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-300 mb-1">Skill</label>
                                            <input
                                                type="text"
                                                value={editAiSkill}
                                                onChange={(e) => setEditAiSkill(e.target.value)}
                                                className="w-full border border-gray-700 p-3 rounded bg-gray-800 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <button
                                            onClick={() => {
                                                setEditingAiQuestion(null);
                                                setEditAiTitle('');
                                                setEditAiSkill('');
                                            }}
                                            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={saveAiQuestionEdit}
                                            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-500"
                                        >
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'assign' && (
                    <div className="bg-gray-900 p-8 rounded-xl shadow border border-gray-800">
                        <h2 className="text-xl font-bold mb-4 text-white">Assign Targeted Exams</h2>
                        <p className="text-gray-400 mb-6">Select students and assign a specific skill exam to them.</p>

                        <div className="flex flex-wrap gap-4 mb-6 items-center">
                            <div className="flex-1 min-w-[200px]">
                                <label className="block text-sm font-medium text-gray-400 mb-2">Select Skill to Assign</label>
                                <select
                                    value={assignSkill}
                                    onChange={(e) => setAssignSkill(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                                >
                                    <option value="">-- Select Skill --</option>
                                    <option value="Python">Python</option>
                                    <option value="Java">Java</option>
                                    <option value="JavaScript">JavaScript</option>
                                    <option value="C++">C++</option>
                                    <option value="Data Structures">Data Structures</option>
                                    <option value="SQL">SQL</option>
                                    <option value="React">React</option>
                                    <option value="Machine Learning">Machine Learning</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={handleAssignExam}
                                    className="bg-primary-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-500"
                                >
                                    Assign Exam ({selectedStudents.length})
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto border border-gray-800 rounded-lg">
                            <table className="w-full text-left bg-gray-900">
                                <thead className="bg-gray-800 border-b border-gray-700 text-gray-400">
                                    <tr>
                                        <th className="py-4 px-4 font-bold uppercase text-xs tracking-wider w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedStudents.length > 0 && selectedStudents.length === allUsers.filter(u => u.role === 'student').length}
                                                onChange={() => {
                                                    const students = allUsers.filter(u => u.role === 'student');
                                                    if (selectedStudents.length === students.length) {
                                                        setSelectedStudents([]);
                                                    } else {
                                                        setSelectedStudents(students.map(u => u.id));
                                                    }
                                                }}
                                                className="w-4 h-4"
                                            />
                                        </th>
                                        <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Student Name</th>
                                        <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Email</th>
                                        <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Role</th>
                                        <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Account Status</th>
                                        {assignSkill && <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Exam Status</th>}
                                        {assignSkill && <th className="py-4 px-6 font-bold uppercase text-xs tracking-wider">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {allUsers.filter(u => u.role === 'student').length === 0 ? (
                                        <tr>
                                            <td colSpan={assignSkill ? 7 : 5} className="py-8 text-center text-gray-400">
                                                No students found.
                                            </td>
                                        </tr>
                                    ) : (
                                        allUsers.filter(u => u.role === 'student').map(user => {
                                            const assignedKey = `${user.id}_${assignSkill}`;
                                            const isAssigned = assignSkill && assignedExamsMap[assignedKey];
                                            return (
                                                <tr
                                                    key={user.id}
                                                    className={`hover:bg-gray-800 transition ${selectedStudents.includes(user.id) ? 'bg-purple-900/20' : ''}`}
                                                >
                                                    <td className="py-4 px-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudents.includes(user.id)}
                                                            onChange={() => toggleStudentSelection(user.id)}
                                                            className="w-4 h-4"
                                                        />
                                                    </td>
                                                    <td className="py-4 px-6 font-bold text-white">{user.full_name}</td>
                                                    <td className="py-4 px-6 text-gray-400">{user.email}</td>
                                                    <td className="py-4 px-6">
                                                        <span className="bg-purple-900/30 text-primary-400 px-3 py-1 rounded-full font-bold uppercase text-xs border border-purple-500/30">
                                                            Student
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-6">
                                                        <span className={`px-2 py-1 text-xs rounded font-bold ${user.is_blocked ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
                                                            }`}>
                                                            {user.is_blocked ? 'Blocked' : 'Active'}
                                                        </span>
                                                    </td>
                                                    {assignSkill && (
                                                        <td className="py-4 px-6">
                                                            {isAssigned ? (
                                                                <span className="bg-yellow-900/50 text-yellow-400 px-3 py-1 rounded-full font-bold text-xs border border-yellow-500/30">
                                                                    Assigned
                                                                </span>
                                                            ) : (
                                                                <span className="bg-gray-800 text-gray-400 px-3 py-1 rounded-full font-bold text-xs border border-gray-700">
                                                                    Not Assigned
                                                                </span>
                                                            )}
                                                        </td>
                                                    )}
                                                    {assignSkill && (
                                                        <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
                                                            {isAssigned ? (
                                                                <button
                                                                    onClick={() => handleUnassignExam(user.id, assignSkill)}
                                                                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                                                >
                                                                    <XCircle className="w-4 h-4" />
                                                                    Unassign
                                                                </button>
                                                            ) : (
                                                                <span className="text-gray-500 text-sm">-</span>
                                                            )}
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'monitor' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-white">Live AI Exam Monitoring</h2>
                            <div className="bg-green-900/40 text-green-500 px-4 py-2 rounded-lg font-bold flex items-center shadow-sm border border-green-500/30">
                                <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse" /> AI Active
                            </div>
                        </div>

                        <div className="bg-yellow-900/30 border border-yellow-700 p-3 rounded-lg text-sm">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-yellow-400 font-bold">Monitoring: {students.length} active exam(s)</p>
                                    <p className="text-gray-300">Live streams received: {Object.keys(liveStreams).length}</p>
                                    <p className="text-gray-300">Stream sources: {JSON.stringify(Object.keys(liveStreams))}</p>
                                    <p className="text-gray-300">Removed (hidden): {[...removedStudentIds].join(', ') || 'None'}</p>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={fetchResults}
                                        className="bg-green-900/50 hover:bg-green-800 text-green-400 border border-green-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                                    >
                                        Refresh Now
                                    </button>
                                    {removedStudentIds.size > 0 && (
                                        <button
                                            onClick={() => {
                                                setRemovedStudentIds(new Set());
                                                localStorage.removeItem('removedStudentIds');
                                            }}
                                            className="bg-blue-900/50 hover:bg-blue-800 text-blue-400 border border-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition"
                                        >
                                            Clear Removed ({removedStudentIds.size})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {students.map(student => (
                                <div key={student.id}
                                    className="bg-gray-900 p-0 rounded-xl border border-gray-800 shadow-sm relative overflow-hidden flex flex-col cursor-pointer hover:border-primary-500 transition-colors"
                                    onClick={() => setSelectedLiveStudent(student)}>

                                    {student.proctoring_flags > 0 && (
                                        <div className="absolute top-0 right-0 bg-red-600/90 text-white text-xs px-3 py-1 font-bold rounded-bl uppercase z-10 shadow-md">
                                            {student.proctoring_flags} ALERT{student.proctoring_flags > 1 ? 'S' : ''}
                                        </div>
                                    )}

                                    <div className="p-4 border-b border-gray-800 bg-gray-950">
                                        <h3 className="font-bold text-lg text-white">{student.user_name}</h3>
                                        <p className="text-sm font-medium text-gray-400">{student.skill}</p>
                                    </div>

                                    <div className="bg-black h-48 flex flex-col items-center justify-center text-gray-500 text-xs relative overflow-hidden">
                                        {liveStreams[student.user_id] || liveStreams[student.user_name] ? (
                                            <>
                                                <img
                                                    src={liveStreams[student.user_id]?.frame || liveStreams[student.user_name]?.frame || liveStreams[student.user_id] || liveStreams[student.user_name]}
                                                    alt={`Stream ${student.user_name}`}
                                                    className="w-full h-full object-cover"
                                                />
                                                {(liveStreams[student.user_id]?.warnings > 0 || liveStreams[student.user_name]?.warnings > 0) && (
                                                    <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold animate-pulse">
                                                        {liveStreams[student.user_id]?.warnings || liveStreams[student.user_name]?.warnings} WARNINGS
                                                    </div>
                                                )}
                                                {liveStreams[student.user_id]?.verified || liveStreams[student.user_name]?.verified ? (
                                                    <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded font-bold">
                                                        VERIFIED
                                                    </div>
                                                ) : (
                                                    <div className="absolute top-2 left-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded font-bold">
                                                        PENDING
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-8 h-8 opacity-20 mb-2" />
                                                Waiting for student...
                                            </>
                                        )}
                                        <div className="absolute bottom-2 left-2 flex items-center gap-2">
                                            <span className="bg-black/70 text-white px-2 py-0.5 rounded shadow text-[10px] uppercase font-bold tracking-wider">AI Monitor</span>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-gray-900">
                                        {student.proctoring_flags > 0 ? (
                                            <div className="border border-red-800/50 text-red-400 text-xs p-3 bg-red-900/20 rounded-lg shadow-sm">
                                                <strong className="block mb-1 text-red-500 border-b border-red-800/50 pb-1">VIOLATION DETECTED</strong>
                                                Suspicious activity or voice detected. Exam may be terminated.
                                            </div>
                                        ) : (
                                            <div className="border border-green-800/50 text-green-400 text-xs p-3 bg-green-900/20 rounded-lg shadow-sm flex items-center">
                                                <CheckCircle className="w-4 h-4 mr-2" /> AI monitoring normal. Student verified.
                                            </div>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleTerminateStudent(student);
                                            }}
                                            className="mt-3 w-full flex items-center justify-center px-4 py-2 bg-red-900/50 hover:bg-red-800 text-red-400 border border-red-700 rounded-lg text-sm font-medium transition"
                                        >
                                            <XSquare className="w-4 h-4 mr-2" />
                                            Terminate Exam
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                console.log("Remove from monitor clicked for:", student.user_name);
                                                removeFromMonitoring(student);
                                            }}
                                            className="mt-2 w-full flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-yellow-700 rounded-lg text-sm font-medium transition"
                                        >
                                            Remove from Monitor
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {students.filter(s => s.status === 'IN_PROGRESS').length === 0 && (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                    <p>No active exams in progress</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'evaluate' && (
                    <div className="bg-gray-900 p-8 rounded-xl shadow border border-gray-800">
                        {selectedStudent ? (
                            <div>
                                <button
                                    onClick={() => setSelectedStudent(null)}
                                    className="mb-4 text-purple-400 hover:text-purple-300 flex items-center"
                                >
                                    ← Back to submissions
                                </button>
                                <h2 className="text-xl font-bold mb-2 text-white">Student Answers Review</h2>
                                <p className="text-gray-400 mb-6">
                                    {selectedStudent.user_name} - {selectedStudent.skill} Assessment
                                </p>

                                <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 mb-6">
                                    <h3 className="font-bold text-lg text-purple-400 mb-4">Student's Answers</h3>

                                    {selectedStudent.answers && Object.keys(selectedStudent.answers).length > 0 ? (
                                        <div className="space-y-4">
                                            {Object.entries(selectedStudent.answers).map(([questionId, answer]) => (
                                                <div key={questionId} className="border-b border-gray-800 pb-4 last:border-0">
                                                    <p className="text-sm text-gray-400 mb-1">Question ID: {questionId}</p>
                                                    <p className="text-white">{answer || 'No answer provided'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">No answers recorded</p>
                                    )}
                                </div>

                                {selectedStudent.proctoring_logs && selectedStudent.proctoring_logs.length > 0 && (
                                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-6 mb-6">
                                        <h3 className="font-bold text-lg text-red-400 mb-4">Proctoring Logs</h3>
                                        <div className="space-y-2">
                                            {selectedStudent.proctoring_logs.map((log, idx) => (
                                                <div key={idx} className="text-sm text-gray-300">
                                                    <span className="text-gray-500">{log.time}</span> - {log.msg}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <button onClick={() => finalizeAutoScore(selectedStudent.id)} className="bg-green-900/30 text-green-400 border border-green-800/50 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-green-900/50 transition">
                                        Finalize Auto-Score
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-xl font-bold mb-4 text-white">Final Evaluation & Override</h2>
                                <p className="text-gray-400 mb-8">Review auto-graded submissions, check incident logs, and manually approve or override final scores.</p>

                                <div className="space-y-6">
                                    {students.filter(s => s.status === 'COMPLETED' || s.status === 'Graded').map(student => (
                                        <div key={student.id} className="border border-gray-800 bg-gray-950 p-6 rounded-xl flex flex-col lg:flex-row justify-between lg:items-center gap-6 shadow-sm hover:shadow-md hover:border-gray-700 transition">
                                            <div className="flex-1">
                                                <h3 className="font-bold text-xl text-white">{student.user_name}</h3>
                                                <div className="flex gap-4 mt-2 text-sm">
                                                    <span className="text-gray-400 font-medium">Exam: {student.skill}</span>
                                                    <span className="text-gray-600">|</span>
                                                    <span className="text-gray-500 font-medium">Attempt: {student.attempt_id?.substring(0, 8) || 'N/A'}</span>
                                                    <span className="text-gray-600">|</span>
                                                    <span className="text-red-400 font-bold">{student.proctoring_flags} Flags</span>
                                                </div>
                                                {student.timestamp && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Submitted: {new Date(student.timestamp).toLocaleDateString()} at {new Date(student.timestamp).toLocaleTimeString()}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:min-w-[200px] flex items-center gap-3">
                                                <div className="flex-1">
                                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Score</p>
                                                    <p className={`text-lg font-bold ${student.score >= 60 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {student.overridden_score !== null && student.overridden_score !== undefined ? student.overridden_score : student.score || 0}%
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex lg:flex-col gap-3">
                                                <button
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="flex-1 bg-gray-800 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-gray-700 border border-gray-700 transition flex items-center justify-center"
                                                >
                                                    <FileText className="w-4 h-4 mr-2" /> View Answers
                                                </button>
                                                <button
                                                    onClick={() => openEditScore(student)}
                                                    className="flex-1 bg-amber-900/30 text-amber-400 border border-amber-800/50 px-5 py-2.5 rounded-lg text-sm font-bold shadow-sm hover:bg-amber-900/50 transition flex items-center justify-center"
                                                >
                                                    <Edit3 className="w-4 h-4 mr-2" /> Edit Score
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {students.filter(s => s.status === 'COMPLETED' || s.status === 'Graded').length === 0 && (
                                        <div className="text-center py-12 text-gray-500">
                                            <CheckSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                            <p>No completed exams to evaluate</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Edit Score Modal */}
                {editingScore && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                        <div className="bg-gray-900 border border-amber-600 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
                            <h3 className="text-xl font-bold text-amber-400 mb-6 flex items-center">
                                <Edit3 className="w-5 h-5 mr-2" /> Edit Score
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">New Score (0-100)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={editScoreValue}
                                        onChange={(e) => setEditScoreValue(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Mentor Feedback (Optional)</label>
                                    <textarea
                                        value={editFeedback}
                                        onChange={(e) => setEditFeedback(e.target.value)}
                                        placeholder="Add feedback for the student..."
                                        rows={3}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button
                                    onClick={() => {
                                        setEditingScore(null);
                                        setEditScoreValue('');
                                        setEditFeedback('');
                                    }}
                                    className="flex-1 bg-gray-800 text-gray-300 px-5 py-3 rounded-lg font-medium hover:bg-gray-700 border border-gray-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleEditScore(editingScore)}
                                    className="flex-1 bg-amber-600 text-white px-5 py-3 rounded-lg font-bold hover:bg-amber-500 transition"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* Enlarged Stream Modal */}
                {selectedLiveStudent && (
                    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-purple-500/50 rounded-xl p-6 max-w-4xl w-full shadow-2xl relative flex flex-col h-[80vh]">
                            <button
                                onClick={() => setSelectedLiveStudent(null)}
                                className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 rounded-full p-2"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>

                            <h3 className="text-2xl font-bold text-white mb-2 flex items-center">
                                <ShieldAlert className="w-6 h-6 mr-3 text-purple-400" />
                                Live Monitor: {selectedLiveStudent.user_name}
                            </h3>
                            <p className="text-gray-400 mb-4">{selectedLiveStudent.skill} Assessment</p>

                            <div className="flex-1 bg-black rounded-lg overflow-hidden relative flex items-center justify-center border border-gray-800">
                                {liveStreams[selectedLiveStudent.user_id] || liveStreams[selectedLiveStudent.user_name] ? (
                                    <img
                                        src={liveStreams[selectedLiveStudent.user_id]?.frame || liveStreams[selectedLiveStudent.user_name]?.frame || liveStreams[selectedLiveStudent.user_id] || liveStreams[selectedLiveStudent.user_name]}
                                        alt={`Stream ${selectedLiveStudent.user_name}`}
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-center text-gray-500">
                                        <Camera className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                        <p>Waiting for video feed...</p>
                                    </div>
                                )}

                                {(liveStreams[selectedLiveStudent.user_id]?.warnings > 0 || liveStreams[selectedLiveStudent.user_name]?.warnings > 0 || selectedLiveStudent.proctoring_flags > 0) && (
                                    <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded font-bold animate-pulse text-lg shadow-lg">
                                        {Math.max(liveStreams[selectedLiveStudent.user_id]?.warnings || 0, liveStreams[selectedLiveStudent.user_name]?.warnings || 0, selectedLiveStudent.proctoring_flags || 0)} WARNINGS
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex gap-4">
                                <div className={`flex-1 border p-4 rounded-lg bg-gray-950 ${selectedLiveStudent.proctoring_flags > 0 ? 'border-red-900/50' : 'border-green-900/50'}`}>
                                    <p className="text-sm text-gray-400 mb-1">Status</p>
                                    <p className={`font-bold ${selectedLiveStudent.proctoring_flags > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                        {selectedLiveStudent.proctoring_flags > 0 ? 'Suspicious Activity Detected' : 'Monitoring Normal'}
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        console.log("Remove from monitor clicked for:", selectedLiveStudent.user_name);
                                        removeFromMonitoring(selectedLiveStudent);
                                        setSelectedLiveStudent(null);
                                    }}
                                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-yellow-400 border border-yellow-700 rounded-lg text-sm font-medium transition"
                                >
                                    Remove from Monitor
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* Edit Question Modal */}
            {editingQuestion && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">Edit Question</h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editQuestionData.title}
                                    onChange={(e) => setEditQuestionData({...editQuestionData, title: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Skill</label>
                                    <input
                                        type="text"
                                        value={editQuestionData.skill}
                                        onChange={(e) => setEditQuestionData({...editQuestionData, skill: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Marks</label>
                                    <input
                                        type="number"
                                        value={editQuestionData.marks}
                                        onChange={(e) => setEditQuestionData({...editQuestionData, marks: parseInt(e.target.value)})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Type</label>
                                <select
                                    value={editQuestionData.type}
                                    onChange={(e) => setEditQuestionData({...editQuestionData, type: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                >
                                    <option value="MCQ">MCQ</option>
                                    <option value="Short Answer">Short Answer</option>
                                    <option value="Coding">Coding</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Problem Statement</label>
                                <textarea
                                    value={editQuestionData.problem_statement}
                                    onChange={(e) => setEditQuestionData({...editQuestionData, problem_statement: e.target.value})}
                                    rows={4}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            {editQuestionData.type === 'MCQ' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Options (JSON format)</label>
                                    <textarea
                                        value={JSON.stringify(editQuestionData.options, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                setEditQuestionData({...editQuestionData, options: JSON.parse(e.target.value)});
                                            } catch {}
                                        }}
                                        rows={4}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                                    />
                                    <label className="block text-sm font-medium text-gray-400 mb-1 mt-2">Correct Answer</label>
                                    <input
                                        type="text"
                                        value={editQuestionData.correct_answer}
                                        onChange={(e) => setEditQuestionData({...editQuestionData, correct_answer: e.target.value})}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g., A"
                                    />
                                </div>
                            )}
                            {editQuestionData.type === 'Coding' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Test Cases (JSON format)</label>
                                    <textarea
                                        value={JSON.stringify(editQuestionData.test_cases, null, 2)}
                                        onChange={(e) => {
                                            try {
                                                setEditQuestionData({...editQuestionData, test_cases: JSON.parse(e.target.value)});
                                            } catch {}
                                        }}
                                        rows={4}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
                            <button
                                onClick={() => setEditingQuestion(null)}
                                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => updateQuestion(editingQuestion)}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-bold transition"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ExamMentorPage;
