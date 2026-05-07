use rand::RngCore;
use ring::pbkdf2;
use std::num::NonZeroU32;
use zeroize::Zeroize;

pub const KEY_LEN: usize = 32;
pub const SALT_LEN: usize = 32;
const PBKDF2_ITERATIONS: u32 = 600_000;

#[derive(Clone)]
pub struct DerivedKey(pub [u8; KEY_LEN]);

impl Drop for DerivedKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}

pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

pub fn derive_key(password: &str, salt: &[u8]) -> DerivedKey {
    let iters = NonZeroU32::new(PBKDF2_ITERATIONS).expect("PBKDF2 iterations must be non-zero");
    let mut out = [0u8; KEY_LEN];
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iters,
        salt,
        password.as_bytes(),
        &mut out,
    );
    DerivedKey(out)
}
