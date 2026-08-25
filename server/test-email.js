import "dotenv/config";
import { verifyEmailConfig, sendTestEmail } from "./email.js";

const result = await verifyEmailConfig();
if (!result.ok) {
  console.error("❌ Email nije spreman:", result.reason);
  console.log("\nGmail App Password koraci:");
  console.log("1. https://myaccount.google.com/apppasswords");
  console.log("2. Kreiraj App Password za 'Mail'");
  console.log("3. U .env stavi: SMTP_PASS=xxxx xxxx xxxx xxxx");
  console.log("4. Pokreni ponovo: npm run test-email\n");
  process.exit(1);
}

console.log("✓ SMTP konekcija OK");
const sent = await sendTestEmail();
if (sent.ok) {
  console.log(`✓ Test email poslan na ${sent.to}`);
} else {
  console.error("❌ Slanje test emaila nije uspjelo:", sent.reason);
  process.exit(1);
}
