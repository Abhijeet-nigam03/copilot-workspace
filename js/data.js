// ==========================================
// SYNAPSE OS: Initial Database & Sample Data
// ==========================================

const DEFAULT_DATA = {
  profile: {
    name: "Ananya Sharma",
    title: "Computer Science Student",
    email: "ananya.sharma@email.com",
    avatar: "assets/avatar.jpg",
    streakDays: 12,
    totalHoursStudied: 58.5,
    todayHoursStudied: 2.5,
    tasksCompletedTotal: 47,
    dailyGoalMinutes: 120,
    coursesEnrolled: 8,
    classesToday: 3,
    assignmentsDue: 2,
    attendancePercent: 92,
    learningProgressPercent: 72,
    gpa: 8.6
  },
  
  subjects: [
    {
      id: "subj-1",
      name: "Machine Learning & AI",
      color: "#8b5cf6", // Violet
      icon: "brain",
      description: "Neural networks, optimization, deep learning architectures and transformers."
    },
    {
      id: "subj-2",
      name: "Algorithms & Data Structures",
      color: "#06b6d4", // Cyan
      icon: "cpu",
      description: "Advanced algorithms, dynamic programming, graph traversal and complexity analysis."
    },
    {
      id: "subj-3",
      name: "Distributed Systems & Cloud",
      color: "#10b981", // Emerald
      icon: "server",
      description: "System design, consensus algorithms, microservices, scalability and fault tolerance."
    },
    {
      id: "subj-4",
      name: "Mathematics for Computing",
      color: "#f59e0b", // Amber
      icon: "sigma",
      description: "Linear algebra, matrix decomposition, multivariate calculus and probability."
    }
  ],

  notes: [
    {
      id: "note-1",
      subjectId: "subj-1",
      title: "Neural Networks & Backpropagation Math",
      tags: ["DeepLearning", "Calculus", "Optimization"],
      updatedAt: "2026-10-08T18:40:00Z",
      content: `# Neural Networks & Backpropagation Fundamentals

## 1. Forward Pass Formulation
In a multi-layer perceptron (MLP), each layer $l$ computes:
$$\\mathbf{z}^{[l]} = \\mathbf{W}^{[l]} \\mathbf{a}^{[l-1]} + \\mathbf{b}^{[l]}$$
$$\\mathbf{a}^{[l]} = \\sigma(\\mathbf{z}^{[l]})$$

where $\\sigma$ represents the non-linear activation function (e.g. **GELU**, **ReLU**, or **Swish**).

## 2. Loss Function & Chain Rule
For binary or multi-class cross-entropy loss:
$$\\mathcal{L} = -\\sum_{c=1}^C y_c \\log(\\hat{y}_c)$$

To compute gradient with respect to weights $\\mathbf{W}^{[l]}$:
$$\\frac{\\partial \\mathcal{L}}{\\partial \\mathbf{W}^{[l]}} = \\frac{\\partial \\mathcal{L}}{\\partial \\mathbf{z}^{[l]}} \\cdot (\\mathbf{a}^{[l-1]})^T$$

### Key Insights:
- **Vanishing Gradients:** Sigmoid activations saturate when $|z| > 4$, driving derivatives near zero.
- **Modern Mitigations:** Residual skip connections (He et al.), Layer Normalization, and proper initialization (Kaiming / He init).
- **Optimizer of Choice:** AdamW with cosine learning rate warmup.

\`\`\`python
# PyTorch snippet: Custom Linear layer backward step
import torch

def step_gradient(x, weights, grad_output, lr=0.001):
    grad_weights = torch.matmul(grad_output.t(), x)
    weights -= lr * grad_weights
    return weights
\`\`\`
`
    },
    {
      id: "note-2",
      subjectId: "subj-1",
      title: "Transformers: Scaled Dot-Product Attention",
      tags: ["Transformers", "Attention", "NLP"],
      updatedAt: "2026-10-07T14:15:00Z",
      content: `# Scaled Dot-Product Attention & Self-Attention

> "Attention is All You Need" (Vaswani et al., 2017) changed modern deep learning by replacing recurrent networks with parallel self-attention.

## Mathematical Formulation
Given query matrix $Q$, key matrix $K$, and value matrix $V$:

$$\\text{Attention}(Q, K, V) = \\text{softmax}\\left( \\frac{Q K^T}{\\sqrt{d_k}} \\right) V$$

### Why scale by $\\sqrt{d_k}$?
For large projection dimensions (e.g. $d_k = 64$ or $128$), the dot products grow large in magnitude, pushing the softmax function into regions with extremely small gradients. Dividing by $\\sqrt{d_k}$ stabilizes training.

### Multi-Head Attention (MHA)
- Allows model to simultaneously attend to information from different representation subspaces.
- In practice, multi-head projection uses $h$ parallel heads, concatenated and projected via $W^O$.
`
    },
    {
      id: "note-3",
      subjectId: "subj-2",
      title: "Dynamic Programming: State Space & Patterns",
      tags: ["DP", "Algorithms", "Optimization"],
      updatedAt: "2026-10-06T11:20:00Z",
      content: `# Dynamic Programming: Core Patterns

Mastering DP requires recognizing the **subproblem structure** and **state transition**.

## 1. 0/1 Knapsack Pattern
State representation:
\`dp[i][w]\` = maximum value using a subset of the first \`i\` items with weight limit \`w\`.

\`\`\`python
def knapsack(weights, values, capacity):
    n = len(weights)
    dp = [0] * (capacity + 1)
    for i in range(n):
        for w in range(capacity, weights[i] - 1, -1):
            dp[w] = max(dp[w], dp[w - weights[i]] + values[i])
    return dp[capacity]
\`\`\`

## 2. Top Tips for LeetCode Hard DP
- Always check if the state can be space-optimized from $O(N \\times M)$ to $O(M)$ rolling array.
- Look for monotone queue or prefix sums to optimize state transitions from $O(N^2)$ to $O(N)$.
`
    },
    {
      id: "note-4",
      subjectId: "subj-3",
      title: "CAP Theorem & PACELC in Distributed Data Stores",
      tags: ["DistributedSystems", "Architecture", "Databases"],
      updatedAt: "2026-10-05T09:00:00Z",
      content: `# CAP & PACELC Theorem Deep Dive

## The Classic CAP Theorem
In any asynchronous distributed network with network partitions:
- **C** - Strong Consistency (Linearizability)
- **A** - High Availability (Every non-failing node returns a non-error response)
- **P** - Partition Tolerance (System continues operating despite lost/delayed messages)

Since network partitions are an unavoidable physical reality of cables and routers, you must trade off **Consistency vs Availability**.

## PACELC Extension (Daniel Abadi)
If there is a **Partition (P)**:
Trade-off between **Availability (A)** and **Consistency (C)**.

**Else (E)** (normal operations without partitions):
Trade-off between **Latency (L)** and **Consistency (C)**.

| System | In Partition | Normal Operations |
| :--- | :--- | :--- |
| **Amazon DynamoDB** | PA | EL (Low Latency) |
| **Google Spanner** | PC | EC (Strict Serializability via TrueTime) |
| **Apache Cassandra** | PA | EL (Tunable quorum consistency) |
`
    }
  ],

  youtubeVideos: [
    {
      id: "yt-live-1",
      subjectId: "subj-2",
      title: "Data Structures: Arrays & Linked Lists (Prof. Mehta)",
      channel: "Prof. Mehta / Computer Science",
      videoId: "8hly31xKli0",
      thumbnail: "https://img.youtube.com/vi/8hly31xKli0/hqdefault.jpg",
      duration: "58:40",
      tags: ["DataStructures", "Arrays", "LinkedLists"],
      notes: [
        { id: "yn-live-1", time: 120, text: "Array memory allocation: contiguous contiguous vs pointer dereferencing." },
        { id: "yn-live-2", time: 640, text: "Singly linked list insertion and deletion time complexity." }
      ]
    },
    {
      id: "yt-live-2",
      subjectId: "subj-3",
      title: "Database Systems: Relational Normalization & SQL (Prof. Iyer)",
      channel: "Prof. Iyer / Database Systems",
      videoId: "HXV3zeRR3h4",
      thumbnail: "https://img.youtube.com/vi/HXV3zeRR3h4/hqdefault.jpg",
      duration: "1:15:20",
      tags: ["Database", "SQL", "Normalization"],
      notes: [
        { id: "yn-live-3", time: 240, text: "1NF, 2NF, 3NF and BCNF functional dependencies." },
        { id: "yn-live-4", time: 920, text: "Lossless join decomposition and dependency preservation." }
      ]
    },
    {
      id: "yt-live-3",
      subjectId: "subj-3",
      title: "Operating Systems: Process Synchronization & Concurrency (Prof. Verma)",
      channel: "Prof. Verma / OS Systems",
      videoId: "26QPDBe-NB8",
      thumbnail: "https://img.youtube.com/vi/26QPDBe-NB8/hqdefault.jpg",
      duration: "48:15",
      tags: ["OperatingSystems", "Concurrency", "Semaphores"],
      notes: [
        { id: "yn-live-5", time: 180, text: "Critical section problem: Mutual Exclusion, Progress, Bounded Waiting." },
        { id: "yn-live-6", time: 850, text: "Mutex locks and counting semaphores implementation." }
      ]
    },
    {
      id: "yt-1",
      subjectId: "subj-1",
      title: "Neural Networks: Zero to Hero (Building Micrograd)",
      channel: "Andrej Karpathy",
      videoId: "VMj-3S1tku0",
      thumbnail: "https://img.youtube.com/vi/VMj-3S1tku0/hqdefault.jpg",
      duration: "2:25:34",
      tags: ["DeepLearning", "PyTorch", "Python"],
      notes: [
        { id: "yn-1", time: 142, text: "Introduction to scalar-valued autograd engine and Value class wrapper." },
        { id: "yn-2", time: 780, text: "Forward expression graph construction: tracking parents and mathematical operation (+, *)." },
        { id: "yn-3", time: 1845, text: "Deriving manual backprop for composite expression f(x, y) = x*y + 2." },
        { id: "yn-4", time: 3620, text: "Topological sort of computational graph nodes before calling backward()." },
        { id: "yn-5", time: 5410, text: "Building a Multi-Layer Perceptron (Neuron, Layer, MLP) and training on binary classification." }
      ]
    },
    {
      id: "yt-2",
      subjectId: "subj-4",
      title: "Essence of Linear Algebra: Vectors, What are they?",
      channel: "3Blue1Brown",
      videoId: "fNk_zzaMoSs",
      thumbnail: "https://img.youtube.com/vi/fNk_zzaMoSs/hqdefault.jpg",
      duration: "9:52",
      tags: ["Math", "LinearAlgebra", "Geometry"],
      notes: [
        { id: "yn-6", time: 45, text: "Three perspectives on vectors: Physics (arrows), CS (lists of numbers), Math (axioms)." },
        { id: "yn-7", time: 210, text: "Geometric view: standard Cartesian coordinates and displacement from origin." },
        { id: "yn-8", time: 415, text: "Vector addition as sequential movement and scalar multiplication as scaling length." }
      ]
    },
    {
      id: "yt-3",
      subjectId: "subj-2",
      title: "MIT 6.006: Introduction to Algorithms & Asymptotic Notation",
      channel: "MIT OpenCourseWare",
      videoId: "ZA-tUyM_y7s",
      thumbnail: "https://img.youtube.com/vi/ZA-tUyM_y7s/hqdefault.jpg",
      duration: "49:22",
      tags: ["Algorithms", "Complexity", "MIT"],
      notes: [
        { id: "yn-9", time: 180, text: "Peak finding in 1D array: naive linear scan O(n) vs divide & conquer O(log n)." },
        { id: "yn-10", time: 1240, text: "Formal definition of peak element: A[i] >= A[i-1] and A[i] >= A[i+1]." },
        { id: "yn-11", time: 2100, text: "Extension to 2D peak finding on n x m matrix using column maximum." }
      ]
    },
    {
      id: "yt-4",
      subjectId: "subj-1",
      title: "Attention is All You Need & Transformer Neural Networks",
      channel: "StatQuest with Josh Starmer",
      videoId: "zxQyTK8quyY",
      thumbnail: "https://img.youtube.com/vi/zxQyTK8quyY/hqdefault.jpg",
      duration: "13:40",
      tags: ["Transformers", "Attention", "NLP"],
      notes: [
        { id: "yn-12", time: 120, text: "Self-Attention query, key, value matrix intuitive analogy." },
        { id: "yn-13", time: 480, text: "Calculating dot product similarity score between token vectors." },
        { id: "yn-14", time: 720, text: "Softmax normalization and weighted sum over value embeddings." }
      ]
    },
    {
      id: "yt-5",
      subjectId: "subj-3",
      title: "System Design: Distributed Cache Architecture",
      channel: "ByteByteGo",
      videoId: "dGAgxozNWFE",
      thumbnail: "https://img.youtube.com/vi/dGAgxozNWFE/hqdefault.jpg",
      duration: "11:25",
      tags: ["SystemDesign", "DistributedSystems", "Caching"],
      notes: [
        { id: "yn-15", time: 90, text: "Cache eviction strategies: LRU, LFU, FIFO comparison." },
        { id: "yn-16", time: 380, text: "Consistent Hashing to distribute load evenly across cache servers." },
        { id: "yn-17", time: 540, text: "Cache aside vs Read-through vs Write-behind persistence patterns." }
      ]
    },
    {
      id: "yt-6",
      subjectId: "subj-2",
      title: "Dynamic Programming: 7 Steps to Master DP",
      channel: "NeetCode",
      videoId: "Hdr64lKQ3e4",
      thumbnail: "https://img.youtube.com/vi/Hdr64lKQ3e4/hqdefault.jpg",
      duration: "15:10",
      tags: ["Algorithms", "DP", "LeetCode"],
      notes: [
        { id: "yn-18", time: 110, text: "Recognizing overlapping subproblems and optimal substructure." },
        { id: "yn-19", time: 490, text: "Memoization (top-down) vs Tabulation (bottom-up)." },
        { id: "yn-20", time: 740, text: "Space optimization tricks by keeping rolling variables." }
      ]
    }
  ],

  pdfs: [
    {
      id: "pdf-1",
      subjectId: "subj-1",
      title: "Machine Learning & Deep Learning Handbook",
      fileName: "sample_study_guide.pdf",
      filePath: "assets/sample_study_guide.pdf",
      totalPages: 12,
      lastReadPage: 3,
      tags: ["Cheatsheet", "DeepLearning", "ExamPrep"],
      notes: "Reviewed Sections 1 & 2 on Loss functions and Backprop. Need to review Transformer attention derivations on Page 4."
    },
    {
      id: "pdf-2",
      subjectId: "subj-3",
      title: "Google Spanner: Globally-Distributed Database",
      fileName: "spanner-osdi2012.pdf",
      filePath: "assets/sample_study_guide.pdf",
      totalPages: 14,
      lastReadPage: 1,
      tags: ["Paper", "DistributedSystems", "Spanner"],
      notes: "Key paper on TrueTime API, GPS and Atomic Clocks for bounded uncertainty intervals."
    }
  ],

  tasks: [
    {
      id: "task-asg-1",
      title: "DSA Module 3: Trees & Graphs Implementation",
      subjectId: "subj-2",
      category: "Assignment",
      priority: "high",
      status: "pending",
      dueDate: "2024-10-18",
      isToday: true,
      timeBlock: "Morning",
      estimatedMins: 60
    },
    {
      id: "task-asg-2",
      title: "Database Normalization & Indexing Problem Set",
      subjectId: "subj-3",
      category: "Assignment",
      priority: "medium",
      status: "pending",
      dueDate: "2024-10-20",
      isToday: true,
      timeBlock: "Afternoon",
      estimatedMins: 45
    },
    {
      id: "task-asg-3",
      title: "OS Case Study: Process Synchronization",
      subjectId: "subj-3",
      category: "Assignment",
      priority: "high",
      status: "completed",
      dueDate: "2024-10-22",
      isToday: false,
      timeBlock: null,
      estimatedMins: 90
    },
    {
      id: "task-asg-4",
      title: "CN Lab Report: Packet Analysis",
      subjectId: "subj-3",
      category: "Assignment",
      priority: "low",
      status: "completed",
      dueDate: "2024-10-25",
      isToday: false,
      timeBlock: null,
      estimatedMins: 30
    },
  ],

  studySessions: [
    { id: "ses-1", date: "2026-10-09", subjectId: "subj-4", durationMinutes: 45, topic: "Essence of Linear Algebra" },
    { id: "ses-2", date: "2026-10-09", subjectId: "subj-1", durationMinutes: 60, topic: "Backpropagation Math" },
    { id: "ses-3", date: "2026-10-08", subjectId: "subj-1", durationMinutes: 90, topic: "Micrograd autograd engine" },
    { id: "ses-4", date: "2026-10-08", subjectId: "subj-2", durationMinutes: 50, topic: "Dynamic Programming Knapsack" },
    { id: "ses-5", date: "2026-10-07", subjectId: "subj-3", durationMinutes: 75, topic: "CAP Theorem & Distributed consensus" },
    { id: "ses-6", date: "2026-10-06", subjectId: "subj-1", durationMinutes: 80, topic: "Transformer Self-Attention" },
    { id: "ses-7", date: "2026-10-05", subjectId: "subj-2", durationMinutes: 60, topic: "MIT 6.006 Peak Finding" },
    { id: "ses-8", date: "2026-10-04", subjectId: "subj-4", durationMinutes: 45, topic: "Matrix Inverses & Determinants" },
    { id: "ses-9", date: "2026-10-03", subjectId: "subj-1", durationMinutes: 110, topic: "PyTorch Tensor Internals" },
    { id: "ses-10", date: "2026-10-02", subjectId: "subj-3", durationMinutes: 90, topic: "Raft Consensus Protocol" }
  ],

  courses: [
    {
      id: "crs-1",
      title: "Data Structures & Algorithms",
      platform: "Learnova LMS Core",
      instructor: "Prof. Mehta",
      subjectId: "subj-2",
      progress: 75,
      status: "In Progress",
      url: "#",
      modulesCompleted: 6,
      totalModules: 8,
      targetCompletion: "2026-11-15",
      notes: "Arrays, Linked Lists, Trees, Graphs, and Dynamic Programming."
    },
    {
      id: "crs-2",
      title: "Database Systems & Architecture",
      platform: "Learnova LMS Core",
      instructor: "Prof. Iyer",
      subjectId: "subj-3",
      progress: 60,
      status: "In Progress",
      url: "#",
      modulesCompleted: 6,
      totalModules: 10,
      targetCompletion: "2026-11-30",
      notes: "Relational Algebra, SQL, Normalization (1NF-BCNF), Indexing."
    },
    {
      id: "crs-3",
      title: "Operating Systems Principles",
      platform: "Learnova LMS Core",
      instructor: "Prof. Verma",
      subjectId: "subj-3",
      progress: 40,
      status: "In Progress",
      url: "#",
      modulesCompleted: 4,
      totalModules: 10,
      targetCompletion: "2026-12-10",
      notes: "Process Scheduling, Synchronization, Memory Management & File Systems."
    },
    {
      id: "crs-4",
      title: "Computer Networks & Protocols",
      platform: "Learnova LMS Core",
      instructor: "Prof. Rao",
      subjectId: "subj-3",
      progress: 20,
      status: "In Progress",
      url: "#",
      modulesCompleted: 2,
      totalModules: 10,
      targetCompletion: "2026-12-20",
      notes: "OSI Layer, TCP/IP, Routing Algorithms, Socket Programming."
    },
    {
      id: "crs-5",
      title: "Machine Learning & AI Foundations",
      platform: "Stanford Online / Learnova",
      instructor: "Andrew Ng",
      subjectId: "subj-1",
      progress: 72,
      status: "In Progress",
      url: "https://cs229.stanford.edu",
      modulesCompleted: 7,
      totalModules: 10,
      targetCompletion: "2026-11-15",
      notes: "Supervised Learning, Deep Neural Nets, Loss Optimization."
    },
    {
      id: "crs-6",
      title: "Web Technologies & Cloud Services",
      platform: "Learnova LMS Core",
      instructor: "Prof. Gupta",
      subjectId: "subj-3",
      progress: 80,
      status: "In Progress",
      url: "#",
      modulesCompleted: 8,
      totalModules: 10,
      targetCompletion: "2026-10-31",
      notes: "RESTful APIs, Client Architecture, Cloud Deployment."
    },
    {
      id: "crs-7",
      title: "Software Engineering & Architecture",
      platform: "Learnova LMS Core",
      instructor: "Prof. Sharma",
      subjectId: "subj-2",
      progress: 100,
      status: "Completed",
      url: "#",
      modulesCompleted: 12,
      totalModules: 12,
      targetCompletion: "2026-09-30",
      notes: "Agile, Design Patterns, CI/CD, Automated Testing."
    },
    {
      id: "crs-8",
      title: "Discrete Mathematics & Graph Theory",
      platform: "Learnova LMS Core",
      instructor: "Prof. Raman",
      subjectId: "subj-4",
      progress: 100,
      status: "Completed",
      url: "#",
      modulesCompleted: 10,
      totalModules: 10,
      targetCompletion: "2026-09-15",
      notes: "Propositional Logic, Combinatorics, Graph Theory."
    }
  ],

  certifications: [
    {
      id: "cert-1",
      name: "AWS Certified Solutions Architect – Associate",
      issuer: "Amazon Web Services",
      credentialId: "AWS-SAA-839210",
      issueDate: "2026-04-12",
      expiryDate: "2029-04-12",
      verifyUrl: "https://aws.amazon.com/verification",
      status: "Active", // Active, In Progress, Expired
      badgeColor: "#f59e0b"
    },
    {
      id: "cert-2",
      name: "TensorFlow Developer Certificate",
      issuer: "Google / TensorFlow Certificate Program",
      credentialId: "TF-DEV-991240",
      issueDate: "2026-01-18",
      expiryDate: "2029-01-18",
      verifyUrl: "https://www.credential.net",
      status: "Active",
      badgeColor: "#8b5cf6"
    },
    {
      id: "cert-3",
      name: "Google Cloud Professional Machine Learning Engineer",
      issuer: "Google Cloud",
      credentialId: "GCP-MLE-PENDING",
      issueDate: "Scheduled: 2026-11-20",
      expiryDate: "2029-11-20",
      verifyUrl: "",
      status: "In Progress",
      badgeColor: "#06b6d4"
    }
  ],

  skills: [
    {
      id: "sk-1",
      name: "Deep Learning (PyTorch)",
      domain: "AI & Machine Learning",
      level: 4, // 1 to 5
      targetLevel: 5,
      lastPracticed: "Today",
      description: "Custom autograd layers, distributed training (DDP), tensor optimizations."
    },
    {
      id: "sk-2",
      name: "Algorithms & Complexity",
      domain: "Computer Science",
      level: 4,
      targetLevel: 5,
      lastPracticed: "Yesterday",
      description: "Time/space complexity analysis, tree/graph traversal, dynamic programming."
    },
    {
      id: "sk-3",
      name: "Distributed Systems Architecture",
      domain: "Systems & Cloud",
      level: 3,
      targetLevel: 5,
      lastPracticed: "2 days ago",
      description: "Consensus (Raft/Paxos), replication, sharding, caching, message queues."
    },
    {
      id: "sk-4",
      name: "Linear Algebra & Vector Calculus",
      domain: "Mathematics",
      level: 4,
      targetLevel: 5,
      lastPracticed: "Today",
      description: "Eigendecomposition, SVD, gradients of scalar/vector functions."
    },
    {
      id: "sk-5",
      name: "Docker & Container Orchestration",
      domain: "DevOps & Cloud",
      level: 3,
      targetLevel: 4,
      lastPracticed: "1 week ago",
      description: "Multi-stage Docker builds, Kubernetes manifests, container networking."
    }
  ],

  goals: [
    {
      id: "goal-1",
      title: "Master Modern Transformer & LLM Architectures",
      category: "Technical Mastery",
      targetDate: "2026-12-31",
      description: "Implement attention, RoPE, KV Cache, and FlashAttention from scratch.",
      milestones: [
        { id: "m-1", text: "Derive Scaled Dot-Product Attention equations", done: true },
        { id: "m-2", text: "Code GPT-2 decoder from scratch in PyTorch", done: true },
        { id: "m-3", text: "Implement RoPE (Rotary Position Embeddings)", done: true },
        { id: "m-4", text: "Profile and understand FlashAttention tiling", done: false },
        { id: "m-5", text: "Fine-tune 7B model using LoRA / QLoRA on custom dataset", done: false }
      ]
    },
    {
      id: "goal-2",
      title: "Pass Google Cloud Professional ML Engineer Exam",
      category: "Certification",
      targetDate: "2026-11-20",
      description: "Cover Vertex AI pipelines, BigQuery ML, Model Monitoring and Security.",
      milestones: [
        { id: "m-6", text: "Complete official GCP ML study path", done: true },
        { id: "m-7", text: "Build end-to-end Vertex AI pipeline project", done: true },
        { id: "m-8", text: "Score 85%+ on full-length mock exams", done: false },
        { id: "m-9", text: "Review feature engineering and data drift policies", done: false }
      ]
    },
    {
      id: "goal-3",
      title: "Publish 10 High-Quality Technical Study Breakdowns",
      category: "Knowledge Sharing",
      targetDate: "2026-11-30",
      description: "Write intuitive visual guides breaking down complex research papers.",
      milestones: [
        { id: "m-10", text: "Article: Intuitive Backpropagation with Computational Graphs", done: true },
        { id: "m-11", text: "Article: Why Raft Consensus is easier than Paxos", done: true },
        { id: "m-12", text: "Article: KV Cache Memory Explained Visually", done: false },
        { id: "m-13", text: "Article: The Math Behind Low-Rank Adaptation (LoRA)", done: false }
      ]
    }
  ]
};
