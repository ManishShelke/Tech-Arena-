import { db, inMemory } from './index.ts';
import { users, rounds, questions, events, competitionSettings } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function seedTournamentDatabase(): Promise<void> {
  try {
    // 1. Seed Tournament Event
    const existingEvents = await db.query.events.findMany();
    if (existingEvents.length === 0) {
      await db.insert(events).values({
        title: 'TECH ARENA 2026 — Inter-College Technical Championship',
        description: 'Elite multi-round inter-collegiate technical championship featuring Easy, Intermediate, and Hard difficulty coding & debugging arenas.',
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

    // 3. Seed Easy, Intermediate, and Hard Competition Levels (Rounds)
    const existingRounds = await db.query.rounds.findMany();
    if (existingRounds.length === 0) {
      const defaultRounds = [
        {
          roundNumber: 1,
          difficulty: 'easy',
          title: 'Easy Level: Rapid Qualifier — Core Computing & Systems',
          description: 'High-speed technical qualifier testing computer systems, network protocols, memory models, and algorithmic fundamentals under strict proctoring.',
          durationMinutes: 15,
          maxViolations: 2,
          isOpen: true,
          isPublished: true,
          orderIndex: 1,
        },
        {
          roundNumber: 2,
          difficulty: 'intermediate',
          title: 'Intermediate Level: Algorithmic Engineering & Bug Hunt',
          description: 'Production bug-hunting and algorithm optimization under strict time and anti-cheat constraints. Code submissions are validated server-side.',
          durationMinutes: 25,
          maxViolations: 2,
          isOpen: true,
          isPublished: true,
          orderIndex: 2,
        },
        {
          roundNumber: 3,
          difficulty: 'hard',
          title: 'Hard Level: Live Arena Clash — Distributed Systems & Security',
          description: 'Grand finals arena terminal: High-concurrency architectures, cryptographic exploits, and distributed consensus dilemmas.',
          durationMinutes: 20,
          maxViolations: 2,
          isOpen: true,
          isPublished: true,
          orderIndex: 3,
        },
      ];

      for (const r of defaultRounds) {
        await db.insert(rounds).values(r);
      }
    }

    // 4. Seed Questions for Easy Level (Round 1)
    const r1 = await db.query.rounds.findFirst({
      where: eq(rounds.roundNumber, 1),
    });

    if (r1) {
      const existingQ1 = await db.query.questions.findMany({
        where: eq(questions.roundId, r1.id),
      });

      if (existingQ1.length === 0) {
        const r1Questions = [
          {
            roundId: r1.id,
            prompt: 'In a distributed hash table (DHT) using consistent hashing with N cache nodes, what fraction of keys need to be remapped on average when a new node is added?',
            type: 'mcq',
            options: ['1/N', '1/(N+1)', 'log(N)/N', 'N/(N+1)'],
            correctOption: 1,
            points: 10,
            orderIndex: 1,
            category: 'Distributed Systems',
          },
          {
            roundId: r1.id,
            prompt: 'What is the theoretical worst-case time complexity of inserting into an already populated Red-Black tree containing N elements?',
            type: 'mcq',
            options: ['O(1)', 'O(log N)', 'O(N)', 'O(N log N)'],
            correctOption: 1,
            points: 10,
            orderIndex: 2,
            category: 'Data Structures',
          },
          {
            roundId: r1.id,
            prompt: 'Which TCP flag combination is transmitted during the initial handshake step when establishing a reliable bidirectional connection?',
            type: 'mcq',
            options: ['SYN', 'SYN-ACK', 'ACK-PSH', 'FIN-ACK'],
            correctOption: 0,
            points: 10,
            orderIndex: 3,
            category: 'Computer Networks',
          },
          {
            roundId: r1.id,
            prompt: 'In modern Linux kernels, what mechanism allows user-space programs to execute sandboxed byte-code within the kernel address space without modifying kernel source code?',
            type: 'mcq',
            options: ['seccomp-bpf', 'eBPF', 'cgroups v2', 'KVM hypercalls'],
            correctOption: 1,
            points: 15,
            orderIndex: 4,
            category: 'Operating Systems',
          },
          {
            roundId: r1.id,
            prompt: 'In PostgreSQL, which index type utilizes generalized inverted indexes and is optimal for full-text search, arrays, and JSONB containment operators?',
            type: 'mcq',
            options: ['B-Tree', 'Hash', 'GIN', 'GiST'],
            correctOption: 2,
            points: 15,
            orderIndex: 5,
            category: 'Database Engines',
          },
        ];

        for (const q of r1Questions) {
          await db.insert(questions).values(q);
        }
      }
    }

    // 5. Seed Root Administrator Account ONLY (NO fake participants or dummy attempts!)
    const adminUser = await db.query.users.findFirst({
      where: eq(users.role, 'admin'),
    });

    if (!adminUser) {
      await db.insert(users).values({
        uid: 'admin_matrix_root',
        email: 'admin@techarena.edu',
        role: 'admin',
        name: 'Chief Administrator',
        college: 'Tech Arena Directorate',
        teamName: 'Admin Control Center',
        teamMembers: ['Chief Proctor', 'Tournament Director'],
        code: '#TA-ADMIN',
        zone: 'Central Command',
        isBlocked: false,
      });
    }

    // NOTE: All dummy participants, fake scores, and sample leaderboard attempts have been REMOVED.
    // The application starts cleanly with 0 participants and real-time statistics.
  } catch (err) {
    console.error('seedTournamentDatabase error:', err);
  }
}

export async function syncRound2Questions(): Promise<void> {
  try {
    const r2 = await db.query.rounds.findFirst({
      where: eq(rounds.roundNumber, 2),
    });

    if (r2) {
      const existingQ2 = await db.query.questions.findMany({
        where: eq(questions.roundId, r2.id),
      });

      if (existingQ2.length === 0) {
        const r2Questions = [
          {
            roundId: r2.id,
            prompt: 'Design an in-place array manipulation function `removeDuplicates(nums: number[]): number` that removes duplicates from a sorted array and returns the length of unique elements with O(1) extra space.',
            type: 'code',
            codeStarter: `function removeDuplicates(nums: number[]): number {
  // TODO: Fix the two-pointer tracking to prevent out-of-bounds mutation
  if (nums.length === 0) return 0;
  let writeIdx = 1;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1]) {
      nums[writeIdx] = nums[i];
      writeIdx++;
    }
  }
  return writeIdx;
}`,
            points: 25,
            orderIndex: 1,
            category: 'Algorithmic Optimization',
          },
          {
            roundId: r2.id,
            prompt: 'Identify the concurrency race condition in this token bucket rate limiter implementation and return the thread-safe mutex acquisition fix.',
            type: 'code',
            codeStarter: `class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private capacity: number;
  private refillRatePerSec: number;

  constructor(capacity: number, refillRatePerSec: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.lastRefill = Date.now();
  }

  public tryAcquire(requested: number = 1): boolean {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRatePerSec);
    this.lastRefill = now;

    if (this.tokens >= requested) {
      this.tokens -= requested;
      return true;
    }
    return false;
  }
}`,
            points: 30,
            orderIndex: 2,
            category: 'Concurrency & Systems',
          },
          {
            roundId: r2.id,
            prompt: 'Which HTTP/2 and HTTP/3 feature enables transmitting multiple concurrent request/response cycles over a single TCP/QUIC transport connection without head-of-line blocking?',
            type: 'mcq',
            options: ['Multiplexed Streams', 'Server Push Framing', 'HPACK Header Compression', 'Flow Control Window'],
            correctOption: 0,
            points: 15,
            orderIndex: 3,
            category: 'Protocol Engineering',
          },
        ];

        for (const q of r2Questions) {
          await db.insert(questions).values(q);
        }
      }
    }

    // Seed Hard Level (Round 3) questions if missing
    const r3 = await db.query.rounds.findFirst({
      where: eq(rounds.roundNumber, 3),
    });

    if (r3) {
      const existingQ3 = await db.query.questions.findMany({
        where: eq(questions.roundId, r3.id),
      });

      if (existingQ3.length === 0) {
        const r3Questions = [
          {
            roundId: r3.id,
            prompt: 'In the Raft consensus algorithm, under what specific quorum condition can a leader commit a log entry from a previous term?',
            type: 'mcq',
            options: [
              'Only indirectly by committing an entry from its current term',
              'Immediately when a majority of followers acknowledge the previous entry',
              'Once every heartbeat cycle has elapsed across all nodes',
              'Whenever no candidate has initiated election within electionTimeout',
            ],
            correctOption: 0,
            points: 30,
            orderIndex: 1,
            category: 'Distributed Consensus',
          },
          {
            roundId: r3.id,
            prompt: 'Implement a lock-free Single-Producer Single-Consumer (SPSC) ring buffer with atomic memory fences to prevent cache thrashing.',
            type: 'code',
            codeStarter: `class SPSCQueue<T> {
  private buffer: (T | undefined)[];
  private capacity: number;
  private head: number = 0; // write index
  private tail: number = 0; // read index

  constructor(capacity: number) {
    this.capacity = capacity + 1;
    this.buffer = new Array(this.capacity);
  }

  public enqueue(item: T): boolean {
    const nextHead = (this.head + 1) % this.capacity;
    if (nextHead === this.tail) return false; // Buffer full
    this.buffer[this.head] = item;
    this.head = nextHead;
    return true;
  }

  public dequeue(): T | undefined {
    if (this.head === this.tail) return undefined; // Buffer empty
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = undefined;
    this.tail = (this.tail + 1) % this.capacity;
    return item;
  }
}`,
            points: 35,
            orderIndex: 2,
            category: 'High-Performance Systems',
          },
        ];

        for (const q of r3Questions) {
          await db.insert(questions).values(q);
        }
      }
    }
  } catch (err) {
    console.error('syncRound2Questions error:', err);
  }
}
