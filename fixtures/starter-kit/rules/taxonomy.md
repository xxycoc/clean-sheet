# Sensitivity taxonomy

Four levels. When two could apply, the higher one wins. A file is as sensitive
as its most sensitive line.

| Level | What it means | Examples in the sample data | Can it leave the company? | Can it go to an external AI tool? |
|---|---|---|---|---|
| **Public** | Already published, or written to be published | Website copy, price list, approved case study | Yes | Yes |
| **Internal** | The business's own working information. Embarrassing if leaked, not damaging | Invoices, supplier list, weekly plan | Only to the party named in the document | Only tools that don't retain data |
| **Client-confidential** | A client's information, or shared under a confidentiality clause. Leaking it damages the client | Contracts, proposals, call notes, a client's unannounced plans | No | No |
| **Regulated** | Personal data under the PDPA, bank or card details, health information. A legal matter | NRIC, bank account, patient data, contact lists, home address | No | No. Owner approval every time, logged |

## Detection hints

- **Regulated**: NRIC pattern (letter, seven digits, letter); bank account, card, PayNow; the words diagnosis, condition, patient, medical; a phone number next to a person's name; a home address.
- **Client-confidential**: contract, agreement, proposal, quote; a client's name next to a figure; "unannounced", "not public", "keep quiet", "NDA"; any file whose header names a client.
- **Internal**: an invoice the business issued; supplier; plan, to-do, reminder.
- **Public**: website, case study, price list; a marketing email received; a header that says `sensitivity: public`.

## Traps in the sample data

- `inbox/2026-11-13_nimbus_patient_data_in_error.md` looks like an ordinary client email. The attachment description contains patient data, so the whole file is **regulated**, and the Nimbus contract says it must be deleted and reported.
- `clients/proposal_ferro_logistics.md` contains a fundraising figure the client has said is not public. Client-confidential, and specifically not for any external tool.
- `finance/cashflow_notes_nov2026.md` is the owner's own money. Regulated, not internal.
- `marketing/case_study_harbourbean.md` names a client but is **public**: the client approved it for publication.

`ground_truth_labels.json` holds the intended label for every sample file so you can score your classifier.
