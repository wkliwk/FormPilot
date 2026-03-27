/**
 * Mock form text content for testing analyzeFormFields.
 */

/** Realistic W-4 form text (abridged). */
export const TAX_FORM_W4_TEXT = `Form W-4
Employee's Withholding Certificate
Department of the Treasury — Internal Revenue Service

Step 1: Enter Personal Information
(a) First name and middle initial: _______________
    Last name: _______________
(b) Social security number: ___-__-____
(c) Address: _______________
    City or town, state, and ZIP code: _______________
(d) Filing status:
    [ ] Single or Married filing separately
    [ ] Married filing jointly
    [ ] Head of household

Step 2: Multiple Jobs or Spouse Works
Complete this step if you (1) hold more than one job at a time, or
(2) are married filing jointly and your spouse also works.

Step 3: Claim Dependents
If your total income will be $200,000 or less ($400,000 or less if married filing jointly):
Multiply the number of qualifying children under age 17 by $2,000: $______
Multiply the number of other dependents by $500: $______

Step 4 (optional): Other Adjustments
(a) Other income (not from jobs): $______
(b) Deductions: $______
(c) Extra withholding: $______

Step 5: Sign Here
Employee's signature: _______________  Date: ___/___/______`;

/** Text longer than the 50,000 char truncation limit. */
export const OVERSIZED_TEXT = "A".repeat(60_000);

/** An immigration form sample. */
export const IMMIGRATION_FORM_TEXT = `Form I-130
Petition for Alien Relative
Department of Homeland Security — U.S. Citizenship and Immigration Services

Part 1. Relationship
I am filing this petition for my:
[ ] Spouse  [ ] Parent  [ ] Brother/Sister  [ ] Child

Part 2. Information About You (Petitioner)
1. Full legal name:
   Family Name (Last Name): _______________
   Given Name (First Name): _______________
   Middle Name: _______________
2. Address: _______________
3. Date of Birth (mm/dd/yyyy): ___/___/______
4. Place of Birth (City/Town, State, Country): _______________
5. A-Number (if any): A_______________
6. U.S. Social Security Number: ___-__-____

Part 3. Information About Your Relative (Beneficiary)
1. Full legal name:
   Family Name (Last Name): _______________
   Given Name (First Name): _______________
2. Date of Birth (mm/dd/yyyy): ___/___/______
3. Country of Birth: _______________
4. Country of Citizenship: _______________`;
