"""AES-256-GCM encryption for LLM provider API keys at rest.

Mirrors backup/.../EncryptionService.java's approach (same algorithm class,
same PBKDF2 iteration count) — a separate secret/salt though, since this
encrypts a different thing (LLM provider keys, not backup archives). No
cross-compatibility with the Java service needed or intended.

Fixed salt is deliberate: every process that needs to encrypt or decrypt
(ai_agent writes on save, host-wrapper reads on startup/reload) must derive
the IDENTICAL key from the SAME passphrase without exchanging key material
directly — both just need AI_SETTINGS_ENCRYPTION_KEY set to the same value.
"""
import os
from typing import Optional

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_SALT = b"CommunicatorLLMSettingsSalt"
_ITERATIONS = 310_000
_KEY_BYTES = 32  # 256 bits
_NONCE_BYTES = 12  # GCM nonce


class EncryptionService:
    """Encrypts/decrypts LLM provider API keys for the llm_provider_keys table.

    Passphrase comes from AI_SETTINGS_ENCRYPTION_KEY — must be set identically
    wherever this runs (ai_agent AND host-wrapper). Blank/missing means
    encryption is disabled: encrypt()/decrypt() raise rather than ever
    silently handling a key in plaintext.
    """

    def __init__(self, passphrase: Optional[str] = None):
        if passphrase is None:
            passphrase = os.environ.get("AI_SETTINGS_ENCRYPTION_KEY", "")
        self._key = self._derive_key(passphrase) if passphrase else None

    @property
    def configured(self) -> bool:
        return self._key is not None

    @staticmethod
    def _derive_key(passphrase: str) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=_KEY_BYTES,
            salt=_SALT,
            iterations=_ITERATIONS,
        )
        return kdf.derive(passphrase.encode("utf-8"))

    def encrypt(self, plaintext: str) -> bytes:
        """Returns [12B nonce][GCM ciphertext + 16B auth tag]."""
        if self._key is None:
            raise RuntimeError("Encryption not configured — set AI_SETTINGS_ENCRYPTION_KEY")
        aesgcm = AESGCM(self._key)
        nonce = os.urandom(_NONCE_BYTES)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return nonce + ciphertext

    def decrypt(self, encrypted: bytes) -> str:
        """Expects the format produced by encrypt()."""
        if self._key is None:
            raise RuntimeError("Encryption not configured — set AI_SETTINGS_ENCRYPTION_KEY")
        aesgcm = AESGCM(self._key)
        nonce, ciphertext = encrypted[:_NONCE_BYTES], encrypted[_NONCE_BYTES:]
        return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
