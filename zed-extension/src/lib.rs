use std::fs;
use zed_extension_api::{self as zed, LanguageServerId, Result};

const REPOSITORY: &str = "grayscale-lang/grayls";
const SERVER_ASSET: &str = "server.js";

struct GrayExtension {
    cached_server_path: Option<String>,
}

impl GrayExtension {
    // Downloads server.js from the latest grayls release on first use, then
    // reuses it for the rest of the session.
    fn server_path(&mut self, language_server_id: &LanguageServerId) -> Result<String> {
        if let Some(path) = &self.cached_server_path {
            if fs::metadata(path).is_ok() {
                return Ok(path.clone());
            }
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );
        let release = zed::latest_github_release(
            REPOSITORY,
            zed::GithubReleaseOptions {
                require_assets: true,
                pre_release: false,
            },
        )?;
        let asset = release
            .assets
            .iter()
            .find(|asset| asset.name == SERVER_ASSET)
            .ok_or_else(|| format!("grayls release {} has no {}", release.version, SERVER_ASSET))?;

        let directory = format!("grayls-{}", release.version);
        let path = format!("{}/{}", directory, SERVER_ASSET);
        if fs::metadata(&path).is_err() {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );
            fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
            zed::download_file(
                &asset.download_url,
                &path,
                zed::DownloadedFileType::Uncompressed,
            )
            .map_err(|error| format!("failed to download {}: {}", SERVER_ASSET, error))?;
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );
        self.cached_server_path = Some(path.clone());
        Ok(path)
    }
}

impl zed::Extension for GrayExtension {
    fn new() -> Self {
        GrayExtension {
            cached_server_path: None,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        let node = worktree
            .which("node")
            .ok_or("grayls needs Node.js (v18 or later) on your PATH")?;
        let server = self.server_path(language_server_id)?;
        let server = std::env::current_dir()
            .map_err(|error| error.to_string())?
            .join(server)
            .to_string_lossy()
            .to_string();

        Ok(zed::Command {
            command: node,
            args: vec![server, "--stdio".to_string()],
            env: worktree.shell_env(),
        })
    }
}

zed::register_extension!(GrayExtension);
