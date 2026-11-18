# Hashmeta site: fix round 1

Replace CONTACT_EMAIL below with the address you want on the site, then paste everything inside the fence into QwenWork.

```
Using the hashmeta connector, make all of these edits to the Clean Sheet site in one dev task, then show me the changed text. Do not deploy.

The site's examples must match how the Keeper really decides. The real rules are:
- A quote below the owner's floor: BLOCK. A quote below the price list or any discount: HOLD.
- A payment over SGD 1,000, or with no matching invoice: HOLD. A payment under SGD 1,000 for an invoice already received: ALLOW.
- An email to someone not on the client or supplier list: HOLD. An email carrying client-confidential data: HOLD.
- Client contact data uploaded to an outside tool: BLOCK.
- A figure sent to a client that does not match the contract or records: BLOCK.
- An address or instruction that only came from an untrusted or lookalike email: BLOCK.
- One client's confidential file sent to a different client: BLOCK.
- There is no rule about supplier bank details or an approved supplier list. Remove every mention of both.

HOME
1. Keeper card rows:
   - ALLOW: "Sent the March invoice to Amira at Northlight." / "Recipient matches the client on the job."
   - HOLD: "Payment of SGD 2,300 to Harbour Print for invoice INV-0412." / "Over SGD 1,000. Waiting for you."
   - BLOCK: "Quote for the Tan project: SGD 1,150." / "Below your floor of SGD 1,400. Never sent."
2. Problem card 3: title "The request isn't real." Body: "An email that looks like your supplier asks your agent to pay a new account. Your agent pays it. The money is gone."
3. Four moments intro: "Four things the Keeper catches. Here is what each one looks like."
4. Moment 1, "A rogue agent caught.": body "An agent tries to upload your full client list to an outside mailing tool." BLOCK, reason "Client contact details never go to outside tools."
5. Moment 2, retitle "A fake request stopped.": body "An email that looks like your client asks your agent to send all invoices and bank details to a new address. The Keeper stops it." BLOCK, reason "That address only appeared in a suspicious email."
6. Moment 3, "A made-up number flagged.": body "An agent defends an invoice to a client with a figure that does not match your contract. The Keeper stops the email and names the number." BLOCK, reason "That figure does not match your contract."
7. Proof stat label: change "test actions caught" to "on AvePoint's test set".

HOW IT WORKS
8. "Rules sound like this" card: replace "Pay only suppliers on my approved list." with "Ask me before any payment over SGD 1,000."
9. ALLOW example: "Allow — quote sent to Amira at Northlight." SGD 2,400 is above your floor of SGD 1,800, and Northlight is the client this quote belongs to.
10. HOLD example: "Hold — payment of SGD 4,800 to Northline Trading." It is over SGD 1,000, so the payment is waiting for your yes.
11. BLOCK example: "Block — client file addressed to the wrong client." The attached file belongs to Northlight, and this email is going to a different client.
12. Briefing sample, Hold line: "1 payment of SGD 4,800. Over SGD 1,000. Waiting for your yes."
13. Replace "The agent cannot send it again by another route." (everywhere it appears) with "If the agent tries again, the Keeper checks it again."
14. FAQ "Can a blocked action slip out another way?": answer "Not through Clean Sheet. Every action your agents take through Clean Sheet is checked, including retries. Connect your agents only through Clean Sheet and nothing leaves unchecked."
15. Form placeholder "Mei Tan": change to "Your name".

TRUST
16. Example record 1: "02:14:07 · Payments agent — Tried to: Pay Harbour Print SGD 4,800 for invoice INV-2291 — Decision: HOLD — Reason: Over SGD 1,000. — Rule: Payments over SGD 1,000 need your approval. — Status: Not paid. Awaiting you."
17. Example rule 2: replace the bank-details rule with
    IF email_recipient ONLY_SEEN_IN untrusted_email
    THEN BLOCK
    SAY "That address only appeared in a suspicious email."
    And the Hold decision example: "Payment over SGD 1,000. Approve before we pay."
18. Tamper paragraph: replace "That includes us. If anyone alters a record — an agent, a person, or Clean Sheet itself — the check fails and you can see it." with "Keep your own copy of the log, and even a change made by us would show when you run the check." Apply the same idea to the FAQ "Could a record be changed later": "Not without it showing, as long as you keep your own copy to check against."
19. "Clean Sheet is a Singapore company" → "Clean Sheet is built in Singapore".
20. Remove "That includes us" style claims anywhere else.

FORMS
21. Use the one approved "Join the waitlist" form (ID 1795021215882005: name, email, company, agent count, approved thank-you message) on Home, How It Works, Pricing and Trust. Remove the three generated forms so every sign-up lands in one list.

LEGAL
22. Privacy Policy: rewrite for this site. Say what the waitlist collects (name, email, company name, number of AI agents), that it is used only to contact people about Clean Sheet early access, that it is handled under Singapore's Personal Data Protection Act 2012, that people can ask to access, correct or withdraw consent by emailing CONTACT_EMAIL, and that data is deleted when early access opens or on request. Remove phone number and anything not collected.
23. Terms: governing law Singapore. Contact: CONTACT_EMAIL. Same contact email in the Privacy Policy and footer.

Keep everything else, including the faint pitch lines in the Home hero.
```
