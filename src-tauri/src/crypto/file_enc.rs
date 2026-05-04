use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use rand::RngCore;

use crate::crypto::key::DerivedKey;
use crate::error::{AppError, AppResult};

const NONCE_LEN: usize = 12; // 96-bit nonce for AES-256-GCM

/// Encrypts raw bytes with AES-256-GCM using the session key.
/// Output layout: [12-byte nonce][ciphertext+tag].
pub fn encrypt_file(data: &[u8], key: &DerivedKey) -> AppResult<Vec<u8>> {
    let cipher_key = Key::<Aes256Gcm>::from_slice(&key.0);
    let cipher = Aes256Gcm::new(cipher_key);

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, data)
        .map_err(|e| AppError::Other(format!("encrypt: {e}")))?;

    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypts a file previously encrypted with encrypt_file.
pub fn decrypt_file(data: &[u8], key: &DerivedKey) -> AppResult<Vec<u8>> {
    if data.len() < NONCE_LEN {
        return Err(AppError::Other("encrypted file too short".into()));
    }
    let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
    let cipher_key = Key::<Aes256Gcm>::from_slice(&key.0);
    let cipher = Aes256Gcm::new(cipher_key);
    let nonce = Nonce::from_slice(nonce_bytes);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AppError::InvalidPassword)
}
