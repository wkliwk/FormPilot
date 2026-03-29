/** Today's date formatted as MM/DD/YYYY */
function todayFormatted(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/**
 * Generate a realistic sample value for a form field based on its label and type.
 * Pure function — no API calls, no DB access. Safe to call client-side.
 */
export function generateSampleValue(field: { label: string; type: string }): string {
  const label = field.label.toLowerCase();

  // Name
  if (label.includes("first name") || label === "first") return "Alex";
  if (label.includes("last name") || label.includes("surname") || label === "last") return "Johnson";
  if (label.includes("middle name") || label.includes("middle initial")) return "M";
  if (
    label.includes("full name") || label.includes("your name") ||
    label === "name" || label.includes("applicant name") || label.includes("patient name")
  ) return "Alex Johnson";

  // Government IDs
  if (label.includes("social security") || label.includes("ssn") || label.includes("tax id")) return "123-45-6789";
  if (label.includes("passport")) return "A12345678";
  if (label.includes("driver") && label.includes("license")) return "D1234567";

  // Dates
  if (label.includes("date of birth") || label.includes("dob") || label.includes("birthday") || label.includes("birth date")) return "01/15/1985";
  if (field.type === "date" || label.includes("date")) return todayFormatted();

  // Address
  if (label.includes("street") || (label.includes("address") && !label.includes("email"))) return "456 Oak Avenue";
  if (label.includes("apt") || label.includes("suite") || label.includes("unit") || label === "address line 2") return "Apt 2B";
  if (label.includes("city")) return "Springfield";
  if (label === "state" || label.includes("state")) return "IL";
  if (label.includes("zip") || label.includes("postal") || label.includes("post code")) return "62701";
  if (label.includes("country")) return "United States";

  // Contact
  if (label.includes("email")) return "alex.johnson@example.com";
  if (label.includes("phone") || label.includes("telephone") || label.includes("mobile") || label.includes("cell")) return "(555) 867-5309";
  if (label.includes("fax")) return "(555) 867-5310";

  // Employment
  if (label.includes("employer") || label.includes("company") || label.includes("organization") || label.includes("business")) return "Acme Corp";
  if (label.includes("job title") || label.includes("position") || label.includes("occupation")) return "Software Engineer";
  if (label.includes("salary") || label.includes("income") || label.includes("annual") || label.includes("wage")) return "75000";
  if (label.includes("department")) return "Engineering";
  if (label.includes("start date") || label.includes("hire date")) return "03/01/2020";

  // Financial
  if (label.includes("amount") || label.includes("total") || label.includes("balance")) return "0.00";
  if (label.includes("account number")) return "0001234567";
  if (label.includes("routing")) return "021000021";

  // Personal
  if (field.type === "checkbox") return "Unchecked";
  if (label.includes("signature")) return "Alex Johnson";
  if (label.includes("initials")) return "AJ";
  if (label.includes("gender") || label.includes("sex")) return "Male";
  if (label.includes("age")) return "39";
  if (label.includes("nationality") || label.includes("citizenship")) return "United States";
  if (label.includes("marital") || label.includes("status")) return "Single";
  if (label.includes("relationship")) return "Self";
  if (label.includes("description") || label.includes("notes") || label.includes("comments")) return "N/A";

  return "Sample";
}
