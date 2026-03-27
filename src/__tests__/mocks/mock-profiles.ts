/**
 * Mock user profiles for testing stripSensitiveFields and autofillFields.
 */

/** A profile with all fields populated, including sensitive ones. */
export const COMPLETE_PROFILE: Record<string, string> = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
  phone: "(555) 123-4567",
  address: "123 Main St",
  city: "Springfield",
  state: "IL",
  zip: "62701",
  dateOfBirth: "1990-05-15",
  employerName: "Acme Corp",
  employerAddress: "456 Corp Blvd, Springfield, IL 62702",
  ssn: "123-45-6789",
  passportNumber: "X12345678",
  driverLicense: "D400-1234-5678",
  bankAccount: "9876543210",
  routingNumber: "021000021",
  creditCard: "4111111111111111",
};

/** A profile with only basic fields — no sensitive data. */
export const MINIMAL_PROFILE: Record<string, string> = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane.doe@example.com",
};

/** An empty profile. */
export const EMPTY_PROFILE: Record<string, string> = {};
