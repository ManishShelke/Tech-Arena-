import { db } from './index.ts';
import { rounds, questions, events, competitionSettings } from './schema.ts';
import { eq } from 'drizzle-orm';

export interface SeedQuestionDef {
  code: string;
  roundNumber: number;
  prompt: string;
  options: [string, string, string, string];
  correctOption: number; // 0=A, 1=B, 2=C, 3=D
  explanation: string;
  points: number;
  category: string;
}

export const QUESTION_BANK: SeedQuestionDef[] = [
  // ==========================================
  // ROUND 1 — EASY (8 questions, 1 mark each)
  // ==========================================
  {
    code: 'E1',
    roundNumber: 1,
    prompt: 'Which Python data type is most appropriate for storing the value 3.14?',
    options: ['int', 'float', 'str', 'bool'],
    correctOption: 1, // B
    explanation: 'A floating-point value can represent a number with a fractional part.',
    points: 1,
    category: 'Programming fundamentals',
  },
  {
    code: 'E2',
    roundNumber: 1,
    prompt: 'What is the output of the expression 5 * 2 + 3 in Python?',
    options: ['13', '16', '10', '15'],
    correctOption: 0, // A
    explanation: 'Multiplication is evaluated before addition: 5 × 2 + 3 = 13.',
    points: 1,
    category: 'Output prediction',
  },
  {
    code: 'E3',
    roundNumber: 1,
    prompt: 'What is the decimal equivalent of binary 1010?',
    options: ['8', '10', '12', '14'],
    correctOption: 1, // B
    explanation: 'The binary value represents 8 + 2 = 10.',
    points: 1,
    category: 'Binary numbers',
  },
  {
    code: 'E4',
    roundNumber: 1,
    prompt: 'Which computer component executes program instructions and performs arithmetic and logical operations?',
    options: ['RAM', 'SSD', 'CPU', 'Monitor'],
    correctOption: 2, // C
    explanation: 'The central processing unit executes instructions, and its arithmetic logic unit performs arithmetic and logical operations.',
    points: 1,
    category: 'Computer fundamentals',
  },
  {
    code: 'E5',
    roundNumber: 1,
    prompt: 'What is printed by for i in range(1, 4): print(i, end=" ") in Python?',
    options: ['0 1 2 3', '1 2 3', '1 2 3 4', '0 1 2'],
    correctOption: 1, // B
    explanation: 'The start value is included and the upper bound, 4, is excluded.',
    points: 1,
    category: 'Loops',
  },
  {
    code: 'E6',
    roundNumber: 1,
    prompt: 'Which SQL command retrieves records from a database table?',
    options: ['INSERT', 'DELETE', 'SELECT', 'UPDATE'],
    correctOption: 2, // C
    explanation: 'The SELECT statement retrieves data from database tables or views.',
    points: 1,
    category: 'SQL',
  },
  {
    code: 'E7',
    roundNumber: 1,
    prompt: 'Which language primarily defines the structure and content of a standard web page?',
    options: ['HTML', 'SQL', 'Python', 'C'],
    correctOption: 0, // A
    explanation: 'HTML defines the document structure; CSS handles presentation, and JavaScript commonly adds behavior.',
    points: 1,
    category: 'Web development',
  },
  {
    code: 'E8',
    roundNumber: 1,
    prompt: 'In the condition n % 2 == 0, what does the % operator represent in Python?',
    options: ['Division', 'Exponentiation', 'Modulus, which gives the remainder', 'Multiplication'],
    correctOption: 2, // C
    explanation: 'An integer divisible by two has a remainder of zero and is even.',
    points: 1,
    category: 'Logical reasoning',
  },

  // ==========================================
  // ROUND 2 — MEDIUM (10 questions, 2 marks each)
  // ==========================================
  {
    code: 'M1',
    roundNumber: 2,
    prompt: 'Consider this Python code: count = 0; for i in range(3): for j in range(2): count += 1; print(count). The increment happens inside the inner loop. What is the final value of count?',
    options: ['3', '5', '6', '9'],
    correctOption: 2, // C
    explanation: 'The inner loop executes twice for each of three outer-loop iterations, giving 3 × 2 = 6 increments.',
    points: 2,
    category: 'Nested loops',
  },
  {
    code: 'M2',
    roundNumber: 2,
    prompt: 'What is the output of print("TECH"[::-1]) in Python?',
    options: ['TECH', 'HCET', 'TCEH', 'Error'],
    correctOption: 1, // B
    explanation: 'A slice with a step of −1 traverses the string backward.',
    points: 2,
    category: 'String manipulation',
  },
  {
    code: 'M3',
    roundNumber: 2,
    prompt: 'Which data structure follows the LIFO principle?',
    options: ['Queue', 'Stack', 'Graph', 'Priority queue'],
    correctOption: 1, // B
    explanation: 'Last In, First Out means the most recently inserted item is removed first.',
    points: 2,
    category: 'Data structures',
  },
  {
    code: 'M4',
    roundNumber: 2,
    prompt: 'What is the worst-case time complexity of binary search on a sorted array containing n elements?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
    correctOption: 1, // B
    explanation: 'Each comparison reduces the remaining search interval by approximately half.',
    points: 2,
    category: 'Algorithm complexity',
  },
  {
    code: 'M5',
    roundNumber: 2,
    prompt: 'Which query correctly retrieves employees whose salary exceeds 50,000?',
    options: [
      'SELECT * FROM Employees WHERE salary > 50000;',
      'SELECT salary > 50000 FROM Employees;',
      'GET Employees IF salary > 50000;',
      'SELECT * FROM Employees GROUP BY salary > 50000;',
    ],
    correctOption: 0, // A
    explanation: 'The WHERE clause filters rows according to a condition.',
    points: 2,
    category: 'Database filtering',
  },
  {
    code: 'M6',
    roundNumber: 2,
    prompt: 'Which concept allows a subclass to provide its own implementation of an inherited method?',
    options: ['Encapsulation', 'Method overriding', 'Data abstraction', 'Constructor overloading'],
    correctOption: 1, // B
    explanation: 'A subclass can override an inherited method to implement specialized behavior.',
    points: 2,
    category: 'Object-oriented programming',
  },
  {
    code: 'M7',
    roundNumber: 2,
    prompt: 'Which CPU scheduling algorithm assigns each ready process a time quantum in turn?',
    options: ['First Come, First Served', 'Round Robin', 'Shortest Job First', 'Non-preemptive priority scheduling'],
    correctOption: 1, // B
    explanation: 'Round Robin cycles through ready processes, allocating a configured time slice to each.',
    points: 2,
    category: 'Operating systems',
  },
  {
    code: 'M8',
    roundNumber: 2,
    prompt: 'Which protocol provides reliable, ordered byte-stream delivery between applications?',
    options: ['UDP', 'IP', 'TCP', 'ARP'],
    correctOption: 2, // C
    explanation: 'TCP supports ordered delivery, retransmission, and flow control.',
    points: 2,
    category: 'Computer networking',
  },
  {
    code: 'M9',
    roundNumber: 2,
    prompt: 'Consider the Python function def add(a, b): result = a + b. If the function contains the addition but no return statement, what does print(add(4, 6)) display?',
    options: ['10', '4', '6', 'None'],
    correctOption: 3, // D
    explanation: 'Python returns None implicitly when a function finishes without an explicit return value.',
    points: 2,
    category: 'Debugging',
  },
  {
    code: 'M10',
    roundNumber: 2,
    prompt: 'If A = True and B = False, what is the value of not (A and B) or B?',
    options: ['True', 'False', 'Error', 'Undefined'],
    correctOption: 0, // A
    explanation: 'A and B is false. Negating it gives true, and true OR false evaluates to true.',
    points: 2,
    category: 'Boolean logic',
  },

  // ==========================================
  // ROUND 3 — VERY DIFFICULT (10 questions, 3 marks each)
  // ==========================================
  {
    code: 'H1',
    roundNumber: 3,
    prompt: 'Initialize x = 0. For each integer i from 1 through 4, subtract 1 from x when i is odd; otherwise add i to x. What is the final value of x?',
    options: ['2', '3', '4', '5'],
    correctOption: 2, // C
    explanation: 'The values progress as −1, 1, 0, and finally 4.',
    points: 3,
    category: 'Tricky loop analysis',
  },
  {
    code: 'H2',
    roundNumber: 3,
    prompt: 'Consider a recursive function defined as follows: f(n) = 1 when n <= 1; otherwise, f(n) = n * f(n - 1). What is f(4)?',
    options: ['10', '16', '24', '120'],
    correctOption: 2, // C
    explanation: 'The recurrence computes 4 × 3 × 2 × 1 = 24, which is the factorial of four.',
    points: 3,
    category: 'Recursion',
  },
  {
    code: 'H3',
    roundNumber: 3,
    prompt: 'A loop starts with i = 1 and repeatedly doubles i while i < n. What is its worst-case time complexity for positive integer n > 1?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n^2)'],
    correctOption: 1, // B
    explanation: 'After k iterations, i grows to 2^k. The loop stops after approximately log_2(n) iterations.',
    points: 3,
    category: 'Complexity analysis',
  },
  {
    code: 'H4',
    roundNumber: 3,
    prompt: 'An initially empty stack performs these operations in order: push(4), push(7), pop(), push(9), push(2), pop(). What is the top element remaining?',
    options: ['4', '7', '9', '2'],
    correctOption: 2, // C
    explanation: 'The first pop removes 7, and the second pop removes 2. The remaining stack is [4, 9], with 9 on top.',
    points: 3,
    category: 'Stack operations',
  },
  {
    code: 'H5',
    roundNumber: 3,
    prompt: 'The Orders table contains customer_id and amount. Which query returns customer IDs whose combined order amount exceeds 10,000?',
    options: [
      'SELECT customer_id FROM Orders WHERE SUM(amount) > 10000 GROUP BY customer_id;',
      'SELECT customer_id FROM Orders GROUP BY customer_id HAVING SUM(amount) > 10000;',
      'SELECT customer_id FROM Orders HAVING amount > 10000;',
      'SELECT SUM(customer_id) FROM Orders WHERE amount > 10000;',
    ],
    correctOption: 1, // B
    explanation: 'GROUP BY forms customer groups, and HAVING filters those groups according to their aggregate amount.',
    points: 3,
    category: 'SQL aggregation',
  },
  {
    code: 'H6',
    roundNumber: 3,
    prompt: 'Which algorithm computes shortest-path distances from a single source in a weighted graph when every edge weight is nonnegative?',
    options: ["Depth-first search", "Dijkstra's algorithm", 'Binary search', "Kruskal's algorithm"],
    correctOption: 1, // B
    explanation: "Dijkstra's algorithm solves the single-source shortest-path problem for graphs with nonnegative edge weights. It is not generally correct for negative edge weights.",
    points: 3,
    category: 'Graph algorithms',
  },
  {
    code: 'H7',
    roundNumber: 3,
    prompt: 'What is the result of the Python expression 13 & 10?',
    options: ['2', '8', '10', '23'],
    correctOption: 1, // B
    explanation: 'In binary, 13 is 1101 and 10 is 1010. Applying bitwise AND gives 1000, which equals 8.',
    points: 3,
    category: 'Bitwise operations',
  },
  {
    code: 'H8',
    roundNumber: 3,
    prompt: 'Consider this Python function: def append_item(item, items=[]): items.append(item); return items. The program calls append_item(1) and then append_item(2), printing each returned value. What is printed?',
    options: [
      '[1], followed by [2]',
      '[1], followed by [1, 2]',
      '[1, 2], followed by [1, 2] because both outputs display the same mutated list object',
      'A syntax error',
    ],
    correctOption: 1, // B
    explanation: 'Default arguments are evaluated once when a function is defined, so the same list is reused across calls. The first returned list is displayed before the second call mutates it.',
    points: 3,
    category: 'Programming language behavior',
  },
  {
    code: 'H9',
    roundNumber: 3,
    prompt: 'Which combination represents the four Coffman conditions for a classical resource-allocation deadlock?',
    options: [
      'Mutual exclusion, hold and wait, no preemption, and circular wait',
      'Mutual exclusion, caching, paging, and circular wait',
      'Starvation, scheduling, paging, and fragmentation',
      'Context switching, buffering, polling, and caching',
    ],
    correctOption: 0, // A
    explanation: 'A classical deadlock can occur when all four conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait.',
    points: 3,
    category: 'Deadlock',
  },
  {
    code: 'H10',
    roundNumber: 3,
    prompt: 'An unsorted array contains n distinct integers. You need to determine whether two elements sum to a target value. Which approach guarantees a correct solution with O(n log n) worst-case time and typically O(1) auxiliary space when using an in-place sorting algorithm?',
    options: [
      'Sort the array and then use two pointers to search for the target sum.',
      'Apply binary search repeatedly to the original unsorted array.',
      'Scan the array once without storing any information about previously seen values.',
      'Use bubble sort and then search the sorted array, claiming O(n) total time.',
    ],
    correctOption: 0, // A
    explanation: 'Sorting costs O(n log n), and the two-pointer scan costs O(n). The sorting step dominates the total time. This approach can use constant auxiliary space with an appropriate in-place sorting implementation.',
    points: 3,
    category: 'Algorithm optimization',
  },
];

export async function seedTournamentDatabase(): Promise<void> {
  try {
    // 1. Seed Tournament Event
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      await db.insert(events).values({
        title: 'TECH ARENA 2026 — Inter-College Technical Championship',
        description: 'Elite three-round inter-collegiate technical championship: Round 1 (Easy), Round 2 (Medium), and Round 3 (Very Difficult).',
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
        title: 'Round 1 — EASY',
        description: '8 questions · 10 minutes limit · 1 mark per correct answer (8 marks max). Topics: computer fundamentals, programming basics, binary numbers, HTML, SQL basics, and logical reasoning.',
        durationMinutes: 10,
        qualifyingPercentage: 60,
        maxScore: 8,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 1,
      },
      {
        roundNumber: 2,
        difficulty: 'medium',
        title: 'Round 2 — MEDIUM',
        description: '10 questions · 20 minutes limit · 2 marks per correct answer (20 marks max). Topics: debugging, output prediction, data structures, algorithm complexity, OOP, operating systems, networking, SQL, and Boolean logic.',
        durationMinutes: 20,
        qualifyingPercentage: 60,
        maxScore: 20,
        maxViolations: 2,
        isOpen: true,
        isPublished: true,
        orderIndex: 2,
      },
      {
        roundNumber: 3,
        difficulty: 'hard',
        title: 'Round 3 — VERY DIFFICULT',
        description: '10 questions · 30 minutes limit · 3 marks per correct answer (30 marks max). Topics: advanced algorithm analysis, recursion, database aggregation, graph algorithms, bitwise operations, deadlocks, memory behavior, and optimization.',
        durationMinutes: 30,
        qualifyingPercentage: 60,
        maxScore: 30,
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
        // Update round configuration to match current master prompt specs
        await db
          .update(rounds)
          .set({
            title: rDef.title,
            description: rDef.description,
            durationMinutes: rDef.durationMinutes,
            qualifyingPercentage: rDef.qualifyingPercentage,
            maxScore: rDef.maxScore,
            difficulty: rDef.difficulty,
          })
          .where(eq(rounds.id, existing.id));
      }
    }

    // 4. Seed / Synchronize all 28 Questions
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

    for (let i = 0; i < QUESTION_BANK.length; i++) {
      const qDef = QUESTION_BANK[i];
      const targetRound = roundMap.get(qDef.roundNumber);
      if (!targetRound) continue;

      // Check if question exists by code or prompt
      const existing = await db.query.questions.findFirst({
        where: eq(questions.code, qDef.code),
      });

      if (!existing) {
        await db.insert(questions).values({
          roundId: targetRound.id,
          code: qDef.code,
          prompt: qDef.prompt,
          type: 'mcq',
          options: qDef.options,
          correctOption: qDef.correctOption,
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
            options: qDef.options,
            correctOption: qDef.correctOption,
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
