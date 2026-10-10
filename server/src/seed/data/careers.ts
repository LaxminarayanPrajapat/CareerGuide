export interface SeedCareer {
  slug: string;
  title: string;
  category: string;
  description: string;
  responsibilities: string[];
  /** Required competencies keyed by skill code from `SKILLS`. */
  requiredSkills: Array<{
    skillCode: string;
    requiredLevel: number;
    weight: number;
    importance: 'core' | 'supporting';
    developmentFocus: string;
  }>;
  aptitudeFit: Array<{ dimension: string; weight: number }>;
  preferenceFit: Array<{ dimension: string; weight: number }>;
  prerequisites: string[];
  learningStages: Array<{ stage: string; focus: string[] }>;
  relatedCareerSlugs: string[];
  suggestedProjects: string[];
}

/**
 * Sample career catalogue for academic demonstration.
 *
 * These entries are illustrative master data, not an exhaustive or ranked list
 * of careers, and not an employment outcome claim. Required levels and weights
 * are documented, editable assumptions that an administrator can revise.
 */
export const CAREERS: SeedCareer[] = [
  {
    slug: 'frontend-developer',
    title: 'Frontend Developer',
    category: 'Software Engineering',
    description:
      'Builds the user-facing layer of web applications: layout, interaction, accessibility and client-side state. Works closely with designers and backend engineers to deliver interfaces that are usable, fast and maintainable.',
    responsibilities: [
      'Implement responsive, accessible interfaces from design specifications',
      'Manage client-side state and data fetching',
      'Write component-level tests and maintain component libraries',
      'Collaborate with backend engineers on API contracts',
    ],
    requiredSkills: [
      { skillCode: 'WEB_DEVELOPMENT', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Deepen HTML semantics, CSS layout, and modern JavaScript fundamentals.' },
      { skillCode: 'UI_DESIGN', requiredLevel: 55, weight: 0.7, importance: 'supporting', developmentFocus: 'Practise spacing, hierarchy and accessible colour contrast.' },
      { skillCode: 'UX_RESEARCH', requiredLevel: 35, weight: 0.4, importance: 'supporting', developmentFocus: 'Learn basic usability testing so you can validate designs with real users.' },
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 60, weight: 0.8, importance: 'core', developmentFocus: 'Strengthen control flow, functions and debugging habits.' },
      { skillCode: 'VERSION_CONTROL', requiredLevel: 50, weight: 0.5, importance: 'supporting', developmentFocus: 'Get comfortable with branching and reviewing diffs.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 60, weight: 0.6, importance: 'supporting', developmentFocus: 'Systematically check cross-browser and responsive edge cases.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.6 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'creative', weight: 0.6 },
      { dimension: 'detail_oriented', weight: 0.5 },
    ],
    prerequisites: ['Basic HTML, CSS and JavaScript', 'Comfort using a browser developer console'],
    learningStages: [
      { stage: 'beginner', focus: ['Semantic HTML and modern CSS layout', 'JavaScript language fundamentals'] },
      { stage: 'intermediate', focus: ['Component architecture and state management', 'Accessibility fundamentals'] },
      { stage: 'advanced', focus: ['Performance optimisation', 'Design systems and testing strategy'] },
    ],
    relatedCareerSlugs: ['full-stack-developer', 'ui-ux-designer', 'qa-test-engineer'],
    suggestedProjects: [
      'Build an accessible personal dashboard',
      'Recreate a public website from a screenshot with responsive behaviour',
      'Contribute a documented component to an open-source design system',
    ],
  },
  {
    slug: 'backend-developer',
    title: 'Backend Developer',
    category: 'Software Engineering',
    description:
      'Designs and implements server-side services: APIs, business logic, data persistence, authentication and reliability. Works on the parts of a system that must stay correct under concurrent load.',
    responsibilities: [
      'Design and build REST APIs and background jobs',
      'Model data, write queries and manage schema migrations',
      'Implement authentication, authorisation and input validation',
      'Instrument services for reliability and diagnose production issues',
    ],
    requiredSkills: [
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Deepen data structures, error handling and testing.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 65, weight: 0.9, importance: 'core', developmentFocus: 'Practise normalisation, indexing and query optimisation.' },
      { skillCode: 'WEB_DEVELOPMENT', requiredLevel: 55, weight: 0.6, importance: 'supporting', developmentFocus: 'Understand HTTP semantics and API versioning.' },
      { skillCode: 'ALGORITHMS', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Practise searching, sorting and complexity analysis.' },
      { skillCode: 'CYBERSECURITY', requiredLevel: 50, weight: 0.7, importance: 'core', developmentFocus: 'Learn OWASP Top 10 and secure session handling.' },
      { skillCode: 'TESTING_PRINCIPLES', requiredLevel: 50, weight: 0.5, importance: 'supporting', developmentFocus: 'Write integration tests around your API contracts.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.8 },
      { dimension: 'NUMERICAL_APTITUDE', weight: 0.4 },
    ],
    preferenceFit: [
      { dimension: 'structured', weight: 0.6 },
      { dimension: 'analytical', weight: 0.7 },
    ],
    prerequisites: ['One programming language used confidently', 'Basic relational database experience'],
    learningStages: [
      { stage: 'beginner', focus: ['Server-side language fundamentals', 'Relational modelling and SQL'] },
      { stage: 'intermediate', focus: ['API design and authentication', 'Transactions and indexing'] },
      { stage: 'advanced', focus: ['Distributed systems concerns', 'Observability and performance'] },
    ],
    relatedCareerSlugs: ['full-stack-developer', 'database-administrator', 'cloud-engineer'],
    suggestedProjects: [
      'Build a REST API with authentication and role checks',
      'Design and optimise a schema for a realistic dataset',
      'Add integration tests and structured logging to an open-source service',
    ],
  },
  {
    slug: 'full-stack-developer',
    title: 'Full Stack Developer',
    category: 'Software Engineering',
    description:
      'Works across the whole stack, owning features from data model through interface. Valuable in small teams and fast-moving products where breadth matters more than extreme specialisation.',
    responsibilities: [
      'Build features across client, server and data layers',
      'Design data models and APIs together with backend peers',
      'Integrate third-party services and handle failures gracefully',
      'Participate in testing and deployment decisions',
    ],
    requiredSkills: [
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 65, weight: 0.9, importance: 'core', developmentFocus: 'Strengthen fundamentals before adding more frameworks.' },
      { skillCode: 'WEB_DEVELOPMENT', requiredLevel: 65, weight: 1, importance: 'core', developmentFocus: 'Build one complete CRUD application end to end.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 55, weight: 0.8, importance: 'core', developmentFocus: 'Practise schema design and safe migrations.' },
      { skillCode: 'OOP_CONCEPTS', requiredLevel: 45, weight: 0.5, importance: 'supporting', developmentFocus: 'Apply encapsulation to keep features maintainable.' },
      { skillCode: 'VERSION_CONTROL', requiredLevel: 55, weight: 0.6, importance: 'supporting', developmentFocus: 'Use feature branches and small reviewable commits.' },
      { skillCode: 'ADAPTABILITY', requiredLevel: 55, weight: 0.5, importance: 'supporting', developmentFocus: 'Deliberately learn one new tool each month.' },
    ],
    aptitudeFit: [
      { dimension: 'PROBLEM_SOLVING', weight: 0.7 },
      { dimension: 'LOGICAL_REASONING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'exploratory', weight: 0.7 },
      { dimension: 'collaborative', weight: 0.5 },
    ],
    prerequisites: ['Comfort with basic programming', 'Familiarity with at least one web framework'],
    learningStages: [
      { stage: 'beginner', focus: ['Full-stack framework basics', 'CRUD data modelling'] },
      { stage: 'intermediate', focus: ['Authentication, validation and testing', 'Deployment pipelines'] },
      { stage: 'advanced', focus: ['Performance, caching and observability', 'System design trade-offs'] },
    ],
    relatedCareerSlugs: ['frontend-developer', 'backend-developer', 'software-engineer'],
    suggestedProjects: [
      'Ship a small product with authentication, roles and reporting',
      'Write an end-to-end test suite for a real open-source issue',
      'Deploy an application with CI and document the architecture',
    ],
  },
  {
    slug: 'software-engineer',
    title: 'Software Engineer',
    category: 'Software Engineering',
    description:
      'A broad engineering role covering design, implementation, testing and maintenance of software systems, with an emphasis on correctness, maintainability and collaboration across a team.',
    responsibilities: [
      'Design and implement software features within an existing architecture',
      'Review code and raise the quality bar across the team',
      'Diagnose and fix defects, including intermittent ones',
      'Contribute to technical decisions and documentation',
    ],
    requiredSkills: [
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Master control flow, data structures and debugging.' },
      { skillCode: 'OOP_CONCEPTS', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Study composition, interfaces and SOLID principles.' },
      { skillCode: 'ALGORITHMS', requiredLevel: 55, weight: 0.8, importance: 'core', developmentFocus: 'Practise standard data structures and complexity reasoning.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 45, weight: 0.5, importance: 'supporting', developmentFocus: 'Understand transactions and query behaviour.' },
      { skillCode: 'TESTING_PRINCIPLES', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Practise test design techniques, not just test writing.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 60, weight: 0.6, importance: 'core', developmentFocus: 'Evaluate trade-offs before choosing an approach.' },
      { skillCode: 'TEAM_COLLABORATION', requiredLevel: 55, weight: 0.5, importance: 'supporting', developmentFocus: 'Practise reviewing code and receiving review feedback.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.8 },
    ],
    preferenceFit: [
      { dimension: 'analytical', weight: 0.6 },
      { dimension: 'structured', weight: 0.5 },
    ],
    prerequisites: ['Solid programming fundamentals', 'Completion of a full-stack project'],
    learningStages: [
      { stage: 'beginner', focus: ['Language depth and version control fluency', 'Unit testing habits'] },
      { stage: 'intermediate', focus: ['Design patterns and code review practice', 'Debugging real defects'] },
      { stage: 'advanced', focus: ['System design and technical writing', 'Mentoring and estimation'] },
    ],
    relatedCareerSlugs: ['backend-developer', 'full-stack-developer', 'qa-test-engineer'],
    suggestedProjects: [
      'Contribute a merged fix or feature to an open-source project',
      'Refactor an untested module with tests added alongside',
      'Write a short design document for a system you built',
    ],
  },
  {
    slug: 'data-analyst',
    title: 'Data Analyst',
    category: 'Data & Analytics',
    description:
      'Turns raw data into decision-ready information: cleans datasets, explores patterns, builds dashboards and communicates findings to non-technical stakeholders.',
    responsibilities: [
      'Clean, transform and validate datasets',
      'Answer business questions with well-supported analysis',
      'Build dashboards and visualisations others can act on',
      'Document methodology and communicate uncertainty honestly',
    ],
    requiredSkills: [
      { skillCode: 'DATA_ANALYSIS', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Build a portfolio of end-to-end analyses.' },
      { skillCode: 'STATISTICS', requiredLevel: 60, weight: 0.9, importance: 'core', developmentFocus: 'Study sampling, distributions and hypothesis testing.' },
      { skillCode: 'NUMERICAL_APTITUDE', requiredLevel: 60, weight: 0.7, importance: 'core', developmentFocus: 'Strengthen quantitative reasoning and spreadsheet/query fluency.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 45, weight: 0.6, importance: 'supporting', developmentFocus: 'Write SQL queries against a real dataset.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 60, weight: 0.8, importance: 'core', developmentFocus: 'Practise explaining findings to non-technical audiences.' },
      { skillCode: 'UI_DESIGN', requiredLevel: 35, weight: 0.4, importance: 'supporting', developmentFocus: 'Learn chart selection and clear visual encoding.' },
    ],
    aptitudeFit: [
      { dimension: 'NUMERICAL_APTITUDE', weight: 0.9 },
      { dimension: 'LOGICAL_REASONING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'analytical', weight: 0.7 },
      { dimension: 'structured', weight: 0.5 },
    ],
    prerequisites: ['Spreadsheet proficiency', 'Basic statistics', 'Some SQL or a data tool'],
    learningStages: [
      { stage: 'beginner', focus: ['SQL fundamentals', 'Data cleaning with a real dataset'] },
      { stage: 'intermediate', focus: ['Statistical reasoning and dashboards', 'Stakeholder communication'] },
      { stage: 'advanced', focus: ['Experiment design and measurement', 'Automated reporting pipelines'] },
    ],
    relatedCareerSlugs: ['data-scientist', 'business-analyst'],
    suggestedProjects: [
      'Publish an exploratory analysis of a public dataset',
      'Build an interactive dashboard for a real problem',
      'Write a short data quality report for a messy dataset',
    ],
  },
  {
    slug: 'data-scientist',
    title: 'Data Scientist',
    category: 'Data & Analytics',
    description:
      'Builds statistical and machine-learning models to answer questions that are not settled by straightforward analysis, then validates them rigorously before they influence decisions.',
    responsibilities: [
      'Frame ambiguous problems as measurable questions',
      'Build and validate predictive or inferential models',
      'Design evaluations that resist overfitting and leakage',
      'Communicate model limitations alongside results',
    ],
    requiredSkills: [
      { skillCode: 'MACHINE_LEARNING', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Complete several end-to-end modelling projects with honest evaluation.' },
      { skillCode: 'STATISTICS', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Study estimation, inference and experimental design.' },
      { skillCode: 'DATA_ANALYSIS', requiredLevel: 65, weight: 0.8, importance: 'core', developmentFocus: 'Strengthen exploratory analysis and data quality assessment.' },
      { skillCode: 'NUMERICAL_APTITUDE', requiredLevel: 65, weight: 0.8, importance: 'core', developmentFocus: 'Practise probability and numerical reasoning problems.' },
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 60, weight: 0.7, importance: 'core', developmentFocus: 'Improve Python or R proficiency for analysis pipelines.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 65, weight: 0.7, importance: 'supporting', developmentFocus: 'Practise spotting spurious correlation and leakage.' },
    ],
    aptitudeFit: [
      { dimension: 'NUMERICAL_APTITUDE', weight: 0.9 },
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
    ],
    preferenceFit: [
      { dimension: 'analytical', weight: 0.8 },
      { dimension: 'exploratory', weight: 0.5 },
    ],
    prerequisites: ['Statistics fundamentals', 'Programming for data analysis', 'Linear algebra basics'],
    learningStages: [
      { stage: 'beginner', focus: ['Probability and inference foundations', 'Data wrangling in Python'] },
      { stage: 'intermediate', focus: ['Classical models and cross-validation', 'Reproducible analysis workflows'] },
      { stage: 'advanced', focus: ['Deep learning and experiment design', 'Model deployment and monitoring'] },
    ],
    relatedCareerSlugs: ['data-analyst', 'ai-ml-engineer'],
    suggestedProjects: [
      'Build a classification project with a rigorous evaluation plan',
      'Reproduce and critique a published analysis',
      'Deploy a model with monitoring and a written limitations section',
    ],
  },
  {
    slug: 'ai-ml-engineer',
    title: 'AI/ML Engineer',
    category: 'Data & Analytics',
    description:
      'Takes machine-learning models from notebook to production: builds training and serving pipelines, integrates them into applications and keeps them reliable after release.',
    responsibilities: [
      'Design training and evaluation pipelines',
      'Serve models through APIs or batch jobs',
      'Integrate model outputs into larger application systems',
      'Monitor models in production and detect drift',
    ],
    requiredSkills: [
      { skillCode: 'MACHINE_LEARNING', requiredLevel: 72, weight: 1, importance: 'core', developmentFocus: 'Deepen model evaluation and experiment tracking.' },
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 70, weight: 0.9, importance: 'core', developmentFocus: 'Strengthen software engineering practice around model code.' },
      { skillCode: 'ALGORITHMS', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Practise optimisation and inference efficiency trade-offs.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 45, weight: 0.5, importance: 'supporting', developmentFocus: 'Handle feature and vector storage well.' },
      { skillCode: 'CLOUD_PLATFORMS', requiredLevel: 45, weight: 0.6, importance: 'supporting', developmentFocus: 'Learn containerised model serving.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 65, weight: 0.7, importance: 'core', developmentFocus: 'Practise evaluating when a model should not be used.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.9 },
      { dimension: 'NUMERICAL_APTITUDE', weight: 0.7 },
    ],
    preferenceFit: [
      { dimension: 'analytical', weight: 0.7 },
      { dimension: 'exploratory', weight: 0.7 },
    ],
    prerequisites: ['Programming proficiency', 'Statistics and machine-learning fundamentals'],
    learningStages: [
      { stage: 'beginner', focus: ['Classical models end to end', 'Python engineering hygiene'] },
      { stage: 'intermediate', focus: ['Model serving and API integration', 'Experiment tracking'] },
      { stage: 'advanced', focus: ['Distributed training and inference optimisation', 'Monitoring and drift detection'] },
    ],
    relatedCareerSlugs: ['data-scientist', 'backend-developer', 'cloud-engineer'],
    suggestedProjects: [
      'Serve a trained model behind a documented API',
      'Build a reproducible training pipeline with tests',
      'Instrument a deployed model and write a monitoring dashboard',
    ],
  },
  {
    slug: 'database-administrator',
    title: 'Database Administrator',
    category: 'Infrastructure',
    description:
      'Owns the reliability, performance and integrity of an organisation\'s data stores: schema governance, backups, tuning, replication and recovery testing.',
    responsibilities: [
      'Design and govern schemas for consistency and integrity',
      'Tune queries, indexes and storage configuration',
      'Design, test and execute backup and recovery procedures',
      'Monitor for performance and security problems',
    ],
    requiredSkills: [
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 75, weight: 1, importance: 'core', developmentFocus: 'Master normalisation, indexing and transaction isolation.' },
      { skillCode: 'NETWORKING', requiredLevel: 55, weight: 0.7, importance: 'supporting', developmentFocus: 'Understand connectivity, ports and latency between services.' },
      { skillCode: 'CYBERSECURITY', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Practise least privilege, encryption and audit logging.' },
      { skillCode: 'CLOUD_PLATFORMS', requiredLevel: 45, weight: 0.6, importance: 'supporting', developmentFocus: 'Learn managed database offerings and their trade-offs.' },
      { skillCode: 'PROBLEM_SOLVING', requiredLevel: 65, weight: 0.8, importance: 'core', developmentFocus: 'Practise diagnosing slow queries and locking problems.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 60, weight: 0.6, importance: 'core', developmentFocus: 'Verify every migration and backup before production use.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
      { dimension: 'NUMERICAL_APTITUDE', weight: 0.5 },
    ],
    preferenceFit: [
      { dimension: 'structured', weight: 0.7 },
      { dimension: 'detail_oriented', weight: 0.7 },
    ],
    prerequisites: ['Strong SQL', 'Relational modelling experience'],
    learningStages: [
      { stage: 'beginner', focus: ['Advanced SQL and query plans', 'Indexing fundamentals'] },
      { stage: 'intermediate', focus: ['Replication, backup and recovery drills', 'Security and auditing'] },
      { stage: 'advanced', focus: ['Distributed databases and capacity planning', 'Automation of routine operations'] },
    ],
    relatedCareerSlugs: ['backend-developer', 'cloud-engineer'],
    suggestedProjects: [
      'Load and query a large public dataset and document the indexes used',
      'Run and document a full backup-and-restore drill',
      'Write a schema governance proposal for a realistic system',
    ],
  },
  {
    slug: 'cybersecurity-analyst',
    title: 'Cybersecurity Analyst',
    category: 'Infrastructure',
    description:
      'Protects systems and data by monitoring for threats, investigating incidents, hardening configurations and responding to vulnerabilities before they are exploited.',
    responsibilities: [
      'Monitor systems and logs for suspicious activity',
      'Triage and investigate security alerts and incidents',
      'Review configurations against hardening baselines',
      'Support vulnerability assessment and remediation',
    ],
    requiredSkills: [
      { skillCode: 'CYBERSECURITY', requiredLevel: 72, weight: 1, importance: 'core', developmentFocus: 'Study the OWASP Top 10 and network-level attacks in depth.' },
      { skillCode: 'NETWORKING', requiredLevel: 60, weight: 0.9, importance: 'core', developmentFocus: 'Deepen protocol and packet-level understanding.' },
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 50, weight: 0.6, importance: 'supporting', developmentFocus: 'Practise scripting for log analysis and tooling.' },
      { skillCode: 'CLOUD_PLATFORMS', requiredLevel: 40, weight: 0.5, importance: 'supporting', developmentFocus: 'Learn common cloud misconfigurations.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 65, weight: 0.8, importance: 'core', developmentFocus: 'Practise evidence-driven triage of ambiguous alerts.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 65, weight: 0.7, importance: 'core', developmentFocus: 'Notice small configuration deviations that matter.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.9 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.8 },
    ],
    preferenceFit: [
      { dimension: 'analytical', weight: 0.7 },
      { dimension: 'detail_oriented', weight: 0.8 },
    ],
    prerequisites: ['Networking fundamentals', 'Operating system basics'],
    learningStages: [
      { stage: 'beginner', focus: ['Security fundamentals and CIA triad', 'Linux command line and networking labs'] },
      { stage: 'intermediate', focus: ['Web application security and secure coding review', 'Log analysis and detection'] },
      { stage: 'advanced', focus: ['Incident response and threat hunting', 'Cloud security architecture'] },
    ],
    relatedCareerSlugs: ['network-engineer', 'cloud-engineer'],
    suggestedProjects: [
      'Run a deliberately vulnerable lab and document every fix',
      'Build a small detection rule set and test it against sample logs',
      'Perform a personal security audit of your own devices',
    ],
  },
  {
    slug: 'cloud-engineer',
    title: 'Cloud Engineer',
    category: 'Infrastructure',
    description:
      'Deploys, configures and operates systems on cloud platforms, using managed services and automation to keep environments reproducible, observable and cost-aware.',
    responsibilities: [
      'Provision infrastructure using code rather than manual clicks',
      'Design deployment pipelines and rollback procedures',
      'Configure networking, identity and access',
      'Monitor reliability and control cost as usage grows',
    ],
    requiredSkills: [
      { skillCode: 'CLOUD_PLATFORMS', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Build repeatable infrastructure with a code tool.' },
      { skillCode: 'NETWORKING', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Understand virtual networking, DNS and load balancing.' },
      { skillCode: 'CYBERSECURITY', requiredLevel: 50, weight: 0.7, importance: 'core', developmentFocus: 'Practise identity management and least privilege.' },
      { skillCode: 'VERSION_CONTROL', requiredLevel: 50, weight: 0.5, importance: 'supporting', developmentFocus: 'Manage infrastructure code in reviewable commits.' },
      { skillCode: 'PROBLEM_SOLVING', requiredLevel: 60, weight: 0.7, importance: 'core', developmentFocus: 'Practise diagnosing multi-component failures.' },
      { skillCode: 'ADAPTABILITY', requiredLevel: 55, weight: 0.5, importance: 'supporting', developmentFocus: 'Keep up with a fast-changing service catalogue.' },
    ],
    aptitudeFit: [
      { dimension: 'PROBLEM_SOLVING', weight: 0.8 },
      { dimension: 'LOGICAL_REASONING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'structured', weight: 0.6 },
      { dimension: 'exploratory', weight: 0.5 },
    ],
    prerequisites: ['Linux command line', 'Networking basics', 'Some scripting experience'],
    learningStages: [
      { stage: 'beginner', focus: ['One cloud platform fundamentals', 'Networking and identity basics'] },
      { stage: 'intermediate', focus: ['Infrastructure as code', 'CI/CD deployment pipelines'] },
      { stage: 'advanced', focus: ['Multi-region design and cost optimisation', 'Reliability and incident practice'] },
    ],
    relatedCareerSlugs: ['network-engineer', 'backend-developer', 'devops-focused roles'],
    suggestedProjects: [
      'Deploy a real application with infrastructure as code',
      'Set up monitoring and alerting, then break the app on purpose',
      'Document a cost review for a small cloud workload',
    ],
  },
  {
    slug: 'qa-test-engineer',
    title: 'QA / Test Engineer',
    category: 'Software Engineering',
    description:
      'Designs and executes testing that gives a team confidence to release: test strategy, automation, defect reporting and quality metrics grounded in real risk.',
    responsibilities: [
      'Define test strategy and scope with the team',
      'Design test cases from requirements and risk',
      'Build and maintain automated test suites',
      'Report, triage and verify defects',
    ],
    requiredSkills: [
      { skillCode: 'TESTING_PRINCIPLES', requiredLevel: 72, weight: 1, importance: 'core', developmentFocus: 'Practise boundary-value analysis, equivalence classes and test pyramids.' },
      { skillCode: 'PROGRAMMING_FUNDAMENTALS', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Strengthen scripting for automated test frameworks.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 60, weight: 0.8, importance: 'core', developmentFocus: 'Identify the highest-risk untested paths, not just the easiest.' },
      { skillCode: 'DATABASE_CONCEPTS', requiredLevel: 40, weight: 0.4, importance: 'supporting', developmentFocus: 'Verify data correctness with SQL assertions.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 55, weight: 0.6, importance: 'supporting', developmentFocus: 'Write reproducible defect reports.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 65, weight: 0.7, importance: 'core', developmentFocus: 'Check edge cases methodically.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.7 },
    ],
    preferenceFit: [
      { dimension: 'detail_oriented', weight: 0.8 },
      { dimension: 'structured', weight: 0.6 },
    ],
    prerequisites: ['Basic programming', 'Understanding of how software is built'],
    learningStages: [
      { stage: 'beginner', focus: ['Manual test design techniques', 'Defect reporting discipline'] },
      { stage: 'intermediate', focus: ['Automated test frameworks', 'API and integration testing'] },
      { stage: 'advanced', focus: ['Test strategy and release risk management', 'Performance testing basics'] },
    ],
    relatedCareerSlugs: ['software-engineer', 'full-stack-developer'],
    suggestedProjects: [
      'Write a test strategy for a real open-source project',
      'Build an automated suite for a public API and report coverage honestly',
      'Log and triage bugs in a real project tracker',
    ],
  },
  {
    slug: 'business-analyst',
    title: 'Business Analyst',
    category: 'Business',
    description:
      'Bridges business needs and technical delivery: gathers requirements, models processes, defines acceptance criteria and makes sure the built solution actually solves the problem.',
    responsibilities: [
      'Elicit and document requirements from stakeholders',
      'Model current and future business processes',
      'Define acceptance criteria and validate deliverables',
      'Track scope, dependencies and expectations',
    ],
    requiredSkills: [
      { skillCode: 'BUSINESS_ANALYTICS', requiredLevel: 68, weight: 1, importance: 'core', developmentFocus: 'Practise writing specific, measurable requirements.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 70, weight: 1, importance: 'core', developmentFocus: 'Improve facilitation and written communication.' },
      { skillCode: 'DATA_ANALYSIS', requiredLevel: 50, weight: 0.7, importance: 'supporting', developmentFocus: 'Use data to validate or challenge a requirement.' },
      { skillCode: 'PROJECT_MANAGEMENT', requiredLevel: 55, weight: 0.7, importance: 'core', developmentFocus: 'Practise scoping, estimation and dependency tracking.' },
      { skillCode: 'CRITICAL_THINKING', requiredLevel: 62, weight: 0.8, importance: 'core', developmentFocus: 'Distinguish a stated want from an actual need.' },
      { skillCode: 'TEAM_COLLABORATION', requiredLevel: 60, weight: 0.6, importance: 'supporting', developmentFocus: 'Build trust across technical and non-technical teams.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.7 },
      { dimension: 'VERBAL_REASONING', weight: 0.7 },
    ],
    preferenceFit: [
      { dimension: 'collaborative', weight: 0.8 },
      { dimension: 'structured', weight: 0.6 },
    ],
    prerequisites: ['Clear written communication', 'Interest in how an organisation actually operates'],
    learningStages: [
      { stage: 'beginner', focus: ['Requirements elicitation and user stories', 'Process modelling basics'] },
      { stage: 'intermediate', focus: ['Acceptance criteria and validation', 'Stakeholder management'] },
      { stage: 'advanced', focus: ['Domain specialisation and product thinking', 'Agile delivery practice'] },
    ],
    relatedCareerSlugs: ['project-coordinator', 'data-analyst'],
    suggestedProjects: [
      'Document an end-to-end process for a real organisation or campus system',
      'Write a full requirements specification with testable acceptance criteria',
      'Analyse a public dataset to justify a proposed process change',
    ],
  },
  {
    slug: 'ui-ux-designer',
    title: 'UI/UX Designer',
    category: 'Design',
    description:
      'Designs interfaces and the experiences around them: research with users, structure flows, produce visual systems and validate designs through iteration.',
    responsibilities: [
      'Conduct user research and usability testing',
      'Create wireframes, prototypes and visual designs',
      'Maintain and extend the design system',
      'Work with engineers to ensure faithful implementation',
    ],
    requiredSkills: [
      { skillCode: 'UI_DESIGN', requiredLevel: 72, weight: 1, importance: 'core', developmentFocus: 'Build a portfolio of complete, well-reasoned interfaces.' },
      { skillCode: 'UX_RESEARCH', requiredLevel: 62, weight: 0.9, importance: 'core', developmentFocus: 'Practise interviews, personas and usability testing.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 62, weight: 0.7, importance: 'core', developmentFocus: 'Present design decisions with their rationale.' },
      { skillCode: 'WEB_DEVELOPMENT', requiredLevel: 45, weight: 0.6, importance: 'supporting', developmentFocus: 'Learn enough HTML/CSS to prototype in the browser.' },
      { skillCode: 'PROBLEM_SOLVING', requiredLevel: 55, weight: 0.6, importance: 'supporting', developmentFocus: 'Frame design problems before proposing solutions.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 60, weight: 0.6, importance: 'supporting', developmentFocus: 'Check spacing, alignment and states systematically.' },
    ],
    aptitudeFit: [
      { dimension: 'VERBAL_REASONING', weight: 0.5 },
      { dimension: 'SPATIAL_REASONING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'creative', weight: 0.9 },
      { dimension: 'collaborative', weight: 0.6 },
    ],
    prerequisites: ['Visual communication fundamentals', 'Willingness to iterate from feedback'],
    learningStages: [
      { stage: 'beginner', focus: ['Typography, colour and layout principles', 'Figma or equivalent tooling'] },
      { stage: 'intermediate', focus: ['User research and usability testing', 'Design systems'] },
      { stage: 'advanced', focus: ['Accessibility standards and complex flows', 'Measuring design outcomes'] },
    ],
    relatedCareerSlugs: ['frontend-developer', 'business-analyst'],
    suggestedProjects: [
      'Redesign a real public service and document the usability findings',
      'Run a usability test on a prototype and iterate from the evidence',
      'Build a small design system with documented tokens',
    ],
  },
  {
    slug: 'network-engineer',
    title: 'Network Engineer',
    category: 'Infrastructure',
    description:
      'Designs, configures and troubleshoots networks so that systems stay reachable and performant, balancing routing, switching, segmentation and monitoring.',
    responsibilities: [
      'Design and configure routing and switching',
      'Segment networks and enforce access policy',
      'Diagnose connectivity and performance issues',
      'Maintain monitoring and update network documentation',
    ],
    requiredSkills: [
      { skillCode: 'NETWORKING', requiredLevel: 72, weight: 1, importance: 'core', developmentFocus: 'Deepen protocol behaviour and hands-on lab practice.' },
      { skillCode: 'CLOUD_PLATFORMS', requiredLevel: 45, weight: 0.6, importance: 'supporting', developmentFocus: 'Understand virtual networks and security groups.' },
      { skillCode: 'CYBERSECURITY', requiredLevel: 55, weight: 0.8, importance: 'core', developmentFocus: 'Practise segmentation, firewalls and access control.' },
      { skillCode: 'PROBLEM_SOLVING', requiredLevel: 65, weight: 0.8, importance: 'core', developmentFocus: 'Work through structured troubleshooting scenarios.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 60, weight: 0.6, importance: 'supporting', developmentFocus: 'Verify configuration changes carefully.' },
    ],
    aptitudeFit: [
      { dimension: 'LOGICAL_REASONING', weight: 0.8 },
      { dimension: 'SPATIAL_REASONING', weight: 0.5 },
    ],
    preferenceFit: [
      { dimension: 'structured', weight: 0.6 },
      { dimension: 'detail_oriented', weight: 0.6 },
    ],
    prerequisites: ['Basic operating system knowledge', 'Willingness to practise in a lab environment'],
    learningStages: [
      { stage: 'beginner', focus: ['TCP/IP, switching and routing fundamentals', 'Subnetting practice'] },
      { stage: 'intermediate', focus: ['Firewalls, VPN and network services', 'Structured troubleshooting'] },
      { stage: 'advanced', focus: ['Automation and software-defined networking', 'High-availability design'] },
    ],
    relatedCareerSlugs: ['cloud-engineer', 'cybersecurity-analyst'],
    suggestedProjects: [
      'Build a segmented lab network and document the design',
      'Capture and analyse packet traces to explain a network behaviour',
      'Automate a routine network configuration task',
    ],
  },
  {
    slug: 'it-support-specialist',
    title: 'IT Support Specialist',
    category: 'Infrastructure',
    description:
      'Provides first-line technical support to users, resolves incidents and routine problems, and keeps an organisation\'s everyday technology working.',
    responsibilities: [
      'Respond to and resolve user support requests',
      'Install, configure and maintain hardware and software',
      'Document incidents and known solutions',
      'Escalate complex problems with clear context',
    ],
    requiredSkills: [
      { skillCode: 'NETWORKING', requiredLevel: 55, weight: 0.9, importance: 'core', developmentFocus: 'Learn practical troubleshooting for connectivity issues.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 68, weight: 1, importance: 'core', developmentFocus: 'Practise explaining technical fixes in plain language.' },
      { skillCode: 'PROBLEM_SOLVING', requiredLevel: 60, weight: 0.9, importance: 'core', developmentFocus: 'Build a structured first-line diagnostic routine.' },
      { skillCode: 'CYBERSECURITY', requiredLevel: 40, weight: 0.5, importance: 'supporting', developmentFocus: 'Understand safe handling of user accounts and devices.' },
      { skillCode: 'TIME_MANAGEMENT', requiredLevel: 58, weight: 0.6, importance: 'supporting', developmentFocus: 'Practise prioritising and updating users on progress.' },
    ],
    aptitudeFit: [
      { dimension: 'PROBLEM_SOLVING', weight: 0.8 },
      { dimension: 'LOGICAL_REASONING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'collaborative', weight: 0.8 },
      { dimension: 'structured', weight: 0.5 },
    ],
    prerequisites: ['Basic operating system and networking knowledge', 'Patience for user-facing work'],
    learningStages: [
      { stage: 'beginner', focus: ['OS installation, configuration and repair', 'Ticketing discipline and documentation'] },
      { stage: 'intermediate', focus: ['Network troubleshooting', 'Scripting to automate repetitive fixes'] },
      { stage: 'advanced', focus: ['Service desk tooling and SLAs', 'Automating onboarding and support workflows'] },
    ],
    relatedCareerSlugs: ['network-engineer', 'project-coordinator'],
    suggestedProjects: [
      'Build a troubleshooting decision tree for a common IT problem',
      'Write clear documentation for a task others must repeat',
      'Automate a repetitive support task with a script',
    ],
  },
  {
    slug: 'project-coordinator',
    title: 'Project Coordinator',
    category: 'Business',
    description:
      'Keeps a project organised and on schedule: planning, tracking progress, coordinating people and dependencies, and making sure everyone knows what happens next.',
    responsibilities: [
      'Maintain project plans, timelines and status reporting',
      'Coordinate meetings, dependencies and follow-ups',
      'Track risks and escalate issues early',
      'Keep documentation accurate and current',
    ],
    requiredSkills: [
      { skillCode: 'PROJECT_MANAGEMENT', requiredLevel: 68, weight: 1, importance: 'core', developmentFocus: 'Practise estimation, scheduling and dependency mapping.' },
      { skillCode: 'COMMUNICATION', requiredLevel: 68, weight: 1, importance: 'core', developmentFocus: 'Improve written status reporting and meeting facilitation.' },
      { skillCode: 'TIME_MANAGEMENT', requiredLevel: 65, weight: 0.9, importance: 'core', developmentFocus: 'Strengthen prioritisation under competing deadlines.' },
      { skillCode: 'TEAM_COLLABORATION', requiredLevel: 62, weight: 0.8, importance: 'core', developmentFocus: 'Practise keeping stakeholders aligned without authority.' },
      { skillCode: 'ATTENTION_TO_DETAIL', requiredLevel: 58, weight: 0.6, importance: 'supporting', developmentFocus: 'Check dates, owners and numbers consistently.' },
    ],
    aptitudeFit: [
      { dimension: 'VERBAL_REASONING', weight: 0.5 },
      { dimension: 'PROBLEM_SOLVING', weight: 0.6 },
    ],
    preferenceFit: [
      { dimension: 'collaborative', weight: 0.9 },
      { dimension: 'structured', weight: 0.8 },
    ],
    prerequisites: ['Organisation skills', 'Clear written communication'],
    learningStages: [
      { stage: 'beginner', focus: ['Project lifecycle, roles and terminology', 'Note-taking and action tracking'] },
      { stage: 'intermediate', focus: ['Scheduling, dependencies and risk tracking', 'Stakeholder reporting'] },
      { stage: 'advanced', focus: ['Multi-project coordination', 'Process improvement and tooling'] },
    ],
    relatedCareerSlugs: ['business-analyst', 'it-support-specialist'],
    suggestedProjects: [
      'Run a real campus or community project end to end with a documented plan',
      'Build a repeatable status-report template and test it with a team',
      'Organise a small event and document lessons learned',
    ],
  },
];

export const CAREER_CATEGORIES = Array.from(new Set(CAREERS.map((c) => c.category)));
