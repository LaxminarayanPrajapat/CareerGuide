export interface SeedSkill {
  code: string;
  name: string;
  description: string;
  category: 'aptitude' | 'technical' | 'domain' | 'professional' | 'communication';
  isPreferenceSkill?: boolean;
  tags?: string[];
}

/**
 * Skills measured by the assessment engine. Every code here is referenced by
 * the sample questions and by the career catalogue, so a candidate's measured
 * profile can be compared against real career requirements.
 */
export const SKILLS: SeedSkill[] = [
  // Aptitude
  { code: 'LOGICAL_REASONING', name: 'Logical Reasoning', description: 'Ability to identify patterns, draw valid conclusions and reason through unfamiliar problems.', category: 'aptitude', tags: ['reasoning'] },
  { code: 'NUMERICAL_APTITUDE', name: 'Numerical Aptitude', description: 'Comfort with arithmetic, ratios, percentages, rates and quantitative comparison.', category: 'aptitude', tags: ['maths'] },
  { code: 'VERBAL_REASONING', name: 'Verbal Reasoning', description: 'Ability to read carefully, interpret written information and reason from text.', category: 'aptitude', tags: ['communication'] },
  { code: 'SPATIAL_REASONING', name: 'Spatial Reasoning', description: 'Understanding of how 2D representations map onto 3D structures.', category: 'aptitude', tags: ['visual'] },
  { code: 'PROBLEM_SOLVING', name: 'Problem Solving', description: 'Breaking an unfamiliar problem into tractable steps and choosing a viable approach.', category: 'aptitude', tags: ['reasoning'] },

  // Technical
  { code: 'PROGRAMMING_FUNDAMENTALS', name: 'Programming Fundamentals', description: 'Core programming concepts: variables, control flow, functions, data types and debugging.', category: 'technical', tags: ['development'] },
  { code: 'OOP_CONCEPTS', name: 'Object-Oriented Programming', description: 'Classes, objects, encapsulation, inheritance, polymorphism and composition.', category: 'technical', tags: ['development'] },
  { code: 'DATABASE_CONCEPTS', name: 'Database Concepts', description: 'Relational modelling, normalisation, SQL querying, indexing and transactions.', category: 'technical', tags: ['data'] },
  { code: 'WEB_DEVELOPMENT', name: 'Web Development', description: 'Building web applications: HTTP, REST, HTML, CSS, JavaScript and component architecture.', category: 'technical', tags: ['development'] },
  { code: 'VERSION_CONTROL', name: 'Version Control', description: 'Using Git for branching, reviewing changes and collaborating safely on a codebase.', category: 'technical', tags: ['development'] },
  { code: 'ALGORITHMS', name: 'Algorithms & Complexity', description: 'Searching, sorting, recursion and reasoning about time and space complexity.', category: 'technical', tags: ['development'] },

  // Domain
  { code: 'DATA_ANALYSIS', name: 'Data Analysis', description: 'Cleaning, exploring and interpreting datasets to support decisions.', category: 'domain', tags: ['data'] },
  { code: 'STATISTICS', name: 'Statistics', description: 'Descriptive statistics, distributions, sampling and interpreting uncertainty.', category: 'domain', tags: ['data'] },
  { code: 'MACHINE_LEARNING', name: 'Machine Learning', description: 'Supervised and unsupervised learning, model evaluation and overfitting.', category: 'domain', tags: ['data'] },
  { code: 'NETWORKING', name: 'Networking Fundamentals', description: 'IP addressing, protocols, routing, DNS and troubleshooting layered network issues.', category: 'domain', tags: ['infrastructure'] },
  { code: 'CLOUD_PLATFORMS', name: 'Cloud Platforms', description: 'Compute, storage, deployment models, containers and managed services.', category: 'domain', tags: ['infrastructure'] },
  { code: 'CYBERSECURITY', name: 'Cybersecurity Fundamentals', description: 'Threat models, authentication, secure coding, common vulnerabilities and defence basics.', category: 'domain', tags: ['security'] },
  { code: 'TESTING_PRINCIPLES', name: 'Software Testing', description: 'Test levels, test design techniques, defect reporting and automation strategy.', category: 'domain', tags: ['quality'] },
  { code: 'UI_DESIGN', name: 'UI Design Principles', description: 'Layout, visual hierarchy, colour, typography and designing usable interfaces.', category: 'domain', tags: ['design'] },
  { code: 'UX_RESEARCH', name: 'UX Research', description: 'User interviews, usability testing and turning evidence into design decisions.', category: 'domain', tags: ['design'] },
  { code: 'BUSINESS_ANALYTICS', name: 'Business Analytics', description: 'Translating organisational problems into measurable requirements and useful insights.', category: 'domain', tags: ['business'] },
  { code: 'PROJECT_MANAGEMENT', name: 'Project Management', description: 'Planning, estimation, tracking delivery, managing risk and stakeholder communication.', category: 'domain', tags: ['business'] },

  // Professional / communication
  { code: 'COMMUNICATION', name: 'Communication', description: 'Explaining technical ideas clearly to different audiences, in writing and verbally.', category: 'communication', tags: ['soft'] },
  { code: 'TEAM_COLLABORATION', name: 'Team Collaboration', description: 'Working within a team, sharing context and resolving disagreements constructively.', category: 'professional', tags: ['soft'] },
  { code: 'ADAPTABILITY', name: 'Adaptability', description: 'Adjusting to changing requirements and learning unfamiliar tools quickly.', category: 'professional', tags: ['soft'] },
  { code: 'TIME_MANAGEMENT', name: 'Time Management', description: 'Prioritising work, estimating effort and delivering against commitments.', category: 'professional', tags: ['soft'] },
  { code: 'ATTENTION_TO_DETAIL', name: 'Attention to Detail', description: 'Noticing and correcting small errors before they become defects.', category: 'professional', tags: ['soft'] },
  { code: 'CRITICAL_THINKING', name: 'Critical Thinking', description: 'Evaluating evidence, weighing alternatives and forming justified conclusions.', category: 'professional', tags: ['soft'] },
];
