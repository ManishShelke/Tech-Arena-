import { db } from './index.ts';
import { rounds, questions, events, competitionSettings } from './schema.ts';
import { eq } from 'drizzle-orm';

export interface SeedQuestionDef {
  code: string;
  roundNumber: number;
  prompt: string;
  type?: 'mcq' | 'qa' | 'code';
  options?: string[];
  correctOption?: number; // 0=A, 1=B, 2=C, 3=D
  codeStarter?: string;
  explanation: string;
  points: number;
  category: string;
}

export const QUESTION_BANK: SeedQuestionDef[] = [
  // ==========================================
  // ROUND 1 — MIXED APTITUDE & COMPUTER LANGUAGE MCQs (30 questions: Easy, Moderate, Hard)
  // ==========================================
  // --- EASY TIER (10 Questions × 1 Mark) ---
  {
    code: 'E1',
    roundNumber: 1,
    prompt: 'Which Python data type is most appropriate for storing the value 3.14?',
    options: ['int', 'float', 'str', 'bool'],
    correctOption: 1,
    explanation: 'Float stores numbers with decimal points.',
    points: 1,
    category: 'Easy · Python Fundamentals',
  },
  {
    code: 'E2',
    roundNumber: 1,
    prompt: 'What is the output of the expression 5 * 2 + 3 in Python?',
    options: ['13', '16', '10', '15'],
    correctOption: 0,
    explanation: 'Multiplication precedes addition: 10 + 3 = 13.',
    points: 1,
    category: 'Easy · Output Prediction',
  },
  {
    code: 'E3',
    roundNumber: 1,
    prompt: 'What is the decimal equivalent of the binary number 1010?',
    options: ['8', '10', '12', '14'],
    correctOption: 1,
    explanation: '8 + 0 + 2 + 0 = 10.',
    points: 1,
    category: 'Easy · Number System',
  },
  {
    code: 'E4',
    roundNumber: 1,
    prompt: 'Which computer component executes program instructions and performs arithmetic and logical operations?',
    options: ['RAM', 'SSD', 'CPU', 'Monitor'],
    correctOption: 2,
    explanation: 'CPU executes instructions and ALU performs operations.',
    points: 1,
    category: 'Easy · Computer Fundamentals',
  },
  {
    code: 'E5',
    roundNumber: 1,
    prompt: 'What is printed by: for i in range(1, 4): print(i, end=" ") in Python?',
    options: ['0 1 2 3', '1 2 3', '1 2 3 4', '0 1 2'],
    correctOption: 1,
    explanation: 'range(1, 4) yields 1, 2, 3.',
    points: 1,
    category: 'Easy · Loops',
  },
  {
    code: 'E6',
    roundNumber: 1,
    prompt: 'Which SQL command retrieves records from a database table?',
    options: ['INSERT', 'DELETE', 'SELECT', 'UPDATE'],
    correctOption: 2,
    explanation: 'SELECT queries data from a table.',
    points: 1,
    category: 'Easy · SQL',
  },
  {
    code: 'E7',
    roundNumber: 1,
    prompt: 'Which language primarily defines the structure and content of a standard web page?',
    options: ['HTML', 'SQL', 'Python', 'C'],
    correctOption: 0,
    explanation: 'HTML defines web page structure.',
    points: 1,
    category: 'Easy · Web Development',
  },
  {
    code: 'E8',
    roundNumber: 1,
    prompt: 'In the condition n % 2 == 0, what does the % operator represent?',
    options: ['Division', 'Exponentiation', 'Modulus (remainder)', 'Multiplication'],
    correctOption: 2,
    explanation: 'Modulus returns the remainder of division.',
    points: 1,
    category: 'Easy · C / Python Operators',
  },
  {
    code: 'E9',
    roundNumber: 1,
    prompt: 'Find the next number in the aptitude series: 3, 6, 9, 12, ?',
    options: ['14', '15', '16', '18'],
    correctOption: 1,
    explanation: 'Multiples of 3 (+3 each step).',
    points: 1,
    category: 'Easy · Quantitative Aptitude',
  },
  {
    code: 'E10',
    roundNumber: 1,
    prompt: 'Which symbol is used to start a single-line comment in C and Java?',
    options: ['#', '//', '<!--', '**'],
    correctOption: 1,
    explanation: '// starts a single-line comment in C, C++, and Java.',
    points: 1,
    category: 'Easy · C / Java Syntax',
  },

  // --- MODERATE TIER (10 Questions × 1 Mark) ---
  {
    code: 'R1_M1',
    roundNumber: 1,
    prompt: 'If a train travels 120 km in 2 hours at a constant speed, how far will it travel in 3.5 hours?',
    options: ['180 km', '200 km', '210 km', '240 km'],
    correctOption: 2,
    explanation: 'Speed = 60 km/h; 60 × 3.5 = 210 km.',
    points: 1,
    category: 'Moderate · Quantitative Aptitude',
  },
  {
    code: 'R1_M2',
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint x = 4;\nint y = ++x * 2;\nprintf("%d", y);',
    options: ['8', '9', '10', '12'],
    correctOption: 2,
    explanation: 'Pre-increment makes x = 5 first, then 5 * 2 = 10.',
    points: 1,
    category: 'Moderate · C Programming',
  },
  {
    code: 'R1_M3',
    roundNumber: 1,
    prompt: 'What is the output of the following Python slice?\n\ns = "TECH_ARENA"\nprint(s[1:4])',
    options: ['TEC', 'ECH', 'ECH_', 'TECH'],
    correctOption: 1,
    explanation: 'Indices 1, 2, 3 correspond to E, C, H.',
    points: 1,
    category: 'Moderate · Python Strings',
  },
  {
    code: 'R1_M4',
    roundNumber: 1,
    prompt: 'In a class of 40 students, 60% passed an aptitude test. How many students did NOT pass?',
    options: ['12', '16', '20', '24'],
    correctOption: 1,
    explanation: '40% of 40 = 16.',
    points: 1,
    category: 'Moderate · Quantitative Aptitude',
  },
  {
    code: 'R1_M5',
    roundNumber: 1,
    prompt: 'Which data structure operates on a Last-In, First-Out (LIFO) principle?',
    options: ['Queue', 'Stack', 'Linked List', 'Binary Search Tree'],
    correctOption: 1,
    explanation: 'Stack follows Last-In, First-Out.',
    points: 1,
    category: 'Moderate · Data Structures',
  },
  {
    code: 'R1_M6',
    roundNumber: 1,
    prompt: 'Find the odd one out from the following programming terms:',
    options: ['while', 'for', 'do-while', 'switch'],
    correctOption: 3,
    explanation: 'switch is a conditional branching statement, whereas the others are loops.',
    points: 1,
    category: 'Moderate · Logical Reasoning',
  },
  {
    code: 'R1_M7',
    roundNumber: 1,
    prompt: 'What is the result of the bitwise XOR expression 5 ^ 3 in C / Python?',
    options: ['2', '6', '7', '1'],
    correctOption: 1,
    explanation: '101 XOR 011 = 110 (6 in decimal).',
    points: 1,
    category: 'Moderate · Bitwise Logic',
  },
  {
    code: 'R1_M8',
    roundNumber: 1,
    prompt: 'If CODING is coded as DPEJOH in a certain cipher, how is LOGIC coded?',
    options: ['MPHJF', 'MPHJD', 'LPHJD', 'MQHJD'],
    correctOption: 1,
    explanation: 'Each letter is shifted forward by +1 in the alphabet.',
    points: 1,
    category: 'Moderate · Verbal & Logical Aptitude',
  },
  {
    code: 'R1_M9',
    roundNumber: 1,
    prompt: 'Which SQL clause is used to filter groups created by a GROUP BY clause?',
    options: ['WHERE', 'ORDER BY', 'HAVING', 'DISTINCT'],
    correctOption: 2,
    explanation: 'HAVING filters grouped aggregate results.',
    points: 1,
    category: 'Moderate · DBMS & SQL',
  },
  {
    code: 'R1_M10',
    roundNumber: 1,
    prompt: 'What is the output of print(bool("False")) in Python?',
    options: ['False', 'True', 'None', 'ValueError'],
    correctOption: 1,
    explanation: 'Any non-empty string in Python evaluates to True.',
    points: 1,
    category: 'Moderate · Python Language',
  },

  // --- HARD TIER (10 Questions × 1 Mark) ---
  {
    code: 'R1_H1',
    roundNumber: 1,
    prompt: 'A can complete a coding module in 12 days and B can complete the same module in 24 days. If they work together, how many days will it take to finish?',
    options: ['6 days', '8 days', '9 days', '10 days'],
    correctOption: 1,
    explanation: 'Combined rate = 1/12 + 1/24 = 3/24 = 1/8 -> 8 days.',
    points: 1,
    category: 'Hard · Quantitative Aptitude',
  },
  {
    code: 'R1_H2',
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint a = 1, b = 2, c = 3;\nint res = a++ && --b && ++c;\nprintf("%d %d %d %d", a, b, c, res);',
    options: ['2 1 4 1', '2 1 3 0', '1 1 4 1', '2 2 4 1'],
    correctOption: 0,
    explanation: 'a++ evaluates to 1 (truthy, a becomes 2), --b evaluates to 1 (truthy), ++c evaluates to 4 (truthy), so res is 1.',
    points: 1,
    category: 'Hard · C Short-Circuit Evaluation',
  },
  {
    code: 'R1_H3',
    roundNumber: 1,
    prompt: 'What is the time complexity of finding an element in a balanced Binary Search Tree (BST) with n nodes in the worst case?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctOption: 1,
    explanation: 'A balanced BST has height O(log n).',
    points: 1,
    category: 'Hard · Algorithms & Complexity',
  },
  {
    code: 'R1_H4',
    roundNumber: 1,
    prompt: 'Find the missing number in the series: 2, 5, 11, 23, 47, ?',
    options: ['93', '94', '95', '96'],
    correctOption: 2,
    explanation: 'Pattern is ×2 + 1 at each step: 47 × 2 + 1 = 95.',
    points: 1,
    category: 'Hard · Logical Series Aptitude',
  },
  {
    code: 'R1_H5',
    roundNumber: 1,
    prompt: 'What will be printed by the following Python code?\n\nx = [1, 2, 3]\ny = x\ny.append(4)\nprint(len(x))',
    options: ['3', '4', '1', 'TypeError'],
    correctOption: 1,
    explanation: 'x and y reference the same list object in memory.',
    points: 1,
    category: 'Hard · Python Memory Model',
  },
  {
    code: 'R1_H6',
    roundNumber: 1,
    prompt: 'How many handshakes occur if 8 software engineers in a room each shake hands with every other engineer exactly once?',
    options: ['24', '28', '32', '56'],
    correctOption: 1,
    explanation: 'n(n - 1) / 2 = 8 × 7 / 2 = 28.',
    points: 1,
    category: 'Hard · Combinatorics Aptitude',
  },
  {
    code: 'R1_H7',
    roundNumber: 1,
    prompt: 'What is the output of the following C code?\n\nint arr[] = {10, 20, 30, 40};\nint *p = arr;\nprintf("%d", *(p + 2));',
    options: ['10', '20', '30', '40'],
    correctOption: 2,
    explanation: 'Pointer arithmetic *(p + 2) accesses arr[2], which is 30.',
    points: 1,
    category: 'Hard · C Pointers',
  },
  {
    code: 'R1_H8',
    roundNumber: 1,
    prompt: 'In an IPv4 Class C network with default subnet mask 255.255.255.0, how many usable host IP addresses are available?',
    options: ['254', '255', '256', '512'],
    correctOption: 0,
    explanation: '2^8 - 2 (excluding network and broadcast addresses) = 254.',
    points: 1,
    category: 'Hard · Computer Networks',
  },
  {
    code: 'R1_H9',
    roundNumber: 1,
    prompt: 'If the ratio of the ages of two developers is 3:5 and the sum of their ages is 48 years, what will be the ratio of their ages after 6 years?',
    options: ['2:3', '4:5', '3:4', '5:7'],
    correctOption: 0,
    explanation: 'Current ages: 18 and 30. After 6 years: 24 and 36 -> 24:36 = 2:3.',
    points: 1,
    category: 'Hard · Quantitative Aptitude',
  },
  {
    code: 'R1_H10',
    roundNumber: 1,
    prompt: 'How many total nodes are present in a complete and full binary tree of height h (where a single root node has height 0)?',
    options: ['2^h', '2^(h+1) - 1', '2^h - 1', 'h^2 + 1'],
    correctOption: 1,
    explanation: 'A full binary tree of height h has 1 + 2 + 4 + ... + 2^h = 2^(h+1) - 1 nodes.',
    points: 1,
    category: 'Hard · Data Structures & Trees',
  },


  // ==========================================
  // ROUND 2 — TECHNICAL QUESTIONS POOL (30 questions, 300 marks total)
  // SET A: Easy (10 × 5 Marks) | SET B: Moderate (10 × 10 Marks) | SET C: Difficult (10 × 15 Marks)
  // ==========================================
  // --- SET A — EASY (10 Questions × 5 Marks) ---
  {
    code: 'Q1',
    roundNumber: 2,
    prompt: `What is the output?\n\nint a = 5;\nint b = 2;\nprintf("%d", a * b + a);\n\nClue: Follow the order of arithmetic operations.`,
    options: ['10', '15', '17', '25'],
    correctOption: 1,
    explanation: 'Clue: Follow the order of arithmetic operations. Multiplication happens first (5 * 2 = 10), then addition (10 + 5 = 15). Exact Answer: 15.',
    points: 5,
    category: 'Set A (Easy) · Output Prediction',
  },
  {
    code: 'Q2',
    roundNumber: 2,
    prompt: `What will be the output?\n\nint x = 10;\nif(x % 2 == 0)\n    printf("Even");\nelse\n    printf("Odd");\n\nClue: % gives the remainder.`,
    options: ['Odd', 'Even', '0', 'Compilation Error'],
    correctOption: 1,
    explanation: 'Clue: % gives the remainder. Since 10 % 2 == 0, the condition is true and "Even" is printed. Exact Answer: Even.',
    points: 5,
    category: 'Set A (Easy) · C Programming',
  },
  {
    code: 'Q3',
    roundNumber: 2,
    prompt: `Convert the binary number 10110 into decimal.\n\nClue: Use powers of 2 from right to left.`,
    options: ['18', '20', '22', '26'],
    correctOption: 2,
    explanation: 'Clue: Use powers of 2 from right to left (1×16 + 0×8 + 1×4 + 1×2 + 0×1 = 22). Exact Answer: 22.',
    points: 5,
    category: 'Set A (Easy) · Number System',
  },
  {
    code: 'Q4',
    roundNumber: 2,
    prompt: `How many times will Hello be printed?\n\nfor(int i = 1; i <= 10; i += 2)\n{\n    printf("Hello ");\n}\n\nClue: Write the values taken by i.`,
    options: ['4 times', '5 times', '6 times', '10 times'],
    correctOption: 1,
    explanation: 'Clue: Write the values taken by i (1, 3, 5, 7, 9). Exact Answer: 5 times.',
    points: 5,
    category: 'Set A (Easy) · Loop',
  },
  {
    code: 'Q5',
    roundNumber: 2,
    prompt: `What is the output?\n\nx = 10\ny = 3\n\nprint(x // y)\nprint(x % y)\n\nClue: // gives the quotient and % gives the remainder.`,
    options: ['3.33 and 1', '3 and 1', '3 and 0', '4 and 1'],
    correctOption: 1,
    explanation: 'Clue: // gives the quotient (10 // 3 = 3) and % gives the remainder (10 % 3 = 1). Exact Answer: 3 and 1.',
    points: 5,
    category: 'Set A (Easy) · Python',
  },
  {
    code: 'Q6',
    roundNumber: 2,
    prompt: `Which key uniquely identifies each record in a table?\n\nClue: Think of a unique student ID.`,
    options: ['Foreign Key', 'Primary Key', 'Candidate Key', 'Composite Key'],
    correctOption: 1,
    explanation: 'Clue: Think of a unique student ID. Exact Answer: B) Primary Key.',
    points: 5,
    category: 'Set A (Easy) · DBMS',
  },
  {
    code: 'Q7',
    roundNumber: 2,
    prompt: `Which component temporarily stores data and programs currently being used by the CPU?\n\nClue: Its contents are lost when power is switched off.`,
    options: ['Hard Disk', 'RAM', 'ROM', 'Pen Drive'],
    correctOption: 1,
    explanation: 'Clue: Its contents are lost when power is switched off. Exact Answer: RAM.',
    points: 5,
    category: 'Set A (Easy) · Computer Fundamentals',
  },
  {
    code: 'Q8',
    roundNumber: 2,
    prompt: `Which HTML tag is used to create a hyperlink?\n\nClue: Think of the anchor element.`,
    options: ['<link>', '<a>', '<href>', '<url>'],
    correctOption: 1,
    explanation: 'Clue: Think of the anchor element. Exact Answer: <a>.',
    points: 5,
    category: 'Set A (Easy) · HTML',
  },
  {
    code: 'Q9',
    roundNumber: 2,
    prompt: `Find the next number:\n2, 6, 12, 20, 30, ?\n\nClue: Look at the differences.`,
    options: ['38', '40', '42', '44'],
    correctOption: 2,
    explanation: 'Clue: Look at the differences (+4, +6, +8, +10, +12). 30 + 12 = 42. Exact Answer: 42.',
    points: 5,
    category: 'Set A (Easy) · Logic',
  },
  {
    code: 'Q10',
    roundNumber: 2,
    prompt: `What is the output?\n\nint a = 10;\nprintf("%d", a++);\n\nClue: ++ is a post-increment operator.`,
    options: ['10', '11', '9', 'Compilation Error'],
    correctOption: 0,
    explanation: 'Clue: ++ is a post-increment operator, so 10 is printed before a is incremented. Exact Answer: 10.',
    points: 5,
    category: 'Set A (Easy) · C Programming',
  },

  // --- SET B — MODERATE (10 Questions × 10 Marks) ---
  {
    code: 'Q11',
    roundNumber: 2,
    prompt: `What is the output?\n\nint x = 1;\nfor(int i = 1; i <= 3; i++)\n{\n    x = x * 2;\n}\nprintf("%d", x);\n\nClue: The multiplication happens three times.`,
    options: ['6', '8', '4', '16'],
    correctOption: 1,
    explanation: 'Clue: The multiplication happens three times (1 -> 2 -> 4 -> 8). Exact Answer: 8.',
    points: 10,
    category: 'Set B (Moderate) · Output Prediction',
  },
  {
    code: 'Q12',
    roundNumber: 2,
    prompt: `Find the second-largest distinct number:\n12, 5, 18, 18, 9, 15\n\nClue: Do not count 18 twice.`,
    options: ['18', '15', '12', '9'],
    correctOption: 1,
    explanation: 'Clue: Do not count 18 twice. The largest is 18, and the second-largest distinct number is 15. Exact Answer: 15.',
    points: 10,
    category: 'Set B (Moderate) · Array',
  },
  {
    code: 'Q13',
    roundNumber: 2,
    prompt: `What is the output?\n\nint a = 5;\nint b = 10;\n\na = b;\nb = a;\n\nprintf("%d %d", a, b);\n\nClue: Track the values after each assignment.`,
    options: ['5 10', '10 5', '10 10', '5 5'],
    correctOption: 2,
    explanation: 'Clue: Track the values after each assignment. First a becomes 10, then b becomes a (10). Exact Answer: 10 10.',
    points: 10,
    category: 'Set B (Moderate) · C Programming',
  },
  {
    code: 'Q14',
    roundNumber: 2,
    prompt: `What is the output?\n\na = [10, 20, 30, 40]\nprint(a[1] + a[-1])\n\nClue: -1 refers to the last element.`,
    options: ['50', '60', '70', '30'],
    correctOption: 1,
    explanation: 'Clue: -1 refers to the last element. a[1] is 20 and a[-1] is 40, giving 60. Exact Answer: 60.',
    points: 10,
    category: 'Set B (Moderate) · Python List',
  },
  {
    code: 'Q15',
    roundNumber: 2,
    prompt: `Consider the table Student:\nName — Marks\nRavi — 75\nAnu — 90\nKiran — 65\nMeena — 90\n\nWhat will this query return?\nSELECT COUNT(*) FROM Student WHERE Marks >= 75;\n\nClue: Count the students satisfying the condition.`,
    options: ['2', '3', '4', '1'],
    correctOption: 1,
    explanation: 'Clue: Count the students satisfying the condition (Ravi, Anu, Meena = 3). Exact Answer: 3.',
    points: 10,
    category: 'Set B (Moderate) · SQL',
  },
  {
    code: 'Q16',
    roundNumber: 2,
    prompt: `What is the main purpose of binary search?\n\nClue: Binary search repeatedly divides the search space.`,
    options: [
      'Sort an array',
      'Search efficiently in a sorted array',
      'Reverse an array',
      'Find duplicate elements',
    ],
    correctOption: 1,
    explanation: 'Clue: Binary search repeatedly divides the search space. Exact Answer: B) Search efficiently in a sorted array.',
    points: 10,
    category: 'Set B (Moderate) · Algorithm',
  },
  {
    code: 'Q17',
    roundNumber: 2,
    prompt: `What is the decimal value of 1101₂?\n\nClue: 1×8 + 1×4 + 0×2 + 1×1.`,
    options: ['11', '12', '13', '15'],
    correctOption: 2,
    explanation: 'Clue: 1×8 + 1×4 + 0×2 + 1×1 = 13. Exact Answer: 13.',
    points: 10,
    category: 'Set B (Moderate) · Number System',
  },
  {
    code: 'Q18',
    roundNumber: 2,
    prompt: `Find the error:\n\nint x = 10;\nif(x > 5)\n{\n    printf("Greater")\n}\n\nClue: Look at the end of the printf statement.`,
    options: [
      'Condition must use ==',
      'A semicolon (;) is missing.',
      'Variable x is not initialized',
      'Curly braces are invalid',
    ],
    correctOption: 1,
    explanation: 'Clue: Look at the end of the printf statement. Exact Answer: A semicolon (;) is missing.',
    points: 10,
    category: 'Set B (Moderate) · Debugging',
  },
  {
    code: 'Q19',
    roundNumber: 2,
    prompt: `Which device is primarily used to connect different networks and forward packets between them?\n\nClue: Your home network uses one to connect to the Internet.`,
    options: ['Switch', 'Router', 'Hub', 'Repeater'],
    correctOption: 1,
    explanation: 'Clue: Your home network uses one to connect to the Internet. Exact Answer: Router.',
    points: 10,
    category: 'Set B (Moderate) · Networking',
  },
  {
    code: 'Q20',
    roundNumber: 2,
    prompt: `What is the output?\n\nx = 5\nfor i in range(1, 4):\n    x = x + i\nprint(x)\n\nClue: range(1,4) gives 1, 2, 3.`,
    options: ['9', '10', '11', '15'],
    correctOption: 2,
    explanation: 'Clue: range(1,4) gives 1, 2, 3. 5 + 1 + 2 + 3 = 11. Exact Answer: 11.',
    points: 10,
    category: 'Set B (Moderate) · Logic + Programming',
  },

  // --- SET C — DIFFICULT (10 Questions × 15 Marks) ---
  {
    code: 'Q21',
    roundNumber: 2,
    prompt: `Given [3, 4, -1, 1, 2, 6], find the smallest positive integer that is missing.\n\nClue: Start checking from 1.`,
    options: ['0', '5', '7', '2'],
    correctOption: 1,
    explanation: 'Clue: Start checking from 1. 1, 2, 3, 4 are present; 5 is missing. Exact Answer: 5.',
    points: 15,
    category: 'Set C (Difficult) · Array Problem',
  },
  {
    code: 'Q22',
    roundNumber: 2,
    prompt: `What is the output?\n\nint count = 0;\nfor(int i = 1; i <= 3; i++)\n{\n    for(int j = 1; j <= i; j++)\n    {\n        count++;\n    }\n}\nprintf("%d", count);\n\nClue: Count the inner-loop executions for each value of i.`,
    options: ['3', '6', '9', '4'],
    correctOption: 1,
    explanation: 'Clue: Count the inner-loop executions for each value of i (1 + 2 + 3 = 6). Exact Answer: 6.',
    points: 15,
    category: 'Set C (Difficult) · C — Nested Loops',
  },
  {
    code: 'Q23',
    roundNumber: 2,
    prompt: `Given employee salaries: 25000, 40000, 35000, 50000, 40000. What is the second-highest distinct salary?\n\nClue: Ignore duplicate salaries.`,
    options: ['50000', '40000', '35000', '25000'],
    correctOption: 1,
    explanation: 'Clue: Ignore duplicate salaries. Highest is 50000, second-highest distinct is 40000. Exact Answer: 40000.',
    points: 15,
    category: 'Set C (Difficult) · SQL',
  },
  {
    code: 'Q24',
    roundNumber: 2,
    prompt: `What is the output?\n\nint fun(int n)\n{\n    if(n == 0)\n        return 1;\n    return n * fun(n - 1);\n}\nprintf("%d", fun(4));\n\nClue: Expand the function until n becomes 0.`,
    options: ['12', '16', '24', '120'],
    correctOption: 2,
    explanation: 'Clue: Expand the function until n becomes 0 (4 × 3 × 2 × 1 × 1 = 24). Exact Answer: 24.',
    points: 15,
    category: 'Set C (Difficult) · Recursion',
  },
  {
    code: 'Q25',
    roundNumber: 2,
    prompt: `An array contains [2, 7, 11, 15, 3, 6]. Find all pairs whose sum is 9.\n\nClue: Check which number each element needs to reach 9.`,
    options: ['(2,7) only', '(2,7) and (3,6)', '(3,6) and (2,11)', '(7,11) and (3,6)'],
    correctOption: 1,
    explanation: 'Clue: Check which number each element needs to reach 9. Exact Answer: (2,7) and (3,6).',
    points: 15,
    category: 'Set C (Difficult) · Algorithm',
  },
  {
    code: 'Q26',
    roundNumber: 2,
    prompt: `What is the output?\n\nint x = 5;\nif(x > 3)\n{\n    if(x < 10)\n        printf("A");\n    else\n        printf("B");\n}\nelse\n{\n    printf("C");\n}\n\nClue: Both conditions must be checked.`,
    options: ['A', 'B', 'C', 'AB'],
    correctOption: 0,
    explanation: 'Clue: Both conditions must be checked (5 > 3 and 5 < 10). Exact Answer: A.',
    points: 15,
    category: 'Set C (Difficult) · C Output',
  },
  {
    code: 'Q27',
    roundNumber: 2,
    prompt: `Which normal form removes partial dependency?\n\nClue: Think about dependencies on part of a composite key.`,
    options: ['1NF', '2NF', '3NF', 'BCNF'],
    correctOption: 1,
    explanation: 'Clue: Think about dependencies on part of a composite key. Exact Answer: B) 2NF.',
    points: 15,
    category: 'Set C (Difficult) · DBMS',
  },
  {
    code: 'Q28',
    roundNumber: 2,
    prompt: `A program has CPU burst = 5 ms, I/O burst = 10 ms, CPU burst = 3 ms. Ignoring context-switching time, what is the total CPU time required?\n\nClue: Add only the CPU bursts.`,
    options: ['8 ms', '15 ms', '18 ms', '5 ms'],
    correctOption: 0,
    explanation: 'Clue: Add only the CPU bursts (5 ms + 3 ms = 8 ms). Exact Answer: 8 ms.',
    points: 15,
    category: 'Set C (Difficult) · Operating System',
  },
  {
    code: 'Q29',
    roundNumber: 2,
    prompt: `Find the next number:\n1, 2, 6, 24, 120, ?\n\nClue: Each number is multiplied by an increasing integer.`,
    options: ['240', '600', '720', '840'],
    correctOption: 2,
    explanation: 'Clue: Each number is multiplied by an increasing integer (×2, ×3, ×4, ×5, ×6 -> 120 × 6 = 720). Exact Answer: 720.',
    points: 15,
    category: 'Set C (Difficult) · Number + Logic',
  },
  {
    code: 'Q30',
    roundNumber: 2,
    prompt: `What is the output?\n\nx = 0\nfor i in range(1, 6):\n    if i % 2 == 0:\n        x = x + i\n    else:\n        x = x - i\nprint(x)\n\nClue: Process 1, 2, 3, 4, 5 one at a time.`,
    options: ['-3', '3', '-5', '1'],
    correctOption: 0,
    explanation: 'Clue: Process 1, 2, 3, 4, 5 one at a time (-1 + 2 - 3 + 4 - 5 = -3). Exact Answer: -3.',
    points: 15,
    category: 'Set C (Difficult) · Programming Logic — Challenge',
  },

  // ==========================================
  // ROUND 3 — CODING PROBLEMS (9 Problems: 3 Easy, 3 Moderate, 3 Hard)
  // ==========================================
  // --- EASY TIER (Focus: loops, conditions, arrays, and strings) ---
  {
    code: 'R3_E1',
    roundNumber: 3,
    type: 'code',
    prompt: `1. The Missing Number\nWrite a program that reads N and N−1 distinct integers from the range 1 to N. Print the missing number.\n\nSample Input:\n5\n1 2 4 5\n\nSample Output:\n3\n\nConstraints: 2 ≤ N ≤ 100,000`,
    codeStarter: `// 1. The Missing Number (Easy)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    n = int(input().strip())\n    arr = list(map(int, input().split()))\n    # Write your logic here to print the missing number\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Expected sum of 1..N is N*(N+1)//2. Subtract the sum of the N-1 input integers to find the missing number in O(N) time.',
    points: 5,
    category: 'Easy · Arrays & Loops',
  },
  {
    code: 'R3_E2',
    roundNumber: 3,
    type: 'code',
    prompt: `2. Count the Vowels\nWrite a program that counts the vowels (A, E, I, O, U) in a given line of text. Uppercase and lowercase vowels both count.\n\nSample Input:\nTech Arena\n\nSample Output:\n4\n\nConstraints: Text length: 1 to 10,000 characters`,
    codeStarter: `// 2. Count the Vowels (Easy)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    text = input()\n    # Count uppercase and lowercase vowels (A, E, I, O, U)\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Iterate over each character in the input line and count characters that match A, E, I, O, U (case-insensitive).',
    points: 5,
    category: 'Easy · Strings & Conditions',
  },
  {
    code: 'R3_E3',
    roundNumber: 3,
    type: 'code',
    prompt: `3. Second Largest Distinct Number\nWrite a program to print the second-largest distinct value in an array. If no second-largest distinct value exists, print -1.\n\nSample Input:\n6\n4 9 9 2 7 7\n\nSample Output:\n7\n\nConstraints: 1 ≤ N ≤ 100,000`,
    codeStarter: `// 3. Second Largest Distinct Number (Easy)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    n = int(input().strip())\n    arr = list(map(int, input().split()))\n    # Print the second-largest distinct value, or -1 if none exists\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Track the largest and second-largest distinct values in a single traversal, ignoring duplicate occurrences of the largest number.',
    points: 5,
    category: 'Easy · Array Traversal',
  },

  // --- MODERATE TIER (Focus: stacks, frequency counting, and array traversal) ---
  {
    code: 'R3_M1',
    roundNumber: 3,
    type: 'code',
    prompt: `4. Balanced Brackets\nWrite a program that checks whether a string containing only (), [] and {} has correctly matched and ordered brackets. Print YES if balanced; otherwise print NO.\n\nSample Input:\n{[()]}\n\nSample Output:\nYES\n\nConstraints: String length: 1 to 100,000`,
    codeStarter: `// 4. Balanced Brackets (Moderate)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    s = input().strip()\n    # Check whether (), [], {} are balanced. Print YES or NO\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Use a stack to push opening brackets and match closing brackets against the top of the stack. Output YES if valid and stack is empty at the end, else NO.',
    points: 10,
    category: 'Moderate · Stacks & Strings',
  },
  {
    code: 'R3_M2',
    roundNumber: 3,
    type: 'code',
    prompt: `5. Longest Increasing Segment\nGiven an array, print the length of the longest contiguous segment in which every number is strictly greater than the previous number.\n\nSample Input:\n7\n1 2 2 3 4 5 1\n\nSample Output:\n4\n\nConstraints: 1 ≤ N ≤ 200,000`,
    codeStarter: `// 5. Longest Increasing Segment (Moderate)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    n = int(input().strip())\n    arr = list(map(int, input().split()))\n    # Print the length of the longest strictly increasing contiguous segment\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Scan the array once, incrementing current streak when arr[i] > arr[i-1] and resetting to 1 otherwise, tracking the maximum length seen.',
    points: 10,
    category: 'Moderate · Array Traversal',
  },
  {
    code: 'R3_M3',
    roundNumber: 3,
    type: 'code',
    prompt: `6. First Non-Repeating Character\nPrint the first character in a string that occurs exactly once. Treat uppercase and lowercase as different characters. If none exists, print -1.\n\nSample Input:\nswiss\n\nSample Output:\nw\n\nConstraints: String length: 1 to 100,000`,
    codeStarter: `// 6. First Non-Repeating Character (Moderate)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    s = input().strip()\n    # Print the first character that occurs exactly once, or -1\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Count character frequencies in a hash map or array first, then iterate through the string to find the first character with frequency 1.',
    points: 10,
    category: 'Moderate · Frequency Counting',
  },

  // --- HARD TIER (Focus: dynamic programming, graph traversal, and efficient algorithms) ---
  {
    code: 'R3_H1',
    roundNumber: 3,
    type: 'code',
    prompt: `7. Minimum Coins\nGiven coin denominations and a target amount, find the minimum number of coins needed. You may use each denomination unlimited times. Print -1 if the amount cannot be formed.\n\nSample Input:\n3 11\n1 5 7\n\nSample Output:\n3\n\nConstraints: 1 ≤ number of denominations ≤ 100; target amount ≤ 100,000`,
    codeStarter: `// 7. Minimum Coins (Hard)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    n, target = map(int, input().split())\n    coins = list(map(int, input().split()))\n    # Find the minimum number of coins needed to form target, or print -1\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Use Bottom-Up Dynamic Programming: dp[a] = min(dp[a], dp[a - coin] + 1) for each coin denomination up to target amount.',
    points: 15,
    category: 'Hard · Dynamic Programming',
  },
  {
    code: 'R3_H2',
    roundNumber: 3,
    type: 'code',
    prompt: `8. Shortest Path in a Grid\nA grid uses 0 for open cells and 1 for blocked cells. Starting at the top-left cell, find the minimum number of up/down/left/right moves to reach the bottom-right cell. Print -1 if no path exists or an endpoint is blocked. Count moves, not cells.\n\nSample Input:\n3 3\n0 0 1\n1 0 0\n0 0 0\n\nSample Output:\n4\n\nConstraints: 1 ≤ rows, columns ≤ 500`,
    codeStarter: `// 8. Shortest Path in a Grid (Hard)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\nfrom collections import deque\n\ndef solve():\n    r, c = map(int, input().split())\n    grid = [list(map(int, input().split())) for _ in range(r)]\n    # Find minimum moves from (0,0) to (r-1,c-1) using BFS, or print -1\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: 'Use Breadth-First Search (BFS) starting from (0,0) if open. Explore 4-directional neighbors with value 0 and return the shortest move count to (rows-1, cols-1).',
    points: 15,
    category: 'Hard · Graph Traversal (BFS)',
  },
  {
    code: 'R3_H3',
    roundNumber: 3,
    type: 'code',
    prompt: `9. Maximum Sum Subarray\nGiven an array containing positive, negative or zero integers, find the maximum sum of any non-empty contiguous subarray.\n\nSample Input:\n8\n-2 -3 4 -1 -2 1 5 -3\n\nSample Output:\n7\n\nConstraints: 1 ≤ N ≤ 200,000; each value is between -10^9 and 10^9`,
    codeStarter: `// 9. Maximum Sum Subarray (Hard)\n// Write your solution in Python, C, C++, Java, or JavaScript\n\ndef solve():\n    n = int(input().strip())\n    arr = list(map(int, input().split()))\n    # Find the maximum sum of any non-empty contiguous subarray\n    pass\n\nif __name__ == "__main__":\n    solve()`,
    explanation: "Apply Kadane's algorithm in O(N) time using 64-bit integers: maintain current_sum = max(x, current_sum + x) and best_sum = max(best_sum, current_sum).",
    points: 15,
    category: "Hard · Kadane's Algorithm",
  },
];

export async function seedTournamentDatabase(): Promise<void> {
  try {
    // 1. Seed Tournament Event
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      await db.insert(events).values({
        title: 'TECH ARENA 2026 — Inter-College Technical Championship',
        description: 'Elite three-round inter-collegiate technical championship: Round 1 (Easy, Moderate & Hard MCQs), Round 2 (Technical Question Pool: Set A, Set B, Set C), and Round 3 (Coding Problems: Easy, Moderate & Hard).',
        bannerUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
        isActive: true,
      });
    }

    // 2. Seed Competition Settings if empty
    const existingSettings = await db.query.competitionSettings.findMany();
    if (existingSettings.length === 0) {
      await db.insert(competitionSettings).values({
        competitionStatus: 'active',
        registrationOpen: true,
        fullscreenEnforcement: true,
        strictFocusEnforcement: true,
        heartbeatIntervalSec: 10,
        heartbeatStaleThresholdSec: 30,
        leaderboardFrozen: false,
        publishedFinal: false,
      });
    }

    // 3. Define the Three Official Competition Rounds
    const competitionRoundsDef = [
      {
        roundNumber: 1,
        difficulty: 'easy',
        title: 'Round 1 — MIXED APTITUDE & COMPUTER MCQs',
        description: '30 jumbled questions (Easy, Moderate & Hard) · 20 minutes limit · 1 mark per correct answer (30 marks max). Participants can freely choose questions by difficulty level or order.',
        durationMinutes: 20,
        qualifyingPercentage: 60,
        maxScore: 30,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 1,
      },
      {
        roundNumber: 2,
        difficulty: 'medium',
        title: 'Round 2 — TECHNICAL QUESTION & ANSWER (Q&A)',
        description: '30 Direct Question & Answer problems (No MCQs — Type your answer in the answer box) · 30 minutes limit · Set A Easy (10 × 5 Marks), Set B Moderate (10 × 10 Marks), Set C Difficult (10 × 15 Marks) — 300 marks max.',
        durationMinutes: 30,
        qualifyingPercentage: 60,
        maxScore: 300,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 2,
      },
      {
        roundNumber: 3,
        difficulty: 'hard',
        title: 'Round 3 — CODING PROBLEMS',
        description: '9 coding problems (3 Easy × 5 Marks, 3 Moderate × 10 Marks, 3 Hard × 15 Marks — 90 marks max) · 45 minutes limit. Topics: Arrays, Strings, Stacks, Frequency Counting, Dynamic Programming, BFS Grid Traversal, and Kadane\'s Algorithm.',
        durationMinutes: 45,
        qualifyingPercentage: 60,
        maxScore: 90,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 3,
      },
    ];

    for (const rDef of competitionRoundsDef) {
      const existing = await db.query.rounds.findFirst({
        where: eq(rounds.roundNumber, rDef.roundNumber),
      });

      if (!existing) {
        await db.insert(rounds).values(rDef);
      } else {
        // Preserve admin-modified maxScore, durationMinutes, and qualifyingPercentage
        // Migrate legacy defaults (Round 1 old 8-mark default, Round 3 old 30-mark MCQ default)
        const nextMaxScore =
          existing.roundNumber === 1 && existing.maxScore === 8
            ? rDef.maxScore
            : existing.roundNumber === 3 && existing.maxScore === 30
            ? rDef.maxScore
            : existing.maxScore || rDef.maxScore;
        await db
          .update(rounds)
          .set({
            title: rDef.title,
            description: rDef.description,
            difficulty: rDef.difficulty,
            maxScore: nextMaxScore,
          })
          .where(eq(rounds.id, existing.id));
      }
    }

    // 4. Seed / Synchronize all Competition Questions
    await syncAllCompetitionQuestions();
  } catch (error) {
    console.error('seedTournamentDatabase error:', error);
  }
}

export async function syncAllCompetitionQuestions(): Promise<void> {
  try {
    const allRounds = await db.query.rounds.findMany();
    const roundMap = new Map<number, any>();
    for (const r of allRounds) {
      roundMap.set(r.roundNumber, r);
    }

    const activeCodes = new Set(QUESTION_BANK.map((q) => q.code));

    // Deactivate legacy M1..M10 and H1..H10 questions so Round 2 & Round 3 exclusively use the official questions
    const existingAllQs = await db.query.questions.findMany();
    for (const eqItem of existingAllQs) {
      if (eqItem.code && /^(M|H)\d+$/.test(eqItem.code) && !activeCodes.has(eqItem.code)) {
        await db
          .update(questions)
          .set({ isActive: false })
          .where(eq(questions.id, eqItem.id));
      }
    }

    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const qDef = QUESTION_BANK[i];
      const targetRound = roundMap.get(qDef.roundNumber);
      if (!targetRound) continue;

      const resolvedType = qDef.type || (qDef.roundNumber === 2 ? 'qa' : 'mcq');

      // Check if question exists by code
      const existing = await db.query.questions.findFirst({
        where: eq(questions.code, qDef.code),
      });

      if (!existing) {
        await db.insert(questions).values({
          roundId: targetRound.id,
          code: qDef.code,
          prompt: qDef.prompt,
          type: resolvedType,
          options: qDef.options || [],
          correctOption: qDef.correctOption ?? 0,
          codeStarter: qDef.codeStarter || null,
          explanation: qDef.explanation,
          points: qDef.points,
          orderIndex: i + 1,
          category: qDef.category,
          isActive: true,
        });
      } else {
        // Synchronize question data with authoritative master bank
        await db
          .update(questions)
          .set({
            roundId: targetRound.id,
            prompt: qDef.prompt,
            type: resolvedType,
            options: qDef.options || [],
            correctOption: qDef.correctOption ?? 0,
            codeStarter: qDef.codeStarter || null,
            explanation: qDef.explanation,
            points: qDef.points,
            orderIndex: i + 1,
            category: qDef.category,
            isActive: true,
          })
          .where(eq(questions.id, existing.id));
      }
    }
  } catch (error) {
    console.error('syncAllCompetitionQuestions error:', error);
  }
}

// Keep backward compatibility export for server.ts
export async function syncRound2Questions(): Promise<void> {
  return syncAllCompetitionQuestions();
}
