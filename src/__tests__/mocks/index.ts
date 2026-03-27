/**
 * Central mock index — re-exports all fixtures used across test suites.
 */

export * from "./mock-claude-responses";

// ---------------------------------------------------------------------------
// User profile fixtures
// ---------------------------------------------------------------------------

export const COMPLETE_PROFILE: Record<string, string> = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "(555) 123-4567",
  dateOfBirth: "1990-06-15",
  "address.street": "123 Main St",
  "address.city": "Springfield",
  "address.state": "IL",
  "address.zip": "62704",
  "address.country": "US",
  employerName: "Acme Corp",
  jobTitle: "Software Engineer",
  annualIncome: "120000",
  // Sensitive fields — should be stripped before sending to Claude
  ssn: "123-45-6789",
  passportNumber: "X12345678",
  driverLicense: "D400-1234-5678",
  bankAccount: "000123456789",
  routingNumber: "021000021",
  creditCard: "4111111111111111",
};

export const MINIMAL_PROFILE: Record<string, string> = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
};

export const EMPTY_PROFILE: Record<string, string> = {};

// ---------------------------------------------------------------------------
// Raw form text fixtures
// ---------------------------------------------------------------------------

export const TAX_FORM_W4_TEXT = `
Form W-4
Employee's Withholding Certificate
Department of the Treasury — Internal Revenue Service

Complete Form W-4 so that your employer can withhold the correct federal income tax from your pay.

Step 1: Enter Personal Information
First name and middle initial _______________
Last name _______________
Social Security Number _______________
Address _______________
City or town, state, and ZIP code _______________
Filing status: [ ] Single or Married filing separately
              [ ] Married filing jointly
              [ ] Head of household

Step 2: Multiple Jobs or Spouse Works
Step 3: Claim Dependents
Step 4: Other Adjustments

Employee's signature _______________  Date _______________
`;

export const IMMIGRATION_FORM_TEXT = `
USCIS Form I-485
Application to Register Permanent Residence or Adjust Status
Department of Homeland Security
U.S. Citizenship and Immigration Services

Part 1. Information About You
Full Legal Name: _______________
Alien Registration Number (A-Number): _______________
Date of Birth: _______________
Country of Birth: _______________
Class of Admission: _______________
Port of Entry: _______________

Part 2. Application Type or Filing Category
I am applying for adjustment of status.

Beneficiary information for green card application.
`;

export const OVERSIZED_TEXT = "x".repeat(60_000);
