**Line:** P95 ≤ 500 ms, errors ≤ 1 %
**Baseline:** P95 10 ms, CPU 1.09 %, DB CPU 5.51 %
**Prediction:** slow at 600–800 users

| Users | P95 (ms) | Fail % | CPU % | DB CPU % |
| :---: | :---: | :---: | :---: | :---: |
| 5 | 10 | 0% | 1.09% | 5.51% |
| 50 | 10 | 0% | 5.67% | 7.94% |
| 100 | 10 | 0% | 10.94% | 10.31% |
| 200 | 13 | 0% | 21.15% | 15.73% |
| 400 | 18 | 0% | 41.30% | 24.31% |
| 800 | 98 | 0% | 83.56% | 39.65% |

**Bottleneck:** EC2 App Server (t3.micro)  
**Evidence:** At 800 users, EC2 CPU reached 83.56% (saturation zone, with P95 spikes up to ~1,700 ms) while RDS DB CPU was only 39.65%.


<img width="1917" height="971" alt="3a3ef912-caf6-41d0-9f3b-af6b30935b82" src="https://github.com/user-attachments/assets/37d0ce41-4bbb-45c6-9a0d-95145a39c5c0" />

<img width="1917" height="970" alt="Screenshot 2026-11-22 002220" src="https://github.com/user-attachments/assets/d794edaa-9405-4f49-9531-e34a0bd8cbf5" />

**Policy:** metric Average CPU utilization, target 50%, min 1, max 3, warm-up 300 s  
**After scaling:** P95 ~1,700 (spike) → ~100–260 ms (EC2 CPU dropped from ~78.6% to <30% after scaling to 3 instances, 0% failures)  
**Server-minutes:** ~129 server-minutes (vs 165 server-minutes at max 3 instances for 55 mins)

<img width="1897" height="1055" alt="15cf1411-7950-45c6-b09a-c599f81e22eb" src="https://github.com/user-attachments/assets/3acd9c8c-8e06-4c16-ab24-d9ec5b8b94d7" />

<img width="1917" height="1075" alt="Screenshot 2026-11-22 142131" src="https://github.com/user-attachments/assets/0f184bd3-00bf-4a4d-a2ab-aa253ba951c7" />

<img width="1917" height="1065" alt="974255bd-d1b6-4793-9300-de846c8220c8" src="https://github.com/user-attachments/assets/ce4ee04b-5876-459f-9828-1d0eaa60abb0" />
