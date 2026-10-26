# Architecting for Resilience

Reference materials for designing Business Continuity Plans (BCP) and Disaster Recovery (DR) solutions on AWS.

## Intro

"Everything fails, all the time" is a famous philosophy coined by Werner Vogels, the Chief Technology Officer (CTO) at Amazon. It means that in any large-scale, complex system, unpredictable hardware crashes, software bugs, network outages, and datacenter failures are inevitable.

Instead of fighting the impossible battle of preventing all failures, engineers and architects must design for failure. This caretaker mindset requires building systems that remain functional and graceful even when individual components drop out

## Core Principles

1. **Assume Failure**: Do not build systems on the assumption that everything will stay up. Accept that things will go wrong and build redundancies.

2. **Graceful Degradation**: A failure in one component shouldn't bring down your entire system. Isolate failures so your users experience minimal disruption

3. **Decomposition**: Break applications into small, loosely coupled, stateless building blocks so they can fail independently without cascading.


## BCP Framework

The BCP framework follows a four-phase lifecycle:

1. **Understand** — Business Impact Analysis (BIA) + Risk Assessment
2. **Prepare** — Recovery strategies, DR plan, roles, alternate sites, communication plan
3. **Respond** — Incident Response Plan
4. **Sustain** — Testing, exercises, and plan maintenance

Key metrics defined per system: **RTO** (Recovery Time Objective) and **RPO** (Recovery Point Objective).

## DR Strategies on AWS

Four strategies ordered by cost and recovery speed:

| Level | Strategy | RTO | Cost |
|---|---|---|---|
| 1 | Backup & Restore | Hours | $ |
| 2 | Pilot Light | 30–60 min | $$ |
| 3 | Warm Standby | Minutes | $$$ |
| 4 | Multi-Site Active/Active | Near-zero | $$$$ |
