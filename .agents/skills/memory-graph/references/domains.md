# Knowledge Domains

Detailed definitions of each knowledge domain, with examples and edge cases.

## Table of Contents
- [Domain Overview](#domain-overview)
- [Career](#career)
- [Learning](#learning)
- [Research](#research)
- [Projects](#projects)
- [Skills](#skills)
- [Preferences](#preferences)
- [Habits](#habits)
- [Decisions](#decisions)
- [Relationships](#relationships)
- [Personal Knowledge](#personal-knowledge)
- [Long-term Goals](#long-term-goals)
- [Multi-domain Memories](#multi-domain-memories)

---

## Domain Overview

A memory can belong to multiple domains simultaneously. Use the most specific applicable domain as primary, and note additional domains in tags if relevant.

| Domain | Core Question | Typical Confidence | Typical Importance |
|--------|---------------|-------------------|-------------------|
| Career | "What is their professional situation?" | 70–95% | 6–10 |
| Learning | "What are they learning right now?" | 60–85% | 4–8 |
| Research | "What have they investigated or discovered?" | 70–90% | 5–8 |
| Projects | "What are they building or working on?" | 80–95% | 6–10 |
| Skills | "What can they do?" | 60–95% | 5–9 |
| Preferences | "What do they prefer?" | 70–90% | 3–7 |
| Habits | "What patterns do they follow?" | 60–80% | 3–6 |
| Decisions | "What choices have they made?" | 80–95% | 5–9 |
| Relationships | "Who matters in their professional life?" | 70–90% | 4–8 |
| Personal Knowledge | "What do they know about life topics?" | 60–85% | 3–7 |
| Long-term Goals | "Where are they heading?" | 70–85% | 7–10 |

---

## Career

**What it captures**: Job roles, professional goals, workplace dynamics, industry knowledge, career transitions, compensation context, work environment preferences.

**Examples**:
- "Senior Software Engineer at Acme Corp"
- "Transitioning from backend to full-stack"
- "Works in a remote-first company"
- "Reports to the VP of Engineering"
- "Has 8 years of experience in fintech"

**Edge cases**:
- Job searching → Career (not Projects, unless actively building something for the search)
- Salary negotiations → Career + Decisions
- Industry-specific knowledge → Career + Personal Knowledge
- Networking events → Career + Relationships

**Confidence guidance**:
- Current job details: 90–95% (user knows their own job)
- Career aspirations: 70–80% (may change over time)
- Industry trends they mention: 60–70% (their understanding, not verified fact)

---

## Learning

**What it captures**: Courses, tutorials, books, skills being developed, knowledge gaps, learning strategies, educational background.

**Examples**:
- "Reading 'Designing Data-Intensive Applications'"
- "Taking an online course on distributed systems"
- "Learning Rust through building a CLI tool"
- "Struggles with understanding monads"
- "Finished a bootcamp in 2022"

**Edge cases**:
- Learning a skill for a project → Learning + Skills + Project
- Reading documentation → Learning (unless it's just a lookup)
- Teaching others → Learning + Skills (teaching is a skill)
- Formal education → Learning + Career (if relevant to job)

**Confidence guidance**:
- What they're currently learning: 80–90% (they know what they're studying)
- Their understanding level: 60–75% (hard to gauge from conversation alone)
- Learning goals: 70–80% (may change)

---

## Research

**What it captures**: Papers read, findings, methodologies, open questions, hypotheses, technical investigations, comparison analyses.

**Examples**:
- "Evaluated 5 message queue solutions for the project"
- "Read a paper on consensus algorithms"
- "Found that Redis is faster than Memcached for their use case"
- "Investigating why the auth service has high latency"

**Edge cases**:
- Research for a project → Research + Project
- Academic research → Research + Career (if it's their job)
- Product research (shopping) → Research + Decisions
- Debugging → Research (if systematic) or transient (if one-off)

**Confidence guidance**:
- Research findings: 70–85% (depends on methodology)
- Technical comparisons: 75–90% (if they tested it)
- Hypotheses: 50–65% (not yet confirmed)

---

## Projects

**What it captures**: Active/past projects, architecture decisions, technical choices, deadlines, team composition, project goals, status updates.

**Examples**:
- "Building an e-commerce platform with Next.js and Stripe"
- "The analytics dashboard is in beta testing"
- "Migrated the monolith to microservices last year"
- "Project deadline is March 2024"
- "Using a monorepo with Turborepo"

**Edge cases**:
- Side projects → Projects (not Career, unless it's career-related)
- Open source contributions → Projects + Career (if professional)
- Project management methodology → Projects + Preferences
- Failed projects → Projects + Decisions (lessons learned)

**Confidence guidance**:
- Active project details: 85–95% (they know what they're working on)
- Architecture decisions: 80–90% (confirmed by implementation)
- Future plans: 65–80% (may change)

---

## Skills

**What it captures**: Programming languages, tools, frameworks, soft skills, proficiency levels, certifications, expertise areas.

**Examples**:
- "Expert in Python, intermediate in Rust"
- "5 years of experience with React"
- "Strong at system design"
- "AWS certified"
- "Good at mentoring junior developers"

**Edge cases**:
- Skills being learned → Skills + Learning
- Skill proficiency → Skills (self-assessment, moderate confidence)
- Tool preferences → Skills + Preferences
- Skills used in a project → Skills + Projects

**Confidence guidance**:
- Languages they use: 85–95% (observable from conversation)
- Proficiency level: 60–75% (self-reported, may be biased)
- Years of experience: 75–85% (approximate)

---

## Preferences

**What it captures**: Coding style, tool choices, workflow preferences, aesthetic tastes, communication preferences, environment preferences.

**Examples**:
- "Prefers functional programming over OOP"
- "Uses dark mode everywhere"
- "Likes concise code over verbose"
- "Prefers async communication over meetings"
- "Tabs over spaces"

**Edge cases**:
- Preferences that are also decisions → Preferences (ongoing pattern) vs Decisions (one-time choice)
- Strong opinions → Preferences (high confidence)
- Mild preferences → Preferences (lower confidence)
- Context-dependent preferences → Preferences with context in description

**Confidence guidance**:
- Stated preferences: 75–90% (they know what they like)
- Observed patterns: 65–80% (inference from behavior)
- Weak preferences: 50–65% (might change)

---

## Habits

**What it captures**: Work routines, coding patterns, communication style, recurring behaviors, time management patterns.

**Examples**:
- "Codes in the morning, meetings in the afternoon"
- "Reviews PRs before starting new work"
- "Writes tests after implementation, not TDD"
- "Takes a break every 90 minutes"
- "Commits frequently with descriptive messages"

**Edge cases**:
- Habits that are also preferences → Habits (observable behavior) vs Preferences (stated preference)
- Habits that changed → Old habit: Archived, New habit: Active
- Desired habits (not yet established) → Habits + Long-term Goals

**Confidence guidance**:
- Observed multiple times: 75–85%
- Mentioned once: 60–70%
- Desired but not observed: 50–60%

---

## Decisions

**What it captures**: Choices made, rationale, trade-offs considered, alternatives rejected, decision frameworks used.

**Examples**:
- "Chose PostgreSQL over MongoDB for data integrity"
- "Decided to use microservices for team autonomy"
- "Rejected GraphQL because of caching complexity"
- "Went with a monorepo to simplify dependency management"

**Edge cases**:
- Decisions that became preferences → Decisions (historical) + Preferences (ongoing)
- Reversible decisions → Decisions (lower confidence in permanence)
- Group decisions → Decisions + Relationships (who was involved)
- Decision frameworks → Decisions + Preferences

**Confidence guidance**:
- Explicitly stated decisions: 85–95%
- Inferred decisions: 65–80%
- Reversible decisions: 60–75%

---

## Relationships

**What it captures**: Colleagues, collaborators, mentors, team dynamics, professional network, reporting structure.

**Examples**:
- "Alice is the team lead"
- "Bob is a great pair programming partner"
- "Reports to the VP of Engineering"
- "Works closely with the data science team"
- "Mentoring a junior developer named Charlie"

**Edge cases**:
- People mentioned in passing → Relationships (only if recurring or significant)
- Professional relationships → Relationships (not Personal Knowledge)
- Admired figures (public) → Relationships (lower importance)
- Team composition → Relationships + Projects

**Confidence guidance**:
- Direct relationships: 85–95%
- Observed dynamics: 70–80%
- Inferred relationships: 60–70%

---

## Personal Knowledge

**What it captures**: Health, finance, life lessons, personal philosophy, values, non-work knowledge, hobbies.

**Examples**:
- "Follows a keto diet"
- "Invests in index funds"
- "Values work-life balance highly"
- "Believes in continuous learning"
- "Enjoys rock climbing on weekends"

**Edge cases**:
- Work-life balance → Personal Knowledge + Preferences
- Side interests that could become projects → Personal Knowledge + Projects
- Values that influence decisions → Personal Knowledge + Decisions
- Health routines → Personal Knowledge + Habits

**Confidence guidance**:
- Stated values: 80–90%
- Lifestyle details: 70–85%
- Inferred values: 60–70%

---

## Long-term Goals

**What it captures**: Career aspirations, learning objectives, life goals, vision statements, milestones, bucket list items.

**Examples**:
- "Wants to become a Staff Engineer within 2 years"
- "Plans to start a tech company eventually"
- "Goal to contribute to an open source project with 1000+ stars"
- "Wants to learn 5 programming languages"
- "Aiming for financial independence by 45"

**Edge cases**:
- Short-term goals → Long-term Goals (if strategic) or Projects (if tactical)
- Goals that became projects → Long-term Goals (parent) + Projects (active work)
- Abandoned goals → Long-term Goals (Archived status)
- Evolving goals → Long-term Goals with version history

**Confidence guidance**:
- Stated goals: 70–85% (may evolve)
- Goal progress: 60–75% (hard to verify)
- Inferred goals: 55–70% (speculation)

---

## Multi-domain Memories

Many memories span multiple domains. Use the primary domain for the `category` field and note additional domains in tags.

### Examples of Multi-domain Memories

| Memory | Primary Domain | Additional Domains |
|--------|---------------|-------------------|
| "Learning Rust to build a CLI tool for the project" | Learning | Projects, Skills |
| "Chose PostgreSQL because of ACID requirements" | Decisions | Projects, Preferences |
| "Alice recommended the testing framework we're using" | Relationships | Projects, Skills |
| "Wants to become a tech lead, currently mentoring juniors" | Long-term Goals | Career, Relationships |
| "Writes tests first when working on critical code" | Habits | Preferences, Skills |
| "Read a paper on CRDTs for the distributed cache project" | Research | Projects, Learning |

### How to Handle Multi-domain

1. Choose the **most specific** domain as primary
2. Add additional domains as tags: `["career", "learning"]`
3. In the description, explain the cross-domain context
4. Create edges to related nodes in other domains
