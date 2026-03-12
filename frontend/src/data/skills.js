/**
 * Comprehensive skills list for autocomplete across domains.
 * When user types (e.g., "sql"), related skills are shown for selection.
 */
export const SKILLS_LIST = [
  // Programming Languages
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C', 'C++', 'C#', 'Go', 'Rust',
  'Kotlin', 'Swift', 'R', 'Scala', 'PHP', 'Ruby', 'MATLAB', 'Perl', 'Dart',
  // Web Frontend
  'HTML', 'CSS', 'React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js',
  'Tailwind CSS', 'Bootstrap', 'jQuery', 'Redux', 'React Hooks', 'Webpack', 'Vite',
  // Web Backend
  'Node.js', 'Express', 'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Laravel',
  'ASP.NET', 'REST APIs', 'GraphQL',
  // Database
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'SQLite', 'Oracle',
  'Cassandra', 'Firebase', 'Supabase', 'NoSQL', 'PL/SQL', 'T-SQL',
  // Data & AI
  'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'TensorFlow',
  'PyTorch', 'Scikit-learn', 'Data Science', 'Pandas', 'NumPy', 'OpenCV',
  'Keras', 'Natural Language Processing', 'Data Analysis', 'Data Visualization',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitHub',
  'GitLab', 'CI/CD', 'Linux', 'Terraform', 'Ansible', 'Nginx', 'Apache',
  // Mobile
  'React Native', 'Flutter', 'Android', 'iOS', 'Xamarin', 'SwiftUI',
  'Kotlin Android', 'Mobile App Development',
  // Design
  'UI/UX', 'Figma', 'Adobe XD', 'Photoshop', 'Illustrator', 'Design Thinking',
  'Wireframing', 'Prototyping', 'User Research',
  // Other
  'Agile', 'Scrum', 'Problem Solving', 'Algorithms', 'Data Structures',
  'Object-Oriented Programming', 'System Design', 'API Development',
  'Unit Testing', 'Jest', 'Pytest', 'JUnit', 'Blockchain', 'IoT',
  'Cybersecurity', 'Networking', 'Embedded Systems', 'Robotics',
  // CAD/Engineering (for CAD dept)
  'AutoCAD', 'SolidWorks', 'CATIA', 'Fusion 360', 'Revit', 'ANSYS',
  // Civil
  'Structural Analysis', 'Surveying', 'Construction Management', 'BIM',
  // Electrical/Electronics
  'Circuit Design', 'VHDL', 'Verilog', 'Embedded C', 'Arduino', 'Raspberry Pi',
  'Power Systems', 'Control Systems', 'Signal Processing',
  // Mechanical
  'Thermodynamics', 'Fluid Mechanics', 'CAD/CAM', 'Manufacturing', 'DFM'
]

/**
 * Search skills by query - returns skills that match (case-insensitive).
 * E.g., "sql" returns SQL, MySQL, PostgreSQL, SQLite, NoSQL, PL/SQL, T-SQL
 */
export function searchSkills(query, limit = 10) {
  if (!query || query.trim().length < 2) return []
  const q = query.trim().toLowerCase()
  return SKILLS_LIST
    .filter(skill => skill.toLowerCase().includes(q))
    .slice(0, limit)
}
