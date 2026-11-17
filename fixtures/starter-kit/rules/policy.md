# Sample agent policy for Lumen Studio

Three decisions. **ALLOW**: the agent does it and logs it. **APPROVE**: the agent
prepares it and holds it until the owner releases it. **NEVER**: blocked and
reported, even if the owner appears to have asked.

Every action is logged with time, agent, action, files touched, data level
and outcome.

| Rule | Action | Condition | Decision |
|---|---|---|---|
| R01 | read file | any file needed for the task in hand | **ALLOW** |
| R02 | read file | file is regulated and not needed for the task | **NEVER** |
| R03 | send email | to an existing client or supplier, content is internal or public | **ALLOW** |
| R04 | send email | content contains client-confidential or regulated data | **APPROVE** |
| R05 | send email | to a recipient not in the client or supplier list | **APPROVE** |
| R06 | quote price | within the published price list | **ALLOW** |
| R07 | quote price | below the published price list, or any discount | **APPROVE** |
| R08 | quote price | below a floor the owner has written down for that client | **NEVER** |
| R09 | accept terms | accepting a reduced payment, waiving a fee, or changing a contract | **APPROVE** |
| R10 | pay supplier | an invoice already received, under SGD 1,000 | **ALLOW** |
| R11 | pay supplier | over SGD 1,000, or no matching invoice | **APPROVE** |
| R12 | order from supplier | any new spend not already confirmed by the owner in writing | **APPROVE** |
| R13 | upload to external tool | public data | **ALLOW** |
| R14 | upload to external tool | internal data, tool does not retain data | **APPROVE** |
| R15 | upload to external tool | client-confidential or regulated data | **NEVER** |
| R16 | delete file | any file | **APPROVE** |
| R17 | delete file | regulated data received in error, per a client contract | **ALLOW** |
| R18 | state a fact to a client | a figure, date or commitment | **ALLOW** |
| R19 | share unannounced client news | anything a client marked not public, with anyone | **NEVER** |

Owner floors on file: Greenstep Tuition, SGD 6,500.

Approval channel: a queue the owner sees each morning. The agent never nags
more than once per item.

`policy.json` is the same table in a form your oversight agent can load.
