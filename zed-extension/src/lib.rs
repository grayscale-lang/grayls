use zed_extension_api::{self as zed, LanguageServerId, Result};

struct EzExtension;

impl zed::Extension for EzExtension {
    fn new() -> Self {
        EzExtension
    }

    fn language_server_command(
        &mut self,
        _language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let home = std::env::var("HOME").map_err(|_| "HOME env var not set")?;

        // Find node: read the NVM default alias file to get the active version,
        // then build an absolute path. Falls back to /usr/local/bin/node (Homebrew).
        let node = std::fs::read_to_string(format!("{}/.nvm/alias/default", home))
            .map(|v| format!("{}/.nvm/versions/node/{}/bin/node", home, v.trim()))
            .unwrap_or_else(|_| "/usr/local/bin/node".to_string());

        let server = format!("{}/code/EZLS/out/server.js", home);

        Ok(zed::Command {
            command: node,
            args: vec![server, "--stdio".to_string()],
            env: Default::default(),
        })
    }
}

zed::register_extension!(EzExtension);
