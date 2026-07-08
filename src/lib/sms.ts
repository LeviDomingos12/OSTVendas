export async function sendSMS(to: string, message: string) {
  console.log(`[SMS Gateway] Sending to ${to}: ${message}`);
  // Emulates an API call to Twilio or a local Mozambican SMS provider
  return new Promise((resolve) => setTimeout(resolve, 500));
}
