use std::env;

const DEFAULT_PUBLIC_ORIGIN: &str = "https://api.exalto.ai";
const DEVELOPMENT_BUILD_ID: &str = "dev";

fn main() {
    for (name, fallback) in [
        ("NOTARY_PUBLIC_ORIGIN", DEFAULT_PUBLIC_ORIGIN),
        ("NOTARY_CAPTURE_ORIGIN", "https://capture.exalto.ai"),
        (
            "NOTARY_DOWNLOAD_ORIGIN",
            "https://notary-prod-downloads.t3.tigrisfiles.io",
        ),
    ] {
        println!("cargo:rerun-if-env-changed={name}");
        let origin = env::var(name).unwrap_or_else(|_| fallback.to_owned());
        let origin = origin.trim_end_matches('/');
        let authority = origin
            .strip_prefix("https://")
            .or_else(|| origin.strip_prefix("http://"));
        assert!(
            authority.is_some_and(
                |value| !value.is_empty() && !value.contains(['/', '?', '#', '@', '\n', '\r'])
            ),
            "{name} must be an HTTP(S) origin"
        );
        println!("cargo:rustc-env={name}={origin}");
    }
    println!("cargo:rerun-if-env-changed=NOTARY_BUILD_ID");
    println!("cargo:rerun-if-env-changed=NOTARY_UPDATES_ENABLED");
    let build_id = env::var("NOTARY_BUILD_ID").unwrap_or_else(|_| DEVELOPMENT_BUILD_ID.to_owned());
    assert!(
        valid_release_identifier(&build_id),
        "NOTARY_BUILD_ID must be a safe non-empty release identifier"
    );
    println!("cargo:rustc-env=NOTARY_BUILD_ID={build_id}");

    let updates_enabled = env::var("NOTARY_UPDATES_ENABLED").unwrap_or_else(|_| "0".into());
    assert!(
        matches!(updates_enabled.as_str(), "0" | "1"),
        "NOTARY_UPDATES_ENABLED must be 0 or 1"
    );
    println!("cargo:rustc-env=NOTARY_UPDATES_ENABLED={updates_enabled}");
}

fn valid_release_identifier(value: &str) -> bool {
    !value.is_empty()
        && !value.starts_with('.')
        && !value.contains("..")
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}
