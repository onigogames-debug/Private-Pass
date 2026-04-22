/**
 * crypto.js
 * Handles Web Crypto API operations for securing the vault locally.
 * Uses PBKDF2 for key derivation from Master Password.
 * Uses AES-GCM for symmetric encryption/decryption of the vault.
 */

// Constants
const SALT_KEY = 'pp_vault_salt';
const ITERATIONS = 100000;
const HASH_ALG = 'SHA-256';
const ENC_ALG = 'AES-GCM';

// Generate or retrieve the salt for this device
function getSalt() {
  let saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    // Convert to base64 for storage
    saltStr = arrayBufferToBase64(salt);
    localStorage.setItem(SALT_KEY, saltStr);
    return salt;
  }
  return base64ToArrayBuffer(saltStr);
}

// Derive an AES-GCM key from the Master Password
async function deriveKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const salt = getSalt();

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: ITERATIONS,
      hash: HASH_ALG
    },
    keyMaterial,
    { name: ENC_ALG, length: 256 },
    false, // Master key is not extractable
    ['encrypt', 'decrypt']
  );
}

async function encryptData(key, dataObj) {
  const enc = new TextEncoder();
  const encodedText = enc.encode(JSON.stringify(dataObj));
  
  // Create an Initialization Vector
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encryptedBuf = await window.crypto.subtle.encrypt(
    {
      name: ENC_ALG,
      iv: iv
    },
    key,
    encodedText
  );

  // Combine IV and Encrypted Data to store them together
  const encryptedArray = new Uint8Array(encryptedBuf);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);

  return arrayBufferToBase64(combined);
}

async function decryptData(key, encryptedBase64) {
  try {
    const combined = base64ToArrayBuffer(encryptedBase64);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decryptedBuf = await window.crypto.subtle.decrypt(
      {
        name: ENC_ALG,
        iv: iv
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuf));
  } catch (e) {
    throw new Error('Decryption failed. Incorrect password or corrupted data.');
  }
}

// Check if a vault already exists
function hasVault() {
  return localStorage.getItem('pp_vault_data') !== null;
}

// Utility: ArrayBuffer <-> Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

window.VaultCrypto = {
  deriveKey,
  encryptData,
  decryptData,
  hasVault
};
