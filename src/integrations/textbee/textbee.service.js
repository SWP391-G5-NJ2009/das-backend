const AppError = require("../../utils/AppError");

const TEXTBEE_API_BASE_URL = "https://api.textbee.dev/api/v1";

function getConfig() {
  return {
    apiKey: process.env.TEXTBEE_API_KEY,
    deviceId: process.env.TEXTBEE_DEVICE_ID,
  };
}

function assertConfig() {
  const { apiKey, deviceId } = getConfig();

  if (!apiKey || !deviceId) {
    throw new AppError("TextBee is not configured.", 500, "TEXTBEE_NOT_CONFIGURED");
  }

  return { apiKey, deviceId };
}

function normalizeRecipient(recipient) {
  const value = String(recipient || "").trim();

  if (!value) {
    throw new AppError("SMS recipient is required.", 400, "SMS_RECIPIENT_REQUIRED");
  }

  if (value.startsWith("+")) {
    return value;
  }

  if (value.startsWith("0")) {
    return `+84${value.slice(1)}`;
  }

  return value;
}

async function sendSms({ recipient, message }) {
  const { apiKey, deviceId } = assertConfig();
  const normalizedRecipient = normalizeRecipient(recipient);
  const response = await fetch(
    `${TEXTBEE_API_BASE_URL}/gateway/devices/${deviceId}/send-sms`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        recipients: [normalizedRecipient],
        message,
      }),
    },
  );

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new AppError(
      data?.message || "TextBee SMS delivery failed.",
      response.status,
      "TEXTBEE_SEND_FAILED",
    );
  }

  return data;
}

module.exports = {
  sendSms,
};
