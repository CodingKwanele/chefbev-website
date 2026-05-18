export function cleanText(value, max = 120) {
  return String(value || "").trim().substring(0, max);
}

export function optionalText(value, max = 120) {
  const cleaned = cleanText(value, max);
  return cleaned || undefined;
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

export function isPhone(value) {
  return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(
    String(value || "")
  );
}

export function assertValidUrl(value, fieldName = "URL") {
  if (!value) return;

  try {
    new URL(value);
  } catch {
    throw new Error(`${fieldName} is not a valid URL`);
  }
}

export function assertMin(value, min, message) {
  if (String(value || "").trim().length < min) {
    throw new Error(message);
  }
}

export function assertOneOf(value, allowed, message) {
  if (!allowed.includes(value)) {
    throw new Error(message);
  }
}

export function removeUndefined(data) {
  return Object.fromEntries(
    Object.entries(data).filter((entry) => entry[1] !== undefined)
  );
}
