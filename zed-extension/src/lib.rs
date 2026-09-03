use zed_extension_api::{self as zed, LanguageServerId, Result};

struct GrayExtension;

impl zed::Extension for GrayExtension {
    fn new() -> Self {
        GrayExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        // Extensions run in a WASI sandbox with no host environment, so
        // `std::env::var` never sees `HOME`. Read it from the worktree's shell
        // environment instead.
        let env = worktree.shell_env();
        let home = env
            .iter()
            .find(|(key, _)| key == "HOME")
            .map(|(_, value)| value.clone())
            .ok_or("HOME env var not set")?;

        // Prefer node from the worktree's `$PATH`. Fall back to the NVM default
        // alias, then Homebrew.
        let node = worktree.which("node").unwrap_or_else(|| {
            std::fs::read_to_string(format!("{}/.nvm/alias/default", home))
                .map(|v| format!("{}/.nvm/versions/node/{}/bin/node", home, v.trim()))
                .unwrap_or_else(|_| "/usr/local/bin/node".to_string())
        });

        let server = format!("{}/code/grayls/out/server.js", home);

        Ok(zed::Command {
            command: node,
            args: vec![server, "--stdio".to_string()],
            env,
        })
    }
}

zed::register_extension!(GrayExtension);
