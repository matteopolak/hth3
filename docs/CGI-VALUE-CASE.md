# CivicResolve — provisional CGI value case

**Status:** Synthetic, assumption-based draft. Replace with findings from all six official CGI CSV files before submission. No savings or operational improvements have been observed in a live deployment.

## Problem and first phase

Manual triage can delay assignment and create avoidable transfers when complaint categories or ownership rules are unclear. The first phase gives residents a confirmed report and case number, routes a bounded category decision to a team, sends uncertain reports to human review, and records status changes. It does not repair underlying service capacity, legacy system integration, field work delays, or every source of backlog.

## Reproducible scenario

The repository generates 600 synthetic reports over a baseline and a Saturday update. The fixture has 120 unresolved cases, 10% labeled as historically misrouted, median first triage of 27 hours, median assignment of 50 hours, and an increase in water complaints from 18% to 80% of phase volume. These values test the workflow and are **not** Northwind’s real metrics. The taxonomy change is simulated against recent cases before an owner publishes it; later reports use the new version.

## Cost and benefit assumptions

| Scenario     | Cases / month | Assisted share | Manual → assisted triage | Staff cost |   Setup | Monthly operation | Hours saved / month | Net benefit / month | Simple payback |
| ------------ | ------------: | -------------: | ------------------------ | ---------: | ------: | ----------------: | ------------------: | ------------------: | -------------: |
| Conservative |           500 |            50% | 10 → 5 min               |      $30/h | $15,000 |              $800 |                20.8 |               −$175 |           None |
| Expected     |           600 |            70% | 12 → 3 min               |      $35/h | $12,000 |              $600 |                63.0 |              $1,605 |     7.5 months |
| Optimistic   |           700 |            80% | 15 → 2 min               |      $40/h | $10,000 |              $500 |               121.3 |              $4,353 |     2.3 months |

Formula: `hours saved = monthly cases × assisted share × (manual minutes − assisted minutes) ÷ 60`; `monthly net = hours saved × hourly staff cost − monthly operation`; `payback = setup ÷ monthly net` when monthly net is positive. Expected operating cost is $1 per case at 600 cases/month, excluding setup amortization. This model counts only triage labor; routing-error reduction and faster resolution are potential benefits that need measured evidence before monetization.

## Measurement gate

Before claiming value, reconcile the six CGI files, establish the official manual baseline, and measure median triage/assignment/resolution times, wrong-department rate, human-review rate, cost per case, and backlog by time period. Run a controlled pilot with staff correction and compare like-for-like cases after the Saturday scenario update. Continue only if the measured net benefit and service quality both improve.
