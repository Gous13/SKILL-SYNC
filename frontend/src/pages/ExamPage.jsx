import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Mic, AlertTriangle, CheckCircle, Clock, Play, Code, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

const ExamPage = () => {
  const [searchParams] = useSearchParams();
  const initialSkill = searchParams.get('skill') || '';

  const [step, setStep] = useState('skill_selection');
  const [skill, setSkill] = useState(initialSkill);
  const [examStarted, setExamStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3600);
  const [warnings, setWarnings] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [proctorLogs, setProctorLogs] = useState([]);
  const [attemptId, setAttemptId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const socketRef = useRef(null);
  const { user } = useAuth();

  const faceNotDetectedStartRef = useRef(null);
  const multipleFacesDetectedStartRef = useRef(null);
  const lookAwayStartRef = useRef(null);
  const tabSwitchCountRef = useRef(0);
  const lastWarningTimeRef = useRef(0);
  const warningDismissTimeoutRef = useRef(null);
  const warningCountRef = useRef(0);
  useEffect(() => {
    warningCountRef.current = warningCount;
  }, [warningCount]);
  const socketStreamIntervalRef = useRef(null);

  const [aiGeneratedQuestion, setAiGeneratedQuestion] = useState(null);
  const [questions, setQuestions] = useState([]);

  const [answers, setAnswers] = useState({
    mcq1: '',
    short1: '',
    code1: ''
  });

  const [testResult, setTestResult] = useState(null);

  const handleSkillSubmit = async (targetSkill) => {
    const skillToValuate = targetSkill || skill;
    if (!skillToValuate) return alert('Please enter a subject/skill');

    const validSkills = [
      'python', 'javascript', 'react', 'java', 'c++', 'sql',
      'machine learning', 'data structures', 'web development',
      'html', 'css', 'node', 'nodejs', 'express', 'database',
      'algorithms', 'typescript', 'angular', 'vue', 'django',
      'flask', 'spring', 'ruby', 'rails', 'php', 'laravel',
      'c#', 'csharp', 'go', 'golang', 'rust', 'swift',
      'kotlin', 'scala', 'mongodb', 'postgresql', 'mysql',
      'redis', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
      'devops', 'rest api', 'graphql', 'jquery', 'bootstrap',
      'tailwind', 'sass', 'less', 'webpack', 'vite', 'npm',
      'yarn', 'git', 'github', 'gitlab', 'jquery mobile',
      'react native', 'flutter', 'ionic', 'xamarin', 'android',
      'ios', 'objective-c', 'r', 'matlab', 'spss', 'sas',
      'statistics', 'deep learning', 'neural networks', 'nlp',
      'computer vision', 'opencv', 'tensorflow', 'pytorch', 'keras'
    ];

    const skillLower = skillToValuate.toLowerCase().trim();
    const isValid = validSkills.some(valid => skillLower.includes(valid));

    if (!isValid) {
      setStep('skill_selection');
      return alert(`Invalid skill: "${skillToValuate}". Please enter a valid programming language, framework, or technology (e.g., Python, JavaScript, React, Java, SQL, etc.)`);
    }

    setStep('generating');
    setSkill(skillToValuate);

    let fetchedQuestions = [];
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/exam/questions?skill=${encodeURIComponent(skillToValuate)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchedQuestions = await res.json();
        setQuestions(fetchedQuestions);
      }
    } catch (err) {
      console.error("Failed fetching questions from server", err);
    }

    setTimeout(() => {
      if (fetchedQuestions.length === 0) {
        setAiGeneratedQuestion(generateSkillBasedQuestion(skillToValuate));
      }
      setStep('setup');
      requestPermissions();
    }, 2000);
  };

  const generateSkillBasedQuestion = (skill) => {
    const skillLower = skill.toLowerCase();

    const skillQuestions = {
      python: {
        title: 'Python Data Processing',
        problemStatement: `Write a Python function that takes a list of integers and returns a new list containing only the unique elements while preserving the original order. Additionally, implement error handling for non-integer inputs.`,
        sampleInput: 'input_list = [1, 2, 2, 3, 4, 3, 5]',
        sampleOutput: '[1, 2, 3, 4, 5]',
        hiddenTests: 5
      },
      javascript: {
        title: 'JavaScript DOM Manipulation',
        problemStatement: `Write a JavaScript function that creates a debounced version of a callback function. The debounced function should delay execution until after a specified wait time has elapsed since the last call.`,
        sampleInput: 'debounce(fn, 300)',
        sampleOutput: 'Returns a debounced function',
        hiddenTests: 4
      },
      react: {
        title: 'React State Management',
        problemStatement: `Create a custom React hook called useLocalStorage that syncs state with browser localStorage. It should handle serialization/deserialization and provide a clean API similar to useState.`,
        sampleInput: 'const [value, setValue] = useLocalStorage("key", "default")',
        sampleOutput: 'Manages state in localStorage',
        hiddenTests: 4
      },
      java: {
        title: 'Java Object-Oriented Programming',
        problemStatement: `Implement an abstract class Shape with abstract methods for area() and perimeter(). Then create Circle and Rectangle subclasses that properly implement these methods with appropriate constructors and validation.`,
        sampleInput: 'Shape circle = new Circle(5);',
        sampleOutput: 'area = 78.54, perimeter = 31.42',
        hiddenTests: 5
      },
      'c++': {
        title: 'C++ Memory Management',
        problemStatement: `Implement a smart pointer class template that manages dynamic memory with reference counting. Include copy constructor, move constructor, and proper memory deallocation.`,
        sampleInput: 'SmartPtr<int> ptr(new int(10));',
        sampleOutput: 'Reference count tracking',
        hiddenTests: 4
      },
      sql: {
        title: 'SQL Database Queries',
        problemStatement: `Write a SQL query that finds the nth highest salary from an employees table. Also include a query that ranks employees by salary within each department using window functions.`,
        sampleInput: 'Employees table with columns: id, name, department, salary',
        sampleOutput: 'Nth highest salary result',
        hiddenTests: 4
      },
      machine: {
        title: 'Machine Learning Implementation',
        problemStatement: `Implement a simple neural network from scratch using NumPy that can perform binary classification. Include forward propagation, backpropagation, and training loop.`,
        sampleInput: 'X_train, y_train for binary classification',
        sampleOutput: 'Trained model predictions',
        hiddenTests: 4
      },
      data: {
        title: 'Data Structures & Algorithms',
        problemStatement: `Implement a thread-safe LRU (Least Recently Used) cache with O(1) time complexity for both get and put operations. Use appropriate locking mechanisms.`,
        sampleInput: 'cache = LRUCache(2); cache.put(1,1); cache.put(2,2); cache.get(1)',
        sampleOutput: 'Returns 1',
        hiddenTests: 5
      },
      web: {
        title: 'Web API Development',
        problemStatement: `Design and implement a RESTful API endpoint for user authentication using JWT tokens. Include registration, login, token refresh, and middleware for protected routes.`,
        sampleInput: 'POST /api/auth/login with credentials',
        sampleOutput: 'JWT access and refresh tokens',
        hiddenTests: 4
      },
      html: {
        title: 'HTML/CSS Layout',
        problemStatement: `Create a responsive grid layout using CSS Grid that adapts from single column on mobile to 3 columns on desktop. Include a sticky header and proper semantic HTML structure.`,
        sampleInput: 'HTML structure with CSS Grid',
        sampleOutput: 'Responsive layout',
        hiddenTests: 3
      },
      css: {
        title: 'CSS Animations',
        problemStatement: `Implement a complex CSS animation that creates a loading spinner with pulsing effect, using only CSS (no JavaScript for the animation). Include accessibility considerations.`,
        sampleInput: 'HTML element with CSS classes',
        sampleOutput: 'Animated spinner',
        hiddenTests: 3
      },
      node: {
        title: 'Node.js Asynchronous Programming',
        problemStatement: `Implement a function that fetches data from multiple APIs concurrently using Promises, with error handling and a timeout. Use async/await and handle partial failures gracefully.`,
        sampleInput: 'fetchAll(urls, timeout)',
        sampleOutput: 'Array of results',
        hiddenTests: 4
      },
      express: {
        title: 'Express.js Middleware',
        problemStatement: `Create custom Express middleware for request rate limiting per IP address, with different limits for authenticated vs anonymous users. Include proper headers and error responses.`,
        sampleInput: 'Rate limiter middleware',
        sampleOutput: 'Rate limited responses',
        hiddenTests: 4
      },
      database: {
        title: 'Database Design',
        problemStatement: `Design a normalized database schema for an e-commerce system with users, products, orders, and reviews. Include proper foreign keys, indexes, and write optimization queries.`,
        sampleInput: 'ER diagram for e-commerce',
        sampleOutput: 'SQL CREATE TABLE statements',
        hiddenTests: 4
      },
      algorithms: {
        title: 'Algorithm Design',
        problemStatement: `Implement Dijkstra's algorithm for finding shortest path in a weighted graph. Handle edge cases like negative weights and disconnected nodes.`,
        sampleInput: 'Graph adjacency list, start node',
        sampleOutput: 'Shortest paths from start',
        hiddenTests: 5
      },
      default: {
        title: `Implement a Solution in ${skill}`,
        problemStatement: `Write a function that solves the given problem efficiently. Consider edge cases and optimize for time and space complexity. Your solution will be tested against hidden test cases.`,
        sampleInput: 'Based on problem requirements',
        sampleOutput: 'Expected output',
        hiddenTests: 3
      }
    };

    for (const [key, value] of Object.entries(skillQuestions)) {
      if (skillLower.includes(key)) {
        return value;
      }
    }

    return skillQuestions.default;
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    if (initialSkill) {
      handleSkillSubmit(initialSkill);
    }
  }, []);

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: true
      });
      streamRef.current = stream;

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      if (!hasVideo) {
        setCameraPermissionDenied(true);
        alert('Camera is not available. Please connect a camera and try again.');
        return;
      }
      if (!hasAudio) {
        alert('Microphone is not available. Please connect a microphone and try again.');
        return;
      }

      setMicDetected(true);
      setCameraPermissionDenied(false);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    } catch (err) {
      console.error('Media access error:', err);
      setCameraPermissionDenied(true);
    }
  };

  const verifyIdentity = async () => {
    if (!videoRef.current || !canvasRef.current) {
      alert('Camera not ready. Please wait and try again.');
      return;
    }

    setVerificationStatus('verifying');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    await new Promise(resolve => {
      if (video.readyState >= 2) {
        resolve();
      } else {
        video.onloadeddata = resolve;
      }
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    if (canvas.width > 640 || canvas.height > 480) {
      const scale = Math.min(640 / canvas.width, 480 / canvas.height);
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(video, 0, 0);
      canvas.width = Math.floor(canvas.width * scale);
      canvas.height = Math.floor(canvas.height * scale);
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let skinPixels = 0;
    let totalBrightness = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;

      if (r > 95 && g > 40 && b > 20 &&
        r > g && r > b &&
        Math.abs(r - g) > 15 &&
        r > 60) {
        skinPixels++;
      }
    }

    const skinRatio = skinPixels / (data.length / 4);
    const avgBrightness = totalBrightness / (data.length / 4);

    console.log('Skin ratio:', skinRatio, 'Brightness:', avgBrightness);

    let faceFound = skinRatio > 0.008 || avgBrightness > 20;

    if (faceFound) {
      const photoData = canvas.toDataURL('image/jpeg', 0.8);
      setVerifiedPhoto(photoData);
      setFaceDetected(true);
      setVerificationStatus('verified');
      setCanStartExam(true);
    } else {
      setFaceDetected(false);
      setVerificationStatus('failed');
      alert(`No face detected. Skin ratio: ${skinRatio.toFixed(4)}, Brightness: ${avgBrightness.toFixed(0)}. Please ensure your face is visible and well-lit, then try again.`);
    }
  };

  const detectFaceOnce = async () => {
    if (!videoRef.current || !canvasRef.current) return { faceDetected: false, faceCount: 0 };

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState < 2) return { faceDetected: false, faceCount: 0 };

    const targetWidth = Math.min(video.videoWidth || 320, 320);
    const targetHeight = Math.min(video.videoHeight || 240, 240);
    if (canvas.width !== targetWidth) canvas.width = targetWidth;
    if (canvas.height !== targetHeight) canvas.height = targetHeight;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    try {
      if ('FaceDetector' in window) {
        const faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
        const faces = await faceDetector.detect(canvas);
        return { faceDetected: faces.length >= 1, faceCount: faces.length };
      } else {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let skinPixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
            skinPixels++;
          }
        }

        const skinRatio = skinPixels / (data.length / 4);
        return { faceDetected: skinRatio > 0.03, faceCount: skinRatio > 0.03 ? 1 : 0 };
      }
    } catch (err) {
      console.error('Face detection error:', err);
      return { faceDetected: false, faceCount: 0 };
    }
  };

  const startContinuousFaceMonitoring = () => {
    const checkInterval = 1000;
    const NO_FACE_THRESHOLD = 8000;
    const MULTIPLE_FACES_THRESHOLD = 5000;
    const FORBIDDEN_OBJECT_THRESHOLD = 3000;

    faceDetectionIntervalRef.current = setInterval(async () => {
      if (!examStarted || !videoRef.current) return;

      const { faceDetected, faceCount } = await detectFaceOnce();
      const { hasObjects: hasForbiddenObjects, objects: detectedObjects } = await detectObjects();
      const now = Date.now();

      if (faceCount === 0) {
        if (!faceNotDetectedStartRef.current) {
          faceNotDetectedStartRef.current = now;
        } else if (now - faceNotDetectedStartRef.current > NO_FACE_THRESHOLD) {
          const msg = 'Face not detected for extended period. Please ensure your face is visible.';
          if (warningCount >= 2) {
            addProctorLog('FACE_NOT_DETECTED', 'Face not detected for 8+ seconds - terminating');
            terminateExam(msg);
          } else {
            addProctorLog('FACE_NOT_DETECTED', msg);
            showWarning(msg);
          }
          faceNotDetectedStartRef.current = null;
        }
      } else {
        faceNotDetectedStartRef.current = null;
      }

      if (faceCount > 1) {
        if (!multipleFacesDetectedStartRef.current) {
          multipleFacesDetectedStartRef.current = now;
        } else if (now - multipleFacesDetectedStartRef.current > MULTIPLE_FACES_THRESHOLD) {
          const msg = 'Multiple faces detected for extended period. Please ensure only you are in frame.';
          if (warningCount >= 2) {
            addProctorLog('MULTIPLE_FACES', 'Multiple faces detected for 5+ seconds - terminating');
            terminateExam(msg);
          } else {
            addProctorLog('MULTIPLE_FACES', msg);
            showWarning(msg);
          }
          multipleFacesDetectedStartRef.current = null;
        }
      } else {
        multipleFacesDetectedStartRef.current = null;
      }

      if (hasForbiddenObjects) {
        const objectNames = [...new Set(detectedObjects)].join(', ');
        if (!forbiddenObjectDetectedStartRef.current) {
          forbiddenObjectDetectedStartRef.current = now;
        } else if (now - forbiddenObjectDetectedStartRef.current > FORBIDDEN_OBJECT_THRESHOLD) {
          const msg = `Forbidden object detected: ${objectNames}. Please remove phones and other items from view.`;
          if (warningCount >= 2) {
            addProctorLog('FORBIDDEN_OBJECT', `Forbidden object detected for 3+ seconds - terminating: ${objectNames}`);
            terminateExam(msg);
          } else {
            addProctorLog('FORBIDDEN_OBJECT', msg);
            showWarning(msg);
          }
          forbiddenObjectDetectedStartRef.current = null;
        }
      } else {
        forbiddenObjectDetectedStartRef.current = null;
      }

    }, checkInterval);
  };

  const startImmediateVerification = async () => {
    let attempts = 0;
    const maxAttempts = 20;
    const checkInterval = 100;

    const checkForFace = async () => {
      if (verificationStatus === 'verified') return;

      attempts++;
      const faceFound = await detectFaceOnce();

      if (faceFound) {
        setFaceDetected(true);
        setVerificationStatus('verified');
        setCanStartExam(true);
        return;
      }

      if (attempts < maxAttempts) {
        checkForFace();
      } else {
        setFaceDetected(false);
        setVerificationStatus('failed');
      }
    };

    checkForFace();
  };

  const startVerification = () => {
    verificationIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || verificationStatus === 'verified') return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState !== 4) return;

      const verifyWidth = Math.min(video.videoWidth || 320, 320);
      const verifyHeight = Math.min(video.videoHeight || 240, 240);
      if (canvas.width !== verifyWidth) canvas.width = verifyWidth;
      if (canvas.height !== verifyHeight) canvas.height = verifyHeight;
      ctx.drawImage(video, 0, 0, verifyWidth, verifyHeight);

      let faceFound = false;

      try {
        if ('FaceDetector' in window) {
          const faceDetector = new FaceDetector({ fastMode: true, maxDetectedFaces: 3 });
          const faces = await faceDetector.detect(canvas);
          faceFound = faces.length === 1;
        } else {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          let skinPixels = 0;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
              skinPixels++;
            }
          }

          faceFound = skinPixels / (data.length / 4) > 0.08;
        }
      } catch (err) {
        console.error('Face detection error:', err);
      }

      if (faceFound) {
        setFaceDetected(true);
        setVerificationStatus('verified');
        setCanStartExam(true);
        if (verificationIntervalRef.current) {
          clearInterval(verificationIntervalRef.current);
        }
      } else {
        setFaceDetected(false);
        setVerificationStatus('verifying');
        setCanStartExam(false);
      }
    }, 1000);
  };

  const [faceDetected, setFaceDetected] = useState(false);
  const [micDetected, setMicDetected] = useState(false);
  const [canStartExam, setCanStartExam] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [verifiedPhoto, setVerifiedPhoto] = useState(null);
  const canvasRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const cocoModelRef = useRef(null);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const lastWarningRef = useRef(0);

  const forbiddenObjectDetectedStartRef = useRef(null);
  const audioWarningStartRef = useRef(null);

  const setupAudioMonitoring = () => {
    if (!streamRef.current) return;

    const audioTracks = streamRef.current.getAudioTracks();
    if (audioTracks.length === 0) return;

    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;

      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(analyserRef.current);

      const checkAudio = () => {
        if (!analyserRef.current || !examStarted) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        if (average > 50) {
          const now = Date.now();
          if (!audioWarningStartRef.current) {
            audioWarningStartRef.current = now;
          } else if (now - audioWarningStartRef.current > 3000) {
            const msg = 'Voice detected. Please stay silent during the exam.';
            addProctorLog('VOICE_DETECTED', msg);

            if (warningCount >= 2) {
              addProctorLog('VOICE_DETECTED', 'Multiple voice detections - terminating exam');
              terminateExam(msg);
            } else {
              showWarning(msg);
            }
            audioWarningStartRef.current = null;
          }
        } else {
          audioWarningStartRef.current = null;
        }
      };

      setInterval(checkAudio, 500);
    } catch (err) {
      console.error('Audio monitoring error:', err);
    }
  };

  const loadCocoModel = async () => {
    try {
      const cocoSsd = await import('@tensorflow-models/coco-ssd');
      const model = await cocoSsd.load();
      cocoModelRef.current = model;
      console.log('COCO-SSD model loaded successfully');
    } catch (err) {
      console.error('Failed to load COCO-SSD model:', err);
    }
  };

  const detectObjects = async () => {
    if (!videoRef.current || !canvasRef.current || !cocoModelRef.current) return { hasObjects: false, objects: [] };

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState < 2) return { hasObjects: false, objects: [] };

    const objWidth = Math.min(video.videoWidth || 320, 320);
    const objHeight = Math.min(video.videoHeight || 240, 240);
    if (canvas.width !== objWidth) canvas.width = objWidth;
    if (canvas.height !== objHeight) canvas.height = objHeight;
    ctx.drawImage(video, 0, 0, objWidth, objHeight);

    try {
      const predictions = await cocoModelRef.current.detect(canvas);

      const forbiddenObjects = [
        'cell phone', 'phone', 'remote', 'book', 'notebook',
        'laptop', 'keyboard', 'mouse', 'tv', 'monitor',
        'tablet', 'ipod', 'camera', 'handbag', ' suitcase',
        'bottle', 'cup', 'bowl', 'knife', 'fork', 'spoon'
      ];

      const detectedForbidden = predictions.filter(pred =>
        forbiddenObjects.some(obj => pred.class.toLowerCase().includes(obj.toLowerCase()))
      );

      return {
        hasObjects: detectedForbidden.length > 0,
        objects: detectedForbidden.map(p => p.class)
      };
    } catch (err) {
      console.error('Object detection error:', err);
      return { hasObjects: false, objects: [] };
    }
  };

  const addProctorLog = (eventType, details) => {
    const log = {
      timestamp: new Date().toISOString(),
      eventType,
      details,
      warningCount: warningCount
    };
    setProctorLogs(prev => [...prev, log]);
    console.log('[PROCTOR LOG]', log);
  };

  const showWarning = (msg) => {
    const now = Date.now();
    if (now - lastWarningTimeRef.current > 2000) {
      lastWarningTimeRef.current = now;
      setWarningMessage(msg);
      setShowWarningModal(true);

      setWarnings(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
      setWarningCount(prev => prev + 1);
      addProctorLog('WARNING', msg);

      if (warningDismissTimeoutRef.current) {
        clearTimeout(warningDismissTimeoutRef.current);
      }
      warningDismissTimeoutRef.current = setTimeout(() => {
        setShowWarningModal(false);
      }, 5000);
    }
  };

  const terminateExam = (reason) => {
    addProctorLog('EXAM_TERMINATED', reason);
    alert(`EXAM TERMINATED: ${reason}`);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    if (socketStreamIntervalRef.current) {
      clearInterval(socketStreamIntervalRef.current);
    }
    if (socketRef.current) {
      socketRef.current.emit('proctor_stream', {
        skill: skill,
        studentName: user?.full_name || 'Student',
        studentId: user?.id,
        action: 'COMPLETED'
      });
      setTimeout(() => {
        if (socketRef.current) socketRef.current.disconnect();
      }, 500);
    }

    window.location.href = '/dashboard';
  };

  const addWarning = (msg) => {
    const now = Date.now();
    if (now - lastWarningRef.current > 3000) {
      lastWarningRef.current = now;
      setWarnings(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
    }
  };

  useEffect(() => {
    if (!examStarted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        if (now - lastWarningTimeRef.current > 3000) {
          tabSwitchCountRef.current += 1;
          const count = tabSwitchCountRef.current;

          if (count >= 3) {
            addProctorLog('TAB_SWITCH', `Third tab switch detected - terminating exam`);
            terminateExam('Tab switching detected 3 times - exam terminated');
          } else {
            const msg = `Tab switch detected (${count}/3). Please stay on the exam page.`;
            addProctorLog('TAB_SWITCH', msg);
            showWarning(msg);
          }
        }
      }
    };

    const handleBlur = () => {
      // Detect when window loses focus (user may be using another app)
      if (examStarted && document.visibilityState === 'hidden') {
        const now = Date.now();
        // Only warn if this is a significant away period (more than 2 seconds)
        if (now - lastWarningTimeRef.current > 2000) {
          addProctorLog('WINDOW_BLUR', 'Window lost focus - possible use of other applications');
          showWarning('Warning: Please stay focused on the exam. Using other applications may be recorded.');
        }
      }
    };

    // Detect if user tries to open other apps/windows using performance API
    const handleBeforeUnload = (e) => {
      if (examStarted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // Monitor for multiple windows/tabs (additional security)
    let windowCheckInterval;
    if (examStarted) {
      windowCheckInterval = setInterval(() => {
        // Check if there are other windows/tabs of this application
        if (window.screen.width > 0 && window.screen.height > 0) {
          // Additional check can be implemented with more sophisticated methods
          // For now, we rely on visibility API and blur events
        }
      }, 5000);
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (windowCheckInterval) clearInterval(windowCheckInterval);
    };
  }, [examStarted, warningCount, warningMessage]);

  const startExam = async () => {
    if (cameraPermissionDenied) {
      alert('Camera access is required to take this test. Please enable camera permissions.');
      return;
    }

    if (!canStartExam) {
      alert('Please verify your identity first by clicking "Verify Identity" button.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/exam/attempt/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ skill })
      });

      if (res.ok) {
        const attemptData = await res.json();
        setAttemptId(attemptData.attempt_id);
        console.log('[Exam] Attempt started:', attemptData.attempt_id);
      } else {
        console.error('Failed to start exam attempt');
      }
    } catch (err) {
      console.error('Error starting exam attempt:', err);
    }

    setStep('exam');
    setExamStarted(true);
    setWarningCount(0);
    tabSwitchCountRef.current = 0;
    faceNotDetectedStartRef.current = null;
    multipleFacesDetectedStartRef.current = null;

    addProctorLog('EXAM_STARTED', `Exam started for skill: ${skill}`);

    loadCocoModel();
    setupAudioMonitoring();
    startContinuousFaceMonitoring();

    socketRef.current = io('http://localhost:5000', {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
      socketRef.current.emit('join_proctor_room', { skill: skill });

      // Start streaming video automatically
      socketStreamIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current || !examStarted) {
          console.log('[Stream] Skipping - not ready:', { hasVideo: !!videoRef.current, hasCanvas: !!canvasRef.current, examStarted });
          return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        console.log('[Stream] Video readyState:', video.readyState, 'paused:', video.paused);
        
        if (video.readyState < 2) {
          console.log('[Stream] Video not ready yet');
          return;
        }

        if (canvas.width !== 320) canvas.width = 320;
        if (canvas.height !== 240) canvas.height = 240;
        
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.error('[Stream] Error drawing video:', e);
          return;
        }

        const frameData = canvas.toDataURL('image/jpeg', 0.5);
        
        if (!frameData || frameData.length < 100) {
          console.log('[Stream] Empty frame, skipping');
          return;
        }

        socketRef.current.emit('proctor_stream', {
          skill: skill,
          studentName: user?.full_name || 'Student',
          studentId: user?.id,
          frame: frameData,
          warnings: warningCountRef.current,
          verified: true
        });
        console.log('[Stream] Sent frame:', { skill, studentId: user?.id, frameSize: frameData.length });
      }, 2000);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    socketRef.current.on('force_terminate', (data) => {
      if (data.studentId === user?.id) {
        terminateExam('Terminated manually by the mentor.');
      }
    });
  };

  useEffect(() => {
    let timer;
    if (examStarted && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0) {
      handleSubmit();
    }
    return () => clearInterval(timer);
  }, [examStarted, timeLeft]);

  const handleRunCode = () => {
    setTestResult('running');
    setTimeout(() => {
      if (answers.code1.length > 20) {
        setTestResult('success');
      } else {
        setTestResult('failed');
      }
    }, 1500);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const confirmSubmit = window.confirm("Are you sure you want to submit the exam?");
    if (!confirmSubmit) return;

    setIsSubmitting(true);
    setStep('submitting');

    addProctorLog('EXAM_SUBMITTED', `Exam submitted with ${warningCount} warnings`);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    if (socketStreamIntervalRef.current) {
      clearInterval(socketStreamIntervalRef.current);
    }
    if (socketRef.current) {
      socketRef.current.emit('proctor_stream', {
        skill: skill,
        studentName: user?.full_name || 'Student',
        studentId: user?.id,
        action: 'COMPLETED'
      });
      setTimeout(() => {
        if (socketRef.current) socketRef.current.disconnect();
      }, 500);
    }

    try {
      const token = localStorage.getItem('token');
      console.log('Submitting exam with attemptId:', attemptId);
      console.log('Answers:', answers);

      // Collect all answers including dynamic ones from questions
      const allAnswers = { ...answers };
      questions.forEach(q => {
        if (q.type === 'MCQ' && answers[q.id]) {
          allAnswers[q.id] = answers[q.id];
        }
      });

      // Calculate score based on marks: MCQ (5 marks each) and Coding (95 marks)
      let calculatedScore = 0;

      // Check MCQ questions from the server
      questions.forEach(q => {
        if (q.type === 'MCQ') {
          const userAnswer = allAnswers[q.id];
          if (userAnswer && userAnswer.toUpperCase() === q.correct_answer?.toUpperCase()) {
            calculatedScore += 5;
          }
        }
      });

      // Check default MCQ if no questions from server
      if (questions.length === 0 || !questions.some(q => q.type === 'MCQ')) {
        const defaultMCQ = getSkillMCQ(skill);
        if (answers.mcq1 && defaultMCQ && answers.mcq1.toUpperCase() === defaultMCQ.correct?.toUpperCase()) {
          calculatedScore += 5;
        }
      }
      // Add coding score
      if (testResult === 'success') {
        calculatedScore += 95;
      }

      // Cap score at 100 if there are multiple MCQs plus coding
      calculatedScore = Math.min(calculatedScore, 100);

      // Penalize 10 marks per tab switch
      const tabSwitchPenalty = (tabSwitchCountRef.current || 0) * 10;
      calculatedScore = Math.max(0, calculatedScore - tabSwitchPenalty);

      let res;
      const submitData = {
        skill: skill,
        answers: allAnswers,
        score: calculatedScore,
        flags: warningCount,
        logs: warnings,
        proctorLogs: proctorLogs
      };

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(submitData),
        signal: AbortSignal.timeout(30000)
      };

      if (attemptId) {
        res = await fetch(`http://localhost:5000/api/exam/attempt/${attemptId}/submit`, fetchOptions);
      } else {
        res = await fetch('http://localhost:5000/api/exam/submit', fetchOptions);
      }

      if (!res) {
        throw new Error('No response received from server');
      }

      if (res.ok) {
        const resultData = await res.json();
        console.log('Exam submitted successfully:', resultData);
        localStorage.setItem('latestExamResult', JSON.stringify({
          ...resultData,
          timestamp: new Date().toISOString()
        }));
        setStep('finished');
      } else {
        const errorData = await res.json();
        console.error('Submit failed:', errorData);
        alert('Failed to submit exam: ' + (errorData.error || 'Unknown error'));
        setStep('exam');
      }
    } catch (err) {
      console.error("Error submitting exam:", err);
      let errorMessage = 'Error submitting exam. Please try again.';

      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        errorMessage = 'Cannot connect to server. Please ensure the backend is running at http://localhost:5000';
      } else if (err.message) {
        errorMessage = 'Error submitting exam: ' + err.message;
      }

      alert(errorMessage);
      setStep('exam');
    } finally {
      setIsSubmitting(false);
      setExamStarted(false);
    }
  };

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const getSkillMCQ = (skillName) => {
    const skillLower = skillName.toLowerCase();

    const mcqData = {
      python: {
        question: 'In Python, which data structure provides O(1) average time complexity for lookup, insertion, and deletion?',
        options: [
          { id: 'A', text: 'List' },
          { id: 'B', text: 'Dictionary (Hash Map)' },
          { id: 'C', text: 'Tuple' },
          { id: 'D', text: 'Set' }
        ],
        correct: 'B'
      },
      javascript: {
        question: 'What will "typeof null" return in JavaScript?',
        options: [
          { id: 'A', text: '"null"' },
          { id: 'B', text: '"undefined"' },
          { id: 'C', text: '"object"' },
          { id: 'D', text: '"number"' }
        ],
        correct: 'C'
      },
      react: {
        question: 'In React, which hook is used to perform side effects in function components?',
        options: [
          { id: 'A', text: 'useState' },
          { id: 'B', text: 'useEffect' },
          { id: 'C', text: 'useContext' },
          { id: 'D', text: 'useReducer' }
        ],
        correct: 'B'
      },
      java: {
        question: 'In Java, which keyword is used to inherit a class?',
        options: [
          { id: 'A', text: 'implements' },
          { id: 'B', text: 'inherits' },
          { id: 'C', text: 'extends' },
          { id: 'D', text: 'super' }
        ],
        correct: 'C'
      },
      'c++': {
        question: 'What is the output of: sizeof(char) in C++?',
        options: [
          { id: 'A', text: '1 byte' },
          { id: 'B', text: '2 bytes' },
          { id: 'C', text: '4 bytes' },
          { id: 'D', text: 'Depends on compiler' }
        ],
        correct: 'A'
      },
      sql: {
        question: 'Which SQL clause is used to filter grouped results?',
        options: [
          { id: 'A', text: 'WHERE' },
          { id: 'B', text: 'HAVING' },
          { id: 'C', text: 'GROUP BY' },
          { id: 'D', text: 'ORDER BY' }
        ],
        correct: 'B'
      },
      machine: {
        question: 'Which algorithm is typically used for binary classification problems?',
        options: [
          { id: 'A', text: 'K-Means Clustering' },
          { id: 'B', text: 'Linear Regression' },
          { id: 'C', text: 'Logistic Regression' },
          { id: 'D', text: 'Principal Component Analysis' }
        ],
        correct: 'C'
      },
      data: {
        question: 'What is the time complexity of accessing an element in an array by index?',
        options: [
          { id: 'A', text: 'O(1)' },
          { id: 'B', text: 'O(n)' },
          { id: 'C', text: 'O(log n)' },
          { id: 'D', text: 'O(n²)' }
        ],
        correct: 'A'
      },
      web: {
        question: 'Which HTTP status code indicates a successful response?',
        options: [
          { id: 'A', text: '404' },
          { id: 'B', text: '500' },
          { id: 'C', text: '200' },
          { id: 'D', text: '301' }
        ],
        correct: 'C'
      },
      node: {
        question: 'In Node.js, which module is used for file system operations?',
        options: [
          { id: 'A', text: 'http' },
          { id: 'B', text: 'fs' },
          { id: 'C', text: 'path' },
          { id: 'D', text: 'url' }
        ],
        correct: 'B'
      },
      express: {
        question: 'In Express.js, which method is used to handle GET requests?',
        options: [
          { id: 'A', text: 'app.post()' },
          { id: 'B', text: 'app.get()' },
          { id: 'C', text: 'app.put()' },
          { id: 'D', text: 'app.delete()' }
        ],
        correct: 'B'
      },
      algorithms: {
        question: 'Which sorting algorithm has the best average-case time complexity?',
        options: [
          { id: 'A', text: 'Bubble Sort' },
          { id: 'B', text: 'Selection Sort' },
          { id: 'C', text: 'Quick Sort' },
          { id: 'D', text: 'Insertion Sort' }
        ],
        correct: 'C'
      },
      default: {
        question: `What is a fundamental concept in ${skillName} that every developer should understand?`,
        options: [
          { id: 'A', text: 'Core fundamentals and best practices' },
          { id: 'B', text: 'Advanced optimization techniques' },
          { id: 'C', text: 'Debugging and testing strategies' },
          { id: 'D', text: 'All of the above' }
        ],
        correct: 'D'
      }
    };

    let mcq = mcqData.default;
    for (const [key, value] of Object.entries(mcqData)) {
      if (skillLower.includes(key)) {
        mcq = value;
        break;
      }
    }

    return (
      <>
        <p className="text-gray-300 mb-4">{mcq.question}</p>
        <div className="space-y-3">
          {mcq.options.map((opt) => (
            <label key={opt.id} className="flex items-center p-3 rounded-lg border border-gray-800 cursor-pointer hover:bg-purple-900/20 hover:border-purple-500/30 transition bg-black/40">
              <input type="radio" name="mcq1" value={opt.id} className="mr-3 w-4 h-4 text-purple-600 focus:ring-purple-500 bg-gray-900 border-gray-700" onChange={e => setAnswers({ ...answers, mcq1: e.target.value })} />
              <span className="font-bold text-purple-400 w-8">{opt.id}.</span>
              <span className="text-gray-300">{opt.text}</span>
            </label>
          ))}
        </div>
      </>
    );
  };

  return (
    <Layout>
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 border-2 border-red-500 rounded-xl p-6 max-w-sm mx-4 shadow-2xl shadow-red-900/50">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-red-400 text-center mb-2">Warning ({warningCount}/3)</h3>
            <p className="text-gray-300 text-center text-sm">{warningMessage}</p>
            <p className="text-gray-500 text-xs text-center mt-4">
              After 3 warnings, the exam will be terminated.
            </p>
            <button
              onClick={() => setShowWarningModal(false)}
              className="mt-6 w-full py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      <div className="min-h-screen bg-gray-950 px-4 py-8">
        <div className="max-w-6xl mx-auto mt-4">

          {step === 'skill_selection' && (
            <div className="bg-gray-900 rounded-xl shadow-2xl p-12 text-center max-w-2xl mx-auto border border-purple-900/30 ring-1 ring-purple-500/10">
              <Cpu className="w-16 h-16 text-purple-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-4 text-purple-50">AI-Powered Skill Assessment</h1>
              <p className="text-gray-400 mb-8">Enter your target skill. Our AI will instantly generate tailored coding problems, MCQs, and hidden test cases to evaluate your proficiency.</p>
              <input
                type="text"
                className="px-4 py-3 bg-gray-800 border-gray-700 text-white placeholder-gray-500 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-purple-500 mb-6 text-lg border"
                placeholder="e.g. React.js, Python Data Structures, System Design"
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
              />
              <button
                onClick={() => handleSkillSubmit()}
                className="w-full px-6 py-4 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition shadow-lg shadow-purple-900/50 text-lg"
              >
                Generate AI Exam Paper
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="bg-gray-900 rounded-xl shadow-2xl p-24 text-center max-w-2xl mx-auto border border-purple-900/30 flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">AI is drafting your exam...</h2>
              <p className="text-gray-400">Analyzing {skill} concepts, generating problem statements, and configuring hidden test validation.</p>
            </div>
          )}

          {step === 'setup' && (
            <div className="bg-gray-900 rounded-xl shadow p-10 text-center border border-purple-900/30">
              <h2 className="text-2xl font-bold mb-6 text-gray-100">Device Verification & AI Proctoring Setup</h2>

              {cameraPermissionDenied && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-200 p-4 rounded-lg max-w-2xl mx-auto mb-6">
                  <AlertTriangle className="w-6 h-6 inline-block mr-2" />
                  Camera access is required to take this test. Please enable camera permissions and refresh the page.
                </div>
              )}
              <div className="flex justify-center mb-6">
                <div className="w-[400px] h-[300px] bg-black rounded-xl overflow-hidden relative shadow-inner shadow-purple-900/20 border border-gray-800">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`px-2 py-1 text-xs rounded font-medium flex items-center border ${micDetected ? 'bg-green-900/80 text-green-100 border-green-500/30' : 'bg-red-900/80 text-red-100 border-red-500/30'}`}>
                      <Mic className="w-3 h-3 mr-1" /> {micDetected ? 'MIC ACTIVE' : 'MIC OFF'}
                    </span>
                  </div>
                  <div className="absolute top-4 right-4">
                    <span className={`px-2 py-1 text-xs rounded font-medium flex items-center border ${verificationStatus === 'verified' ? 'bg-green-900/80 text-green-100 border-green-500/30' : 'bg-yellow-900/80 text-yellow-100 border-yellow-500/30'}`}>
                      <Camera className="w-3 h-3 mr-1" /> {verificationStatus === 'verified' ? 'VERIFIED' : verificationStatus === 'verifying' ? 'VERIFYING...' : 'NOT VERIFIED'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800/50 border border-purple-500/20 text-purple-200 p-4 rounded-lg max-w-2xl mx-auto mb-8 text-sm text-left">
                <strong className="text-purple-400 mb-2 inline-block">Proctoring Rules:</strong>
                <ul className="list-disc ml-5 mt-2 space-y-1 text-gray-300">
                  <li>Your photo will be captured for identity verification.</li>
                  <li>Camera will be monitored during the exam.</li>
                  <li>Normal movements (blinking, brief looks away) are allowed.</li>
                  <li>You will receive warnings before termination - 3 warnings allowed.</li>
                  <li>Do not switch browser tabs or exit full-screen mode repeatedly.</li>
                </ul>
              </div>

              <div className="mb-6">
                <div className={`flex items-center justify-center gap-2 text-sm font-bold ${canStartExam ? 'text-green-400' : 'text-yellow-400'}`}>
                  {canStartExam ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {canStartExam ? 'Identity Verified - Ready to Start' : 'Click "Verify Identity" to capture your photo'}
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={verifyIdentity}
                  disabled={verificationStatus === 'verified' || verificationStatus === 'verifying'}
                  className={`px-8 py-4 font-bold rounded-lg transition shadow-lg text-lg min-w-[200px] ${verificationStatus === 'verified'
                    ? 'bg-green-600 text-white cursor-default'
                    : verificationStatus === 'verifying'
                      ? 'bg-yellow-600 text-white cursor-wait'
                      : 'bg-purple-600 text-white hover:bg-purple-700 shadow-purple-900/50'
                    }`}
                >
                  {verificationStatus === 'verified' ? 'Verified!' : verificationStatus === 'verifying' ? 'Verifying...' : 'Verify Identity'}
                </button>

                <button
                  onClick={startExam}
                  disabled={!canStartExam}
                  className={`px-8 py-4 font-bold rounded-lg transition shadow-lg text-lg min-w-[200px] ${canStartExam
                    ? 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/50'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50'
                    }`}
                >
                  Start Exam
                </button>
              </div>
            </div>
          )}

          {step === 'exam' && (
            <div className="flex flex-col gap-6">
              <div className="flex-1 flex flex-col gap-6">
                {/* Small warning notification at top */}
                <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg px-4 py-2 flex items-center gap-3">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-300">
                    Using multiple applications during exam is prohibited and may result in termination.
                  </p>
                </div>

                <div className="bg-gray-900 rounded-xl shadow-lg border border-purple-900/30 p-4 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-100">Exam: <span className="text-purple-400">{skill}</span></h2>
                  <div className="flex items-center gap-4">
                    {warningCount > 0 && (
                      <div className={`font-mono font-bold text-lg px-3 py-2 rounded-lg border ${warningCount >= 2 ? 'bg-red-950/50 text-red-400 border-red-500/50' : 'bg-yellow-950/50 text-yellow-400 border-yellow-500/50'}`}>
                        Warnings: {warningCount}/3
                      </div>
                    )}
                    <div className="flex items-center text-red-400 font-mono font-bold text-lg bg-red-950/30 px-4 py-2 rounded-lg border border-red-900/50">
                      <Clock className="w-5 h-5 mr-2" /> {formatTime(timeLeft)}
                    </div>
                    <button
                      onClick={handleSubmit}
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition flex items-center"
                    >
                      Submit Exam
                    </button>
                  </div>
                </div>

                {questions.filter(q => q.type === 'MCQ').map((q, qIndex) => (
                  <div key={q.id} className="bg-gray-900 p-6 border border-gray-800 rounded-xl shadow-lg mt-4">
                    <h3 className="font-semibold text-purple-300 mb-4 text-lg">MCQ. Conceptual Question on {skill}</h3>
                    <p className="text-gray-300 mb-4">{q.problemStatement || q.title}</p>
                    <div className="space-y-3">
                      {q.options && Object.entries(q.options).map(([optKey, optText]) => (
                        <label key={optKey} className={`flex items-center p-3 rounded-lg border border-gray-800 cursor-pointer hover:bg-purple-900/20 hover:border-purple-500/30 transition bg-black/40`}>
                          <input type="radio" name={`mcq_${q.id}`} value={optKey} className="mr-3 w-4 h-4 text-purple-600 focus:ring-purple-500 bg-gray-900 border-gray-700" onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
                          <span className="font-bold text-purple-400 w-8">{optKey}.</span>
                          <span className="text-gray-300">{optText}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                {questions.filter(q => q.type === 'Short Answer').map((q, qIndex) => (
                  <div key={q.id} className="bg-gray-900 p-6 border border-gray-800 rounded-xl shadow-lg mt-4">
                    <h3 className="font-semibold text-purple-300 mb-4 text-lg">Short Answer: {q.title}</h3>
                    <p className="text-gray-300 mb-4">{q.problem_statement}</p>
                    <textarea
                      className="w-full h-32 bg-black/40 border border-gray-800 rounded-lg p-4 text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="Write your answer here..."
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  </div>
                ))}

                {questions.filter(q => q.type === 'Coding').map((q, qIndex) => (
                  <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col mt-4">
                    <div className="bg-black/40 border-b border-gray-800 p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-purple-100 text-lg flex items-center">
                          <Code className="w-5 h-5 mr-2 text-purple-400" />
                          Coding: {q.title}
                        </h3>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed mb-4">{q.problem_statement}</p>
                      <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg text-sm font-mono text-gray-400 mb-3">
                        <div className="mb-2"><strong className="text-purple-400">Sample Input:</strong> {q.sample_input}</div>
                        <div><strong className="text-purple-400">Sample Output:</strong> {q.sample_output}</div>
                      </div>
                      {q.test_cases && q.test_cases.length > 0 && (
                        <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg text-sm font-mono text-gray-400">
                          <div className="text-yellow-400 font-bold mb-2">Test Cases ({q.test_cases.length}):</div>
                          {q.test_cases.map((tc, tcIdx) => (
                            <div key={tcIdx} className="mb-2 pb-2 border-b border-gray-800 last:border-0">
                              <div><strong className="text-purple-400">Test {tcIdx + 1} Input:</strong> {tc.input}</div>
                              <div><strong className="text-purple-400">Expected Output:</strong> {tc.expected_output}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="p-0 border-b border-gray-800 bg-black relative">
                      <textarea
                        className="w-full h-80 bg-[#0d0d12] text-purple-50 p-6 font-mono text-sm focus:outline-none resize-y border-none"
                        placeholder="// Write your code here..."
                        value={answers[q.id] || ''}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        spellCheck="false"
                      />
                    </div>
                  </div>
                ))}

                {questions.length === 0 && (
                  <div className="bg-gray-900 p-6 border border-gray-800 rounded-xl shadow-lg mt-4">
                    <h3 className="font-semibold text-purple-300 mb-4 text-lg">1. Conceptual Question on {skill}</h3>
                    {getSkillMCQ(skill)}
                  </div>
                )}

                {aiGeneratedQuestion && (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
                    {/* Problem Statement Header */}
                    <div className="bg-black/40 border-b border-gray-800 p-5">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-purple-100 text-lg flex items-center">
                          <Code className="w-5 h-5 mr-2 text-purple-400" />
                          2. Practical: {aiGeneratedQuestion.title}
                        </h3>
                        <span className="text-xs font-bold px-3 py-1 bg-purple-900/50 text-purple-300 border border-purple-700/50 rounded-full">AI Generated</span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed mb-4">{aiGeneratedQuestion.problemStatement}</p>
                      <div className="bg-gray-950 border border-gray-800 p-4 rounded-lg text-sm font-mono text-gray-400">
                        <div className="mb-2"><strong className="text-purple-400">Input:</strong> {aiGeneratedQuestion.sampleInput}</div>
                        <div><strong className="text-purple-400">Output:</strong> {aiGeneratedQuestion.sampleOutput}</div>
                      </div>
                    </div>

                    {/* Code Editor */}
                    <div className="p-0 border-b border-gray-800 bg-black relative">
                      <div className="absolute top-0 right-0 p-3 flex gap-2 z-10">
                        <button onClick={handleRunCode} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-md text-xs font-bold flex items-center transition shadow shadow-purple-900/50 border border-purple-500/50">
                          <Play className="w-3 h-3 mr-2" /> RUN CODE
                        </button>
                      </div>
                      <textarea
                        className="w-full h-80 bg-[#0d0d12] text-purple-50 p-6 font-mono text-sm focus:outline-none resize-y border-none"
                        placeholder="// Write your code here...&#10;// e.g. function solution(nums, target) { ... }"
                        value={answers.code1}
                        onChange={e => setAnswers({ ...answers, code1: e.target.value })}
                        spellCheck="false"
                      />
                    </div>

                    {/* Evaluation Result */}
                    <div className="bg-gray-900 border-t border-gray-800 p-5">
                      <h4 className="text-sm font-bold text-gray-400 mb-3 border-b border-gray-800 pb-2">Auto-Evaluation Results ({aiGeneratedQuestion.hiddenTests} Hidden Tests)</h4>
                      {testResult === 'running' && <div className="text-purple-400 text-sm flex items-center"><div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mr-2"></div> Compiling and executing against AI test cases...</div>}
                      {testResult === 'success' && <div className="text-green-400 text-sm font-bold flex items-center bg-green-950/30 border border-green-900/50 p-3 rounded-md"><CheckCircle className="w-4 h-4 mr-2" /> All test cases passed successfully.</div>}
                      {testResult === 'failed' && <div className="text-red-400 text-sm font-bold flex items-center bg-red-950/30 border border-red-900/50 p-3 rounded-md"><AlertTriangle className="w-4 h-4 mr-2" /> Output mismatch on Test Case #2. Keep trying!</div>}
                      {!testResult && <div className="text-gray-500 text-sm italic">Code has not been executed yet. Run code to evaluate against hidden test cases.</div>}
                    </div>
                  </div>
                )}

                <button onClick={handleSubmit} className="w-full py-4 mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-900/50 border border-purple-500/50 text-lg transition">
                  Submit Entire Exam
                </button>
              </div>

              {/* Proctor Sidebar */}
              <div className="w-full lg:w-80 flex flex-col gap-6">
                <div className="bg-black rounded-xl overflow-hidden shadow-lg border border-purple-900/50 relative h-56">
                  {verifiedPhoto ? (
                    <img src={verifiedPhoto} alt="Verified" className="w-full h-full object-cover opacity-90" />
                  ) : (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80"></video>
                  )}
                  <div className="absolute top-3 left-3 bg-purple-600/90 backdrop-blur-sm text-white text-xs px-2 py-1 rounded border border-purple-500/50 font-bold shadow-sm">
                    Verified
                  </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-lg flex-1 flex flex-col overflow-hidden">
                  <div className="bg-black/40 border-b border-gray-800 p-4 flex justify-between items-center">
                    <h4 className="font-bold text-gray-200 flex items-center text-sm">
                      <AlertTriangle className="w-4 h-4 mr-2 text-purple-500" /> Activity Log
                    </h4>
                    <span className={`text-xs border px-3 py-1 rounded-full font-bold ${warningCount >= 2 ? 'bg-red-900/50 text-red-400 border-red-500/50' : 'bg-gray-800 text-purple-400 border-gray-700'}`}>
                      {warningCount}/3 Warnings
                    </span>
                  </div>
                  <div className="p-4 flex-1 overflow-y-auto bg-gray-950">
                    {warnings.length === 0 ? (
                      <div className="h-full flex flex-col justify-center items-center text-center opacity-70">
                        <CheckCircle className="w-8 h-8 text-purple-500/50 mb-3" />
                        <p className="text-sm font-medium text-gray-500">Secure environment.<br />No suspicious activity.</p>
                      </div>
                    ) : (
                      <ul className="space-y-3">
                        {warnings.map((w, idx) => (
                          <li key={idx} className="bg-gray-900 p-3 border-l-4 border-red-500/80 rounded shadow-sm text-sm">
                            <div className="text-red-400 font-bold mb-1">{w.msg}</div>
                            <div className="text-gray-600 text-xs font-mono">{w.time}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'submitting' && (
            <div className="bg-gray-900 rounded-xl shadow-2xl p-24 text-center max-w-2xl mx-auto border border-purple-900/30 flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mb-6"></div>
              <h2 className="text-2xl font-bold text-gray-100 mb-2">Submitting Exam...</h2>
              <p className="text-gray-400">Packaging code execution logs, proctoring footage, and responses for mentor evaluation.</p>
            </div>
          )}

          {step === 'finished' && (
            <div className="bg-gray-900 rounded-xl shadow-2xl p-16 text-center max-w-2xl mx-auto border border-purple-900/30">
              <CheckCircle className="w-24 h-24 text-purple-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
              <h2 className="text-3xl font-bold mb-4 text-purple-50">Exam Successfully Submitted!</h2>
              <p className="text-gray-400 mb-10 max-w-md mx-auto">
                Your submission, including auto-graded code and AI proctoring logs, have been securely transmitted to your mentor for final evaluation.
              </p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-8 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 border border-gray-700 shadow-md transition"
              >
                Return to Dashboard
              </button>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
};

export default ExamPage;
